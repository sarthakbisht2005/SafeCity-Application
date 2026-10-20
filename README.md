# MySafeCity

MySafeCity is a React/Vite application backed by Supabase. The browser app needs a Supabase project to support authentication, reports, SOS alerts, notifications, and maps.

## Prerequisites

- Node.js 20 or newer and npm
- A Supabase project with the migrations in this repository applied
- For browser tests, install Playwright's Chromium browser with `npx playwright install chromium`

## Run on Windows

From the repository folder in PowerShell:

```powershell
npm ci
Copy-Item .env.example .env
```

Edit `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase project API settings. The publishable/anon key is intended for browser use; never put a service-role key, Twilio secret, or AI provider key in a `VITE_` variable.

Start the development server:

```powershell
npm run dev
```

Open <http://localhost:8080>.

## Supabase setup

The complete database schema, Row-Level Security policies, storage setup, and realtime configuration are consolidated into a single clean file: `supabase/schema.sql`.

### Applying the Schema:

**Option 1 — Supabase Dashboard (Recommended)**:
1. Open your project on the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor**.
3. Open or paste the contents of `supabase/schema.sql`.
4. Click **Run**.

**Option 2 — Supabase CLI**:
```powershell
supabase login
supabase link --project-ref your-project-ref
supabase db query --file supabase/schema.sql
```

Review pending migrations and confirm the target project before pushing. Create an admin role using a trusted administrative process; never grant roles from browser code. Add emergency-service records only from a verified source.

Email/password, phone OTP, and Google sign-in use Supabase Auth. In Authentication settings:

- Enable Phone and configure an SMS provider. Phone sign-up collects a name; phone login only works for existing accounts.
- Make sure new user sign-ups are allowed. If Supabase returns `Signups not allowed for otp`, enable the Phone provider and review the project's signup restrictions; this rejection comes from Auth before the app can create a profile.
- Enable Google and configure the Google client ID/secret. Add `http://localhost:8080` and the production app origin to allowed redirect URLs, and set `https://your-project-ref.supabase.co/auth/v1/callback` as the authorized callback URL in Google Cloud.
- Configure email confirmation and redirect settings for local and deployed app URLs.

The public heatmap shows coarse, aggregated cells for non-rejected reports, including pending submissions. Pending reports are unverified and should be treated as community reports, not confirmed incidents; reporter names, descriptions, and exact locations are not included in the public map response.

Crime reports accept up to five evidence files per report (JPG, PNG, WebP, GIF, or PDF; 10 MB per file). Evidence is stored in a private bucket and visible only to the report owner and admins. The Admin Dashboard Users tab supports editing citizen names and phone numbers, temporary blocks, reversible blacklists, and confirmed permanent deletion; it does not allow admin-role changes or credential edits. Apply the evidence, admin-profile, and citizen-access migrations before using these features on a hosted project.

Phone OTP is sent by Supabase Auth; it does not use the legacy `send-otp` Edge Function. Before dropping its old database tables from a hosted project, delete any previously deployed function and then apply migrations:

```powershell
supabase functions delete send-otp --project-ref your-project-ref
supabase db push
```

AI chat and report authenticity scoring remain optional Edge Functions and require AI credentials. Keep service-role and provider secrets in Supabase function secrets, never in `.env` or client-side code. Deploy these functions only after reviewing their auth settings.

After changing their source, deploy the authenticated AI functions and set their provider secrets through the Supabase CLI or dashboard:

```powershell
supabase functions deploy ai-chat --project-ref your-project-ref
supabase functions deploy detect-fake-report --project-ref your-project-ref
supabase functions deploy manage-citizen --project-ref your-project-ref
```

Both `ai-chat` and `detect-fake-report` call Gemini 3.8 Flash and use the `GEMINI_API_KEY` Edge Function secret. Enter the key directly in your terminal (do not paste it into chat or put it in `.env`), then deploy both functions:

```powershell
supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY --project-ref your-project-ref
supabase functions deploy ai-chat --project-ref your-project-ref
supabase functions deploy detect-fake-report --project-ref your-project-ref
```

If the browser reports that it failed to send a request to the Edge Function or the function returns 404, verify `ai-chat` is deployed to the same project as `VITE_SUPABASE_URL`. A 502 response means the function reached Gemini but the provider request failed; check the secret, Gemini API project, and quota.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The Playwright smoke test starts Vite on port 8080 and checks that the home page renders. Keep a valid local `.env` in place when running it.
