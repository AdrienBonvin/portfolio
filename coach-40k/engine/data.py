"""Load the Wahapedia CSV export into datasheet objects and build units.

The export files are pipe-delimited UTF-8 CSVs (see data/wahapedia/README.md).
We read them with DictReader so column order does not matter; only the columns
actually used are required.
"""

from __future__ import annotations

import csv
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

from .dice import Dice
from .keywords import parse_abilities, strip_html
from .profiles import Unit, Weapon

REQUIRED_FILES = [
    "Datasheets.csv",
    "Datasheets_models.csv",
    "Datasheets_wargear.csv",
    "Datasheets_keywords.csv",
    "Datasheets_models_cost.csv",
    "Factions.csv",
]


def normalize(name: str) -> str:
    """Lowercase, strip accents and punctuation for name matching."""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"['’´`\"\-–—.,()]", " ", name.lower())
    return re.sub(r"\s+", " ", name).strip()


def _parse_target(value: str) -> int | None:
    """'3+' -> 3, '-' or '' or 'N/A' -> None."""
    value = strip_html(value or "").strip()
    m = re.match(r"^(\d)\s*\+", value)
    return int(m.group(1)) if m else None


def _parse_int(value: str, default: int = 0) -> int:
    m = re.search(r"-?\d+", strip_html(value or ""))
    return int(m.group(0)) if m else default


class DataError(RuntimeError):
    pass


class AmbiguousName(DataError):
    def __init__(self, query: str, candidates: list[str], kind: str = "unit"):
        self.query = query
        self.candidates = candidates
        super().__init__(
            f"ambiguous {kind} name {query!r} — candidates: {', '.join(candidates)}"
        )


@dataclass
class RawWeapon:
    name: str
    kind: str          # "ranged" | "melee"
    attacks: Dice
    skill: int | None
    strength: int
    ap: int
    damage: Dice
    abilities_text: str


@dataclass
class Datasheet:
    id: str
    name: str
    faction_id: str
    faction_name: str = ""
    loadout: str = ""
    models: list[dict] = field(default_factory=list)       # per model line
    weapons: list[RawWeapon] = field(default_factory=list)
    keywords: set[str] = field(default_factory=set)
    cost_lines: list[tuple[int | None, int]] = field(default_factory=list)
    abilities: list[str] = field(default_factory=list)
    fnp: int | None = None


def _read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh, delimiter="|"))
    return rows


class Database:
    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)
        missing = [f for f in REQUIRED_FILES if not (self.data_dir / f).exists()]
        if missing:
            raise DataError(
                f"missing Wahapedia files in {self.data_dir}: {', '.join(missing)}. "
                "Run `python scripts/update_data.py` (see data/wahapedia/README.md)."
            )
        self.datasheets: dict[str, Datasheet] = {}
        self.factions: dict[str, str] = {}
        self._by_norm_name: dict[str, list[Datasheet]] = defaultdict(list)
        self._load()

    # ----------------------------------------------------------------- load
    def _load(self) -> None:
        for row in _read_csv(self.data_dir / "Factions.csv"):
            self.factions[row["id"]] = row["name"].strip()

        for row in _read_csv(self.data_dir / "Datasheets.csv"):
            ds = Datasheet(
                id=row["id"].strip(),
                name=strip_html(row["name"]).strip(),
                faction_id=row.get("faction_id", "").strip(),
                loadout=strip_html(row.get("loadout", "")),
            )
            ds.faction_name = self.factions.get(ds.faction_id, ds.faction_id)
            self.datasheets[ds.id] = ds
            self._by_norm_name[normalize(ds.name)].append(ds)

        for row in _read_csv(self.data_dir / "Datasheets_models.csv"):
            ds = self.datasheets.get(row["datasheet_id"].strip())
            if ds is None:
                continue
            ds.models.append({
                "name": strip_html(row.get("name", "")),
                "T": _parse_int(row.get("T", ""), 4),
                "Sv": _parse_target(row.get("Sv", "")) or 7,
                "inv": _parse_target(row.get("inv_sv", "")),
                "W": _parse_int(row.get("W", ""), 1),
            })

        for row in _read_csv(self.data_dir / "Datasheets_wargear.csv"):
            ds = self.datasheets.get(row["datasheet_id"].strip())
            if ds is None:
                continue
            kind = (row.get("type") or "").strip().lower()
            kind = "melee" if kind == "melee" else "ranged"
            try:
                attacks = Dice.parse(strip_html(row.get("A", "1")))
                damage = Dice.parse(strip_html(row.get("D", "1")))
            except ValueError:
                continue  # profile with unusable stats (e.g. '-')
            ds.weapons.append(RawWeapon(
                name=strip_html(row.get("name", "")).strip(),
                kind=kind,
                attacks=attacks,
                skill=_parse_target(row.get("BS_WS", "")),
                strength=_parse_int(row.get("S", ""), 4),
                ap=abs(_parse_int(row.get("AP", ""), 0)),
                damage=damage,
                abilities_text=row.get("description", "") or "",
            ))

        for row in _read_csv(self.data_dir / "Datasheets_keywords.csv"):
            ds = self.datasheets.get(row["datasheet_id"].strip())
            if ds is None:
                continue
            kw = strip_html(row.get("keyword", "")).strip().upper()
            if kw:
                ds.keywords.add(kw)

        for row in _read_csv(self.data_dir / "Datasheets_models_cost.csv"):
            ds = self.datasheets.get(row["datasheet_id"].strip())
            if ds is None:
                continue
            desc = strip_html(row.get("description", ""))
            m = re.search(r"\d+", desc)
            count = int(m.group(0)) if m else None
            ds.cost_lines.append((count, _parse_int(row.get("cost", ""), 0)))

        abilities_path = self.data_dir / "Datasheets_abilities.csv"
        if abilities_path.exists():
            for row in _read_csv(abilities_path):
                ds = self.datasheets.get(row["datasheet_id"].strip())
                if ds is None:
                    continue
                name = strip_html(row.get("name", "")).strip()
                desc = strip_html(row.get("description", ""))
                if name:
                    ds.abilities.append(name)
                # Feel No Pain is regular enough to parse automatically.
                m = re.search(r"feel no pain (\d)\+", f"{name} {desc}".lower())
                if m:
                    ds.fnp = int(m.group(1))

    # ---------------------------------------------------------------- match
    def find_datasheet(self, name: str, faction_hint: str | None = None) -> Datasheet:
        """Fuzzy-match a unit name; raise AmbiguousName instead of guessing."""
        query = normalize(name)
        pool = list(self.datasheets.values())
        if faction_hint:
            hint = normalize(faction_hint)
            hinted = [d for d in pool if normalize(d.faction_name) == hint]
            if hinted:
                pool = hinted

        exact = [d for d in pool if normalize(d.name) == query]
        if len(exact) == 1:
            return exact[0]
        if len(exact) > 1:
            raise AmbiguousName(name, [f"{d.name} ({d.faction_name})" for d in exact])

        scored = sorted(
            ((SequenceMatcher(None, query, normalize(d.name)).ratio(), d) for d in pool),
            key=lambda t: t[0], reverse=True,
        )
        best_score = scored[0][0]
        if best_score < 0.75:
            close = [d.name for s, d in scored[:5] if s > 0.5]
            raise DataError(
                f"no datasheet found for {name!r}"
                + (f" — closest: {', '.join(close)}" if close else "")
            )
        contenders = [d for s, d in scored if s >= best_score - 0.03]
        if len(contenders) > 1:
            raise AmbiguousName(
                name, [f"{d.name} ({d.faction_name})" for d in contenders[:6]]
            )
        return contenders[0]


