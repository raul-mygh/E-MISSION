import { guard, isAdmin, passwordOk, sessionCookie, clearCookie } from './_lib.js';

export default guard(async (req, res) => {
  if (req.method === 'GET') return res.json({ admin: isAdmin(req) });
  if (req.method === 'POST') {
    if (!passwordOk(req.body && req.body.password)) {
      await new Promise(r => setTimeout(r, 700));
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    res.setHeader('Set-Cookie', sessionCookie());
    return res.json({ admin: true });
  }
  if (req.method === 'DELETE') { res.setHeader('Set-Cookie', clearCookie()); return res.json({ admin: false }); }
  return res.status(405).json({ error: 'Method not allowed' });
});
