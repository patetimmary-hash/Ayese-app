import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, migrate } from './db.js';
import { signToken, authMiddleware, register, login, googleAuth } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

// ── Badge definitions ──
const BADGES = [
  { id: 'first_report',   name: 'First Report',      icon: '🌱', desc: 'Submit your first report' },
  { id: 'five_reports',   name: 'Getting Started',   icon: '🌿', desc: 'Submit 5 reports' },
  { id: 'twenty_reports', name: 'Dedicated Reporter', icon: '🌳', desc: 'Submit 20 reports' },
  { id: 'area_guardian',  name: 'Area Guardian',     icon: '🛡️', desc: 'Adopt your first area' },
  { id: 'streak_3',       name: 'Streak Keeper',     icon: '🔥', desc: '3-day reporting streak' },
  { id: 'streak_7',       name: 'Week Warrior',      icon: '⚡', desc: '7-day reporting streak' },
  { id: 'cleanup_hero',   name: 'Cleanup Hero',      icon: '✨', desc: 'Mark 5 reports as cleaned' },
  { id: 'pathfinder',     name: 'Pathfinder',        icon: '📍', desc: 'Attach location to a report' },
  { id: 'photographer',   name: 'Photographer',      icon: '📸', desc: 'Attach a photo to a report' },
  { id: 'hazard_hunter',  name: 'Hazard Hunter',     icon: '⚠️', desc: 'Report 3 hazardous items' },
];

// ── Rewards engine ──
async function computeStats(userId) {
  const reports = await query('SELECT * FROM reports WHERE user_id = $1 ORDER BY created_at', [userId]);
  const adoptions = await query('SELECT * FROM adoptions WHERE user_id = $1', [userId]);
  const resolutions = await query('SELECT id FROM reports WHERE resolved_by = $1', [userId]);
  const reportRows = reports.rows;

  // streak
  const days = [...new Set(reportRows.map(r => new Date(r.created_at).toISOString().slice(0, 10)))].sort().reverse();
  let streak = 0;
  if (days.length) {
    let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
    for (const d of days) {
      const key = cursor.toISOString().slice(0, 10);
      if (d === key) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else if (d < key) break;
    }
  }

  const hazardCount = reportRows.filter(r => (r.categories || []).includes('hazard')).length;
  const hasLocation = reportRows.some(r => r.coords);
  const hasPhoto = reportRows.some(r => r.photo_url);
  const adoptedAreas = [...new Set(adoptions.rows.map(a => a.area))];

  const earned = [
    reportRows.length >= 1 && 'first_report',
    reportRows.length >= 5 && 'five_reports',
    reportRows.length >= 20 && 'twenty_reports',
    adoptedAreas.length >= 1 && 'area_guardian',
    streak >= 3 && 'streak_3',
    streak >= 7 && 'streak_7',
    resolutions.rows.length >= 5 && 'cleanup_hero',
    hasLocation && 'pathfinder',
    hasPhoto && 'photographer',
    hazardCount >= 3 && 'hazard_hunter',
  ].filter(Boolean);

  // persist new badges
  for (const badgeId of earned) {
    await query(
      `INSERT INTO badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT (user_id, badge_id) DO NOTHING`,
      [userId, badgeId]
    );
  }

  const points = reportRows.length * 10 + adoptedAreas.length * 25 + resolutions.rows.length * 50 + earned.length * 100;
  const level = Math.floor(points / 200) + 1;
  const progress = (points % 200) / 200;

  return {
    points,
    level,
    progress,
    nextLevelPoints: (level) * 200,
    streak,
    totalReports: reportRows.length,
    adoptedAreas: adoptedAreas.length,
    resolvedCount: resolutions.rows.length,
    badges: BADGES.map(b => ({ ...b, earned: earned.includes(b.id) })),
  };
}

// ── Public config ──
app.get('/api/config', (_req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// ── Auth routes ──
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const user = await register(email, password, name);
    res.json({ token: signToken(user), user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = await login(email, password);
    res.json({ token: signToken(user), user });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'No Google token provided' });
    const user = await googleAuth(idToken);
    res.json({ token: signToken(user), user });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const result = await query('SELECT id, email, name, points FROM users WHERE id = $1', [req.user.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ user: result.rows[0] });
});

// ── Report routes ──
app.get('/api/reports', async (_req, res) => {
  const result = await query(`
    SELECT r.*, u.name AS user_name,
      (SELECT count(*) FROM flags f WHERE f.report_id = r.id) AS flag_count
    FROM reports r JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC
  `);
  res.json(result.rows.map(r => ({
    id: r.id,
    area: r.area,
    description: r.description,
    severity: r.severity,
    categories: r.categories,
    coords: r.coords,
    photoUrl: r.photo_url,
    resolved: r.resolved,
    resolvedBy: r.resolved_by,
    createdAt: r.created_at,
    userId: r.user_id,
    userName: r.user_name,
    flagCount: Number(r.flag_count),
  })));
});

app.post('/api/reports', authMiddleware, async (req, res) => {
  try {
    const { area, description, severity, categories, coords, photoUrl } = req.body;
    if (!area?.trim()) return res.status(400).json({ error: 'Area name is required' });
    const result = await query(
      `INSERT INTO reports (user_id, area, description, severity, categories, coords, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, area.trim(), description || null, severity || 3,
       JSON.stringify(categories || []), coords ? JSON.stringify(coords) : null, photoUrl || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/reports/:id/resolve', authMiddleware, async (req, res) => {
  await query(
    'UPDATE reports SET resolved = true, resolved_by = $1, resolved_at = NOW() WHERE id = $2 AND resolved = false',
    [req.user.id, req.params.id]
  );
  res.json({ success: true });
});

// ── Flag routes ──
app.post('/api/flags', authMiddleware, async (req, res) => {
  try {
    await query(
      `INSERT INTO flags (report_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.body.reportId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Adoption routes ──
app.get('/api/adoptions', async (_req, res) => {
  const result = await query('SELECT * FROM adoptions ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/adoptions', authMiddleware, async (req, res) => {
  try {
    const { area } = req.body;
    if (!area?.trim()) return res.status(400).json({ error: 'Area is required' });
    await query(
      `INSERT INTO adoptions (user_id, area) VALUES ($1, $2) ON CONFLICT (user_id, area) DO NOTHING`,
      [req.user.id, area.trim()]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Rewards & impact ──
app.get('/api/rewards', authMiddleware, async (req, res) => {
  res.json(await computeStats(req.user.id));
});

app.get('/api/impact', authMiddleware, async (req, res) => {
  res.json(await computeStats(req.user.id));
});

// ── SPA fallback ──
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
migrate().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Ayese API running on :${PORT}`));
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
