/* Admin user management for Amaan ERP (Vercel serverless function).
   Needs Vercel environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL.
   The service_role key must live ONLY in Vercel settings, never in GitHub or config.js. */
const BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OWNER = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ROLES = ['admin', 'member', 'viewer'];

async function sb(path, opt) {
  const r = await fetch(BASE + path, opt);
  let j = null; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, j };
}
const adminH = () => ({ apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' });
async function caller(req) {
  const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!t) return null;
  const r = await sb('/auth/v1/user', { headers: { apikey: KEY, Authorization: 'Bearer ' + t } });
  return r.ok && r.j && r.j.id ? r.j : null;
}
function roleOf(u) {
  if (OWNER && String(u.email || '').toLowerCase() === OWNER) return 'admin';
  const r = u.app_metadata && u.app_metadata.role;
  return ROLES.indexOf(r) >= 0 ? r : 'member';
}
const nameOf = (u) => (u.user_metadata && u.user_metadata.name) || String(u.email || '').split('@')[0];
const pub = (u) => ({ id: u.id, email: u.email, name: nameOf(u), role: roleOf(u), owner: !!OWNER && String(u.email).toLowerCase() === OWNER, last: u.last_sign_in_at || null });
function send(res, code, o) { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(o)); }
async function body(req) {
  if (req.body !== undefined && req.body !== null) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  let s = ''; for await (const c of req) s += c; return s ? JSON.parse(s) : {};
}

module.exports = async (req, res) => {
  try {
    if (!BASE || !KEY || !OWNER) return send(res, 500, { error: 'Server settings missing: add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL in Vercel > Settings > Environment Variables, then Redeploy.' });
    const me = await caller(req);
    if (!me) return send(res, 401, { error: 'Not signed in' });
    const myRole = roleOf(me);
    const q = new URL(req.url, 'http://x').searchParams;
    const b = req.method === 'POST' ? await body(req) : {};
    const action = b.action || q.get('action');

    if (action === 'me') return send(res, 200, pub(me));
    if (myRole !== 'admin') return send(res, 403, { error: 'Admins only' });

    if (action === 'list') {
      const r = await sb('/auth/v1/admin/users?per_page=200', { headers: adminH() });
      if (!r.ok) return send(res, 502, { error: (r.j && (r.j.msg || r.j.message)) || 'Could not list users' });
      return send(res, 200, { users: (r.j.users || []).map(pub).sort((a, c) => (a.owner ? -1 : 0) - (c.owner ? -1 : 0) || a.email.localeCompare(c.email)) });
    }
    if (action === 'create') {
      const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || ''), role = ROLES.indexOf(b.role) >= 0 ? b.role : 'member';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: 'Enter a valid email.' });
      if (pw.length < 6) return send(res, 400, { error: 'Password must be at least 6 characters.' });
      const r = await sb('/auth/v1/admin/users', { method: 'POST', headers: adminH(), body: JSON.stringify({ email, password: pw, email_confirm: true, user_metadata: { name: String(b.name || '').trim() || email.split('@')[0] }, app_metadata: { role } }) });
      if (!r.ok) return send(res, 400, { error: (r.j && (r.j.msg || r.j.message || r.j.error_description)) || 'Could not create the user.' });
      return send(res, 200, { user: pub(r.j) });
    }
    if (action === 'update' || action === 'delete') {
      const id = String(b.id || '');
      if (!id) return send(res, 400, { error: 'id required' });
      const t = await sb('/auth/v1/admin/users/' + encodeURIComponent(id), { headers: adminH() });
      if (!t.ok) return send(res, 404, { error: 'User not found' });
      const target = t.j, isOwner = String(target.email).toLowerCase() === OWNER;
      if (action === 'delete') {
        if (isOwner || target.id === me.id) return send(res, 400, { error: 'You cannot delete this account.' });
        const r = await sb('/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'DELETE', headers: adminH() });
        return r.ok ? send(res, 200, { ok: true }) : send(res, 502, { error: 'Could not delete.' });
      }
      const patch = {};
      if (b.role !== undefined) {
        if (ROLES.indexOf(b.role) < 0) return send(res, 400, { error: 'Bad role' });
        if (isOwner || target.id === me.id) return send(res, 400, { error: 'You cannot change the role of this account.' });
        patch.app_metadata = Object.assign({}, target.app_metadata || {}, { role: b.role });
      }
      if (b.name !== undefined) patch.user_metadata = Object.assign({}, target.user_metadata || {}, { name: String(b.name).trim() });
      if (b.password !== undefined) { if (String(b.password).length < 6) return send(res, 400, { error: 'Password must be at least 6 characters.' }); patch.password = String(b.password); }
      const r = await sb('/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'PUT', headers: adminH(), body: JSON.stringify(patch) });
      return r.ok ? send(res, 200, { user: pub(r.j) }) : send(res, 400, { error: (r.j && (r.j.msg || r.j.message)) || 'Could not update.' });
    }
    send(res, 400, { error: 'bad action' });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
};
