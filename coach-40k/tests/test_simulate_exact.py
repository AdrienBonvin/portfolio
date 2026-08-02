"""Monte Carlo validation against hand-computed exact expectations.

Every case documents its closed-form math. Targets get huge wound pools so
no simulation ever wipes the unit (allocation truncation would otherwise bias
the mean); allocation itself is validated in dedicated cases at the end.
"""

import pytest

from engine.analytic import expected_damage
from engine.dice import Dice
from engine.flags import UnitFlags, parse_flags
from engine.keywords import parse_abilities
from engine.profiles import Unit, Weapon
from engine.simulate import (SimOptions, clamp_mod, save_target,
                             simulate_matchup, wound_target)

ITERS = 30_000


def weapon(a="10", skill=3, s=5, ap=0, d="1", abilities="", kind="ranged", count=1):
    return Weapon(name="test weapon", kind=kind, count=count,
                  attacks=Dice.parse(a), skill=skill, strength=s, ap=ap,
                  damage=Dice.parse(d), abilities=parse_abilities(abilities))


def attacker(flags=""):
    return Unit(name="attacker", flags=parse_flags(flags) if flags else UnitFlags())


def target(t=4, sv=4, inv=None, w=500, models=1, fnp=None, flags="", keywords=()):
    return Unit(name="target", toughness=t, save=sv, invuln=inv, wounds=w,
                models=models, fnp=fnp,
                flags=parse_flags(flags) if flags else UnitFlags(),
                keywords=set(keywords))


def run(w, atk, dfd, phase="shooting", optimal=False, iters=ITERS):
    opts = SimOptions(iterations=iters, seed=7, optimal_range=optimal)
    stats = simulate_matchup(atk, dfd, [w], phase, opts)
    analytic = expected_damage(w, atk, dfd, phase, opts)
    return stats, analytic


def check(w, atk, dfd, expected, phase="shooting", optimal=False):
    """MC mean and closed-form must both agree with the hand-computed value."""
    stats, analytic = run(w, atk, dfd, phase, optimal)
    assert analytic == pytest.approx(expected, abs=1e-9), "analytic formula drift"
    tol = max(0.06, 0.02 * expected)
    assert stats.mean_damage == pytest.approx(expected, abs=tol), (
        f"MC={stats.mean_damage:.4f} expected={expected:.4f}")


# ------------------------------------------------------------ pure functions

def test_wound_table():
    assert wound_target(8, 4) == 2   # S >= 2T
    assert wound_target(5, 4) == 3   # S > T
    assert wound_target(4, 4) == 4   # S == T
    assert wound_target(3, 4) == 5   # S < T
    assert wound_target(3, 6) == 6   # 2S <= T
    assert wound_target(3, 7) == 6


def test_clamp():
    assert clamp_mod(3) == 1 and clamp_mod(-2) == -1 and clamp_mod(0) == 0


def test_save_target_ap_cover_invuln():
    w0, w2 = weapon(ap=0), weapon(ap=2)
    assert save_target(w0, target(sv=4), cover=False) == 4
    assert save_target(w2, target(sv=3), cover=False) == 5
    assert save_target(w2, target(sv=3), cover=True) == 4
    # cover gives nothing to a 3+ save against AP 0
    assert save_target(w0, target(sv=3), cover=True) == 3
    # but it does help a 4+ save against AP 0
    assert save_target(w0, target(sv=4), cover=True) == 3
    # invulnerable caps the effective target and ignores AP
    assert save_target(weapon(ap=3), target(sv=3, inv=4), cover=False) == 4
    # AP beyond any save -> 7 (impossible)
    assert save_target(weapon(ap=6), target(sv=4), cover=False) == 7


# ------------------------------------------------- hand-verifiable MC cases

def test_baseline():
    # 10 attacks, 3+ hit (4/6), S5 vs T4 -> 3+ wound (4/6), Sv4+ AP0 -> 1/2 fail
    # E = 10 * 4/6 * 4/6 * 1/2 = 2.2222
    check(weapon(), attacker(), target(), 10 * (4/6) * (4/6) * 0.5)


