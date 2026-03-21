export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { firstName, email, phone, stickerSpot } = body;

    if (!firstName || !email || !phone) {
      return Response.json(
        { error: "First name, email, and phone are required." },
        { status: 400 }
      );
    }

    const passCode = `TRAIL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const claimToken = crypto.randomUUID();
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return Response.json({
      success: true,
      passCode,
      redeemToken: claimToken,
      expiresAt: expires.toLocaleDateString(),
      stickerSpot: stickerSpot || "unknown",
    });
  } catch (error) {
    return Response.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
