import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://ayese:ayese_dev_pw@localhost:5432/ayese',
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function migrate() {
  let retries = 0;
  while (retries < 30) {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          name TEXT,
          google_id TEXT UNIQUE,
          points INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          area TEXT NOT NULL,
          description TEXT,
          severity INTEGER DEFAULT 3,
          categories JSONB DEFAULT '[]',
          coords JSONB,
          photo_url TEXT,
          resolved BOOLEAN DEFAULT FALSE,
          resolved_by UUID REFERENCES users(id),
          resolved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS adoptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          area TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, area)
        );
        CREATE TABLE IF NOT EXISTS flags (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(report_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS badges (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          badge_id TEXT NOT NULL,
          earned_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, badge_id)
        );
      `);
      return;
    } catch (err) {
      retries++;
      if (retries >= 30) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

export default pool;
