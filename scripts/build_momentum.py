#!/usr/bin/env python3
"""Write assets/data/momentum.json: cumulative clones and commits for the home page.

The home page draws its two History charts from this file, then tries to refresh
them in the browser from the same public sources. Rerun this script to update
the fallback copy the page ships with.

  python3 scripts/build_momentum.py --vigil /path/to/vigil-clone

Clones come from Vigil-SOC/metrics (data/traffic_daily.csv), read from GitHub
unless --metrics-csv names a local copy. Commits come from the history of a
full (not shallow) clone of Vigil-SOC/vigil: non-merge commits by commit date
on --ref, the convention GitHub's commit activity uses.
Standard library only.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import pathlib
import subprocess
import urllib.request

METRICS_CSV = "https://raw.githubusercontent.com/Vigil-SOC/metrics/main/data/traffic_daily.csv"
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "data" / "momentum.json"


def read_csv(source: str) -> list[dict]:
    if source.startswith("https://"):
        with urllib.request.urlopen(source, timeout=30) as resp:
            text = resp.read().decode("utf-8")
    else:
        text = pathlib.Path(source).read_text(encoding="utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def cumulative_clones(rows: list[dict]) -> dict:
    rows = sorted(rows, key=lambda r: r["date"])
    total, daily = 0, []
    for r in rows:
        total += int(r["clones"])
        daily.append(total)
    return {"start": rows[0]["date"], "daily": daily}


def cumulative_commits(repo: str, ref: str) -> dict:
    out = subprocess.run(
        ["git", "-C", repo, "log", "--no-merges", "--format=%cs", ref],
        check=True, capture_output=True, text=True,
    ).stdout.split()
    per_day: dict[str, int] = {}
    for d in out:
        per_day[d] = per_day.get(d, 0) + 1
    first = dt.date.fromisoformat(min(per_day))
    last = dt.date.fromisoformat(max(per_day))
    total, daily, day = 0, [], first
    while day <= last:
        total += per_day.get(day.isoformat(), 0)
        daily.append(total)
        day += dt.timedelta(days=1)
    return {"start": first.isoformat(), "daily": daily}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--vigil", required=True, help="path to a full clone of Vigil-SOC/vigil")
    ap.add_argument("--ref", default="origin/HEAD", help="branch or ref to count (default origin/HEAD)")
    ap.add_argument("--metrics-csv", default=METRICS_CSV, help="traffic_daily.csv path or URL")
    args = ap.parse_args()

    data = {
        "generated": dt.date.today().isoformat(),
        "clones": cumulative_clones(read_csv(args.metrics_csv)),
        "commits": cumulative_commits(args.vigil, args.ref),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {OUT}: clones {data['clones']['daily'][-1]:,}, commits {data['commits']['daily'][-1]:,}")


if __name__ == "__main__":
    main()