def match_weapons(sheet: Datasheet, requested: dict[str, int],
                  models: int, notes: list[str]) -> list[Weapon]:
    """Resolve requested weapon names (fuzzy) against the datasheet wargear.

    `requested` maps weapon name -> count. If empty, fall back to the
    datasheet default loadout prose, then to every profile once (with a note).
    Multi-profile weapons keep all their profiles here; the best profile per
    group is picked at simulation time.
    """
    weapons: list[Weapon] = []

    def add(raw: RawWeapon, count: int) -> None:
        weapons.append(Weapon(
            name=raw.name, kind=raw.kind, count=count, attacks=raw.attacks,
            skill=raw.skill, strength=raw.strength, ap=raw.ap,
            damage=raw.damage, abilities=parse_abilities(raw.abilities_text),
        ))

    if requested:
        for req_name, count in requested.items():
            q = normalize(req_name)
            # a request matches every profile of the same weapon
            matches = [w for w in sheet.weapons if normalize(w.name) == q
                       or normalize(w.name).startswith(q)]
            if not matches:
                scored = sorted(
                    ((SequenceMatcher(None, q, normalize(w.name)).ratio(), w)
                     for w in sheet.weapons),
                    key=lambda t: t[0], reverse=True,
                )
                if scored and scored[0][0] >= 0.7:
                    top = scored[0][0]
                    matches = [w for s, w in scored if s >= top - 0.01]
            if matches:
                for raw in matches:
                    add(raw, count)
            else:
                notes.append(f"weapon not matched on datasheet: {req_name!r} (ignored)")
    else:
        loadout = normalize(sheet.loadout)
        defaults = [w for w in sheet.weapons if normalize(w.name) in loadout]
        if defaults:
            notes.append("no wargear in list; using datasheet default loadout")
            for raw in defaults:
                add(raw, models)
        elif sheet.weapons:
            notes.append(
                "no wargear in list and no default loadout matched; "
                "using every weapon profile once — check this"
            )
            for raw in sheet.weapons:
                add(raw, 1)
    return weapons


def build_unit(sheet: Datasheet, models: int | None, points: int | None,
               weapon_request: dict[str, int]) -> Unit:
    """Assemble a simulable Unit from a datasheet + army list info."""
    notes: list[str] = []

    # Model count: explicit > matched by points on the cost table > minimum size.
    if models is None:
        if points is not None:
            for count, cost in sheet.cost_lines:
                if cost == points and count:
                    models = count
                    break
        if models is None:
            sizes = [c for c, _ in sheet.cost_lines if c]
            models = min(sizes) if sizes else 1
            notes.append(f"model count not in list; assuming {models}")

    if points is None:
        for count, cost in sheet.cost_lines:
            if count == models:
                points = cost
                break
        points = points or 0
        if points == 0:
            notes.append("points not found; unit scored with 0 points")

    if not sheet.models:
        raise DataError(f"datasheet {sheet.name!r} has no model profile")
    profile = sheet.models[0]
    if len({(m["T"], m["Sv"], m["W"]) for m in sheet.models}) > 1:
        notes.append(
            "datasheet has mixed model profiles; using the first line "
            f"(T{profile['T']} Sv{profile['Sv']}+ W{profile['W']})"
        )

    unit = Unit(
        name=sheet.name,
        datasheet_id=sheet.id,
        faction=sheet.faction_name,
        points=points,
        models=models,
        toughness=profile["T"],
        save=profile["Sv"],
        invuln=profile["inv"],
        wounds=profile["W"],
        fnp=sheet.fnp,
        keywords=set(sheet.keywords),
        abilities_text=list(sheet.abilities),
        notes=notes,
    )
    unit.weapons = match_weapons(sheet, weapon_request, models, notes)
    return unit
