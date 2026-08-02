# coach-40k

Warhammer 40k (11th edition) mathhammer engine. Feeds a Claude Project: you
paste two army lists, Claude clones this repo, runs the engine, and reads the
matchup matrix back to you. **The LLM never computes probabilities itself —
all numbers come from the Monte Carlo engine.**

Python 3.11+, standard library only. No pip install needed.

## Quick start

```
python -m engine.run my_list.txt opponent_list.txt
```

- `my_list.txt` / `opponent_list.txt`: text exports from the official GW app
  (hand-written lists work too, see below).
- Writes `output/matchup.json` (full data) and prints a readable summary.
- `--json` prints the raw JSON to stdout; `--summary` prints only the summary.
- `--iterations N` (default 20 000 per pair), `--seed N` (default 0,
  deterministic runs).
- `--optimal-range` assumes half range everywhere (RAPID FIRE and MELTA
  bonuses active).
- `--flags flags.txt` applies manual per-unit modifiers (see below).

Run the test suite with `python -m pytest tests/` (needs `pip install pytest`).

## Weekly workflow (Claude Project)

1. Open a new conversation in the Claude Project.
2. Paste both lists (GW app export format).
3. Claude clones the repo, writes the lists to files, runs
   `python -m engine.run my_list.txt opponent_list.txt --json`, and presents
   the matchup matrix, priority targets and threats.
4. If the engine reports ambiguous unit names, Claude shows the candidates
   and asks which one you meant — it never guesses.
5. Free-text abilities the engine ignored are listed in the output
   (`abilities_not_simulated`, `warnings`); add manual flags for the ones
   that matter and re-run.

Mission questions use `missions/*.md` pasted into context (see
`missions/README.md` — ⚠ to populate).

## Data

Wahapedia CSV export, 11th edition. **⚠ Not committed yet** — the build
environment could not reach wahapedia.ru. To populate/refresh:

```
python scripts/update_data.py
```

then commit. Details, manual fallback, and file list: `data/wahapedia/README.md`.
The export date is stamped in `data/wahapedia/EXPORT_DATE.txt`. Re-run after
each GW balance dataslate or points update.

## List format

The parser accepts the official GW app text export:

```
My list (2000 points)

Tyranids
Strike Force (2000 points)
Invasion Fleet

CHARACTERS

Hive Tyrant (235 points)
  • 1x Monstrous bonesword and lash whip

OTHER DATASHEETS

Termagants (60 points)
  • 10x Termagant
    ◦ 10x Fleshborer
```

Minimal hand-written lists also work — one `Unit Name (points)` line per
unit, optional `- 10x Model` / `- 10x Weapon` bullets. Model count falls back
to matching the points cost against the datasheet's cost table, then to the
minimum unit size (with a warning).

Unit and weapon names are fuzzy-matched against Wahapedia datasheets.
Ambiguities raise an error listing the candidates instead of guessing.

## Manual flags

Free-text abilities (auras, stratagems, detachment rules…) are ignored by
default and compensated with explicit flags:

```
# flags.txt — unit name : comma-separated flags
Hive Tyrant: +1 to wound, reroll hits, charged
Termagants: cover, fnp 6+
```

Full flag list: docstring of `engine/flags.py`.

## What the engine computes

For every (attacker unit → defender unit) pair, both directions, shooting and
melee, one full activation (all weapons of the chosen profile), Monte Carlo
with ≥ 20 000 iterations:

- mean damage (post Feel No Pain) and mean models killed;
- P(unit destroyed) and P(reduced below half strength);
- kill distribution percentiles (p50 / p90).

Per-unit summary: top 3 priority targets ranked by **expected points
destroyed** (P(destroy) × target points, best phase) and top 3 threats
against the unit.

## Handled automatically vs manual flags

**Native (parsed from Wahapedia weapon data):** full attack sequence
(Attacks → Hit → Wound → Save armour/invuln with AP → Damage → FNP → per-model
allocation with lost excess damage), Sustained Hits X, Lethal Hits,
Devastating Wounds, Anti-X N+, Torrent, Blast, Twin-linked, Rapid Fire X,
Melta X, Heavy, Lance, Ignores Cover, hit/wound modifier cap ±1, benefit of
cover (incl. the 3+/AP0 exception), Feel No Pain from datasheet abilities,
best-profile selection for multi-profile weapons (strike/sweep…), Extra
Attacks weapons stacking in melee.

**Manual flags required for:** any free-text ability — auras, stratagems,
detachment rules, enhancements. Cover, stationary (Heavy), charged (Lance),
half range (Rapid Fire/Melta), rerolls, ±1 hit/wound, Stealth, -1 damage,
half damage, FNP/invuln overrides, extended crit ranges (5+).

## Known limits

- **One activation in a vacuum**: no terrain, no movement/range checking
  (range assumptions via flags), no morale/battle-shock, no leader-joined
  units (simulate the bodyguard and leader separately), no strat interaction.
- **Damage output convention**: `mean_damage` is post-FNP, pre-allocation
  (UnitCrunch convention); allocation losses show up in
  `mean_models_killed`. Simulation of a pair stops once the target is wiped.
- Mixed-toughness units use their first model profile (warned in output).
- Pistols are fired alongside other weapons (rules say pistol *or* the
  rest); One Shot weapons fire in the one simulated activation.
- Devastating Wounds implemented per the current rules: no save of any kind,
  normal allocation, FNP applies, no spill between models.
- Mortal wounds from abilities (not weapon attacks) are not modeled.
- Rerolls target failures only — no crit-fishing rerolls of successful
  non-crit rolls.
- Priority ranking uses P(destroy) × points; a unit that cannot be wiped in
  one activation scores 0 even if chip damage is strategically useful — read
  `mean_damage` alongside it.

## Validation

`tests/` contains 58 tests, including a battery of Monte Carlo runs checked
against hand-computed closed-form expectations (each test documents its
math) and exact wipe-probability cases. `tests/reference_matchups.md` is the
log for UnitCrunch cross-checks on real profiles (⚠ pending data download —
run the 3 Tyranid checks listed there once data is in).
