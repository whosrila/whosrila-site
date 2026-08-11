#!/usr/bin/env python3
"""
Work out who is owed what from a Stripe payout export.

    python3 tools/splits.py stripe_export.csv
    python3 tools/splits.py stripe_export.csv --statements=payouts-aug

Stripe's export has gross, fee and net per transaction. Splits are applied to
NET — the money that actually landed — not to the sticker price, so nobody is
paid a share of a fee that was never received.

With --statements it also writes one plain-text statement per counterparty,
showing only the songs that person is on, ready to send with the payment.

Export the CSV from: Stripe Dashboard -> Payments -> Export, or
Balance -> Payouts -> the payout -> Download.

WHY THIS IS A MANUAL STEP. Stripe can split a payment automatically, but only
through Connect: the charge has to be created server-side as a Checkout
Session, a webhook has to fire on completion, and a Transfer has to be created
per recipient — and every collaborator needs their own connected account with
identity and bank details verified. Payment Links cannot do it at all. That is
a real backend and real onboarding friction for each person. At this
catalogue's size, exporting a CSV and paying a handful of people directly is
both cheaper and less to go wrong.
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

def blank_line():
    return {"units": 0, "net": 0.0, "b_units": 0, "b_net": 0.0, "pct": 0.0, "owed": 0.0}

def write_statements(detail, outdir, period, net_total):
    """One plain-text statement per counterparty, ready to send as-is.

    A collaborator should be able to check the arithmetic themselves without
    seeing the whole catalogue's takings, so each statement shows only the
    songs that person is on.
    """
    import os
    os.makedirs(outdir, exist_ok=True)
    written = []
    for who, songs in sorted(detail.items()):
        total = sum(s["owed"] for s in songs.values())
        if total < 0.005:
            continue
        safe = re.sub(r"[^A-Za-z0-9]+", "-", who).strip("-").lower()
        path = os.path.join(outdir, f"statement-{safe}.txt")
        L = []
        L.append("WHOSRILA — DIRECT SALES STATEMENT")
        L.append("=" * 42)
        L.append("")
        L.append(f"For:    {who}")
        if period:
            L.append(f"Period: {period}")
        L.append("")
        L.append("These are sales made directly from whosrila.com, not")
        L.append("streaming or distributor royalties, which are paid separately.")
        L.append("")
        L.append("Shares apply to NET — what actually landed after Stripe's")
        L.append("fee (2.9% + $0.30 per sale) — so nobody is paid a share of")
        L.append("a fee that was never received.")
        L.append("")
        L.append("-" * 42)
        for song, s in sorted(songs.items(), key=lambda x: -x[1]["owed"]):
            if s["owed"] < 0.005:
                continue
            L.append("")
            L.append(f"  {song.title()}")
            # pad the labels to a common width so the money column lines up
            if s["units"]:
                L.append(f"    {str(s['units']) + ' sold direct':<24}net  ${s['net']:>8,.2f}")
            if s["b_units"]:
                L.append(f"    {str(s['b_units']) + ' via the bundle':<24}net  ${s['b_net']:>8,.2f}")
            share_label = f"your share {s['pct']:g}%"
            L.append(f"    {share_label:<24}owed  ${s['owed']:>8,.2f}")
        L.append("")
        L.append("-" * 42)
        L.append(f"  TOTAL DUE{'':<20}${total:>9,.2f}")
        L.append("")
        L.append("Questions or a disagreement on any line — reply and we")
        L.append("will go through it. press@whosrila.com")
        L.append("")
        with open(path, "w") as f:
            f.write("\n".join(L) + "\n")
        written.append((who, total, path))
    return written

def main(path, outdir=None):
    owed = defaultdict(float)
    # who -> song -> line, so each person can be sent only their own songs
    detail = defaultdict(lambda: defaultdict(blank_line))
    per_song = defaultdict(lambda: {"count": 0, "net": 0.0})
    unmatched, unallocated = [], {"count": 0, "net": 0.0}
    gross_total = fee_total = net_total = 0.0
    dates = []

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
    c_date  = col("created", "created (utc)", "created date (utc)", "date")

    if not c_desc or not c_net:
        sys.exit("Could not find a description and a net column in that CSV. "
                 f"Columns present: {', '.join(cols)}")

    for r in rows:
        if c_stat and r.get(c_stat, "").strip().lower() in ("failed", "refunded", "canceled", "cancelled"):
            continue
        gross, fee, net = money(r.get(c_gross)), money(r.get(c_fee)), money(r.get(c_net))
        gross_total += gross; fee_total += fee; net_total += net
        if c_date and r.get(c_date):
            dates.append(str(r[c_date])[:10])

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
                    cut = share * pct / 100
                    owed[who] += cut
                    d = detail[who][s]
                    d["b_units"] += 1; d["b_net"] += share
                    d["pct"] = pct; d["owed"] += cut
            continue

        per_song[song]["count"] += 1
        per_song[song]["net"] += net
        for who, pct in SPLITS[song].items():
            cut = net * pct / 100
            owed[who] += cut
            d = detail[who][song]
            d["units"] += 1; d["net"] += net
            d["pct"] = pct; d["owed"] += cut

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

    if outdir:
        period = ""
        if dates:
            lo, hi = min(dates), max(dates)
            period = lo if lo == hi else f"{lo} to {hi}"
        written = write_statements(detail, outdir, period, net_total)
        print(f"\n  STATEMENTS — {len(written)} written to {outdir}/")
        for who, total, p in written:
            flag = "   <- NAME NEEDED, do not send" if "needed" in who.lower() else ""
            print(f"    {who:<28} ${total:>9,.2f}  {p.split('/')[-1]}{flag}")
    print()

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    flags = [a for a in sys.argv[1:] if a.startswith("-")]
    if len(args) < 1:
        sys.exit(__doc__)
    out = None
    for f in flags:
        if f.startswith("--statements"):
            out = f.split("=", 1)[1] if "=" in f else "statements"
    main(args[0], out)
