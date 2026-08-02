from engine.keywords import parse_abilities, strip_html


def test_strip_html():
    assert strip_html('<span class="kwb">LETHAL HITS</span>') == "LETHAL HITS"


def test_parse_flags_and_values():
    ab = parse_abilities("Sustained Hits 1, Lethal Hits, Devastating Wounds, "
                         "Anti-Infantry 4+, Torrent, Blast, Twin-linked, "
                         "Rapid Fire 2, Melta 2, Heavy, Lance")
    assert ab.sustained_hits.mean == 1
    assert ab.lethal_hits and ab.devastating_wounds
    assert ab.anti == {"INFANTRY": 4}
    assert ab.torrent and ab.blast and ab.twin_linked
    assert ab.rapid_fire.mean == 2
    assert ab.melta == 2
    assert ab.heavy and ab.lance
    assert ab.unknown == []


def test_sustained_d3():
    ab = parse_abilities("SUSTAINED HITS D3")
    assert ab.sustained_hits.mean == 2.0


def test_unknown_reported():
    ab = parse_abilities("Assault, Frobnicate 3+")
    assert ab.assault
    assert ab.unknown == ["Frobnicate 3+"]


def test_html_input():
    ab = parse_abilities('<span class="kwb">ANTI-VEHICLE 3+</span>, '
                         '<span class="kwb">MELTA 4</span>')
    assert ab.anti == {"VEHICLE": 3}
    assert ab.melta == 4


def test_empty():
    ab = parse_abilities("-")
    assert not ab.lethal_hits and ab.unknown == []
