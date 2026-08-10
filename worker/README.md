# Download delivery — setup

## Status, 10 Aug 2026

Done, in the dashboard:

- Cloudflare account `whosrila@gmail.com`, account id `77dc6521eaed9a947b699aaa59b94005`
- Worker **whosrila-downloads** created, real code deployed
- Live at <https://whosrila-downloads.whosrila.workers.dev>
- The workers.dev subdomain is `whosrila.workers.dev`, so the URL already
  matches the `WORKER` constant in `/download/index.html`. No edit needed.
- R2 subscription added; bucket `whosrila-downloads` created, **public access
  disabled**
- Both bindings connected: `FILES` → the bucket, `DOWNLOADS` → the KV
  namespace, so the 12-download cap is live rather than optional
- All eight Stripe links redirect to `/download/?session_id=...`

Verified along the way, not assumed:

| Request | Response | Meaning |
|---|---|---|
| no `session_id` | `That download link is not valid.` | refuses empty |
| `session_id=notasession` | `That download link is not valid.` | refuses malformed |
| `session_id=cs_live_fake…` | `We could not reach Stripe just now.` | format accepted, Stripe call attempted, failed only for want of the key |

That third one is the useful one — it proves the whole chain runs and that the
key is the only thing missing.

**Left to do, both WHOSRILA's:**

1. **Upload the eight files** to the bucket (step 3). Must be done by hand —
   the upload tooling available here caps at 10 MB per file and the bundle zip
   is 43.8 MB.
2. **Add `STRIPE_SECRET_KEY`** (step 6). A credential; it goes from Stripe's
   dashboard into Cloudflare's encrypted field directly.

Once both are in, the shop works. Then test with a real purchase, especially
the key-swap case at the bottom of this file.

---

Stripe takes the money but will not hand over a file. This Worker does that
part: it asks Stripe whether a given checkout session actually paid, and only
then streams the audio out of a private R2 bucket.

Everything below is done in the Cloudflare dashboard. There is no Node on this
machine, so the `wrangler` CLI route is not available without installing it —
and the dashboard does the whole job anyway. `wrangler.toml` is kept for
reference if the CLI is ever set up.

**Never paste the Stripe secret key into a chat, a file, or a commit.** It goes
straight from Stripe's dashboard into Cloudflare's secret field, once. Anyone
holding it can move money.

---

## 1. Cloudflare account

Sign up free at <https://dash.cloudflare.com/sign-up>. Nothing needs to move —
the domain stays on GoDaddy, the site stays on GitHub Pages. The Worker lives
on its own `workers.dev` address and is called from the site.

## 2. R2 bucket

**R2 → Create bucket**, name it exactly:

```
whosrila-downloads
```

Leave public access **off**. The bucket must stay private — the Worker is the
only thing that should be able to read it.

Cloudflare may ask for a card before it enables R2, even though this usage is
free (10 GB storage, no charge for downloads, against about 57 MB of audio).

## 3. Upload the files

From `~/Desktop/WHOSRILA/Shop Masters`, drag these **eight** into the bucket:

```
WHOSRILA - Complete Digital Collection.zip
WHOSRILA - For Me.mp3
WHOSRILA - Fully Meech (Acoustic).mp3
WHOSRILA - Kingston.mp3
WHOSRILA - Blue Notes.mp3
WHOSRILA - Protection.mp3
WHOSRILA - Gratitude.mp3
WHOSRILA - Top Form.mp3
```

Not `Outta' Line` (no agreed split) and not `Made You` (not out until 13 Aug).
Both are converted and waiting.

The object names must match the filenames **exactly** — the Worker looks them
up by name, and a stray rename is the likeliest thing to break this.

## 4. Create the Worker

**Workers & Pages → Create → Start with Hello World → Deploy**, then **Edit
code**. Delete what is there, paste the whole of `src/worker.js` from this
folder, and deploy again.

Name it `whosrila-downloads` so its URL is predictable.

## 5. Bind the bucket

**Worker → Settings → Bindings → Add → R2 bucket**

| Field | Value |
|---|---|
| Variable name | `FILES` |
| R2 bucket | `whosrila-downloads` |

The variable name must be `FILES`. That is what the code reads.

## 6. Add the Stripe key

Get it from <https://dashboard.stripe.com/apikeys> — the **live** secret key,
starting `sk_live_`. Reveal it, copy it, and go straight to:

**Worker → Settings → Variables and Secrets → Add → Secret**

| Field | Value |
|---|---|
| Name | `STRIPE_SECRET_KEY` |
| Value | the `sk_live_…` key |
| Type | **Secret** (encrypted), not plaintext |

Deploy. The key is now write-only — Cloudflare will not show it again, and it
is never sent to anyone's browser.

## 7. Hand back the Worker URL

The Worker's address looks like:

```
https://whosrila-downloads.<your-subdomain>.workers.dev
```

That goes into `WORKER` at the bottom of `/download/index.html`. It is set to
a guess right now; if the real subdomain differs, the download page cannot
reach the Worker and every purchase shows "could not reach the download
service".

## 8. Optional — cap re-downloads

Without this the link still expires after 7 days, but can be used any number of
times inside that window.

**Storage & Databases → KV → Create namespace**, call it `DOWNLOADS`, then
**Worker → Settings → Bindings → Add → KV namespace**, variable name
`DOWNLOADS`. The Worker detects it and starts enforcing a 12-download cap per
purchase. It runs fine without it.

---

## Checking it works

Stripe has a test mode, but these payment links are live, so the honest test is
a real purchase:

1. Buy the cheapest single with a real card — it costs $2.99 and you get about
   $2.60 of it back as your own payout.
2. You should land on `whosrila.com/download/?session_id=cs_live_…` and see the
   file listed within a second or two.
3. Download it. Check it plays and the artwork is there.
4. Refund yourself in Stripe afterwards if you want the money back.

Then try the failure cases, which matter more:

- Strip the `session_id` off the URL → "This page only works straight after a
  purchase."
- Invent one, e.g. `?session_id=cs_live_fake` → "We could not find that order."
- Buy a single, then edit `key=` in the download URL to the bundle zip → "That
  file is not part of your order." **If that one ever returns the zip, take the
  links off the site immediately.**

## When something breaks

**Worker → Logs → Begin log stream**, then reproduce. The Worker logs the real
reason (bad key, missing object, unmatched product) while showing the customer
something plain. Most failures are one of:

- a product renamed in Stripe without updating `CATALOG` in `src/worker.js`
- an object renamed in R2
- the secret key pasted with a trailing space

## On release day, 13 Aug

1. Upload `WHOSRILA - Made You.mp3` to the bucket.
2. In `src/worker.js`, add `"WHOSRILA - Made You": ["WHOSRILA - Made You.mp3"],`
   to `CATALOG`, and add the same filename to the bundle's array.
3. Redeploy the Worker.

The scheduled task for that morning already covers the Stripe side.
