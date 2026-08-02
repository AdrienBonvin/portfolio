"""Data layer + end-to-end pipeline tests on the synthetic fixture dataset.

The fixtures in tests/fixtures/wahapedia mimic the Wahapedia export schema
with made-up units — they are NOT official game values.
"""

import json
from pathlib import Path

import pytest

from engine.data import AmbiguousName, Database, DataError, build_unit
from engine.matchup import MatchupReport, select_weapons
from engine.run import main, resolve_army
from engine.simulate import SimOptions

FIXTURES = Path(__file__).parent / "fixtures" / "wahapedia"

MY_LIST = """\
Bug force (260 points)

Test Bugs
Strike Force (2000 points)

CHARACTERS

Test Tyrant (200 points)
  • 1x Big blade
  • 1x Bio-cannon

OTHER DATASHEETS

Testagants (60 points)
  • 10x Testagant
    ◦ 10x Fleshzapper
    ◦ 10x Claws
"""

OPP_LIST = """\
Marine force (80 points)

Test Marines

OTHER DATASHEETS

Test Intercessors (80 points)
  • 5x Test Intercessor
    ◦ 5x Bolt rifle
    ◦ 5x Close combat weapon
"""


@pytest.fixture(scope="module")
def db():
    return Database(FIXTURES)


def test_missing_data_dir_message(tmp_path):
    with pytest.raises(DataError, match="update_data.py"):
        Database(tmp_path)


def test_find_exact_and_fuzzy(db):
    assert db.find_datasheet("Test Tyrant").id == "101"
    assert db.find_datasheet("test tyrannt").id == "101"          # typo
    assert db.find_datasheet("Testagants", "Test Bugs").id == "100"


def test_ambiguous_raises_with_candidates(db):
    with pytest.raises(AmbiguousName) as exc:
        db.find_datasheet("Test Squad")
    assert "Test Squad Alpha" in str(exc.value)
    assert "Test Squad Beta" in str(exc.value)


def test_unknown_unit(db):
    with pytest.raises(DataError, match="no datasheet found"):
        db.find_datasheet("Completely Unrelated Thing")


def test_build_unit_from_fixture(db):
    sheet = db.find_datasheet("Test Tyrant")
    unit = build_unit(sheet, models=None, points=200,
                      weapon_request={"Big blade": 1, "Bio-cannon": 1})
    assert unit.models == 1 and unit.points == 200
    assert unit.toughness == 10 and unit.save == 2 and unit.invuln == 4
    assert unit.fnp == 6                       # parsed from "Feel No Pain 6+"
    assert "MONSTER" in unit.keywords
    # "Big blade" matches both melee profiles; bio-cannon keeps its keywords
    names = sorted(w.name for w in unit.weapons)
    assert names == ["Big blade – strike", "Big blade – sweep", "Bio-cannon"]
    cannon = next(w for w in unit.weapons if w.name == "Bio-cannon")
    assert cannon.abilities.blast and cannon.abilities.sustained_hits.mean == 1


def test_model_count_resolved_from_points(db):
    sheet = db.find_datasheet("Testagants")
    unit = build_unit(sheet, models=None, points=120, weapon_request={})
    assert unit.models == 20                   # cost table: 20 models = 120 pts
    # no wargear given -> default loadout from datasheet prose
    assert {w.name for w in unit.weapons} == {"Fleshzapper", "Claws"}
    assert all(w.count == 20 for w in unit.weapons)


def test_melee_profile_selection(db):
    warnings = []
    my = resolve_army(MY_LIST, db, "my_list", warnings)
    opp = resolve_army(OPP_LIST, db, "opp", warnings)
    tyrant = next(u for u in my if u.name == "Test Tyrant")
    marines = opp[0]
    opts = SimOptions(iterations=100)
    chosen = select_weapons(tyrant, marines, "melee", opts)
    # vs T4 Sv3+ W2 marines (useful damage capped at 2):
    # strike = 6*5/6*5/6*(4/6)*2 = 5.56 vs sweep = 12*5/6*4/6*(3/6)*1 = 3.33
    assert [w.name for w in chosen] == ["Big blade – strike"]

    # vs T3 Sv5+ W1 swarms the sweep profile wins on useful damage:
    # strike = 6*5/6*5/6*1*min(3,1) = 4.17 vs sweep = 12*5/6*4/6*(5/6) = 5.56
    gants = next(u for u in my if u.name == "Testagants")
    chosen = select_weapons(tyrant, gants, "melee", opts)
    assert [w.name for w in chosen] == ["Big blade – sweep"]


def test_end_to_end_report(db):
    warnings = []
    my = resolve_army(MY_LIST, db, "my_list", warnings)
    opp = resolve_army(OPP_LIST, db, "opp_list", warnings)
    assert [u.name for u in my] == ["Test Tyrant", "Testagants"]
    assert [u.models for u in my] == [1, 10]

    report = MatchupReport(options=SimOptions(iterations=1500),
                           my_units=my, opp_units=opp, warnings=warnings)
    report.compute()
    data = report.to_dict()
    # 2 my-units x 1 opp x 2 phases + 1 opp x 2 my x 2 phases = 8 matchups
    assert len(data["matchups"]) == 8
    for m in data["matchups"]:
        assert 0.0 <= m["p_destroyed"] <= 1.0
        assert m["p_below_half"] >= m["p_destroyed"]
        assert m["mean_damage"] >= 0.0
    summaries = data["unit_summaries"]
    assert {e["unit"] for e in summaries["mine"]} == {"Test Tyrant", "Testagants"}
    assert all(len(e["top_targets"]) <= 3 for e in summaries["mine"])


def test_cli_smoke(tmp_path, capsys):
    my = tmp_path / "my_list.txt"
    opp = tmp_path / "opponent_list.txt"
    out = tmp_path / "matchup.json"
    my.write_text(MY_LIST, encoding="utf-8")
    opp.write_text(OPP_LIST, encoding="utf-8")
    flags = tmp_path / "flags.txt"
    flags.write_text("Test Tyrant: +1 to wound, charged\n", encoding="utf-8")

    rc = main([str(my), str(opp), "--iterations", "500",
               "--data", str(FIXTURES), "--output", str(out),
               "--flags", str(flags)])
    assert rc == 0
    data = json.loads(out.read_text(encoding="utf-8"))
    assert set(data) == {"meta", "my_army", "opponent_army", "matchups",
                         "unit_summaries"}
    tyrant = next(u for u in data["my_army"] if u["name"] == "Test Tyrant")
    assert "+1 to wound" in tyrant["flags"]
    summary = capsys.readouterr().out
    assert "MY ARMY -> OPPONENT" in summary
    assert "PRIORITIES" in summary


def test_cli_bad_list(tmp_path, capsys):
    bad = tmp_path / "bad.txt"
    bad.write_text("nothing here", encoding="utf-8")
    rc = main([str(bad), str(bad), "--data", str(FIXTURES)])
    assert rc == 1
    assert "error:" in capsys.readouterr().err
