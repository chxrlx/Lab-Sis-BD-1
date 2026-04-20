require("dotenv").config();

const os = require("node:os");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const db = require("./db/database");

const app = express();
const port = Number(process.env.PORT) || 3000;
const scanCooldownMs = 7000;
const recentScans = new Map();

const allowedFormats = new Set([
  "QR_CODE",
  "EAN_13",
  "EAN_8",
  "UPC_A",
  "UPC_E",
  "CODE_128",
  "CODE_39",
  "ITF",
  "CODABAR",
  "UNKNOWN",
  "MANUAL_INPUT",
]);

const insertScanStmt = db.prepare(
  `INSERT INTO scans (data, format, created_at, device_id, user_agent, raw_json)
   VALUES (@data, @format, @createdAt, @deviceId, @userAgent, @rawJson)`
);

const listScansStmt = db.prepare(
  `SELECT id, data, format, created_at AS createdAt, device_id AS deviceId
   FROM scans
   ORDER BY created_at DESC
   LIMIT @limit`
);

app.use(cors());
app.use(express.json({ limit: "512kb" }));
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "qr-escaner" });
});

app.get("/api/scans", (req, res) => {
  const parsedLimit = Number.parseInt(String(req.query.limit || "20"), 10);
  const limit = Number.isNaN(parsedLimit) ? 20 : Math.max(1, Math.min(parsedLimit, 100));
  const scans = listScansStmt.all({ limit });
  res.json({ total: scans.length, scans });
});

app.post("/api/scans", (req, res) => {
  const data = typeof req.body?.data === "string" ? req.body.data.trim() : "";
  const format = typeof req.body?.format === "string" ? req.body.format.trim().toUpperCase() : "UNKNOWN";
  const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId.trim() : null;
  const userAgent = typeof req.body?.userAgent === "string" ? req.body.userAgent.trim() : req.get("user-agent") || null;

  if (!data) {
    return res.status(400).json({ ok: false, message: "El campo 'data' es obligatorio." });
  }

  if (data.length > 2048) {
    return res.status(400).json({ ok: false, message: "El campo 'data' es demasiado largo." });
  }

  const normalizedFormat = allowedFormats.has(format) ? format : "UNKNOWN";
  const dedupeKey = `${normalizedFormat}::${data}`;
  const nowMs = Date.now();
  const lastSeenAt = recentScans.get(dedupeKey);

  if (lastSeenAt && nowMs - lastSeenAt < scanCooldownMs) {
    return res.status(202).json({
      ok: true,
      duplicate: true,
      message: "Escaneo repetido ignorado por ventana de seguridad.",
      data,
      format: normalizedFormat,
    });
  }

  recentScans.set(dedupeKey, nowMs);

  // Limpieza simple para que el mapa no crezca indefinidamente.
  if (recentScans.size > 3000) {
    for (const [key, timestamp] of recentScans.entries()) {
      if (nowMs - timestamp > 60000) {
        recentScans.delete(key);
      }
    }
  }

  const rawJson = req.body ? JSON.stringify(req.body) : null;
  const createdAt = getMexicoCityTimestamp();

  const result = insertScanStmt.run({
    data,
    format: normalizedFormat,
    createdAt,
    deviceId,
    userAgent,
    rawJson,
  });

  return res.status(201).json({
    ok: true,
    id: result.lastInsertRowid,
    duplicate: false,
    data,
    format: normalizedFormat,
    createdAt,
  });
});

app.use((err, _req, res, _next) => {
  console.error("Error interno:", err);
  res.status(500).json({ ok: false, message: "Error interno del servidor." });
});

app.listen(port, "0.0.0.0", () => {
  const networkIp = getNetworkIp();
  console.log(`Servidor escuchando en http://localhost:${port}`);
  if (networkIp) {
    console.log(`Acceso desde celular (misma red): http://${networkIp}:${port}`);
  }
  console.log("Base de datos SQLite lista en db/scanner.db");
});

function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) {
      continue;
    }
    for (const detail of iface) {
      if (detail.family === "IPv4" && !detail.internal) {
        return detail.address;
      }
    }
  }
  return null;
}

function getMexicoCityTimestamp() {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return formatter.format(new Date()).replace("T", " ");
}
