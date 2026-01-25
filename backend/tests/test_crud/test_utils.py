from types import SimpleNamespace

import rsm

from aris.crud.utils import extract_section, extract_title
from aris.models import File


class DummyParser:
    def __init__(self, plain):
        pass

    def run(self):
        pass


class DummyProcessor:
    def __init__(self, **_):
        pass

    def run(self):
        pass


def fake_app(kind: str, plain: str, **kwargs):
    if kind == "ProcessorApp":
        processor = DummyProcessor(plain=plain, **kwargs)
        processor.translator = SimpleNamespace(body="<div></div>")
        return processor
    parser = DummyParser(plain)
    parser.transformer = SimpleNamespace(tree=SimpleNamespace(title="Parsed Title"))
    return parser


async def test_extract_title_none_file():
    title = await extract_title(None)
    assert title == ""


async def test_extract_title_existing_title():
    file = File(title="Explicit Title", source="content")
    title = await extract_title(file)
    assert title == "Explicit Title"


async def test_extract_title_parsed(monkeypatch):
    monkeypatch.setattr(rsm.app, "ParserApp", lambda plain: fake_app("ParserApp", plain))
    file = File(source="content")
    title = await extract_title(file)
    assert title == "Parsed Title"


async def test_extract_section_found(monkeypatch):
    monkeypatch.setattr(rsm.app, "ProcessorApp", lambda **kw: fake_app("ProcessorApp", **kw))
    file = File(source="content")
    section = await extract_section(file, "section-name")
    assert section == ""  # BeautifulSoup returns nothing with empty body


async def test_extract_section_not_found(monkeypatch):
    monkeypatch.setattr(rsm.app, "ProcessorApp", lambda **kw: fake_app("ProcessorApp", **kw))
    file = File(source="content")
    section = await extract_section(file, "nonexistent")
    assert section == ""