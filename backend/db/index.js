import initSqlJs from 'sql.js';
import { config } from '../config/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, 'schema.sql');
const dataDir = path.dirname(config.dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let sqlite = null;

function save() {
  if (!sqlite) return;
  try {
    const data = sqlite.export();
    fs.writeFileSync(config.dbPath, Buffer.from(data));
  } catch (e) {
    console.warn('DB save failed', e.message);
  }
}

function createWrapper() {
  return {
    prepare(sql) {
      return {
        run(...params) {
          sqlite.run(sql, params);
          const changes = sqlite.getRowsModified();
          save();
          return { changes };
        },
        get(...params) {
          const stmt = sqlite.prepare(sql);
          stmt.bind(params);
          const row = stmt.step() ? stmt.getAsObject() : null;
          stmt.free();
          return row === null ? undefined : row;
        },
        all(...params) {
          const stmt = sqlite.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
      };
    },
    exec(sql) {
      sqlite.exec(sql);
      save();
    },
  };
}

export async function initDb() {
  const SQL = await initSqlJs();
  const fileBuf = fs.existsSync(config.dbPath) ? fs.readFileSync(config.dbPath) : null;
  sqlite = new SQL.Database(fileBuf);
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const tables = sqlite.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='events'");
  if (!tables.length || !tables[0].values.length) {
    sqlite.exec(schema);
    save();
  }
  db = createWrapper();
  db.exec("CREATE TABLE IF NOT EXISTS alert_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  save();
  // Seed default events: insert each if that id does not exist
  const now = new Date().toISOString();
  const defaultEvents = [
    ['technavya-2', 'TECHNAVYA 2.0', 'Annual tech conference', null, null, 0, now, now],
    ['dev-summit-2025', 'Dev Summit 2025', 'Developer conference: keynotes, workshops, and networking', '2025-03-15', '2025-03-17', 0, now, now],
    ['product-launch-q2', 'Product Launch Q2', 'New product reveal and customer demos', '2025-04-10', '2025-04-10', 0, now, now],
    ['annual-conference', 'Annual Company Conference', 'Company-wide all-hands and breakout sessions', '2025-05-20', '2025-05-22', 0, now, now],
    ['tech-workshop', 'Tech Workshop Series', 'Hands-on technical workshops and training', null, null, 0, now, now],
    ['customer-day', 'Customer Day', 'Customer appreciation and feedback sessions', '2025-06-05', '2025-06-05', 0, now, now],
  ];
  const insert = db.prepare(
    `INSERT OR IGNORE INTO events (id, name, description, start_date, end_date, total_attendees, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const row of defaultEvents) {
    insert.run(...row);
  }
  return db;
}

export { db };
export function getDb() {
  return db;
}
