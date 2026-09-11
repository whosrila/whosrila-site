#!/usr/bin/env python3
"""
Pull the real store URLs out of a Feature.fm / too.fm smart link.

The page is a Nuxt app and the store URLs are not in the HTML as links — each
one is base64'd inside a tracking payload. Decoding those is the only way to
read them without a browser, which matters because this runs on a schedule.

Feature.fm's Apple/iTunes URLs carry at= and ct= affiliate tokens that credit
the commission to Feature.fm rather than the artist, so every URL is stripped
of tracking before being returned.

Usage:  python3 tools/smartlink-links.py <smartlink-url>
"""
import base64, json, re, sys, urllib.parse, urllib.request

TRACKING = {
    'at', 'ct', 'src', 'lid', 'cid', 'uo', 'app_id', 'ls',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'si', 'nd', 'sh', 'share-user-id', 'tag', 'ref', 'referrer',
}

def clean(url: str) -> str:
    """Strip affiliate and analytics params; unwrap branch deep links."""
    # pandora.app.link and friends wrap the real URL in $desktop_url
    if 'app.link' in url or '$desktop_url=' in url:
        q = urllib.parse.urlparse(url).query
        desk = urllib.parse.parse_qs(q).get('$desktop_url')
        if desk:
            url = desk[0]
    p = urllib.parse.urlparse(url)
    keep = [(k, v) for k, v in urllib.parse.parse_qsl(p.query)
            if k.lower() not in TRACKING and not k.startswith('$') and not k.startswith('~')]
    return urllib.parse.urlunparse(p._replace(query=urllib.parse.urlencode(keep)))

def decode_payloads(blob: str):
    """Every store link carries a base64 JSON payload with destUrl + srvc."""
    found = {}
    for raw in re.findall(r'[A-Za-z0-9_-]{120,}', blob):
        b = raw.replace('-', '+').replace('_', '/')
        b += '=' * (-len(b) % 4)
        try:
            txt = base64.b64decode(b).decode('utf-8', 'ignore')
        except Exception:
            continue
        m_url = re.search(r'"destUrl":"(.*?)","srvc":"([a-z0-9]+)"', txt)
        if m_url:
            found.setdefault(m_url.group(2), clean(m_url.group(1).replace('\\/', '/')))
    return found

def main():
    url = sys.argv[1] if len(sys.argv) > 1 else 'https://too.fm/rrj4373'
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'})
    html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    blob = re.search(r'window\.__NUXT__\s*=\s*(.*?)</script>', html, re.S)
    if not blob:
        print('could not find the page data', file=sys.stderr); sys.exit(2)
    blob = blob.group(1)

    names = re.findall(r'serviceName:"([^"]+)"', blob)
    links = decode_payloads(blob)
    print(json.dumps({'services': names, 'links': links}, indent=1))

if __name__ == '__main__':
    main()