def test_lethal_hits():
    # crit hit 1/6 auto-wounds; non-crit hits 3/6 wound on 3+
    # E = 10 * (3/6 * 4/6 + 1/6) * 1/2 = 2.5
    check(weapon(abilities="Lethal Hits"), attacker(), target(),
          10 * (3/6 * 4/6 + 1/6) * 0.5)


def test_sustained_hits_1():
    # rolling hits per attack = 3/6 + (1/6)*2 = 5/6
    # E = 10 * 5/6 * 4/6 * 1/2 = 2.7778
    check(weapon(abilities="Sustained Hits 1"), attacker(), target(),
          10 * (5/6) * (4/6) * 0.5)


def test_devastating_wounds():
    # per hit: crit wound 1/6 bypasses save, normal wounds 3/6 face 1/2 save
    # E = 10 * 4/6 * (3/6 * 1/2 + 1/6) = 2.7778
    check(weapon(abilities="Devastating Wounds"), attacker(), target(),
          10 * (4/6) * (3/6 * 0.5 + 1/6))


def test_anti_keyword_with_dev():
    # Anti-Infantry 4+ vs INFANTRY: crit wounds on 4+ (3/6), plus d=3 normal
    # success (1/6). With Devastating: E = 10 * 4/6 * (1/6 * 1/2 + 3/6)
    check(weapon(abilities="Anti-Infantry 4+, Devastating Wounds"),
          attacker(), target(keywords={"INFANTRY"}),
          10 * (4/6) * (1/6 * 0.5 + 3/6))


def test_anti_no_keyword_match():
    # Anti-Vehicle must not trigger vs INFANTRY: baseline result
    check(weapon(abilities="Anti-Vehicle 2+, Devastating Wounds"),
          attacker(), target(keywords={"INFANTRY"}),
          10 * (4/6) * (3/6 * 0.5 + 1/6))  # dev still works on natural 6s


def test_torrent():
    # auto-hit: E = 10 * 4/6 * 1/2 = 3.3333
    check(weapon(abilities="Torrent"), attacker(), target(),
          10 * (4/6) * 0.5)


def test_blast_vs_10_models():
    # +1 attack per 5 models: 10 + 2 = 12 attacks
    check(weapon(abilities="Blast"), attacker(), target(models=10, w=50),
          12 * (4/6) * (4/6) * 0.5)


def test_twin_linked():
    # wound 3+ rerolling fails: 4/6 + 2/6*4/6 = 8/9
    check(weapon(abilities="Twin-linked"), attacker(), target(),
          10 * (4/6) * (8/9) * 0.5)


def test_rapid_fire_only_at_half_range():
    w = weapon(abilities="Rapid Fire 2")
    check(w, attacker(), target(), 10 * (4/6) * (4/6) * 0.5)            # far
    check(w, attacker(), target(), 12 * (4/6) * (4/6) * 0.5, optimal=True)


def test_melta_at_half_range():
    # D6 damage +2: mean 5.5 per unsaved wound
    check(weapon(d="D6", abilities="Melta 2"), attacker(), target(),
          10 * (4/6) * (4/6) * 0.5 * 5.5, optimal=True)


def test_heavy_stationary_and_cap():
    # Heavy + stationary: 3+ -> 2+ (5/6)
    expected = 10 * (5/6) * (4/6) * 0.5
    check(weapon(abilities="Heavy"), attacker("stationary"), target(), expected)
    # +1 to hit on top must be capped at net +1: same result
    check(weapon(abilities="Heavy"), attacker("stationary, +1 to hit"),
          target(), expected)


def test_lance_needs_charge():
    w = weapon(abilities="Lance", kind="melee")
    check(w, attacker(), target(), 10 * (4/6) * (4/6) * 0.5, phase="melee")
    # charged: wound 3+ -> 2+ (5/6)
    check(w, attacker("charged"), target(), 10 * (4/6) * (5/6) * 0.5,
          phase="melee")


