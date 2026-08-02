"""CLI entry point.

    python -m engine.run my_list.txt opponent_list.txt
    python -m engine.run my_list.txt opponent_list.txt --json
    python -m engine.run my_list.txt opponent_list.txt --summary
    python -m engine.run my_list.txt opponent_list.txt --flags flags.txt

By default the full result is written to output/matchup.json and the readable
summary is printed. --json prints the raw JSON to stdout instead of the
summary; --summary prints only the summary (no file written unless --output).
"""

from __future__ import annotations

import argparse
import json
import sys
from difflib import SequenceMatcher
from pathlib import Path

from .data import AmbiguousName, Database, DataError, build_unit, normalize
from .flags import FlagError, parse_flags_file
from .matchup import MatchupReport
from .parse_list import parse_army_list
from .profiles import Unit
from .simulate import SimOptions

ROOT = Path(__file__).resolve().parent.parent


def resolve_army(text: str, db: Database, label: str,
                 warnings: list[str]) -> list[Unit]:
    parsed = parse_army_list(text)
    if not parsed.units:
        raise DataError(f"{label}: no unit found in the list — check the format")
    units: list[Unit] = []
    faction_hints = parsed.faction_hints
    for pu in parsed.units:
        sheet = None
        errors = []
        for hint in [*faction_hints, None]:
            try:
                sheet = db.find_datasheet(pu.name, hint)
                break
            except AmbiguousName:
                raise
            except DataError as err:
                errors.append(str(err))
        if sheet is None:
            raise DataError(f"{label}: {errors[-1]}")

        weapon_names = [normalize(w.name) for w in sheet.weapons]
        model_names = [normalize(m["name"]) for m in sheet.models]
        model_names.append(normalize(sheet.name))

        def best(name: str, pool: list[str]) -> float:
            q = normalize(name)
            return max((SequenceMatcher(None, q, c).ratio() for c in pool),
                       default=0.0)

        def is_weapon(name: str) -> bool:
            w, m = best(name, weapon_names), best(name, model_names)
            return w >= 0.7 and w >= m

        unit = build_unit(
            sheet,
            models=pu.model_count(is_weapon),
            points=pu.points,
            weapon_request=pu.weapon_request(is_weapon),
        )
        if pu.enhancements:
            unit.notes.append(
                "enhancements not simulated: " + ", ".join(pu.enhancements))
        for note in unit.notes:
            warnings.append(f"{label} / {unit.name}: {note}")
        units.append(unit)
    return units


def apply_flags(path: Path, armies: list[list[Unit]], warnings: list[str]) -> None:
    flag_map = parse_flags_file(path.read_text(encoding="utf-8"))
    all_units = [u for army in armies for u in army]
    for key, flags in flag_map.items():
        q = normalize(key)
        scored = sorted(all_units,
                        key=lambda u: SequenceMatcher(None, q, normalize(u.name)).ratio(),
                        reverse=True)
        target = scored[0] if scored else None
        if target and SequenceMatcher(None, q, normalize(target.name)).ratio() >= 0.7:
            target.flags = flags
        else:
            warnings.append(f"flags: no unit matching {key!r} — entry ignored")


def print_summary(report: MatchupReport, out=None) -> None:
    out = out if out is not None else sys.stdout
    data = report.to_dict()

    def fmt_pct(x: float) -> str:
        return f"{100 * x:5.1f}%"

    for direction, title in (("mine_vs_opp", "MY ARMY -> OPPONENT"),
                             ("opp_vs_mine", "OPPONENT -> MY ARMY")):
        print(f"\n=== {title} ===", file=out)
        rows = [m for m in data["matchups"] if m["direction"] == direction]
        rows.sort(key=lambda m: (m["attacker"], -m["p_destroyed"]))
        current = None
        for m in rows:
            if m["attacker"] != current:
                current = m["attacker"]
                print(f"\n{current}", file=out)
            print(f"  {m['phase']:<9} vs {m['defender']:<32}"
                  f" dmg {m['mean_damage']:6.2f}"
                  f"  kills {m['mean_models_killed']:5.2f}"
                  f"  wipe {fmt_pct(m['p_destroyed'])}"
                  f"  <half {fmt_pct(m['p_below_half'])}", file=out)

    print("\n=== PRIORITIES (expected points destroyed) ===", file=out)
    for side, label in (("mine", "MY UNITS"), ("opponent", "OPPONENT UNITS")):
        print(f"\n--- {label} ---", file=out)
        for entry in data["unit_summaries"][side]:
            print(f"\n{entry['unit']} ({entry['points']} pts)", file=out)
            for t in entry["top_targets"]:
                print(f"  target: {t['target']:<32} [{t['phase']}]"
                      f" wipe {fmt_pct(t['p_destroyed'])}"
                      f"  ~{t['expected_points_destroyed']} pts", file=out)
            for t in entry["top_threats"]:
                print(f"  threat: {t['threat']:<32} [{t['phase']}]"
                      f" wipe {fmt_pct(t['p_destroyed'])}", file=out)

    if data["meta"]["warnings"]:
        print("\n=== WARNINGS ===", file=out)
        for w in data["meta"]["warnings"]:
            print(f"  ! {w}", file=out)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m engine.run",
        description="Warhammer 40k mathhammer matchup matrix (Monte Carlo).")
    parser.add_argument("my_list", type=Path)
    parser.add_argument("opponent_list", type=Path)
    parser.add_argument("--json", action="store_true",
                        help="print raw JSON to stdout")
    parser.add_argument("--summary", action="store_true",
                        help="print only the readable summary")
    parser.add_argument("--iterations", type=int, default=20_000)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--optimal-range", action="store_true",
                        help="assume half range everywhere (RAPID FIRE, MELTA)")
    parser.add_argument("--flags", type=Path,
                        help="per-unit manual flags file (see engine/flags.py)")
    parser.add_argument("--data", type=Path, default=ROOT / "data" / "wahapedia")
    parser.add_argument("--output", type=Path, default=ROOT / "output" / "matchup.json")
    args = parser.parse_args(argv)

    try:
        db = Database(args.data)
        warnings: list[str] = []
        my_units = resolve_army(args.my_list.read_text(encoding="utf-8"),
                                db, "my_list", warnings)
        opp_units = resolve_army(args.opponent_list.read_text(encoding="utf-8"),
                                 db, "opponent_list", warnings)
        if args.flags:
            apply_flags(args.flags, [my_units, opp_units], warnings)
    except (DataError, FlagError, OSError) as err:
        print(f"error: {err}", file=sys.stderr)
        return 1

    opts = SimOptions(iterations=args.iterations, seed=args.seed,
                      optimal_range=args.optimal_range)
    report = MatchupReport(options=opts, my_units=my_units, opp_units=opp_units,
                           warnings=warnings)

    def progress(done: int, total: int) -> None:
        print(f"\r  simulating {done}/{total} matchups…", end="", file=sys.stderr)
        if done == total:
            print(file=sys.stderr)

    report.compute(progress=progress)
    data = report.to_dict()

    if args.json:
        json.dump(data, sys.stdout, indent=2, ensure_ascii=False)
        print()
        return 0

    if not args.summary or args.output != parser.get_default("output"):
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(data, indent=2, ensure_ascii=False),
                               encoding="utf-8")
        print(f"written: {args.output}", file=sys.stderr)

    print_summary(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
