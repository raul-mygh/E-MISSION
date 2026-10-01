import postgres from 'postgres';
import crypto from 'node:crypto';

const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!rawUrl) throw new Error('DATABASE_URL is not set');
const dbUrl = new URL(rawUrl);
dbUrl.searchParams.delete('supa');
dbUrl.searchParams.delete('sslmode');
// prepare:false is required for Supabase's transaction pooler (port 6543)
export const sql = postgres(dbUrl.toString(), { ssl: 'require', prepare: false, max: 1, idle_timeout: 20 });
export const CURRENCIES = ['PHP','USD','EUR','GBP','JPY','SGD','AUD','CAD','AED','SAR'];
export const DEFAULT_CONFIG = { currency: 'PHP', sites: [], agents: [] };
export const norm = v => String(v).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

let ready = null;
export function init() {
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS reports (
        id bigserial PRIMARY KEY,
        info_name text NOT NULL,
        site_location text NOT NULL,
        report_date date NOT NULL DEFAULT CURRENT_DATE,
        total_patients integer NOT NULL CHECK (total_patients >= 0),
        cash_amount numeric(14,2) NOT NULL CHECK (cash_amount >= 0),
        gcash_amount numeric(14,2) NOT NULL CHECK (gcash_amount >= 0),
        gross_amount numeric(14,2) GENERATED ALWAYS AS (cash_amount + gcash_amount) STORED,
        total_expense numeric(14,2) NOT NULL CHECK (total_expense >= 0),
        net_amount numeric(14,2) GENERATED ALWAYS AS (cash_amount + gcash_amount - total_expense) STORED,
        dup_key text NOT NULL UNIQUE,
        submitted_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value jsonb NOT NULL)`;
      // Supabase exposes public tables through its Data API. Enable RLS with no policies
      // so the public anon key cannot read or write anything; this server connects as the
      // database owner, which bypasses RLS.
      await sql`ALTER TABLE reports ENABLE ROW LEVEL SECURITY`;
      await sql`ALTER TABLE settings ENABLE ROW LEVEL SECURITY`;
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}

export async function getConfig() {
  const r = await sql`SELECT value FROM settings WHERE key = 'config'`;
  return r.length ? { ...DEFAULT_CONFIG, ...r[0].value } : { ...DEFAULT_CONFIG };
}

const secret = () => {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
  return process.env.SESSION_SECRET;
};
const sign = v => crypto.createHmac('sha256', secret()).update(v).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const sha = s => crypto.createHash('sha256').update(String(s)).digest();

export function passwordOk(p) {
  if (!process.env.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD is not set');
  return crypto.timingSafeEqual(sha(p || ''), sha(process.env.ADMIN_PASSWORD));
}
export function sessionCookie() {
  const exp = String(Date.now() + 12 * 3600 * 1000);
  return `session=${exp}.${sign(exp)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`;
}
export const clearCookie = () => 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
export function isAdmin(req) {
  const m = (req.headers.cookie || '').match(/(?:^|; )session=(\d+)\.([a-f0-9]+)/);
  return !!m && +m[1] > Date.now() && safeEq(m[2], sign(m[1]));
}
export function guard(handler) {
  return async (req, res) => {
    try { await init(); return await handler(req, res); }
    catch (e) { console.error(e); return res.status(500).json({ error: 'Server error. Check your environment variables and database.' }); }
  };
}
