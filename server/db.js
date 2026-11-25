import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './auth.js';
import { ALL_ITEMS } from '../public/js/checklist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'data', 'herocard.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('worker','supervisor')),
  observer_id   TEXT NOT NULL UNIQUE,
  craft         TEXT,
  supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  client_uuid          TEXT UNIQUE,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_by         TEXT NOT NULL CHECK (completed_by IN ('worker','supervisor')),
  card_date            TEXT NOT NULL,
  card_time            TEXT NOT NULL,
  location             TEXT NOT NULL,
  craft                TEXT NOT NULL,
  observer_id          TEXT NOT NULL,
  intervention_summary TEXT,
  what_was_done        TEXT,
  count_s              INTEGER NOT NULL DEFAULT 0,
  count_i              INTEGER NOT NULL DEFAULT 0,
  count_c              INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','open','closed')),
  reviewed_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at          TEXT,
  review_comment       TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id, card_date);
CREATE INDEX IF NOT EXISTS idx_cards_date ON cards(card_date);

CREATE TABLE IF NOT EXISTS card_items (
  card_id  INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  category TEXT NOT NULL,
  rating   TEXT NOT NULL CHECK (rating IN ('S','I','C')),
  PRIMARY KEY (card_id, item_key)
);
`);

// ---- Demo seed (only on an empty database) ---------------------------------
const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
if (n === 0) {
  const insert = db.prepare(`INSERT INTO users (name,email,password_hash,role,observer_id,craft,supervisor_id)
                             VALUES (?,?,?,?,?,?,?)`);
  const sup = insert.run('Maria Lopez', 'supervisor@herocard.app', hashPassword('Hero2026!'), 'supervisor', 'SUP-1001', 'Safety', null);
  const supId = Number(sup.lastInsertRowid);
  const workers = [
    ['Carlos Ramirez', 'worker@herocard.app', 'EMP-2041', 'Pipefitter'],
    ['James Carter', 'james@herocard.app', 'EMP-2042', 'Welder'],
    ['Luis Hernandez', 'luis@herocard.app', 'EMP-2043', 'Electrician'],
    ['Ashley Brooks', 'ashley@herocard.app', 'EMP-2044', 'Scaffold Builder'],
  ];
  const ids = workers.map(([name, email, oid, craft]) =>
    Number(insert.run(name, email, hashPassword('Hero2026!'), 'worker', oid, craft, supId).lastInsertRowid)
  );
  seedDemoCards(ids, supId);
}

function seedDemoCards(workerIds, supId) {
  {
    const locations = ['Unit 200 – Crude', 'Cooling Tower 3', 'Pipe Rack B', 'Tank Farm', 'Boiler House'];
    const insCard = db.prepare(`INSERT INTO cards
      (user_id,completed_by,card_date,card_time,location,craft,observer_id,intervention_summary,what_was_done,
       count_s,count_i,count_c,status,reviewed_by,reviewed_at,review_comment,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insItem = db.prepare('INSERT INTO card_items (card_id,item_key,category,rating) VALUES (?,?,?,?)');
    const users = db.prepare('SELECT * FROM users WHERE id = ?');
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

    db.exec('BEGIN');
    for (let d = 13; d >= 0; d--) {
      const dt = new Date(); dt.setDate(dt.getDate() - d);
      const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      for (const wid of workerIds) {
        if (rnd() < 0.15) continue; // some missed days
        const u = users.get(wid);
        const picked = ALL_ITEMS.filter(() => rnd() < 0.55);
        const ratings = picked.map((it) => {
          const r = rnd();
          return [it, r < 0.94 ? 'S' : r < 0.98 ? 'C' : 'I'];
        });
        const cs = ratings.filter((x) => x[1] === 'S').length;
        const ci = ratings.filter((x) => x[1] === 'I').length;
        const cc = ratings.filter((x) => x[1] === 'C').length;
        const hasIssue = ci + cc > 0;
        const closed = ci > 0 && d > 2;
        const status = ci > 0 ? (closed ? 'closed' : 'open') : 'submitted';
        const hh = String(6 + Math.floor(rnd() * 9)).padStart(2, '0');
        const mm = String(Math.floor(rnd() * 60)).padStart(2, '0');
        const res = insCard.run(
          wid, 'worker', date, `${hh}:${mm}`, locations[Math.floor(rnd() * locations.length)], u.craft, u.observer_id,
          hasIssue ? 'Observed a coworker near an unguarded edge without 100% tie-off.' : null,
          hasIssue ? 'Stopped the job, discussed the hazard, re-attached lanyard to approved anchor point.' : null,
          cs, ci, cc, status,
          closed ? supId : null, closed ? `${date} 16:30:00` : null, closed ? 'Verified on site. Toolbox talk scheduled.' : null,
          `${date} ${hh}:${mm}:00`
        );
        const cid = Number(res.lastInsertRowid);
        for (const [it, r] of ratings) insItem.run(cid, it.key, it.category, r);
      }
    }
    db.exec('COMMIT');
  }
}
