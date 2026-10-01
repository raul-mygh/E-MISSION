# Mission E-Reporting (Vercel)

Public agent form at `/` (no sign-in) and a password-protected admin at `/admin`.
Stack: static pages + Vercel Functions (`/api`) + Supabase Postgres.

## Deploy
1. Push the contents of this folder to a GitHub repo.
2. Create a Supabase project (supabase.com). Save the database password you choose.
3. In Supabase, click **Connect**, open the **Transaction pooler** (port 6543) connection string, and copy it. Replace `[YOUR-PASSWORD]` with your database password.
4. In Vercel: Add New > Project, import the repo. Before deploying, open Environment Variables and add:
   - `DATABASE_URL`: the Supabase transaction pooler string from step 3
   - `ADMIN_PASSWORD`: the admin login password
   - `SESSION_SECRET`: a long random string (for example `openssl rand -hex 32`)
5. Deploy. The tables are created automatically on the first request, with Row Level Security turned on.
6. Open `/admin`, log in, go to Settings, add your sites and approved agents, then share the agent link or QR code.

Tip: if you use Supabase's Vercel integration instead, it sets `POSTGRES_URL`, which this app also accepts.

## Notes
- Agents never log in. Only active, approved agents and sites are accepted (checked on the server).
- Supabase's public Data API is locked out of these tables (RLS on, no policies); only this app's server can read or write them.
- Duplicates (same date + agent + site) are blocked by a database unique constraint.
- Gross (cash + GCash) and net (gross - expense) are computed by the database.
- Currency changes the display only; stored amounts are not converted.
- The form is public, so anyone with the link can submit under an approved agent name. Add an agent PIN if that matters.
