import { guard, getConfig, sql, isAdmin, norm } from './_lib.js';

const money = v => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e11 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? Math.round(n * 100) / 100 : null;
};

export default guard(async (req, res) => {
  if (req.method === 'GET') {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin login required.' });
    const rows = await sql`SELECT id, info_name, site_location, to_char(report_date,'YYYY-MM-DD') AS report_date,
      total_patients, cash_amount::float8 AS cash_amount, gcash_amount::float8 AS gcash_amount,
      gross_amount::float8 AS gross_amount, total_expense::float8 AS total_expense,
      net_amount::float8 AS net_amount, submitted_at
      FROM reports ORDER BY report_date DESC, submitted_at DESC`;
    return res.json(rows);
  }
  if (req.method === 'POST') {
    const b = req.body || {};
    const cfg = await getConfig();
    const agent = cfg.agents.find(a => a.active && a.name === String(b.info_name || '').trim());
    const site = cfg.sites.find(s => s.active && s.name === String(b.site_location || '').trim());
    if (!agent) return res.status(400).json({ error: 'Agent is not on the approved list.' });
    if (!site) return res.status(400).json({ error: 'Site is not active.' });
    const date = String(b.report_date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return res.status(400).json({ error: 'Invalid report date.' });
    const patients = Number(b.total_patients);
    const cash = money(b.cash_amount), gcash = money(b.gcash_amount), expense = money(b.total_expense);
    if (!Number.isInteger(patients) || patients < 0 || patients > 1e7 || cash === null || gcash === null || expense === null)
      return res.status(400).json({ error: 'All fields are required and must be valid numbers.' });
    const key = `${date}|${norm(agent.name)}|${norm(site.name)}`;
    try {
      await sql`INSERT INTO reports (info_name, site_location, report_date, total_patients, cash_amount, gcash_amount, total_expense, dup_key)
        VALUES (${agent.name}, ${site.name}, ${date}, ${patients}, ${cash}, ${gcash}, ${expense}, ${key})`;
    } catch (e) {
      if (e && e.code === '23505') return res.status(409).json({ error: 'Duplicate record already exist' });
      throw e;
    }
    return res.status(201).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
});
