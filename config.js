import { guard, getConfig, sql, isAdmin, norm, CURRENCIES } from './_lib.js';

function clean(list, label) {
  if (!Array.isArray(list) || list.length > 500) throw new Error(`Invalid ${label} list.`);
  const seen = new Set();
  return list.map(x => {
    const name = String((x && x.name) || '').trim().slice(0, 120);
    if (!name) throw new Error(`${label} names cannot be empty.`);
    if (seen.has(norm(name))) throw new Error(`Duplicate ${label} name: ${name}`);
    seen.add(norm(name));
    return { id: String((x && x.id) || Math.random().toString(36).slice(2, 10)).slice(0, 40), name, active: !!(x && x.active) };
  });
}

export default guard(async (req, res) => {
  if (req.method === 'GET') {
    const cfg = await getConfig();
    if (req.query.full && isAdmin(req)) return res.json(cfg);
    return res.json({
      currency: cfg.currency,
      sites: cfg.sites.filter(s => s.active).map(s => s.name),
      agents: cfg.agents.filter(a => a.active).map(a => a.name)
    });
  }
  if (req.method === 'PUT') {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin login required.' });
    const b = req.body || {};
    if (!CURRENCIES.includes(b.currency)) return res.status(400).json({ error: 'Unsupported currency.' });
    let cfg;
    try { cfg = { currency: b.currency, sites: clean(b.sites, 'Site'), agents: clean(b.agents, 'Agent') }; }
    catch (e) { return res.status(400).json({ error: e.message }); }
    await sql`INSERT INTO settings (key, value) VALUES ('config', ${sql.json(cfg)})
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    return res.json(cfg);
  }
  return res.status(405).json({ error: 'Method not allowed' });
});
