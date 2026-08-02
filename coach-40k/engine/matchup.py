"""Compute the full matchup matrix between two armies.

For every (attacker unit, defender unit) pair, in both directions, for both
phases (shooting and melee), run the Monte Carlo simulation of one full
activation and collect the stats. Then build per-unit summaries: top 3
priority targets and top 3 threats.

Priority score = P(destroy target) x target points, i.e. the expected victory
points removed by dedicating this unit's activation to that target. The best
phase (shooting or melee) is used for the ranking.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .analytic import expected_damage
from .profiles import Unit, Weapon
from .simulate import MatchupStats, SimOptions, simulate_matchup

PHASES = ("shooting", "melee")


def select_weapons(attacker: Unit, defender: Unit, phase: str,
                   opts: SimOptions) -> list[Weapon]:
    """Pick the weapons actually used for one activation in this phase.

    Ranged: every ranged weapon fires. Melee: a model uses a single melee
    weapon, so among profiles/alternatives sharing a profile group we keep
    the one with the best expected damage vs this defender; EXTRA ATTACKS
    weapons are always added on top. Multi-profile ranged weapons (e.g.
    standard/supercharge) are also reduced to their best profile.
    """
    kind = "ranged" if phase == "shooting" else "melee"
    candidates = attacker.weapons_for_phase(kind)
    groups: dict[str, list[Weapon]] = {}
    extras: list[Weapon] = []
    for w in candidates:
        if w.abilities.extra_attacks:
            extras.append(w)
        else:
            groups.setdefault(w.profile_group, []).append(w)

    chosen: list[Weapon] = []
    for group in groups.values():
        if len(group) == 1:
            chosen.append(group[0])
        else:
            chosen.append(max(
                group,
                key=lambda w: expected_damage(w, attacker, defender, phase, opts,
                                              cap_per_wound=True),
            ))
    # In melee every model always fights: extra-attacks weapons stack.
    chosen.extend(extras)
    return chosen


@dataclass
class MatchupReport:
    options: SimOptions
    my_units: list[Unit]
    opp_units: list[Unit]
    results: list[MatchupStats] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def compute(self, progress=None) -> None:
        pairs = [("mine_vs_opp", a, d) for a in self.my_units for d in self.opp_units]
        pairs += [("opp_vs_mine", a, d) for a in self.opp_units for d in self.my_units]
        total = len(pairs) * len(PHASES)
        done = 0
        for direction, attacker, defender in pairs:
            for phase in PHASES:
                weapons = select_weapons(attacker, defender, phase, self.options)
                if weapons:
                    stats = simulate_matchup(
                        attacker, defender, weapons, phase, self.options)
                    stats.notes.append(direction)
                    self.results.append(stats)
                done += 1
                if progress:
                    progress(done, total)

    # ------------------------------------------------------------- summary
    def _best_per_pair(self, direction: str) -> dict[tuple[str, str], MatchupStats]:
        """Best phase per (attacker, defender) for a given direction."""
        best: dict[tuple[str, str], MatchupStats] = {}
        for r in self.results:
            if direction not in r.notes:
                continue
            key = (r.attacker, r.defender)
            if key not in best or r.p_destroyed > best[key].p_destroyed or (
                    r.p_destroyed == best[key].p_destroyed
                    and r.mean_damage > best[key].mean_damage):
                best[key] = r
        return best

    def unit_summaries(self) -> dict:
        opp_points = {u.name: u.points for u in self.opp_units}
        my_points = {u.name: u.points for u in self.my_units}
        mine_atk = self._best_per_pair("mine_vs_opp")
        opp_atk = self._best_per_pair("opp_vs_mine")

        def top_targets(unit_name: str, table, points_of) -> list[dict]:
            rows = [r for (a, _d), r in table.items() if a == unit_name]
            rows.sort(key=lambda r: r.p_destroyed * points_of.get(r.defender, 0),
                      reverse=True)
            return [{
                "target": r.defender,
                "phase": r.phase,
                "p_destroyed": round(r.p_destroyed, 3),
                "mean_models_killed": round(r.mean_models_killed, 2),
                "expected_points_destroyed": round(
                    r.p_destroyed * points_of.get(r.defender, 0), 1),
            } for r in rows[:3]]

        def top_threats(unit_name: str, table) -> list[dict]:
            rows = [r for (_a, d), r in table.items() if d == unit_name]
            rows.sort(key=lambda r: (r.p_destroyed, r.mean_models_killed), reverse=True)
            return [{
                "threat": r.attacker,
                "phase": r.phase,
                "p_destroyed": round(r.p_destroyed, 3),
                "mean_models_killed": round(r.mean_models_killed, 2),
            } for r in rows[:3]]

        return {
            "mine": [{
                "unit": u.name,
                "points": u.points,
                "top_targets": top_targets(u.name, mine_atk, opp_points),
                "top_threats": top_threats(u.name, opp_atk),
            } for u in self.my_units],
            "opponent": [{
                "unit": u.name,
                "points": u.points,
                "top_targets": top_targets(u.name, opp_atk, my_points),
                "top_threats": top_threats(u.name, mine_atk),
            } for u in self.opp_units],
        }

    def to_dict(self) -> dict:
        def unit_info(u: Unit) -> dict:
            return {
                "name": u.name, "faction": u.faction, "points": u.points,
                "models": u.models, "toughness": u.toughness,
                "save": u.save, "invuln": u.invuln, "wounds_per_model": u.wounds,
                "fnp": u.flags.fnp or u.fnp,
                "flags": u.flags.raw,
                "weapons": [f"{w.count}x {w.name}" for w in u.weapons],
                "notes": u.notes,
                "abilities_not_simulated": u.abilities_text,
            }

        return {
            "meta": {
                "iterations": self.options.iterations,
                "seed": self.options.seed,
                "optimal_range": self.options.optimal_range,
                "warnings": self.warnings,
            },
            "my_army": [unit_info(u) for u in self.my_units],
            "opponent_army": [unit_info(u) for u in self.opp_units],
            "matchups": [
                {**r.to_dict(),
                 "direction": ("mine_vs_opp" if "mine_vs_opp" in r.notes
                               else "opp_vs_mine")}
                for r in self.results
            ],
            "unit_summaries": self.unit_summaries(),
        }
