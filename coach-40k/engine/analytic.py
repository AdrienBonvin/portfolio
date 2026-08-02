"""Exact expected-damage computation for a weapon vs a target.

Used for two things:
- picking the best profile of multi-profile weapons (strike vs sweep,
  standard vs supercharge) before simulating;
- cross-checking the Monte Carlo engine in the test suite (the MC mean must
  converge to these closed-form values).

It computes expected TOTAL damage after Feel No Pain, before per-model
allocation (allocation losses are inherently distributional, that is what the
Monte Carlo run is for).
"""

from __future__ import annotations

from itertools import product

from .dice import Dice
from .profiles import Unit, Weapon
from .simulate import SimOptions, build_plan


def _die_outcomes(reroll: str, success_fn, crit_fn):
    """Yield (probability, success, crit) over a d6 with a reroll policy.

    Rerolls happen before modifiers; only failed rolls (or natural 1s for the
    "ones" policy) are rerolled, and a die can only be rerolled once.
    """
    for d1 in range(1, 7):
        p1 = 1 / 6
        s1, c1 = success_fn(d1), crit_fn(d1)
        reroll_this = (reroll == "ones" and d1 == 1) or (reroll == "fails" and not s1)
        if not reroll_this:
            yield p1, s1, c1
        else:
            for d2 in range(1, 7):
                yield p1 / 6, success_fn(d2), crit_fn(d2)


def _probs(reroll: str, success_fn, crit_fn) -> tuple[float, float]:
    """Return (P(success and crit), P(success and not crit))."""
    p_crit = p_noncrit = 0.0
    for p, s, c in _die_outcomes(reroll, success_fn, crit_fn):
        if s and c:
            p_crit += p
        elif s:
            p_noncrit += p
    return p_crit, p_noncrit


def _damage_distribution(dice: Dice) -> list[tuple[int, float]]:
    """Exact distribution of a dice expression as [(value, prob)]."""
    if dice.n == 0:
        return [(dice.flat, 1.0)]
    outcomes: dict[int, float] = {}
    p_each = (1 / dice.sides) ** dice.n
    for rolls in product(range(1, dice.sides + 1), repeat=dice.n):
        total = sum(rolls) + dice.flat
        outcomes[total] = outcomes.get(total, 0.0) + p_each
    return sorted(outcomes.items())


def expected_damage(weapon: Weapon, attacker: Unit, defender: Unit,
                    phase: str, opts: SimOptions | None = None,
                    cap_per_wound: bool = False) -> float:
    """Expected total damage (post-FNP) of a full activation of this weapon.

    With cap_per_wound=True, damage per unsaved wound is capped at the
    defender's wounds per model ("useful" damage: the excess is lost to
    allocation anyway). Used to pick the best weapon profile.
    """
    opts = opts or SimOptions()
    p = build_plan(weapon, attacker, defender, opts, phase)

    e_attacks = p.count * (p.attacks.mean + p.bonus_flat_attacks)
    if p.rapid_fire is not None:
        e_attacks += p.count * p.rapid_fire.mean

    # Hit phase
    if p.torrent:
        e_rolling_hits = 1.0
        e_auto_wounds = 0.0
    else:
        def hit_success(d):
            return d >= p.crit_hit_on or d == 6 or (
                d != 1 and d + p.hit_mod >= p.hit_target)

        p_ch, p_nh = _probs(p.reroll_hits, hit_success, lambda d: d >= p.crit_hit_on)
        sustained = p.sustained.mean if p.sustained is not None else 0.0
        e_rolling_hits = p_nh + p_ch * sustained + p_ch * (0.0 if p.lethal else 1.0)
        e_auto_wounds = p_ch if p.lethal else 0.0

    # Wound phase
    def wound_success(d):
        return d >= p.crit_wound_on or d == 6 or (
            d != 1 and d + p.wound_mod >= p.wound_base)

    p_cw, p_nw = _probs(p.reroll_wounds, wound_success, lambda d: d >= p.crit_wound_on)
    if p.devastating:
        e_saveable = e_rolling_hits * p_nw + e_auto_wounds
        e_unsaveable = e_rolling_hits * p_cw
    else:
        e_saveable = e_rolling_hits * (p_nw + p_cw) + e_auto_wounds
        e_unsaveable = 0.0

    # Save phase (unmodified 1 always fails)
    if p.save_t > 6:
        p_save = 0.0
    else:
        p_save = (7 - max(2, p.save_t)) / 6
    e_unsaved = e_saveable * (1 - p_save) + e_unsaveable

    # Damage per unsaved wound, with melta / halving / reduction, min 1
    e_dmg = 0.0
    for value, prob in _damage_distribution(p.damage):
        dmg = value + p.melta
        if p.half_damage:
            dmg = (dmg + 1) // 2
        dmg = max(1, dmg - p.damage_reduction)
        if cap_per_wound:
            dmg = min(dmg, defender.wounds)
        e_dmg += prob * dmg

    # Feel No Pain: each damage point is ignored on fnp+
    fnp_factor = 1.0
    if p.fnp is not None:
        fnp_factor = (p.fnp - 1) / 6 if p.fnp <= 6 else 1.0

    return e_attacks * e_unsaved * e_dmg * fnp_factor
