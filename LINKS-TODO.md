# Missing streaming links — to fill in

Which per-song links are still missing, and why. Add a link here and it can go
straight onto the song page.

**iTunes (buy) — complete.** All 9 released songs have a verified purchase link.

| Song | Have | Missing |
|---|---|---|
| Blue Notes | 7 | SoundCloud, Amazon Music, YouTube Music |
| For Me | 6 | SoundCloud, Audiomack, Amazon Music, YouTube Music |
| Fully Meech (Acoustic) | 6 | Tidal, Audiomack, Amazon Music, YouTube Music |
| Gratitude | 8 | Amazon Music, YouTube Music |
| Kingston | 7 | SoundCloud, Amazon Music, YouTube Music |
| Outta' Line | 8 | Amazon Music, YouTube Music |
| Protection | 8 | Amazon Music, YouTube Music |
| Top Form | 7 | Audiomack, Amazon Music, YouTube Music |
| Wine and Bubble | 6 | SoundCloud, Audiomack, Amazon Music, YouTube Music |

## Why each is missing

**Amazon Music** — no public API and the pages are login-gated, so per-song URLs
can't be derived. Only the artist page is known.

**YouTube Music** — tracks sit on an auto-generated Topic channel with different
IDs from the videos on the main channel; no reliable way to map them.

**SoundCloud** — only 5 of the 9 are uploaded there (Top Form, Outta' Line,
Fully Meech, Gratitude, Protection). The rest aren't missing links, they're not
on the platform.

**Audiomack** — same: 5 uploaded (Blue Notes, Gratitude, Kingston, Outta' Line,
Protection).

**Tidal / Deezer / Pandora** — gaps are where the distributor didn't deliver the
track, not a lookup failure.

**Spotify — complete.** Wine and Bubble was the last gap. It's a Jon Dela record
(album *Don't Forget Your Loved Ones*, ISRC QZHZ52659621) that WHOSRILA is
featured on, so it never appeared on the WHOSRILA discography and the public
link APIs couldn't match it. Supplied directly and now live on the page.

Everything still listed as missing above is a platform the track genuinely
isn't on, not a lookup that failed. Nothing here needs chasing.

## How to add one

Paste the URL here and it gets added to that song's page, tracked automatically
by `js/track.js` with the platform and song name attached.

