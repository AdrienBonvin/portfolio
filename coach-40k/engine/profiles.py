"""Core data structures: weapons and units as the simulator sees them."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .dice import Dice
from .flags import UnitFlags
from .keywords import WeaponAbilities


@dataclass
class Weapon:
    name: str
    kind: str                 # "ranged" | "melee"
    count: int                # how many of this weapon fire in the activation
    attacks: Dice
    skill: int | None         # BS/WS target (3 for "3+"); None = Torrent
    strength: int
    ap: int                   # stored positive: AP -1 -> 1
    damage: Dice
    abilities: WeaponAbilities = field(default_factory=WeaponAbilities)

    @property
    def profile_group(self) -> str:
        """Group key for multi-profile weapons (e.g. "sword – strike/sweep").

        Non EXTRA ATTACKS melee profiles sharing a group are alternatives: a
        model uses only one of them per activation.
        """
        base = re.split(r"\s+[–—-]\s+|\s*➤\s*", self.name)[0]
        return base.strip().lower()


@dataclass
class Unit:
    name: str
    datasheet_id: str = ""
    faction: str = ""
    points: int = 0
    models: int = 1
    toughness: int = 4
    save: int = 3             # armour save target (3 for "3+")
    invuln: int | None = None
    wounds: int = 1           # wounds per model
    fnp: int | None = None
    keywords: set[str] = field(default_factory=set)
    weapons: list[Weapon] = field(default_factory=list)
    flags: UnitFlags = field(default_factory=UnitFlags)
    abilities_text: list[str] = field(default_factory=list)  # informational only
    notes: list[str] = field(default_factory=list)           # parser warnings

    @property
    def total_wounds(self) -> int:
        return self.models * self.wounds

    def weapons_for_phase(self, kind: str) -> list[Weapon]:
        return [w for w in self.weapons if w.kind == kind]
