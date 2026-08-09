# Direct sales — what is settled and what is not

Splits as given 9 Aug 2026. These govern direct sales only, not distributor
royalties. `tools/splits.py` reads a Stripe export and applies them.

## Stripe — built 9 Aug 2026

Live account `acct_1U2c9hLVCwTbBSNb` (WHOSRILA LLC), verification complete.
Eight products, all one-off, all tax code *Digital Audio Works — downloaded —
non subscription — with limited rights*.

| Product | Price | Payment link |
|---|---|---|
| Complete Digital Collection | $14.99 | https://buy.stripe.com/3cIaEY2Pc7uigt6b0W6Zy00 |
| For Me | $2.99 | https://buy.stripe.com/6oU8wQ9dAdSGccQ0mi6Zy01 |
| Fully Meech (Acoustic) | $2.99 | https://buy.stripe.com/7sY8wQ0H415U5Os1qm6Zy02 |
| Kingston | $2.99 | https://buy.stripe.com/eVqbJ23Tg5magt62uq6Zy03 |
| Blue Notes | $2.99 | https://buy.stripe.com/28EaEY9dAaGua4I6KG6Zy04 |
| Protection | $2.99 | https://buy.stripe.com/00weVe3Tg8ym4Ko7OK6Zy05 |
| Gratitude | $2.99 | https://buy.stripe.com/cNi4gA0H4g0Oa4I5GC6Zy06 |
| Top Form | $2.99 | https://buy.stripe.com/9B63cwgG23e2dgU2uq6Zy07 |

Card, Apple Pay, Klarna, Link, Cash App Pay and Amazon Pay are all on.
"Collect tax automatically" is on but no tax registrations exist, so nothing is
charged yet — it will start collecting by itself once a registration is added.

**These links are deliberately not on the site.** `WR_DIRECT_STORE` in
`index.html` is still empty. Nothing should point at them until the two
blockers below are cleared, or a buyer pays and receives nothing.

Product names are chosen so `tools/splits.py` matches them — "Complete" trips
`BUNDLE_KEYS`, and each single contains its own key. Renaming a product in
Stripe breaks the split report unless `SPLITS` is updated to match.

## Blocker 1 — Stripe will not deliver the file

Checked directly in the payment-link builder: the only post-payment options are
a confirmation page, a redirect to your own site, or an invoice PDF. **Stripe
does not host or send files.** Delivery has to be built. Three ways, cheapest
first:

1. **Email by hand.** Stripe already collects the buyer's email. Send the ZIP
   yourself. Zero engineering, completely secure, fine at low volume, and it
   can start the day the masters exist.
2. **Unlisted download page.** Confirmation page links to an obscure,
   `noindex` URL on whosrila.com holding the files. Instant, no server, but the
   URL is the only thing protecting it — one buyer can pass it on.
3. **Cloudflare Worker + R2.** Stripe redirects to a page on whosrila.com
   carrying `?session_id=`; a Worker verifies that session against the Stripe
   API, confirms it is paid, and returns a short-lived signed R2 link. Instant,
   automatic, and the link expires so forwarding it is useless.

   DNS is on GoDaddy pointing straight at GitHub Pages — **Cloudflare is not in
   front of this site** (the Web Analytics beacon is only a script, which is
   easy to misread as proxying). No DNS move is needed though: the Worker can
   live on its own `workers.dev` subdomain and be called cross-origin. Free at
   this volume — R2 gives 10 GB and charges nothing for egress, against about
   57 MB of audio. Needs a Cloudflare account, and the Stripe secret key pasted
   in as a Worker secret — WHOSRILA does that, not Claude.

Recommendation: 3 if the goal is a real shop, because it is the only one that
is both instant and safe. 1 is the zero-setup stopgap. 2 is a trap — it looks
automated but the file leaks the first time a buyer forwards the link.

## Masters — done, 9 Aug 2026

Built in `/Users/whosrila/Desktop/WHOSRILA/Shop Masters` (deliberately NOT in
this repo — GitHub Pages would serve them to anyone). Nine files, 320 kbps CBR,
LAME quality 0, native sample rate kept, ID3v2.3, front cover embedded, album
and genre taken from Apple's own metadata so tags match the stores. All nine
pass a full decode with zero errors.

Everything was encoded **from the WAV masters, never from the supplied MP3s**:

- `Top Form [44Khz 24bit Stereo].mp3` was 128 kbps audio inside a 22 MB ID3
  tag — unusable. The WAV was fine.
- The other supplied MP3s were 320 but had been resampled to 48 kHz from
  44.1 kHz sources. Re-encoding those would have compounded the loss.

`Fully Meech` was not among the files sent over but its WAV was in the same
folder, so all seven sellable songs are covered. `Outta' Line` was converted
too but stays out of the shop until its split is agreed. `Made You` is ready
for the 13th.

The bundle ZIP (`WHOSRILA - Complete Digital Collection.zip`, 43.8 MB) holds
the seven songs plus `LICENCE.txt`. Singles ship as a single MP3 — no ZIP to
unpack — with the licence pointer in the comment tag and the full text at
whosrila.com/license.

**Possible lead on a missing name:** the Made You session folder is called
"WHOSRILA, Cin - Made You". *Cin* may be the 50% producer credit. Confirm
before using it in a payout.

## Sellable now — split agreed

| Song | WHOSRILA | Others |
|---|---|---|
| For Me | 100% | — |
| Fully Meech (Acoustic) | 100% | — |
| Kingston | 100% | — |
| Blue Notes | 100% | — |
| Protection | 100% | — |
| Gratitude | 50% | 50% |
| Top Form | 50% | 50% |
| Made You *(out 13 Aug)* | 50% | 50% producer |

Made You has no Stripe product yet — it is created on release day along with
the rest of the swap.

## Held back

| Song | Why |
|---|---|
| **Outta' Line** | No split agreed. Sales would be unallocated, so it is not for sale yet. |
| **Wine and Bubble** | Jon Dela's record — WHOSRILA is a feature, not the owner. Never ours to sell. |
| Angels On Sofa | Unreleased. Split known: three ways with Pascal Pressure and Justice Case. |
| Energy | Unreleased. Split known: 50 WHOSRILA / 25 Kum3ra / 25 third party. |

## Outstanding

1. **Delivery method.** The one thing left before the shop can open. See
   blocker 1 — the files now exist, but nothing yet hands them to a buyer.
2. **Outta' Line split** — the only thing keeping a released song off the shop.
3. **Three names.** The split percentages are enough to *sell*; the names are
   needed to *pay*. Currently recorded as shares only:
   - Made You — the producer (possibly "Cin" — confirm)
   - Gratitude and Top Form — the 50% collaborator
   - Energy — the third 25%
4. **Product images.** The eight products have no artwork at checkout. The
   files are ready in `images/art-*.jpg`; the upload tool was failing this
   session, so they go in by hand or on a later pass.

## Notes

- A percentage cannot be paid to "the producer". Get names before the first
  payout run, not before the first sale.
- The bundle is **seven songs**, not nine: Wine and Bubble is not ours and
  Outta' Line has no split. It becomes eight when Made You lands on 13 Aug —
  the product description lists the songs, so it needs editing that day too.
- The usage licence is written: `/license` on the site, and
  `tools/licence-for-downloads.txt` to drop into every ZIP.
- Fees are 2.9% + $0.30. A $2.99 single nets $2.60; the $14.99 bundle nets
  $14.26.
