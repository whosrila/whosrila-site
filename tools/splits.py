#!/usr/bin/env python3
"""
Work out who is owed what from a Stripe payout export.

    python3 tools/splits.py stripe_export.csv

Stripe's export has gross, fee and net per transaction. Splits are applied to
NET — the money that actually landed — not to the sticker price, so nobody is
paid a share of a fee that was never received.

Export it from: Stripe Dashboard -> Payments -> Export, or
Balance -> Payouts -> the payout -> Download.
"""
import csv, sys, re
from collections import defaultdict

# Shares per song. Names are placeholders where WHOSRILA has not supplied them
# yet — a percentage cannot be paid to "producer", so these must be filled in
# before any real payout run.
SPLITS = {
    "for me":                {"WHOSRILA": 100},
    "fully meech":           {"WHOSRILA": 100},
    "kingston":              {"WHOSRILA": 100},
    "blue notes":            {"WHOSRILA": 100},
    "protection":            {"WHOSRILA": 100},
    "made you":              {"WHOSRILA": 50, "PRODUCER (name needed)": 50},
    "gratitude":             {"WHOSRILA": 50, "COLLAB (name needed)": 50},
    "top form":              {"WHOSRILA": 50, "COLLAB (name needed)": 50},
    "angels on sofa":        {"WHOSRILA": 100/3, "Pascal Pressure": 100/3, "Justice Case": 100/3},
    "energy":                {"WHOSRILA": 50, "Kum3ra": 25, "THIRD PARTY (name needed)": 25},
    # Outta' Line deliberately absent — split not yet decided. Sales of it will
    # be reported as unallocated rather than silently assumed to be 100%.
}

# A bundle is not one song, so it cannot carry one split. Its net is divided
# equally across the songs inside it and each song's own split then applies.
# Wine and Bubble is excluded: it is Jon Dela's record, not WHOSRILA's to sell.
BUNDLE_KEYS = ("bundle", "all nine", "all 9", "complete", "everything")
BUNDLE_CONTENTS = [
    "for me", "fully meech", "kingston", "blue notes",
    "protection", "gratitude", "top form",
]

def match(desc):
    """Find which song a line item refers to."""
    d = desc.lower()
    if any(k in d for k in BUNDLE_KEYS):
        return "__bundle__"
    for song in SPLITS:
        if song in d:
            return song
    if "outta" in d:
        return "__unknown__"
    return None

def money(v):
    try:
        return float(re.sub(r"[^0-9.\-]", "", str(v)) or 0)
    except ValueError:
        return 0.0

def main(path):
    owed = defaultdict(float)
    per_song = defaultdict(lambda: {"count": 0, "net": 0.0})
    unmatched, unallocated = [], {"count": 0, "net": 0.0}
    gross_total = fee_total = net_total = 0.0

    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    # Stripe's column names vary by export; find them rather than assume
    cols = rows[0].keys() if rows else []
    def col(*names):
        for n in names:
            for c in cols:
                if c.strip().lower() == n:
                    return c
        return None
    c_desc  = col("description", "product", "line item", "statement descriptor")
    c_gross = col("amount", "gross", "converted amount")
    c_fee   = col("fee", "converted fee")
    c_net   = col("net", "converted net")
    c_stat  = col("status")

    if not c_desc or not c_net:
        sys.exit("Could not find a description and a net column in that CSV. "
                 f"Columns present: {', '.join(cols)}")

    for r in rows:
        if c_stat and r.get(c_stat, "").strip().lower() in ("failed", "refunded", "canceled", "cancelled"):
            continue
        gross, fee, net = money(r.get(c_gross)), money(r.get(c_fee)), money(r.get(c_net))
        gross_total += gross; fee_total += fee; net_total += net

        song = match(r.get(c_desc, ""))
        if song is None:
            unmatched.append(r.get(c_desc, "")[:60]); continue
        if song == "__unknown__":
            unallocated["count"] += 1; unallocated["net"] += net; continue
        if song == "__bundle__":
            share = net / len(BUNDLE_CONTENTS)
            per_song["bundle"]["count"] += 1
            per_song["bundle"]["net"] += net
            for s in BUNDLE_CONTENTS:
                for who, pct in SPLITS[s].items():
                    owed[who] += share * pct / 100
            continue

        per_song[song]["count"] += 1
        per_song[song]["net"] += net
        for who, pct in SPLITS[song].items():
            owed[who] += net * pct / 100

    print(f"\n  {len(rows)} rows read")
    print(f"  gross ${gross_total:,.2f}   fees ${fee_total:,.2f}   net ${net_total:,.2f}")

    print("\n  BY SONG")
    for song, d in sorted(per_song.items(), key=lambda x: -x[1]["net"]):
        print(f"    {song:<20} {d['count']:>4} sales   net ${d['net']:>9,.2f}")

    print("\n  OWED")
    for who, amt in sorted(owed.items(), key=lambda x: -x[1]):
        flag = "   <- NAME NEEDED" if "needed" in who.lower() else ""
        print(f"    {who:<28} ${amt:>9,.2f}{flag}")

    if unallocated["count"]:
        print(f"\n  UNALLOCATED — no split agreed yet")
        print(f"    Outta' Line          {unallocated['count']:>4} sales   net ${unallocated['net']:>9,.2f}")

    if unmatched:
        print(f"\n  UNMATCHED — {len(unmatched)} rows did not name a known song")
        for u in sorted(set(unmatched))[:8]:
            print(f"    {u}")
        print("    (add the product name to SPLITS, or rename the Stripe product to match)")

    check = sum(owed.values()) + unallocated["net"]
    print(f"\n  allocated ${sum(owed.values()):,.2f} + unallocated ${unallocated['net']:,.2f} = ${check:,.2f}")
    print(f"  net received                                    ${net_total:,.2f}")
    if abs(check - net_total) > 0.01 and not unmatched:
        print("  ** these should match — check the split percentages sum to 100 **")
    print()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
