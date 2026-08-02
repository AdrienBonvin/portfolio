from engine.parse_list import parse_army_list

GW_EXPORT = """\
Bug force (260 points)

Test Bugs
Strike Force (2000 points)
Test Detachment

CHARACTERS

Test Tyrant (200 points)
  • Warlord
  • 1x Big blade
  • 1x Bio-cannon
  • Enhancement: Synaptic Nexus

OTHER DATASHEETS

Testagants (60 points)
  • 10x Testagant
    ◦ 10x Fleshzapper
    ◦ 10x Claws

Exported with App Version: v1.29.0 (2), Data Version: v588
"""


def test_gw_app_export():
    parsed = parse_army_list(GW_EXPORT)
    assert parsed.title == "Bug force"
    assert parsed.total_points == 260
    assert "Test Bugs" in parsed.faction_hints
    assert [u.name for u in parsed.units] == ["Test Tyrant", "Testagants"]

    tyrant, gants = parsed.units
    assert tyrant.points == 200
    assert tyrant.is_warlord
    assert tyrant.enhancements == ["Synaptic Nexus"]
    assert (1, "Big blade") in tyrant.entries

    assert gants.points == 60
    assert (10, "Testagant") in gants.entries
    assert (10, "Fleshzapper") in gants.entries

    # entry classification helpers
    is_weapon = lambda name: name in {"Fleshzapper", "Claws", "Big blade", "Bio-cannon"}
    assert gants.model_count(is_weapon) == 10
    assert gants.weapon_request(is_weapon) == {"Fleshzapper": 10, "Claws": 10}
    assert tyrant.model_count(is_weapon) is None  # only weapons listed


def test_handwritten_list():
    text = """\
my list (140 points)

Testagants (60 points)
- 10x Testagant

Test Intercessors (80 points)
"""
    parsed = parse_army_list(text)
    assert [u.name for u in parsed.units] == ["Testagants", "Test Intercessors"]
    assert parsed.units[0].entries == [(10, "Testagant")]
    assert parsed.units[1].entries == []


def test_battle_size_and_sections_skipped():
    parsed = parse_army_list(GW_EXPORT)
    names = [u.name for u in parsed.units]
    assert "Strike Force" not in names
