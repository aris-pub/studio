#!/usr/bin/env python3
"""
Debug two-user Y.js sync by capturing browser console and network logs
"""

import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

# Load session
session_path = Path.home() / '.studio' / 'session.json'
with open(session_path) as f:
    SESSION = json.load(f)

async def setup_user_with_logging(context, page_name):
    """Setup user with console and network logging"""
    page = await context.new_page()

    # Capture console logs
    page.on("console", lambda msg: print(f"[{page_name} Console] {msg.type.upper()}: {msg.text}"))

    # Capture page errors
    page.on("pageerror", lambda err: print(f"[{page_name} Error] {err}"))

    # Capture WebSocket frames
    def handle_websocket(ws):
        print(f"[{page_name}] WebSocket opened: {ws.url}")
        ws.on("close", lambda: print(f"[{page_name}] WebSocket closed"))
        ws.on("framereceived", lambda payload: print(f"[{page_name}] ← Received {len(payload)} bytes"))
        ws.on("framesent", lambda payload: print(f"[{page_name}] → Sent {len(payload)} bytes"))

    page.on("websocket", handle_websocket)

    print(f"\n{page_name}: Navigating to home page...")
    await page.goto('http://localhost:5173/', wait_until='domcontentloaded')

    print(f"{page_name}: Injecting auth tokens...")
    user_json = json.dumps(SESSION["user"])
    await page.evaluate(f"""() => {{
        localStorage.setItem('accessToken', '{SESSION["access_token"]}');
        localStorage.setItem('refreshToken', '{SESSION["refresh_token"]}');
        localStorage.setItem('user', '{user_json}');
    }}""")

    print(f"{page_name}: Navigating to file 1...")
    await page.goto('http://localhost:5173/file/1', wait_until='domcontentloaded')

    print(f"{page_name}: Waiting for manuscript...")
    await page.wait_for_selector('[data-testid="manuscript-container"]', timeout=10000)

    print(f"{page_name}: Opening source editor...")
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
    await page.wait_for_selector('.cm-container', timeout=5000)

    print(f"{page_name}: Ready!\n")
    return page

async def main():
    print("="*60)
    print("Debugging Two-User Y.js Sync")
    print("="*60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # Create two separate contexts
        context_a = await browser.new_context()
        context_b = await browser.new_context()

        print("\n1. Setting up User A...")
        page_a = await setup_user_with_logging(context_a, "User A")

        print("2. Setting up User B...")
        page_b = await setup_user_with_logging(context_b, "User B")

        print("3. Waiting for Y.js sync (5 seconds)...")
        await asyncio.sleep(5)

        print("\n4. User A making edit...")
        await page_a.click('.cm-content')
        await page_a.keyboard.press('End')
        await page_a.keyboard.type('AAAA')
        print("   ✓ User A typed: AAAA")

        print("\n5. Waiting 3 seconds for sync...")
        await asyncio.sleep(3)

        print("\n6. Checking if User B sees the edit...")
        content_b = await page_b.evaluate("() => document.querySelector('.cm-content').textContent")
        if 'AAAA' in content_b:
            print(f"   ✓ User B SEES User A's edit: {content_b}")
        else:
            print(f"   ✗ User B does NOT see User A's edit. Content: {content_b}")

        print("\n7. User B making edit...")
        await page_b.click('.cm-content')
        await page_b.keyboard.press('End')
        await page_b.keyboard.type('BBBB')
        print("   ✓ User B typed: BBBB")

        print("\n8. Waiting 3 seconds for sync...")
        await asyncio.sleep(3)

        print("\n9. Checking if User A sees the edit...")
        content_a = await page_a.evaluate("() => document.querySelector('.cm-content').textContent")
        if 'BBBB' in content_a:
            print(f"   ✓ User A SEES User B's edit: {content_a}")
        else:
            print(f"   ✗ User A does NOT see User B's edit. Content: {content_a}")

        print("\n10. Final state:")
        print(f"   User A content: {content_a}")
        print(f"   User B content: {content_b}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
