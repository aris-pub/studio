#!/usr/bin/env python3
"""
Test two users Y.js sync (frontend only):
1. Open file 1 in two browser sessions
2. User A makes edit
3. Verify User B sees the edit
4. User B makes edit
5. Verify User A sees the edit
"""

import asyncio
import json
import time
from pathlib import Path
from playwright.async_api import async_playwright

# Load session from CLI session file
session_path = Path.home() / '.studio' / 'session.json'
with open(session_path) as f:
    SESSION = json.load(f)

async def setup_user(context, page_name):
    """Setup a user session and navigate to file 264"""
    page = await context.new_page()

    print(f"   {page_name}: Navigating to home page...")
    await page.goto('http://localhost:5173/', wait_until='domcontentloaded')

    print(f"   {page_name}: Injecting auth tokens...")
    user_json = json.dumps(SESSION["user"])
    await page.evaluate(f"""() => {{
        localStorage.setItem('accessToken', '{SESSION["access_token"]}');
        localStorage.setItem('refreshToken', '{SESSION["refresh_token"]}');
        localStorage.setItem('user', '{user_json}');
    }}""")

    print(f"   {page_name}: Navigating to file 1...")
    await page.goto('http://localhost:5173/file/1', wait_until='domcontentloaded')

    print(f"   {page_name}: Waiting for manuscript...")
    await page.wait_for_selector('[data-testid="manuscript-container"]', timeout=10000)

    print(f"   {page_name}: Opening source editor...")
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
    await page.wait_for_selector('.cm-container', timeout=5000)

    print(f"   {page_name}: Ready!")
    return page

async def get_editor_content(page):
    """Get content from CodeMirror editor"""
    return await page.evaluate("""() => {
        const editor = document.querySelector('.cm-content');
        return editor ? editor.textContent : '';
    }""")

async def main():
    print("=" * 60)
    print("Testing Two Users Y.js Sync")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        print("\n1. Setting up User A...")
        context_a = await browser.new_context()
        page_a = await setup_user(context_a, "User A")

        print("\n2. Setting up User B...")
        context_b = await browser.new_context()
        page_b = await setup_user(context_b, "User B")

        print("\n3. Waiting for initial Y.js sync...")
        await asyncio.sleep(2)

        print("\n4. User A making edit...")
        await page_a.click('.cm-content')
        await page_a.keyboard.press('End')
        edit_a_text = f'\n\n# User A Edit at {time.strftime("%H:%M:%S")}\n'
        await page_a.keyboard.type(edit_a_text)
        print(f"   ✓ User A typed: {edit_a_text.strip()}")

        print("\n5. Waiting for sync to User B...")
        await asyncio.sleep(1)

        print("\n6. Checking User B sees User A's edit...")
        content_b = await get_editor_content(page_b)
        if 'User A Edit' in content_b:
            print("   ✓ User B sees User A's edit!")
        else:
            print("   ✗ User B does NOT see User A's edit")

        print("\n7. User B making edit...")
        await page_b.click('.cm-content')
        await page_b.keyboard.press('End')
        edit_b_text = f'\n\n# User B Edit at {time.strftime("%H:%M:%S")}\n'
        await page_b.keyboard.type(edit_b_text)
        print(f"   ✓ User B typed: {edit_b_text.strip()}")

        print("\n8. Waiting for sync to User A...")
        await asyncio.sleep(1)

        print("\n9. Checking User A sees User B's edit...")
        content_a = await get_editor_content(page_a)
        if 'User B Edit' in content_a:
            print("   ✓ User A sees User B's edit!")
        else:
            print("   ✗ User A does NOT see User B's edit")

        print("\n10. Waiting for debounce (500ms) + buffer...")
        await asyncio.sleep(2)

        print("\n11. Test complete!")
        print("\nCheck:")
        print("  - Backend logs for Y.Text change observations (both edits)")
        print("  - Database for updated content (should include both edits)")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
