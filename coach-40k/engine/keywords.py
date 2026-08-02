"""Parse weapon ability keywords from Wahapedia wargear descriptions.

The wargear `description` column holds the bracketed weapon abilities as HTML
(e.g. `<span class="kwb">SUSTAINED HITS 1</span>`). We strip tags and match
known abilities; anything unrecognised is kept in `unknown` so the CLI can
report what was ignored.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .dice import Dice

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def strip_html(text: str) -> str:
    text = _TAG_RE.sub(" ", text or "")
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    return _WS_RE.sub(" ", text).strip()


@dataclass
class WeaponAbilities:
    sustained_hits: Dice | None = None      # extra hits on a critical hit
    lethal_hits: bool = False               # critical hit auto-wounds
    devastating_wounds: bool = False        # critical wound bypasses saves
    anti: dict[str, int] = field(default_factory=dict)  # KEYWORD -> crit wound threshold
    torrent: bool = False                   # auto-hit, no hit roll
    blast: bool = False                     # +1 attack per 5 models in target
    twin_linked: bool = False               # reroll failed wound rolls
    rapid_fire: Dice | None = None          # +X attacks at half range
    melta: int = 0                          # +X damage at half range
    heavy: bool = False                     # +1 to hit if attacker stayed stationary
    lance: bool = False                     # +1 to wound if attacker charged
    assault: bool = False
    pistol: bool = False
    hazardous: bool = False
    precision: bool = False
    ignores_cover: bool = False
    indirect_fire: bool = False
    one_shot: bool = False
    extra_attacks: bool = False
    unknown: list[str] = field(default_factory=list)


# Abilities that are movement/targeting related: parsed so they are not
# reported as unknown, but they have no effect on the damage math.
_FLAGS = {
    "TORRENT": "torrent",
    "BLAST": "blast",
    "TWIN-LINKED": "twin_linked",
    "TWIN LINKED": "twin_linked",
    "LETHAL HITS": "lethal_hits",
    "DEVASTATING WOUNDS": "devastating_wounds",
    "HEAVY": "heavy",
    "LANCE": "lance",
    "ASSAULT": "assault",
    "PISTOL": "pistol",
    "HAZARDOUS": "hazardous",
    "PRECISION": "precision",
    "IGNORES COVER": "ignores_cover",
    "INDIRECT FIRE": "indirect_fire",
    "ONE SHOT": "one_shot",
    "EXTRA ATTACKS": "extra_attacks",
    "PSYCHIC": None,        # no math effect on its own
    "LINKED FIRE": None,
    "CONVERSION": None,
}

_SUSTAINED_RE = re.compile(r"^SUSTAINED HITS (D?\d(?:D\d)?(?:[+-]\d+)?)$", re.I)
_RAPID_FIRE_RE = re.compile(r"^RAPID FIRE (D?\d+(?:[+-]\d+)?)$", re.I)
_MELTA_RE = re.compile(r"^MELTA (\d+)$", re.I)
_ANTI_RE = re.compile(r"^ANTI-([A-Z' ]+?)\s*(\d)\s*\+$", re.I)


def parse_abilities(text: str) -> WeaponAbilities:
    """Parse a comma/bracket separated ability list (plain text or HTML)."""
    out = WeaponAbilities()
    clean = strip_html(text)
    if not clean or clean == "-":
        return out
    # Abilities come either bracketed ("[LETHAL HITS, BLAST]") or plain.
    clean = clean.strip("[]")
    for part in re.split(r"[,;]", clean):
        token = part.strip().strip(".").upper()
        if not token:
            continue
        if token in _FLAGS:
            attr = _FLAGS[token]
            if attr:
                setattr(out, attr, True)
            continue
        if m := _SUSTAINED_RE.match(token):
            out.sustained_hits = Dice.parse(m.group(1))
            continue
        if m := _RAPID_FIRE_RE.match(token):
            out.rapid_fire = Dice.parse(m.group(1))
            continue
        if m := _MELTA_RE.match(token):
            out.melta = int(m.group(1))
            continue
        if m := _ANTI_RE.match(token):
            out.anti[m.group(1).strip().upper()] = int(m.group(2))
            continue
        out.unknown.append(part.strip())
    return out
