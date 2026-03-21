const startScannerBtn = document.getElementById("startScannerBtn");
const stopScannerBtn = document.getElementById("stopScannerBtn");
const scannerWrap = document.getElementById("scannerWrap");
const manualRedeemForm = document.getElementById("manualRedeemForm");
const tokenInput = document.getElementById("tokenInput");

const statusBox = document.getElementById("statusBox");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const statusMeta = document.getElementById("statusMeta");

const passCodeEl = document.getElementById("passCode");
const firstNameEl = document.getElementById("firstName");
const stickerSpotEl = document.getElementById("stickerSpot");
const expiresAtEl = document.getElementById("expiresAt");
const redeemedAtEl = document.getElementById("redeemedAt");

let html5QrCode = null;
let scannerRunning = false;
let isRedeeming = false;

function focusTokenInput() {
  tokenInput.focus();
  tokenInput.select();
}

function showStatus(type, title, message, meta = null) {
  statusBox.className = `status-box ${type}`;
  statusBox.classList.remove("hidden");
  statusTitle.textContent = title;
  statusMessage.textContent = message;

  if (meta) {
    statusMeta.classList.remove("hidden");
    passCodeEl.textContent = meta.passCode || "---";
    firstNameEl.textContent = meta.firstName || "---";
    stickerSpotEl.textContent = meta.stickerSpot || "---";
    expiresAtEl.textContent = meta.expiresAt || "---";
    redeemedAtEl.textContent = meta.redeemedAt || "---";
  } else {
    statusMeta.classList.add("hidden");
    passCodeEl.textContent = "---";
    firstNameEl.textContent = "---";
    stickerSpotEl.textContent = "---";
    expiresAtEl.textContent = "---";
    redeemedAtEl.textContent = "---";
  }
}

function extractToken(value) {
  const trimmed = (value || "").trim();

  try {
    const url = new URL(trimmed);
    return url.searchParams.get("token") || trimmed;
  } catch {
    return trimmed;
  }
}

async function redeemToken(rawValue) {
  const token = extractToken(rawValue);

  if (!token || isRedeeming) return;

  isRedeeming = true;

  try {
    const response = await fetch("/api/redeem", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (data.status === "redeemed") {
      showStatus(
        "success",
        "Pass Redeemed",
        "This trail pass is valid and has now been redeemed.",
        data.pass
      );
    } else if (data.status === "already_redeemed") {
      showStatus(
        "warning",
        "Already Redeemed",
        "This pass has already been used.",
        data.pass
      );
    } else if (data.status === "expired") {
      showStatus(
        "warning",
        "Pass Expired",
        "This pass is no longer valid because it has expired.",
        data.pass
      );
    } else {
      showStatus(
        "error",
        "Invalid Pass",
        data.error || "This pass could not be validated."
      );
    }
  } catch (error) {
    showStatus(
      "error",
      "Redeem Error",
      "There was a problem redeeming this pass."
    );
  } finally {
    isRedeeming = false;
    tokenInput.value = "";
    setTimeout(focusTokenInput, 50);
  }
}

async function startScanner() {
  if (scannerRunning) return;

  scannerWrap.classList.remove("hidden");

  html5QrCode = new Html5Qrcode("preview");
  const cameras = await Html5Qrcode.getCameras();

  if (!cameras || cameras.length === 0) {
    showStatus("error", "Camera Error", "No camera found on this device.");
    return;
  }

  const cameraId = cameras[0].id;

  await html5QrCode.start(
    cameraId,
    {
      fps: 10,
      qrbox: 220,
    },
    async (decodedText) => {
      await stopScanner();
      tokenInput.value = decodedText;
      await redeemToken(decodedText);
    },
    () => {}
  );

  scannerRunning = true;
}

async function stopScanner() {
  if (!html5QrCode || !scannerRunning) return;

  await html5QrCode.stop();
  await html5QrCode.clear();
  scannerRunning = false;
  scannerWrap.classList.add("hidden");
}

startScannerBtn.addEventListener("click", async () => {
  try {
    await startScanner();
  } catch (error) {
    showStatus("error", "Scanner Error", "Could not start camera scanner.");
  }
});

stopScannerBtn.addEventListener("click", async () => {
  try {
    await stopScanner();
  } catch (error) {
    showStatus("error", "Scanner Error", "Could not stop camera scanner cleanly.");
  }
});

manualRedeemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await redeemToken(tokenInput.value);
});

tokenInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    await redeemToken(tokenInput.value);
  }
});

window.addEventListener("load", async () => {
  focusTokenInput();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (token) {
    tokenInput.value = token;
  }
});
