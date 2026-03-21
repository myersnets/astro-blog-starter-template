const claimForm = document.getElementById("claimForm");
const messageEl = document.getElementById("message");
const successCard = document.getElementById("successCard");
const passCodeEl = document.getElementById("passCode");
const expiresAtEl = document.getElementById("expiresAt");
const spotDisplayEl = document.getElementById("spotDisplay");

claimForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  messageEl.textContent = "Claiming your pass...";
  successCard.classList.add("hidden");

  const payload = {
    firstName: document.getElementById("firstName").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    stickerSpot: document.getElementById("stickerSpot").value.trim(),
  };

  try {
    const response = await fetch("/api/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to claim pass.");
    }

    messageEl.textContent = "";
    passCodeEl.textContent = data.passCode;
    expiresAtEl.textContent = data.expiresAt;
    spotDisplayEl.textContent = data.stickerSpot || "unknown";
    successCard.classList.remove("hidden");

    const qrCanvas = document.getElementById("passQr");

const redeemUrl = `${window.location.origin}/staff-redeem.html?token=${encodeURIComponent(data.redeemToken)}`;

new QRious({
  element: qrCanvas,
  value: redeemUrl,
  size: 240,
});
    
    claimForm.reset();
  } catch (error) {
    messageEl.textContent = error.message;
  }
});
