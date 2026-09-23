"""Tests for asset filename validation.

An asset filename is joined onto a temp directory and written during PDF export,
so a name carrying a path writes outside it. See aris/asset_filenames.py.
"""

import pytest

from aris.asset_filenames import validate_asset_filename


@pytest.mark.parametrize(
    "name",
    [
        "figure.png",
        "a b c.svg",
        "figure.tar.gz",
        ".hidden.png",
        "ünïcode.png",
    ],
)
def test_accepts_ordinary_names(name):
    assert validate_asset_filename(name) == name


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("/etc/passwd", "passwd"),
        ("subdir/figure.png", "figure.png"),
        ("  figure.png  ", "figure.png"),
    ],
)
def test_strips_the_directory_part(given, expected):
    assert validate_asset_filename(given) == expected


@pytest.mark.parametrize(
    "name",
    [
        "",
        "   ",
        ".",
        "..",
        "../",
        "../../etc/passwd",
        "../..",
        "..\\..\\windows\\system32\\config",
        "figure\\..\\..\\x.png",
        "figure\x00.png",
    ],
)
def test_rejects_names_that_could_escape(name):
    with pytest.raises(ValueError):
        validate_asset_filename(name)
