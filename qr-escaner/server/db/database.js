const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const dbDirectory = path.join(process.cwd(), "db");
const dbPath = path.join(dbDirectory, "scanner.db");

if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    format TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id TEXT,
    user_agent TEXT,
    raw_json TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_scans_format ON scans(format);
`);

module.exports = db;
