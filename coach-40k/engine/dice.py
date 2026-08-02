"""Dice expression parsing: "D6", "2D6+1", "D3", "4", "D6+2"…"""

from __future__ import annotations

import re
from dataclasses import dataclass
from random import Random

_PATTERN = re.compile(
    r"^\s*(?:(\d*)\s*D\s*(\d+))?\s*(?:(?<=\d)\s*)?([+-]\s*\d+)?\s*$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Dice:
    """n dice with `sides` sides, plus a flat modifier. n=0 means a flat value."""

    n: int
    sides: int
    flat: int

    @classmethod
    def parse(cls, text: str | int) -> "Dice":
        if isinstance(text, int):
            return cls(0, 0, text)
        s = str(text).strip()
        if re.fullmatch(r"\d+", s):
            return cls(0, 0, int(s))
        m = _PATTERN.match(s)
        if not m or not m.group(2):
            raise ValueError(f"cannot parse dice expression: {text!r}")
        n = int(m.group(1)) if m.group(1) else 1
        sides = int(m.group(2))
        flat = int(m.group(3).replace(" ", "")) if m.group(3) else 0
        return cls(n, sides, flat)

    def roll(self, rng: Random) -> int:
        total = self.flat
        for _ in range(self.n):
            total += rng.randint(1, self.sides)
        return total

    @property
    def mean(self) -> float:
        return self.n * (self.sides + 1) / 2 + self.flat

    @property
    def max(self) -> int:
        return self.n * self.sides + self.flat

    def __str__(self) -> str:
        if self.n == 0:
            return str(self.flat)
        core = f"{self.n if self.n > 1 else ''}D{self.sides}"
        if self.flat:
            return f"{core}{self.flat:+d}"
        return core
