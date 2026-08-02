"""Parse army lists exported as text by the official GW app.

Expected shape (tolerant to variations, hand-written lists work too):

    LIST NAME (1995 points)

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

Rules used:
- a line `Name (N points)` opens a unit, except the first one (list title)
  and battle-size lines (Incursion / Strike Force / Onslaught);
- bullet lines `Nx Thing` attach to the current unit; whether "Thing" is a
  model group or a weapon is decided later against the datasheet;
- `Enhancement: X` lines are recorded but not simulated (free-text ability).
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

_POINTS_LINE = re.compile(r"^(.*?)\s*[\(\[]\s*(\d+)\s*(?:pts?|points?)\s*[\)\]]\s*$",
                          re.IGNORECASE)
_BULLET = re.compile(r"^\s*[•◦▪‣*+-]\s*(.*)$")
_COUNT_ITEM = re.compile(r"^(\d+)\s*x\s+(.*)$", re.IGNORECASE)
_BATTLE_SIZES = {"incursion", "strike force", "onslaught", "combat patrol"}
_SECTION_HEADERS = {
    "characters", "battleline", "dedicated transports", "other datasheets",
    "allied units", "epic hero", "epic heroes",
}


@dataclass
class ParsedUnit:
    name: str
    points: int | None = None
    entries: list[tuple[int, str]] = field(default_factory=list)  # (count, name)
    enhancements: list[str] = field(default_factory=list)
    is_warlord: bool = False

    def weapon_request(self, is_weapon) -> dict[str, int]:
        """Split entries into weapons using the `is_weapon(name)` predicate."""
        request: Counter[str] = Counter()
        for count, name in self.entries:
            if is_weapon(name):
                request[name] += count
        return dict(request)

    def model_count(self, is_weapon) -> int | None:
        counts = [c for c, name in self.entries if not is_weapon(name)]
        return sum(counts) if counts else None


@dataclass
class ParsedList:
    title: str = ""
    total_points: int | None = None
    faction_hints: list[str] = field(default_factory=list)
    units: list[ParsedUnit] = field(default_factory=list)


def parse_army_list(text: str) -> ParsedList:
    result = ParsedList()
    current: ParsedUnit | None = None
    seen_points_line = False

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.lower().startswith("exported with"):
            continue

        m_bullet = _BULLET.match(raw_line)
        if m_bullet and current is not None:
            item = m_bullet.group(1).strip()
            low = item.lower()
            if low.startswith(("enhancement:", "enhancements:")):
                current.enhancements.append(item.split(":", 1)[1].strip())
                continue
            if low == "warlord":
                current.is_warlord = True
                continue
            m_count = _COUNT_ITEM.match(item)
            if m_count:
                current.entries.append((int(m_count.group(1)), m_count.group(2).strip()))
            elif item:
                current.entries.append((1, item))
            continue

        m_points = _POINTS_LINE.match(line)
        if m_points:
            name = m_points.group(1).strip()
            pts = int(m_points.group(2))
            if not seen_points_line:
                # first points line = list title
                seen_points_line = True
                result.title = name or "army list"
                result.total_points = pts
                continue
            if name.lower() in _BATTLE_SIZES:
                continue
            current = ParsedUnit(name=name, points=pts)
            result.units.append(current)
            continue

        low = line.lower()
        if low in _SECTION_HEADERS or low in _BATTLE_SIZES:
            current = None
            continue

        # Bare text line outside a unit: faction / detachment hint.
        # Inside a unit block the GW app never emits bare lines, so treat
        # a short bare line before any unit as a hint.
        if current is None and len(line) < 60:
            result.faction_hints.append(line)
            continue

    return result
