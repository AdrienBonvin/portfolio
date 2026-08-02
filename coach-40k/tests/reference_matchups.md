# Reference matchups — UnitCrunch comparison log

Purpose: track that the engine stays within **2%** of UnitCrunch
(https://www.unitcrunch.com) on real profiles. Add a row each time you check
one; investigate any drift > 2%.

## How to compare

1. Make sure `data/wahapedia/` is populated (see that folder's README).
2. Build a one-unit list file for the attacker and one for the defender,
   then run with enough iterations to stabilise the mean:

   ```
   python -m engine.run atk.txt def.txt --iterations 100000 --summary
   ```

3. In UnitCrunch, configure the same attack (same range assumptions: the
   engine only applies RAPID FIRE / MELTA with `--optimal-range` or the
   `half range` flag) and compare mean damage / mean kills.

## Checks to run once real data is in (⚠ pending)

⚠ The environment that generated this repo had no access to wahapedia.ru, so
these three standard Tyranid checks could not be executed yet. Run them after
populating the data and fill the table:

1. **Termagants (10, fleshborers) → Space Marine Intercessors (5)** — volume
   small-arms fire into MEQ.
2. **Hive Tyrant (melee) → Intercessors (5)** — high-skill multi-damage melee
   into 2W bodies.
3. **Carnifex → Rhino / any T9-10 vehicle** — monster melee into vehicle,
   checks the wound table low end and multi-damage allocation.

## Results log

| date | attacker (loadout) | defender | phase | engine mean dmg | UnitCrunch mean dmg | Δ % | engine mean kills | UnitCrunch kills | Δ % | notes |
|------|--------------------|----------|-------|-----------------|---------------------|-----|-------------------|------------------|-----|-------|
|      |                    |          |       |                 |                     |     |                   |                  |     |       |

Notes:
- UnitCrunch "damage" = post-FNP damage; the engine's `mean_damage` is the
  same convention (allocation losses are visible in `mean_models_killed`).
- Differences of ±0.5% are Monte Carlo noise at 20k iterations; bump
  `--iterations` before concluding there is a real gap.
