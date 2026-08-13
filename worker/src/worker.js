/**
 * whosrila-downloads
 *
 * Hands a paying customer their files and nobody else.
 *
 * Stripe cannot deliver files — it only offers a confirmation page, a
 * redirect, or an invoice PDF. So the payment link redirects to
 *   https://whosrila.com/download/?session_id={CHECKOUT_SESSION_ID}
 * and that page asks this Worker what was bought.
 *
 * The Worker asks Stripe directly whether that session is paid. The browser
 * never gets to assert it, so a forged session_id buys nothing. Files are
 * streamed out of R2 through the Worker, which means the bucket itself stays
 * private — there is no public URL to leak.
 *
 * Nothing secret lives in this file. STRIPE_SECRET_KEY is a Worker secret,
 * set with `wrangler secret put`, and is never sent to the browser.
 */

const CORS_ORIGIN = "https://whosrila.com";

// How long after purchase the link keeps working. Stripe sessions do not
// expire on their own, so without this a session_id would be a permanent
// download token the day someone pastes it into a group chat.
const DOWNLOAD_WINDOW_DAYS = 7;

// Cap per purchase, counted in KV. Generous enough for re-downloads across a
// couple of devices, low enough that a shared link is worthless. Set the
// DOWNLOADS KV binding to enable it; without it the cap is simply not applied.
const MAX_DOWNLOADS = 12;

/**
 * Stripe product name -> the files that purchase entitles you to.
 * The key must match the product name in Stripe EXACTLY, and the values must
 * match the object names in the R2 bucket exactly.
 *
 * On 13 Aug, Made You needs a line here and inside the bundle array.
 */
const CATALOG = {
  "WHOSRILA - Complete Digital Collection": [
    "WHOSRILA - Complete Digital Collection.zip",
  ],
  "WHOSRILA - Made You":               ["WHOSRILA - Made You.mp3"],
  "WHOSRILA - For Me":                 ["WHOSRILA - For Me.mp3"],
  "WHOSRILA - Fully Meech (Acoustic)": ["WHOSRILA - Fully Meech (Acoustic).mp3"],
  "WHOSRILA - Kingston":               ["WHOSRILA - Kingston.mp3"],
  "WHOSRILA - Blue Notes":             ["WHOSRILA - Blue Notes.mp3"],
  "WHOSRILA - Protection":             ["WHOSRILA - Protection.mp3"],
  "WHOSRILA - Gratitude":              ["WHOSRILA - Gratitude.mp3"],
  "WHOSRILA - Top Form":               ["WHOSRILA - Top Form.mp3"],
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": CORS_ORIGIN,
      "cache-control": "no-store",
    },
  });

/**
 * Ask Stripe about the session and work out what it entitles the buyer to.
 * Every path that is not a completed, paid, in-window session returns an
 * error — the caller never decides this for itself.
 */
async function resolveOrder(sessionId, env) {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return { error: "That download link is not valid.", status: 400 };
  }

  const res = await fetch(
    "https://api.stripe.com/v1/checkout/sessions/" +
      encodeURIComponent(sessionId) +
      "?expand[]=line_items",
    { headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY } }
  );

  if (res.status === 404) {
    return { error: "We could not find that order.", status: 404 };
  }
  if (!res.ok) {
    // Stripe is down or the key is wrong. Do not imply the customer did
    // anything wrong, and do not leak the reason.
    console.error("stripe lookup failed", res.status, await res.text());
    return { error: "We could not reach Stripe just now. Try again shortly.", status: 502 };
  }

  const session = await res.json();

  if (session.payment_status !== "paid") {
    return { error: "That order has not been paid.", status: 402 };
  }

  const ageDays = (Date.now() / 1000 - session.created) / 86400;
  if (ageDays > DOWNLOAD_WINDOW_DAYS) {
    return {
      error:
        "This download link has expired. Email press@whosrila.com and we will send your files.",
      status: 410,
    };
  }

  const files = [];
  for (const item of session.line_items?.data ?? []) {
    for (const key of CATALOG[item.description] ?? []) {
      if (!files.includes(key)) files.push(key);
    }
  }

  if (!files.length) {
    // Paid for something the catalogue does not know about — usually a
    // product renamed in Stripe without updating CATALOG above.
    console.error(
      "no catalog match",
      (session.line_items?.data ?? []).map((i) => i.description)
    );
    return {
      error: "We could not match your order to a file. Email press@whosrila.com.",
      status: 500,
    };
  }

  return { files, email: session.customer_details?.email ?? null };
}

/** What did I buy? Called by the download page to render the list. */
async function handleOrder(url, env) {
  const order = await resolveOrder(url.searchParams.get("session_id"), env);
  if (order.error) return json({ error: order.error }, order.status);

  return json({
    email: order.email,
    files: order.files.map((key) => ({
      name: key,
      url:
        new URL(url).origin +
        "/api/file?session_id=" +
        encodeURIComponent(url.searchParams.get("session_id")) +
        "&key=" +
        encodeURIComponent(key),
    })),
  });
}

/** Stream one file, after checking this session actually paid for it. */
async function handleFile(url, env) {
  const sessionId = url.searchParams.get("session_id");
  const key = url.searchParams.get("key");

  const order = await resolveOrder(sessionId, env);
  if (order.error) return json({ error: order.error }, order.status);

  // Paying for a single must not let you fetch the bundle by editing the URL.
  if (!order.files.includes(key)) {
    return json({ error: "That file is not part of your order." }, 403);
  }

  if (env.DOWNLOADS) {
    const counter = "dl:" + sessionId;
    const used = parseInt((await env.DOWNLOADS.get(counter)) || "0", 10);
    if (used >= MAX_DOWNLOADS) {
      return json(
        { error: "This link has been used too many times. Email press@whosrila.com." },
        429
      );
    }
    await env.DOWNLOADS.put(counter, String(used + 1), {
      expirationTtl: DOWNLOAD_WINDOW_DAYS * 86400,
    });
  }

  const object = await env.FILES.get(key);
  if (!object) {
    console.error("missing from R2:", key);
    return json({ error: "That file is missing. Email press@whosrila.com." }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "no-store");
  headers.set("access-control-allow-origin", CORS_ORIGIN);
  // RFC 5987 form as well, so the apostrophe in "Outta' Line" and the
  // spaces survive the trip intact.
  headers.set(
    "content-disposition",
    'attachment; filename="' +
      key.replace(/"/g, "") +
      '"; filename*=UTF-8\'\'' +
      encodeURIComponent(key)
  );

  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": CORS_ORIGIN,
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-max-age": "86400",
        },
      });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed." }, 405);
    }

    try {
      if (url.pathname === "/api/order") return await handleOrder(url, env);
      if (url.pathname === "/api/file")  return await handleFile(url, env);
    } catch (err) {
      console.error("unhandled", err && err.stack);
      return json({ error: "Something went wrong. Email press@whosrila.com." }, 500);
    }

    return json({ error: "Not found." }, 404);
  },
};