def test_stealth_ranged_only():
    # -1 to hit: 3+ -> 4+ (3/6) for shooting; melee unaffected
    check(weapon(), attacker(), target(flags="stealth"),
          10 * (3/6) * (4/6) * 0.5)
    check(weapon(kind="melee"), attacker(), target(flags="stealth"),
          10 * (4/6) * (4/6) * 0.5, phase="melee")


def test_ap_and_cover():
    # AP-2 vs Sv3+: save on 5+, fails 4/6
    check(weapon(ap=2), attacker(), target(t=4, sv=3),
          10 * (4/6) * (4/6) * (4/6))
    # with cover: save on 4+, fails 3/6
    check(weapon(ap=2), attacker(), target(t=4, sv=3, flags="cover"),
          10 * (4/6) * (4/6) * 0.5)


def test_invuln():
    # AP-3 vs Sv3+/inv4+: invuln 4+ used, fails 1/2
    check(weapon(ap=3), attacker(), target(sv=3, inv=4),
          10 * (4/6) * (4/6) * 0.5)


def test_fnp():
    # FNP 5+ stops 2/6 of damage: factor 4/6
    check(weapon(), attacker(), target(fnp=5),
          10 * (4/6) * (4/6) * 0.5 * (4/6))


def test_damage_reduction():
    # D3 flat, -1 damage -> 2 per unsaved wound
    check(weapon(d="3"), attacker(), target(flags="-1 damage"),
          10 * (4/6) * (4/6) * 0.5 * 2)


def test_half_damage():
    # D6 halved rounding up: (1,1,2,2,3,3)/6 -> mean 2
    check(weapon(d="D6"), attacker(), target(flags="half damage"),
          10 * (4/6) * (4/6) * 0.5 * 2)


def test_reroll_hit_ones():
    # 3+ rerolling 1s: 4/6 + 1/6*4/6 = 7/9
    check(weapon(), attacker("reroll hit 1s"), target(),
          10 * (7/9) * (4/6) * 0.5)


def test_reroll_hits_full():
    # 3+ rerolling fails: 4/6 + 2/6*4/6 = 8/9
    check(weapon(), attacker("reroll hits"), target(),
          10 * (8/9) * (4/6) * 0.5)


def test_plus_one_to_wound():
    # S4 vs T4: 4+ -> 3+ with the flag
    check(weapon(s=4), attacker("+1 to wound"), target(),
          10 * (4/6) * (4/6) * 0.5)


# ------------------------------------------------------- allocation & wipes

def test_allocation_excess_damage_lost():
    # 3 torrent attacks, wound 2+ (S8 vs T4), no save (AP6), flat D3
    # vs 5 models of 2W: every unsaved wound kills exactly one model.
    # E[kills] = 3 * 5/6 = 2.5 ; damage recorded is the full 3 per wound.
    w = weapon(a="3", s=8, ap=6, d="3", abilities="Torrent")
    stats, _ = run(w, attacker(), target(t=4, sv=4, w=2, models=5))
    assert stats.mean_models_killed == pytest.approx(2.5, abs=0.04)
    assert stats.mean_damage == pytest.approx(7.5, abs=0.12)
    assert stats.p_destroyed == 0.0


def test_wipe_probability_exact():
    # 3 torrent attacks, wound 2+, no save, D1 vs a single 1W model:
    # P(wipe) = 1 - (1/6)^3 = 215/216
    w = weapon(a="3", s=8, ap=6, d="1", abilities="Torrent")
    stats, _ = run(w, attacker(), target(t=4, sv=4, w=1, models=1))
    assert stats.p_destroyed == pytest.approx(215 / 216, abs=0.005)
    assert stats.p_below_half == pytest.approx(stats.p_destroyed, abs=1e-9)


def test_below_half_multi_model():
    # 10 models, need <5 alive to be below half strength
    w = weapon(a="20", s=8, ap=6, d="1", abilities="Torrent")
    stats, _ = run(w, attacker(), target(t=4, sv=7, w=1, models=10))
    # wound 2+ -> kills ~ Binomial(20, 5/6) truncated at 10; almost always >5
    assert stats.p_below_half > 0.99
