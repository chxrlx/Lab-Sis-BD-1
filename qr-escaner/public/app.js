const readerElementId = "reader";
const statusEl = document.getElementById("status");
const readerWrapperEl = document.getElementById("readerWrapper");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const refreshBtn = document.getElementById("refreshBtn");
const scanList = document.getElementById("scanList");
const saveManualBtn = document.getElementById("saveManualBtn");
const manualInput = document.getElementById("manualInput");

let html5QrCode = null;
let isRunning = false;
let saveInProgress = false;
let currentGuideMode = "qr";
const clientCooldownMs = 7000;
const recentClientScans = new Map();

startBtn.addEventListener("click", startScanner);
stopBtn.addEventListener("click", stopScanner);
refreshBtn.addEventListener("click", loadScans);
saveManualBtn.addEventListener("click", handleManualSave);

loadScans();

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

async function startScanner() {
  if (isRunning) {
    return;
  }

  if (typeof Html5Qrcode === "undefined") {
    setStatus("No se pudo cargar la libreria de escaneo.", "error");
    return;
  }

  html5QrCode = new Html5Qrcode(readerElementId);

  const config = {
    fps: 10,
    qrbox: getAdaptiveQrbox,
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
    formatsToSupport: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.CODABAR,
    ],
  };

  try {
    await html5QrCode.start(
      { facingMode: { exact: "environment" } },
      config,
      onScanSuccess,
      () => {}
    );

    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus("Escaner activo. Apunta la camara al codigo.", "success");
  } catch (_error) {
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        () => {}
      );

      isRunning = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      setStatus("Escaner activo. Apunta la camara al codigo.", "success");
    } catch (fallbackError) {
      setStatus(
        "No se pudo acceder a la camara. Si usas HTTP en IP local, prueba HTTPS o usa la entrada manual.",
        "error"
      );
      console.error(fallbackError);
    }
  }
}

async function stopScanner() {
  if (!isRunning || !html5QrCode) {
    return;
  }

  await html5QrCode.stop();
  await html5QrCode.clear();
  isRunning = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  updateGuideMode("qr");
  setStatus("Escaner detenido.", "info");
}

async function onScanSuccess(decodedText, decodedResult) {
  if (saveInProgress) {
    return;
  }

  const now = Date.now();
  const normalizedText = String(decodedText || "").trim();
  if (!normalizedText) {
    return;
  }

  const format = normalizeFormat(decodedResult?.result?.format?.formatName || "UNKNOWN");
  updateGuideMode(isBarcodeFormat(format) ? "barcode" : "qr");

  const dedupeKey = `${format}::${normalizedText}`;
  const lastSeenAt = recentClientScans.get(dedupeKey);
  if (lastSeenAt && now - lastSeenAt < clientCooldownMs) {
    return;
  }

  saveInProgress = true;

  try {
    const result = await saveScan(normalizedText, format);
    recentClientScans.set(dedupeKey, now);
    trimOldClientEntries(now);

    if (result.duplicate) {
      setStatus(`Repetido ignorado: ${normalizedText} (${format})`, "info");
    } else {
      setStatus(`Guardado: ${normalizedText} (${format})`, "success");
    }

    await loadScans();
  } catch (error) {
    setStatus(error.message || "No se pudo guardar el escaneo.", "error");
  } finally {
    saveInProgress = false;
  }
}

async function handleManualSave() {
  const value = manualInput.value.trim();
  if (!value) {
    setStatus("Ingresa un valor antes de guardar.", "error");
    return;
  }

  try {
    await saveScan(value, "MANUAL_INPUT");
    manualInput.value = "";
    setStatus("Entrada manual guardada.", "success");
    await loadScans();
  } catch (error) {
    setStatus(error.message || "No se pudo guardar la entrada manual.", "error");
  }
}

async function saveScan(data, format) {
  const response = await fetch("/api/scans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data,
      format,
      deviceId: getDeviceId(),
      userAgent: navigator.userAgent,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Error al guardar");
  }

  return payload;
}

async function loadScans() {
  const response = await fetch("/api/scans?limit=10");
  const payload = await response.json();

  scanList.innerHTML = "";

  if (!payload.scans || payload.scans.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No hay escaneos guardados aun.";
    scanList.appendChild(empty);
    return;
  }

  for (const scan of payload.scans) {
    const item = document.createElement("li");
    item.className = "scan-item";
    item.innerHTML = `
      <span class="scan-data">${escapeHtml(scan.data)}</span>
      <span class="scan-meta">${escapeHtml(scan.format)} · ${escapeHtml(formatCreatedAt(scan.createdAt))} (CDMX)</span>
    `;
    scanList.appendChild(item);
  }
}

function getAdaptiveQrbox(viewfinderWidth, viewfinderHeight) {
  if (currentGuideMode === "barcode") {
    return {
      width: Math.floor(viewfinderWidth * 0.86),
      height: Math.floor(viewfinderHeight * 0.32),
    };
  }

  const side = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
  return {
    width: side,
    height: side,
  };
}

function updateGuideMode(mode) {
  currentGuideMode = mode === "barcode" ? "barcode" : "qr";
  readerWrapperEl.dataset.guide = currentGuideMode;
}

function normalizeFormat(format) {
  return String(format || "UNKNOWN").trim().toUpperCase();
}

function isBarcodeFormat(format) {
  return format !== "QR_CODE" && format !== "UNKNOWN";
}

function trimOldClientEntries(now) {
  for (const [key, timestamp] of recentClientScans.entries()) {
    if (now - timestamp > 60000) {
      recentClientScans.delete(key);
    }
  }
}

function formatCreatedAt(value) {
  if (!value) {
    return "Sin fecha";
  }

  if (typeof value !== "string") {
    return String(value);
  }

  return value;
}

function getDeviceId() {
  const key = "device-id";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = self.crypto?.randomUUID?.() || `device-${Date.now()}`;
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
