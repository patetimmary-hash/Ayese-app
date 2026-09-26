import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function register(email, password, name) {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) throw new Error('An account with this email already exists');
  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, points',
    [email.toLowerCase(), hash, name || null]
  );
  return result.rows[0];
}

export async function login(email, password) {
  const result = await query('SELECT id, email, name, password_hash, points FROM users WHERE email = $1', [email.toLowerCase()]);
  if (!result.rows.length) throw new Error('Invalid email or password');
  const user = result.rows[0];
  if (!user.password_hash) throw new Error('This account uses Google sign-in');
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Invalid email or password');
  return user;
}

export async function googleAuth(idToken) {
  if (!googleClient) throw new Error('Google sign-in is not configured. Add GOOGLE_CLIENT_ID.');
  const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  const email = payload.email.toLowerCase();
  const name = payload.name;
  const googleId = payload.sub;

  let result = await query('SELECT id, email, name, points FROM users WHERE google_id = $1', [googleId]);
  if (!result.rows.length) {
    result = await query('SELECT id, email, name, points FROM users WHERE email = $1', [email]);
    if (result.rows.length) {
      await query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, result.rows[0].id]);
    } else {
      result = await query(
        'INSERT INTO users (email, name, google_id) VALUES ($1, $2, $3) RETURNING id, email, name, points',
        [email, name, googleId]
      );
    }
  }
  return result.rows[0];
}
