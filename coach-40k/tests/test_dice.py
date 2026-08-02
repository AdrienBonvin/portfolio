from random import Random

import pytest

from engine.dice import Dice


@pytest.mark.parametrize("expr,n,sides,flat,mean", [
    ("1", 0, 0, 1, 1.0),
    ("6", 0, 0, 6, 6.0),
    ("D6", 1, 6, 0, 3.5),
    ("D3", 1, 3, 0, 2.0),
    ("2D6", 2, 6, 0, 7.0),
    ("D6+2", 1, 6, 2, 5.5),
    ("2D6+1", 2, 6, 1, 8.0),
    ("d3+1", 1, 3, 1, 3.0),
])
def test_parse_and_mean(expr, n, sides, flat, mean):
    d = Dice.parse(expr)
    assert (d.n, d.sides, d.flat) == (n, sides, flat)
    assert d.mean == mean


def test_parse_int_input():
    assert Dice.parse(4).mean == 4


def test_invalid():
    with pytest.raises(ValueError):
        Dice.parse("garbage")


def test_roll_bounds_and_mean():
    rng = Random(1)
    d = Dice.parse("2D6+1")
    rolls = [d.roll(rng) for _ in range(20_000)]
    assert min(rolls) >= 3 and max(rolls) <= 13
    assert abs(sum(rolls) / len(rolls) - 8.0) < 0.06
