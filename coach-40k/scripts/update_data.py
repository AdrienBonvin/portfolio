#!/usr/bin/env python3
"""Download the Wahapedia data export (CSV files) into data/wahapedia/.

Wahapedia publishes its whole database as pipe-delimited, UTF-8 CSV files.
See: https://wahapedia.ru/wh40k11ed/the-rules/data-export/

Usage:
    python scripts/update_data.py                # 11th edition (default)
    python scripts/update_data.py --edition wh40k10ed
    python scripts/update_data.py --only Datasheets.csv Datasheets_wargear.csv

The script stamps data/wahapedia/EXPORT_DATE.txt with the download date and
the content of Last_update.csv so the freshness of the data is always known.

If wahapedia.ru is unreachable from your machine/environment (Cloudflare or
network policy), download the files listed in FILES manually from
https://wahapedia.ru/<edition>/<file> and drop them into data/wahapedia/.
"""

import argparse
import datetime
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = "https://wahapedia.ru"
DEFAULT_EDITION = "wh40k11ed"
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "wahapedia"

# Full export file list as documented on the Wahapedia "Data export" page.
FILES = [
    "Factions.csv",
    "Source.csv",
    "Datasheets.csv",
    "Datasheets_abilities.csv",
    "Datasheets_keywords.csv",
    "Datasheets_models.csv",
    "Datasheets_options.csv",
    "Datasheets_wargear.csv",
    "Datasheets_unit_composition.csv",
    "Datasheets_models_cost.csv",
    "Datasheets_stratagems.csv",
    "Datasheets_enhancements.csv",
    "Datasheets_detachment_abilities.csv",
    "Datasheets_leader.csv",
    "Stratagems.csv",
    "Abilities.csv",
    "Enhancements.csv",
    "Detachment_abilities.csv",
    "Last_update.csv",
]

# A browser-like User-Agent: the site sits behind Cloudflare and rejects
# default urllib requests.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
    ),
    "Accept": "text/csv,*/*;q=0.8",
}

RETRIES = 3


def download(url: str, dest: Path) -> None:
    last_err: Exception | None = None
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            # Sanity check: a Cloudflare challenge page is HTML, not CSV.
            head = data[:200].lstrip().lower()
            if head.startswith(b"<!doctype") or head.startswith(b"<html"):
                raise RuntimeError("got an HTML page instead of CSV (Cloudflare?)")
            dest.write_bytes(data)
            return
        except (urllib.error.URLError, RuntimeError, TimeoutError) as err:
            last_err = err
            if attempt < RETRIES:
                time.sleep(2 * attempt)
    raise RuntimeError(f"failed after {RETRIES} attempts: {last_err}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--edition", default=DEFAULT_EDITION,
                        help="Wahapedia edition slug (default: %(default)s)")
    parser.add_argument("--only", nargs="*", metavar="FILE",
                        help="download only these files instead of the full list")
    args = parser.parse_args()

    files = args.only if args.only else FILES
    unknown = [f for f in files if f not in FILES]
    if unknown:
        print(f"warning: not in the known export list: {', '.join(unknown)}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    for name in files:
        url = f"{BASE_URL}/{args.edition}/{name}"
        dest = DATA_DIR / name
        print(f"  {url} -> {dest.relative_to(Path.cwd()) if dest.is_relative_to(Path.cwd()) else dest}")
        try:
            download(url, dest)
        except RuntimeError as err:
            failures.append((name, err))
            print(f"    FAILED: {err}")

    if not failures:
        stamp = DATA_DIR / "EXPORT_DATE.txt"
        lines = [
            f"downloaded: {datetime.date.today().isoformat()}",
            f"edition: {args.edition}",
        ]
        last_update = DATA_DIR / "Last_update.csv"
        if last_update.exists():
            lines.append("last_update.csv content:")
            lines.append(last_update.read_text(encoding="utf-8-sig").strip())
        stamp.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"done. {len(files)} files in {DATA_DIR}")
        return 0

    print(f"\n{len(failures)} file(s) failed. If the site blocks this machine,")
    print(f"download them manually from {BASE_URL}/{args.edition}/<file>")
    print(f"and drop them into {DATA_DIR}/ :")
    for name, _ in failures:
        print(f"  - {name}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
