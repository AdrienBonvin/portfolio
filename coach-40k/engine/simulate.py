"""Monte Carlo simulation of one full unit activation against a target.

Sequence per attack: Attacks -> Hit -> Wound -> Save (armour vs invuln, AP)
-> Damage -> Feel No Pain -> allocation model by model (excess damage from a
single attack is lost, as per the core rules).

Rules conventions implemented (matching the 40k core rules):
- unmodified 1 always fails (hit, wound, save); unmodified 6 always succeeds
  on hit and wound rolls;
- net hit/wound modifiers are capped at +/-1 (save modifiers are not);
- critical hit = unmodified roll >= crit threshold (6 by default);
- SUSTAINED HITS X: critical hit scores X extra hits (they roll to wound);
- LETHAL HITS: the critical hit itself wounds automatically (not a critical
  wound); sustained extra hits still roll to wound normally;
- ANTI-X N+: vs a target with keyword X, unmodified wound rolls of N+ are
  critical wounds (auto-wound);
- DEVASTATING WOUNDS: critical wounds allow no save (armour or invulnerable);
  damage is allocated normally (no spill) and Feel No Pain still applies;
- TWIN-LINKED: reroll failed wound rolls;
- BLAST: +1 attack per 5 models in the target unit;
- RAPID FIRE X / MELTA X: bonus only when the `half range` flag (or the
  --optimal-range option) is set;
- HEAVY: +1 to hit only with the `stationary` flag;
- LANCE: +1 to wound only with the `charged` flag;
- STEALTH (defender flag): -1 to hit for ranged attacks;
- Benefit of cover: +1 to armour save, except for models with a 3+ or better
  save against AP 0; IGNORES COVER negates it;
- rerolls happen before modifiers and only failed rolls (or 1s) are rerolled.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from random import Random

from .dice import Dice
from .profiles import Unit, Weapon


@dataclass
class SimOptions:
    iterations: int = 20_000
    seed: int = 0
    optimal_range: bool = False  # global "half range" assumption for the run


@dataclass
class MatchupStats:
    attacker: str
    defender: str
    phase: str
    weapons_used: list[str]
    mean_damage: float
    mean_models_killed: float
    p_destroyed: float
    p_below_half: float
    kills_p50: int
    kills_p90: int
    iterations: int
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "attacker": self.attacker,
            "defender": self.defender,
            "phase": self.phase,
            "weapons_used": self.weapons_used,
            "mean_damage": round(self.mean_damage, 3),
            "mean_models_killed": round(self.mean_models_killed, 3),
            "p_destroyed": round(self.p_destroyed, 4),
            "p_below_half": round(self.p_below_half, 4),
            "kills_p50": self.kills_p50,
            "kills_p90": self.kills_p90,
            "iterations": self.iterations,
            "notes": self.notes,
        }


def wound_target(strength: int, toughness: int) -> int:
    """Strength vs Toughness table."""
    if strength >= 2 * toughness:
        return 2
    if strength > toughness:
        return 3
    if strength == toughness:
        return 4
    if 2 * strength <= toughness:
        return 6
    return 5


def clamp_mod(mod: int) -> int:
    return max(-1, min(1, mod))


def save_target(weapon: Weapon, defender: Unit, cover: bool) -> int:
    """Effective save target (2..7); 7 means no save possible."""
    armour = defender.save + weapon.ap - defender.flags.save_mod
    if cover and not weapon.abilities.ignores_cover:
        # Cover gives +1 to armour save, but not to 3+ (or better) saves vs AP 0.
        if not (weapon.ap == 0 and defender.save <= 3):
            armour -= 1
    armour = max(2, armour)
    invuln = defender.flags.invuln or defender.invuln
    if invuln is not None:
        armour = min(armour, max(2, invuln))
    return min(armour, 7)


@dataclass
class _WeaponPlan:
    """Per-weapon constants precomputed once per matchup."""

    count: int
    attacks: Dice
    bonus_flat_attacks: int      # blast bonus
    rapid_fire: Dice | None
    torrent: bool
    hit_target: int
    hit_mod: int
    crit_hit_on: int
    reroll_hits: str
    sustained: Dice | None
    lethal: bool
    wound_base: int
    wound_mod: int
    crit_wound_on: int
    reroll_wounds: str
    devastating: bool
    save_t: int
    damage: Dice
    melta: int
    half_range: bool
    damage_reduction: int
    half_damage: bool
    fnp: int | None


def build_plan(weapon: Weapon, attacker: Unit, defender: Unit,
               opts: SimOptions, phase: str) -> _WeaponPlan:
    af, df, ab = attacker.flags, defender.flags, weapon.abilities

    hit_mod = af.hit_mod
    if ab.heavy and af.stationary:
        hit_mod += 1
    if df.stealth and phase == "shooting":
        hit_mod -= 1

    wound_mod = af.wound_mod
    if ab.lance and af.charged:
        wound_mod += 1

    crit_wound_on = af.crit_wound_on
    for kw, threshold in ab.anti.items():
        if kw in defender.keywords:
            crit_wound_on = min(crit_wound_on, threshold)

    half_range = opts.optimal_range or af.half_range
    blast_bonus = defender.models // 5 if ab.blast else 0

    return _WeaponPlan(
        count=weapon.count,
        attacks=weapon.attacks,
        bonus_flat_attacks=blast_bonus,
        rapid_fire=ab.rapid_fire if half_range else None,
        torrent=ab.torrent or weapon.skill is None,
        hit_target=weapon.skill or 0,
        hit_mod=clamp_mod(hit_mod),
        crit_hit_on=af.crit_hit_on,
        reroll_hits=af.reroll_hits,
        sustained=ab.sustained_hits,
        lethal=ab.lethal_hits,
        wound_base=wound_target(weapon.strength, defender.toughness),
        wound_mod=clamp_mod(wound_mod),
        crit_wound_on=crit_wound_on,
        reroll_wounds="fails" if ab.twin_linked else af.reroll_wounds,
        devastating=ab.devastating_wounds,
        save_t=save_target(weapon, defender, df.cover),
        damage=weapon.damage,
        melta=ab.melta if half_range else 0,
        half_range=half_range,
        damage_reduction=df.damage_reduction,
        half_damage=df.half_damage,
        fnp=df.fnp or defender.fnp,
    )


def simulate_matchup(attacker: Unit, defender: Unit, weapons: list[Weapon],
                     phase: str, opts: SimOptions) -> MatchupStats:
    """Simulate the full activation (all given weapons) opts.iterations times."""
    rng = Random(f"{opts.seed}|{attacker.name}|{defender.name}|{phase}")
    plans = [build_plan(w, attacker, defender, opts, phase) for w in weapons]

    n_models = defender.models
    w_per_model = defender.wounds
    total_damage = 0.0
    total_kills = 0
    destroyed = 0
    below_half = 0
    kills_hist = [0] * (n_models + 1)

    half_models = n_models / 2
    half_wounds = w_per_model / 2
    randint = rng.randint

    for _ in range(opts.iterations):
        models_left = n_models
        hp = w_per_model
        dmg_this_iter = 0

        for p in plans:
            if models_left == 0:
                break
            # --- number of attacks -------------------------------------
            n_attacks = p.count * p.bonus_flat_attacks
            for _i in range(p.count):
                n_attacks += p.attacks.roll(rng)
                if p.rapid_fire is not None:
                    n_attacks += p.rapid_fire.roll(rng)

            # --- resolve attacks ---------------------------------------
            # Each entry in the wound queue: (auto_wound, is_extra) flags are
            # folded directly; we count hits needing wound rolls and lethal
            # auto-wounds.
            for _a in range(n_attacks):
                if models_left == 0:
                    break
                rolling_hits = 0
                auto_wounds = 0
                if p.torrent:
                    rolling_hits = 1
                else:
                    d = randint(1, 6)
                    if p.reroll_hits == "ones" and d == 1:
                        d = randint(1, 6)
                    elif p.reroll_hits == "fails":
                        crit = d >= p.crit_hit_on
                        success = crit or d == 6 or (
                            d != 1 and d + p.hit_mod >= p.hit_target)
                        if not success:
                            d = randint(1, 6)
                    crit = d >= p.crit_hit_on
                    hit = crit or d == 6 or (d != 1 and d + p.hit_mod >= p.hit_target)
                    if hit:
                        if crit:
                            if p.sustained is not None:
                                rolling_hits += p.sustained.roll(rng)
                            if p.lethal:
                                auto_wounds += 1
                            else:
                                rolling_hits += 1
                        else:
                            rolling_hits += 1

                # Wound rolls
                normal_wounds = auto_wounds
                dev_wounds = 0
                for _h in range(rolling_hits):
                    d = randint(1, 6)
                    if p.reroll_wounds == "ones" and d == 1:
                        d = randint(1, 6)
                    elif p.reroll_wounds == "fails":
                        crit_w = d >= p.crit_wound_on
                        success = crit_w or d == 6 or (
                            d != 1 and d + p.wound_mod >= p.wound_base)
                        if not success:
                            d = randint(1, 6)
                    crit_w = d >= p.crit_wound_on
                    success = crit_w or d == 6 or (
                        d != 1 and d + p.wound_mod >= p.wound_base)
                    if not success:
                        continue
                    if crit_w and p.devastating:
                        dev_wounds += 1
                    else:
                        normal_wounds += 1

                # Saves, damage, FNP, allocation
                for kind in ((0,) * normal_wounds + (1,) * dev_wounds):
                    if models_left == 0:
                        break
                    if kind == 0:
                        d = randint(1, 6)
                        if d != 1 and d >= p.save_t:
                            continue  # saved
                    dmg = p.damage.roll(rng) + p.melta
                    if p.half_damage:
                        dmg = (dmg + 1) // 2
                    if p.damage_reduction:
                        dmg = dmg - p.damage_reduction
                    if dmg < 1:
                        dmg = 1
                    if p.fnp is not None:
                        passed = 0
                        for _w in range(dmg):
                            if randint(1, 6) >= p.fnp:
                                passed += 1
                        dmg -= passed
                    if dmg == 0:
                        continue
                    dmg_this_iter += dmg
                    hp -= dmg  # excess damage on the model is lost
                    if hp <= 0:
                        models_left -= 1
                        hp = w_per_model

        kills = n_models - models_left
        total_damage += dmg_this_iter
        total_kills += kills
        kills_hist[kills] += 1
        if models_left == 0:
            destroyed += 1
            below_half += 1
        elif n_models > 1:
            if models_left < half_models:
                below_half += 1
        elif hp < half_wounds:
            below_half += 1

    iters = opts.iterations
    # percentiles from the kill histogram
    def percentile(q: float) -> int:
        threshold = q * iters
        acc = 0
        for k, c in enumerate(kills_hist):
            acc += c
            if acc >= threshold:
                return k
        return n_models

    return MatchupStats(
        attacker=attacker.name,
        defender=defender.name,
        phase=phase,
        weapons_used=[f"{w.count}x {w.name}" for w in weapons],
        mean_damage=total_damage / iters,
        mean_models_killed=total_kills / iters,
        p_destroyed=destroyed / iters,
        p_below_half=below_half / iters,
        kills_p50=percentile(0.5),
        kills_p90=percentile(0.9),
        iterations=iters,
    )
