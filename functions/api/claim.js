function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone) {
  return phone.replace(/\D/g, "");
}

function generatePassCode() {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TRAIL-${randomPart}`;
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;

    if (!db) {
      return json({ error: "Database binding not found." }, 500);
    }

    const body = await context.request.json();
    const firstName = (body.firstName || "").trim();
    const email = normalizeEmail(body.email || "");
    const phone = normalizePhone(body.phone || "");
    const stickerSpot = (body.stickerSpot || "unknown").trim();

    if (!firstName || !email || !phone) {
      return json(
        { error: "First name, email, and phone are required." },
        400
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiresIso = expires.toISOString();

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Block repeat claims by email in last 30 days
    const existingEmail = await db
      .prepare(`
        SELECT id, claimed_at
        FROM trail_passes
        WHERE email = ?
          AND claimed_at >= ?
        ORDER BY claimed_at DESC
        LIMIT 1
      `)
      .bind(email, thirtyDaysAgo)
      .first();

    if (existingEmail) {
      return json(
        { error: "This email has already claimed a trail pass in the last 30 days." },
        409
      );
    }

    // Block repeat claims by phone in last 30 days
    const existingPhone = await db
      .prepare(`
        SELECT id, claimed_at
        FROM trail_passes
        WHERE phone = ?
          AND claimed_at >= ?
        ORDER BY claimed_at DESC
        LIMIT 1
      `)
      .bind(phone, thirtyDaysAgo)
      .first();

    if (existingPhone) {
      return json(
        { error: "This phone number has already claimed a trail pass in the last 30 days." },
        409
      );
    }

    let passCode = generatePassCode();
    let codeExists = true;

    while (codeExists) {
      const existingCode = await db
        .prepare(`SELECT id FROM trail_passes WHERE pass_code = ? LIMIT 1`)
        .bind(passCode)
        .first();

      if (!existingCode) {
        codeExists = false;
      } else {
        passCode = generatePassCode();
      }
    }

    const claimToken = crypto.randomUUID();

    const ipAddress =
      context.request.headers.get("CF-Connecting-IP") ||
      context.request.headers.get("X-Forwarded-For") ||
      "";

    const userAgent = context.request.headers.get("User-Agent") || "";

    await db
      .prepare(`
        INSERT INTO trail_passes (
          first_name,
          email,
          phone,
          sticker_spot,
          pass_code,
          claim_token,
          claimed_at,
          expires_at,
          redeemed_at,
          redeemed_by,
          is_redeemed,
          ip_address,
          user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)
      `)
      .bind(
        firstName,
        email,
        phone,
        stickerSpot,
        passCode,
        claimToken,
        nowIso,
        expiresIso,
        ipAddress,
        userAgent
      )
      .run();

    return json({
      success: true,
      passCode,
      redeemToken: claimToken,
      expiresAt: expires.toLocaleDateString(),
      stickerSpot,
    });
  } catch (error) {
    return json(
      {
        error: "Unable to claim pass.",
        details: error.message,
      },
      500
    );
  }
}
