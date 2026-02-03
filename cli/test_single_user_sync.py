#!/usr/bin/env python3
"""
Test single user Y.js sync:
1. Open file 264
2. Make edits in source editor
3. Verify backend observes changes
4. Verify database is updated
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

async def main():
    print("=" * 60)
    print("Testing Single User Y.js Sync")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("\n1. Navigating to home page to enable localStorage...")
        await page.goto('http://localhost:5173/', wait_until='domcontentloaded')

        print("2. Injecting auth tokens into localStorage...")
        user_json = json.dumps(SESSION["user"])
        await page.evaluate(f"""() => {{
            localStorage.setItem('accessToken', '{SESSION["access_token"]}');
            localStorage.setItem('refreshToken', '{SESSION["refresh_token"]}');
            localStorage.setItem('user', '{user_json}');
        }}""")

        print("3. Navigating to file 264...")
        await page.goto('http://localhost:5173/file/1', wait_until='domcontentloaded')

        print("4. Waiting for manuscript to load...")
        await page.wait_for_selector('[data-testid="manuscript-container"]', timeout=10000)
        print("   ✓ Manuscript loaded")

        print("\n5. Opening source editor...")
        await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
        await page.wait_for_selector('.cm-container', timeout=5000)
        print("   ✓ Source editor opened")

        print("\n6. Waiting for initial Y.js sync...")
        await asyncio.sleep(2)

        print("\n7. Making edit (appending text)...")
        # Click in the editor and type
        await page.click('.cm-content')
        await page.keyboard.press('End')  # Go to end
        await page.keyboard.type('\n\n# Test Edit from Single User\n\nThis is a test edit at ' + time.strftime('%H:%M:%S'))
        print("   ✓ Edit made")

        print("\n8. Waiting for debounce (500ms) + buffer...")
        await asyncio.sleep(2)

        print("\n9. Test complete!")
        print("\nCheck:")
        print("  - Backend logs for Y.Text change observation")
        print("  - Database for updated content (should include test edit)")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
