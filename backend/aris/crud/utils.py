import asyncio

import rsm
from bs4 import BeautifulSoup

from ..models import File


async def extract_title(file: File) -> str:
    if file is None:
        return ""
    # Use DB title only if user has manually set one (not the default)
    if file.title and file.title != "New File":
        return str(file.title)

    source_content = str(file.source) if file.source is not None else ""
    if not source_content.strip():
        return ""
    try:
        app = rsm.app.ParserApp(plain=source_content)
        await asyncio.to_thread(app.run)
        if app.transformer and app.transformer.tree and app.transformer.tree.title:
            return str(app.transformer.tree.title)
    except Exception:
        pass
    return ""


async def extract_section(file: File, section_name: str, handrails: bool = True) -> str:
    source_content = str(file.source) if file.source is not None else ""
    app = rsm.app.ProcessorApp(plain=source_content, handrails=handrails)
    await asyncio.to_thread(app.run)
    html = app.translator.body

    soup = BeautifulSoup(html, "lxml")
    element = soup.find("div", class_=section_name)
    # Return the string content of the element, or empty string if not found
    return str(element) if element else ""
