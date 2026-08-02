"""Manual per-unit flags for abilities the engine cannot parse automatically.

Datasheet/army abilities written in free text (auras, detachment rules,
strats…) are ignored by default. The user compensates with explicit flags,
either in a flags file or inline. Example flags file:

    # unit name : comma-separated flags
    Hive Tyrant: +1 to wound, reroll hits
    Termagants: cover, fnp 6+

Supported flags (case-insensitive):
    +1 to hit / -1 to hit
    +1 to wound / -1 to wound
    reroll hit 1s | reroll hits          (rerolls failed hit rolls)
    reroll wound 1s | reroll wounds
    stationary        (unit did not move: HEAVY weapons get +1 to hit)
    charged           (unit charged this turn: LANCE weapons get +1 to wound)
    half range        (RAPID FIRE and MELTA bonuses apply)
    cover             (defender: +1 to armour save, standard 3+/AP0 exception)
    stealth           (defender: ranged attacks against it are -1 to hit)
    -1 damage         (defender: incoming damage reduced by 1, min 1)
    half damage       (defender: incoming damage halved, rounding up)
    fnp N+            (defender: Feel No Pain N+; overrides datasheet value)
    invuln N+         (defender: invulnerable save; overrides datasheet value)
    +1 save / -1 save (defender: armour save modifier, stacks with cover)
    crit hit 5+       (attacker: critical hits on 5+, e.g. from a stratagem)
    crit wound 5+     (attacker: critical wounds on 5+)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class UnitFlags:
    # Offensive
    hit_mod: int = 0
    wound_mod: int = 0
    reroll_hits: str = ""      # "" | "ones" | "fails"
    reroll_wounds: str = ""    # "" | "ones" | "fails"
    stationary: bool = False
    charged: bool = False
    half_range: bool = False
    crit_hit_on: int = 6
    crit_wound_on: int = 6
    # Defensive
    cover: bool = False
    stealth: bool = False
    damage_reduction: int = 0
    half_damage: bool = False
    fnp: int | None = None
    invuln: int | None = None
    save_mod: int = 0
    # Bookkeeping
    raw: list[str] = field(default_factory=list)


_PATTERNS: list[tuple[re.Pattern, callable]] = [
    (re.compile(r"^([+-]1) to hit$"), lambda f, m: setattr(f, "hit_mod", f.hit_mod + int(m.group(1)))),
    (re.compile(r"^([+-]1) to wound$"), lambda f, m: setattr(f, "wound_mod", f.wound_mod + int(m.group(1)))),
    (re.compile(r"^reroll (?:hit )?1s to hit$|^reroll hit 1s$"), lambda f, m: setattr(f, "reroll_hits", "ones")),
    (re.compile(r"^reroll hits$"), lambda f, m: setattr(f, "reroll_hits", "fails")),
    (re.compile(r"^reroll (?:wound )?1s to wound$|^reroll wound 1s$"), lambda f, m: setattr(f, "reroll_wounds", "ones")),
    (re.compile(r"^reroll wounds$"), lambda f, m: setattr(f, "reroll_wounds", "fails")),
    (re.compile(r"^stationary$|^remained stationary$"), lambda f, m: setattr(f, "stationary", True)),
    (re.compile(r"^charged?$"), lambda f, m: setattr(f, "charged", True)),
    (re.compile(r"^half range$|^optimal range$"), lambda f, m: setattr(f, "half_range", True)),
    (re.compile(r"^crit hits? (?:on )?(\d)\+$|^crit hit (\d)\+$"), lambda f, m: setattr(f, "crit_hit_on", int(m.group(1) or m.group(2)))),
    (re.compile(r"^crit wounds? (?:on )?(\d)\+$|^crit wound (\d)\+$"), lambda f, m: setattr(f, "crit_wound_on", int(m.group(1) or m.group(2)))),
    (re.compile(r"^cover$|^benefit of cover$"), lambda f, m: setattr(f, "cover", True)),
    (re.compile(r"^stealth$"), lambda f, m: setattr(f, "stealth", True)),
    (re.compile(r"^-1 damage$|^-1 dmg$"), lambda f, m: setattr(f, "damage_reduction", f.damage_reduction + 1)),
    (re.compile(r"^half damage$"), lambda f, m: setattr(f, "half_damage", True)),
    (re.compile(r"^(?:fnp|feel no pain) (\d)\+$"), lambda f, m: setattr(f, "fnp", int(m.group(1)))),
    (re.compile(r"^invulns? (\d)\+$|^invulnerable (\d)\+$|^invuln save (\d)\+$"),
     lambda f, m: setattr(f, "invuln", int(next(g for g in m.groups() if g)))),
    (re.compile(r"^([+-]1) save$"), lambda f, m: setattr(f, "save_mod", f.save_mod + int(m.group(1)))),
]


class FlagError(ValueError):
    pass


def parse_flags(spec: str) -> UnitFlags:
    """Parse a comma-separated flag list into a UnitFlags."""
    flags = UnitFlags()
    for part in spec.split(","):
        token = part.strip().lower()
        if not token or token.startswith("#"):
            continue
        for pattern, apply in _PATTERNS:
            m = pattern.match(token)
            if m:
                apply(flags, m)
                flags.raw.append(token)
                break
        else:
            raise FlagError(
                f"unknown flag {token!r} — see engine/flags.py for the supported list"
            )
    return flags


def parse_flags_file(text: str) -> dict[str, UnitFlags]:
    """Parse a flags file: one `unit name: flag, flag` entry per line."""
    result: dict[str, UnitFlags] = {}
    for lineno, line in enumerate(text.splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise FlagError(f"line {lineno}: expected 'unit name: flags', got {line!r}")
        name, _, spec = line.partition(":")
        result[name.strip()] = parse_flags(spec)
    return result
