
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function formatDate(dateString) {
  if (!dateString) return "---";
  return new Date(dateString).toLocaleString();
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;

    if (!db) {
      return json({ error: "Database binding not found." }, 500);
    }

    const body = await context.request.json();
    const token = (body.token || "").trim();

    if (!token) {
      return json({ error: "Redeem token is required." }, 400);
    }

    const pass = await db
      .prepare(`
        SELECT
          id,
          first_name,
          email,
          phone,
          sticker_spot,
          pass_code,
          claim_token,
          claimed_at,
          expires_at,
          redeemed_at,
          is_redeemed
        FROM trail_passes
        WHERE claim_token = ?
        LIMIT 1
      `)
      .bind(token)
      .first();

    if (!pass) {
      return json(
        {
          status: "invalid",
          error: "Pass not found.",
        },
        404
      );
    }

    const now = new Date();
    const expiresAt = new Date(pass.expires_at);

    const payload = {
      passCode: pass.pass_code,
      firstName: pass.first_name,
      stickerSpot: pass.sticker_spot || "unknown",
      expiresAt: formatDate(pass.expires_at),
      redeemedAt: formatDate(pass.redeemed_at),
    };

    if (pass.is_redeemed) {
      return json({
        status: "already_redeemed",
        pass: payload,
      });
    }

    if (now > expiresAt) {
      return json({
        status: "expired",
        pass: payload,
      });
    }

    const redeemedAtIso = now.toISOString();

    await db
      .prepare(`
        UPDATE trail_passes
        SET is_redeemed = 1,
            redeemed_at = ?,
            redeemed_by = ?
        WHERE id = ?
      `)
      .bind(redeemedAtIso, "front-desk-scan", pass.id)
      .run();

    return json({
      status: "redeemed",
      pass: {
        ...payload,
        redeemedAt: formatDate(redeemedAtIso),
      },
    });
  } catch (error) {
    return json(
      {
        status: "error",
        error: "Unable to redeem pass.",
        details: error.message,
      },
      500
    );
  }
}
