# Release day checklist

What to change when an upcoming song actually comes out. Same steps every
time. Next up: **Made You — 13 August 2026**.

Nothing here is urgent on the day itself — the page does not break at
midnight. The countdown switches itself to "Out now" and the Feature.fm
embed converts from pre-save to streaming links on its own. This checklist
is about replacing that embed with our own links, which is what makes the
click-throughs trackable.

---

## Why bother, if the embed already works

Clicks inside the Feature.fm iframe happen on their domain, not ours. Our
pixel cannot see them. Every song page that uses `.listen-list` instead
reports each click with the platform and song name attached — that is the
data Meta and Google optimise against. Leaving a released song on the
embed means paying for ads you cannot measure.

---

## Steps

### 1. Collect the links

Once the song is live, the same lookups used for the other nine work:

```bash
curl -s "https://api.song.link/v1-alpha.1/links?url=<any-store-url>&userCountry=US"
```

Take the iTunes buy link from Apple's own API rather than Odesli — Odesli
has served a bad iTunes URL before (see the Fully Meech note in
`LINKS-TODO.md`). It must contain `app=itunes` or it opens Apple Music and
the visitor cannot buy:

```bash
curl -s "https://itunes.apple.com/lookup?id=<track-id>&entity=song"
```

If the song is credited to another artist, the lookups will not find it —
that was the Wine and Bubble case. Paste the link in by hand.

### 2. Swap the embed for the link list

On the song page, delete the `.embed-frame` block and the `.fallback`
paragraph under it, and put this in their place. **iTunes goes first** —
that rule holds on every song page.

```html
<p class="listen-note">Listen or buy</p>
<div class="listen-list">
  <a class="lrow lrow-buy" href="ITUNES_URL_WITH_app=itunes" target="_blank" rel="noopener">
    <span class="ldot ldot-itunes"></span>
    <span class="ltext">
      <span class="lname">iTunes</span>
      <span class="lsub">Own the song</span>
    </span>
    <span class="lgo">Buy</span>
  </a>
  <a class="lrow" href="SPOTIFY_URL" target="_blank" rel="noopener">
    <span class="ldot ldot-spotify"></span>
    <span class="ltext"><span class="lname">Spotify</span></span>
    <span class="lgo">Play</span>
  </a>
  <!-- then Apple Music, Deezer, Tidal, SoundCloud, Audiomack, Pandora -->
</div>
```

Order after iTunes: Spotify, Apple Music, Deezer, Tidal, SoundCloud,
Audiomack, Pandora. Skip any the song is not on. The dot classes are
`ldot-apple`, `ldot-deezer`, `ldot-tidal`, `ldot-soundcloud`,
`ldot-audiomack`, `ldot-pandora`.

No tracking attributes are needed. `js/track.js` matches on the URL, so a
correct link is tracked the moment it is on the page.

### 3. Delete the countdown

Remove the `<div class="countdown">` block and the `<script>` at the
bottom holding `RELEASE_DATE_ISO`. The "Out now" state is only there to
stop a stale clock looking broken — a released song should not have one.

### 4. Fix the wording

Three places still say the song is coming:

- `<span class="stamp">` — becomes `SINGLE &middot; OUT NOW`
- `<p class="hook">` — drop "pre-save it now" and the date
- `<meta name="description">`, `og:description`, `twitter:description` —
  all three carry the same sentence

### 5. Homepage

- Move the card out of `.upcoming-grid` and into the tracklist in date
  order, with its real duration
- Its `.btn-primary` says **Pre-Save** — that becomes a normal link
- Check `js/mailinglist.js` and the `#notify` copy: it names Angels On
  Sofa and Bombs Away as the songs without pre-save links, so that
  sentence needs revisiting as each one lands

### 6. Check it

```bash
python3 -m http.server 8934
```

Open the page and confirm: artwork and preview and links all measure the
same width, iTunes is the first row and opens the store (not Apple
Music), and the console is clean apart from the Cloudflare beacon, which
always fails on localhost.

---

## Tracking

Already wired, nothing to do per release:

| Event | Fires when | Meta | Google |
|---|---|---|---|
| `PlatformClick` | any streaming/store link | `Lead` | GA4 event |
| `PlatformClick` (iTunes) | the buy link | `InitiateCheckout` | GA4 event |
| `PreSaveClick` | a Feature.fm link | `Lead` | GA4 event |
| `PreviewPlay` | the audio preview | custom | GA4 event |
| `VideoPlay` | a video thumbnail | custom | GA4 event |

Every event carries `song` and, where relevant, `platform`, so one event
type still breaks down per song — no separate pixel per song needed.

**Google is not live yet.** `js/consent.js` has `GA4` and `ADS` set to
empty strings, which loads nothing. Fill either one in and Google switches
on across all 20 pages at once. Two things to do at the same time:

1. Add Google to `/privacy` — it currently names only Meta and Cloudflare
2. For Ads conversions rather than plain GA4 events, create the conversion
   in Google Ads and paste its send-to string into `WR_ADS_CONVERSIONS`

Both pixels only start after consent in the UK/EEA. That is deliberate and
should stay that way.
