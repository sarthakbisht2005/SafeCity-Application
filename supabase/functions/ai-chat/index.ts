import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are SafeCity AI Safety Advisor, a calm, concise emergency assistant for citizens.

Your job: give short, step-by-step safety guidance during panic, danger, or unsafe situations, AND answer general safety / city-navigation / reporting questions.

RESPONSE STYLE:
- Calm, clear, reassuring, action-first.
- Use **markdown**: short bold headings, bullet lists, numbered steps. Keep under ~150 words.
- Lead with the single most important next action.
- When relevant, reference the user's CONTEXT (location, nearby services, nearby crimes) by name and distance.
- Use emojis sparingly for status (🚨 danger, ✅ safe, 📞 call, 📍 location).

SAFETY PROTOCOL (when user reports danger or fear):
1. **Get safe** — move to a crowded, well-lit, public place.
2. **Call** — Police 100 · Ambulance 102 · Women Helpline 1091 · Child Helpline 1098 (India).
3. **Trigger SOS** in this app (button below) so admins + your contacts are alerted with your live location.
4. Stay on the line with someone you trust; share live location.

CRIME REPORTING HELP:
- Encourage filing a report in the app with: type, time, exact location (use the map pin), description, and any photos.
- Remind users that false reports waste police time and the system flags suspicious reports automatically.

OUT-OF-SCOPE:
- For non-safety questions, answer briefly (1–2 lines) and redirect to safety topics.
- Never give legal/medical disclaimers. Never invent phone numbers, addresses, or laws.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: access } = await supabase
      .from("citizen_access_controls")
      .select("status, blocked_until")
      .eq("user_id", user.id)
      .maybeSingle();

    if (access && (access.status === "blacklisted" || (access.status === "temporarily_blocked" && (!access.blocked_until || new Date(access.blocked_until).getTime() > Date.now())))) {
      return new Response(JSON.stringify({ error: "Your account is currently restricted. In an emergency, please call 100 directly." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const message: string = body?.message || "";
    const location = body?.location || null;

    if (!message || typeof message !== "string" || message.length > 2000) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (location !== null && (
      typeof location.lat !== "number"
      || typeof location.lng !== "number"
      || !Number.isFinite(location.lat)
      || !Number.isFinite(location.lng)
      || Math.abs(location.lat) > 90
      || Math.abs(location.lng) > 180
    )) {
      return new Response(JSON.stringify({ error: "Invalid location" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context from DB
    let contextStr = "";
    if (location?.lat && location?.lng) {
      contextStr += `User location: lat ${location.lat.toFixed(4)}, lng ${location.lng.toFixed(4)}.\n`;

      interface EmergencyServiceItem {
        name: string;
        type: string;
        phone: string;
        address: string;
        location_lat: number;
        location_lng: number;
      }

      const { data: services } = await supabase
        .from("emergency_services")
        .select("name, type, phone, address, location_lat, location_lng")
        .limit(50);

      if (services?.length) {
        const serviceItems = services as EmergencyServiceItem[];
        const withDist = serviceItems.map((s) => {
          const dx = (s.location_lat - location.lat) * 111;
          const dy = (s.location_lng - location.lng) * 111;
          return { ...s, dist: Math.sqrt(dx * dx + dy * dy) };
        }).sort((a, b) => a.dist - b.dist).slice(0, 3);
        contextStr += "Nearest emergency services:\n";
        withDist.forEach((s) => {
          contextStr += `- ${s.name} (${s.type}) ${s.dist.toFixed(1)}km · ${s.phone}\n`;
        });
      }

      interface CrimeReportItem {
        type: string;
        severity: string;
        location_lat: number;
        location_lng: number;
        created_at: string;
      }

      // Recent crimes within ~2km
      const { data: crimes } = await supabase
        .from("crime_reports")
        .select("type, severity, location_lat, location_lng, created_at")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
        .limit(200);

      if (crimes?.length) {
        const crimeItems = crimes as CrimeReportItem[];
        const nearby = crimeItems.filter((c) => {
          const dx = (c.location_lat - location.lat) * 111;
          const dy = (c.location_lng - location.lng) * 111;
          return Math.sqrt(dx * dx + dy * dy) < 2;
        });
        if (nearby.length) {
          contextStr += `Recent crimes within 2km (last 30d): ${nearby.length}. `;
          const types = [...new Set(nearby.map((c) => c.type))].slice(0, 4).join(", ");
          contextStr += `Types: ${types}.\n`;
        }
      }
    }

    interface ConversationTurn {
      role: "user" | "model";
      parts: [{ text: string }];
    }

    const conversationTurns: ConversationTurn[] = [];
    if (Array.isArray(body?.history)) {
      for (const entry of body.history) {
        if (!entry || typeof entry !== "object") continue;
        const item = entry as { role?: unknown; content?: unknown };
        if (typeof item.content !== "string" || !item.content.trim() || item.content.length > 2000) continue;
        const role: "user" | "model" | null = (item.role === "assistant" || item.role === "model")
          ? "model"
          : item.role === "user"
          ? "user"
          : null;
        if (!role) continue;
        if (conversationTurns.length === 0 && role === "model") continue;

        const prev = conversationTurns[conversationTurns.length - 1];
        if (prev && prev.role === role) {
          prev.parts[0].text += `\n${item.content}`;
        } else {
          conversationTurns.push({ role, parts: [{ text: item.content }] });
        }
      }
    }

    const lastTurn = conversationTurns[conversationTurns.length - 1];
    if (lastTurn && lastTurn.role === "user") {
      lastTurn.parts[0].text += `\n${message}`;
    } else {
      conversationTurns.push({ role: "user", parts: [{ text: message }] });
    }

    const contents = conversationTurns.slice(-8);
    if (contents.length > 0 && contents[0].role !== "user") {
      contents.shift();
    }

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT + (contextStr ? `\n\nCONTEXT:\n${contextStr}` : "") }],
        },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Gemini quota or rate limit reached. Check your Gemini API quota and try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 401 || aiRes.status === 403) {
      console.error("Gemini API rejected the configured key", aiRes.status);
      return new Response(JSON.stringify({ error: "Gemini rejected the configured API key. Check GEMINI_API_KEY and the Gemini API project settings." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 404) {
      console.error("Configured Gemini model was not found or is unavailable", aiRes.status);
      return new Response(JSON.stringify({ error: "Gemini model is unavailable for this API project. Check that gemini-3.8-flash is enabled for the key." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      console.error("Gemini API request failed", aiRes.status);
      return new Response(JSON.stringify({ error: `Gemini service unavailable (HTTP ${aiRes.status}). Check the Edge Function logs.` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const reply: string = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('')
      .trim() || "I couldn't prepare a response. If you are in immediate danger, use the emergency call button.";

    // Persist
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      message,
      response: reply,
      location_lat: location?.lat ?? null,
      location_lng: location?.lng ?? null,
    });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});