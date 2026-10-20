import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedTemporaryDurations = new Set([1, 6, 12, 24, 72, 168, 720]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function removeInBatches(paths: string[]) {
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await serviceClient.storage.from("report-evidence").remove(paths.slice(index, index + 100));
    if (error) throw new Error("Could not clean up report evidence during permanent deletion");
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user: actor }, error: authError } = await userClient.auth.getUser();
    if (authError || !actor) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: actorRoles, error: rolesError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", actor.id);
    if (rolesError || !actorRoles?.some(role => role.role === "admin")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const userId = body?.userId;
    const action = body?.action;
    if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) {
      return jsonResponse({ error: "A valid citizen userId is required" }, 400);
    }

    const { data: targetRoles, error: targetRoleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (targetRoleError) throw new Error("Could not verify target account role");
    if (targetRoles?.some(role => role.role === "admin")) {
      return jsonResponse({ error: "Admin accounts cannot be managed here" }, 400);
    }
    // Ensure citizen role exists in user_roles if missing
    if (!targetRoles?.some(role => role.role === "citizen")) {
      await serviceClient.from("user_roles").upsert(
        { user_id: userId, role: "citizen" },
        { onConflict: "user_id, role" }
      );
    }

    if (action === "delete") {
      const { data: reports } = await serviceClient
        .from("crime_reports")
        .select("media_paths")
        .eq("user_id", userId);

      let avatarPaths: string[] = [];
      try {
        const { data: avatarFiles, error: avatarError } = await serviceClient.storage.from("avatars").list(userId, { limit: 1000 });
        if (!avatarError && avatarFiles) {
          avatarPaths = avatarFiles.filter(file => file?.name && file?.id).map(file => `${userId}/${file.name}`);
        }
      } catch {
        // Storage bucket avatars may be empty or missing
      }

      const evidencePaths = (reports || []).flatMap(report => report.media_paths || [])
        .filter(path => typeof path === "string" && path.startsWith(`${userId}/`));

      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId, false);
      if (deleteError) throw new Error(deleteError.message);

      const cleanupWarnings: string[] = [];
      try {
        await removeInBatches(evidencePaths);
      } catch (error) {
        cleanupWarnings.push(error instanceof Error ? error.message : "Evidence cleanup failed");
      }
      if (avatarPaths.length) {
        try {
          const { error } = await serviceClient.storage.from("avatars").remove(avatarPaths);
          if (error) cleanupWarnings.push("Avatar cleanup failed");
        } catch {
          cleanupWarnings.push("Avatar storage removal skipped");
        }
      }
      const { error: chatError } = await serviceClient.from("chat_messages").delete().eq("user_id", userId);
      if (chatError) cleanupWarnings.push("Chat history cleanup failed");

      return jsonResponse({ status: "deleted", cleanupWarnings });
    }

    let status: "active" | "temporarily_blocked" | "blacklisted";
    let blockedUntil: string | null = null;
    let banDuration: string;

    if (action === "whitelist") {
      status = "active";
      banDuration = "none";
    } else if (action === "blacklist") {
      status = "blacklisted";
      banDuration = "876000h";
    } else if (action === "temporary_block") {
      const hours = body?.durationHours;
      if (!Number.isInteger(hours) || !allowedTemporaryDurations.has(hours)) {
        return jsonResponse({ error: "Choose a supported temporary block duration" }, 400);
      }
      status = "temporarily_blocked";
      blockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      banDuration = `${hours}h`;
    } else {
      return jsonResponse({ error: "Unsupported citizen action" }, 400);
    }

    try {
      const { error: banError } = await serviceClient.auth.admin.updateUserById(userId, { ban_duration: banDuration });
      if (banError) console.warn("Supabase Auth ban_duration update notice:", banError.message);
    } catch (banException) {
      console.warn("Could not update auth ban_duration directly:", banException);
    }

    const { error: statusError } = await serviceClient.from("citizen_access_controls").upsert({
      user_id: userId,
      status,
      blocked_until: blockedUntil,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    });
    if (statusError) throw new Error(statusError.message);

    return jsonResponse({ status, blockedUntil });
  } catch (error) {
    console.error("manage-citizen error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Citizen action failed" }, 500);
  }
});