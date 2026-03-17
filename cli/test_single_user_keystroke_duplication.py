#!/usr/bin/env python3
"""
Regression test for single-user keystroke duplication bug.

When one user opens a document (no other users have it open) and types in the
CodeMirror editor, each keystroke should appear exactly once, not duplicated.

Expected: Typing "HELLO" produces "HELLO"
Bug: Typing "HELLO" produces "HHEELLLLOO" (each character duplicated)
"""

from playwright.sync_api import sync_playwright
import time

from cli import get_frontend_port

FRONTEND_URL = f"http://localhost:{get_frontend_port()}"


def test_single_user_no_duplication() -> None:
    """Test that single-user typing does not duplicate characters."""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("=" * 60)
        print("SINGLE USER KEYSTROKE DUPLICATION TEST")
        print("=" * 60)

        # Navigate to frontend
        page.goto(FRONTEND_URL, wait_until='domcontentloaded')

        # Inject session tokens
        page.evaluate('''localStorage.setItem('accessToken', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzcwMjIxNzM3fQ.mpcn96aimju7TOH-dSfZV34euEH1UQmTlnNcUWOMJ4c'); localStorage.setItem('refreshToken', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzcwMjIxNzM3LCJ0eXBlIjoicmVmcmVzaCJ9.qourOZ_dTRY0Ou7K5wWSpM_8kLR6m52r-o7_2hqe6H4'); localStorage.setItem('user', '{"email": "testuser@aris.pub", "id": 1, "name": "Test User", "initials": null, "created_at": "2026-02-03T16:15:02.946491+00:00", "avatar_color": null, "email_verified": false}');''')

        # Navigate to file
        print("\n1. Navigating to file...")
        page.goto(f'{FRONTEND_URL}/file/1', wait_until='domcontentloaded')

        # Wait for authentication
        page.wait_for_selector('[data-testid="user-avatar"]', timeout=5000)
        print("   ✓ User authenticated")

        # Wait for manuscript container
        page.wait_for_selector('[data-testid="manuscript-container"]', timeout=5000)
        print("   ✓ Manuscript loaded")

        # Open source editor (click the button, not the label)
        print("\n2. Opening source editor...")
        page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button')
        page.wait_for_selector('.cm-editor', timeout=5000)
        print("   ✓ Source editor opened")

        # Wait for Y.js to sync (important!)
        time.sleep(2)
        print("   ✓ Y.js sync complete")

        # Get initial content
        initial_content = page.evaluate('window.__cmView.state.doc.toString()')
        print(f"\n3. Initial content ({len(initial_content)} chars):")
        print(f"   '{initial_content[:50]}{'...' if len(initial_content) > 50 else ''}'")

        # Clear the editor first to have a clean slate
        print("\n4. Clearing editor...")
        page.evaluate('''
            window.__cmView.dispatch({
                changes: { from: 0, to: window.__cmView.state.doc.length, insert: "" }
            });
        ''')
        time.sleep(0.5)

        cleared_content = page.evaluate('window.__cmView.state.doc.toString()')
        print(f"   Content after clear: '{cleared_content}' (length: {len(cleared_content)})")

        # Type test string one character at a time
        test_string = "HELLO"
        print(f"\n5. Typing test string: '{test_string}'")

        # Focus the editor
        page.click('.cm-content')
        time.sleep(0.2)

        for i, char in enumerate(test_string):
            print(f"   Typing char {i+1}: '{char}'", end="", flush=True)
            page.keyboard.press(char)
            time.sleep(0.1)  # Small delay between keystrokes

            # Check content after each keystroke
            current_content = page.evaluate('window.__cmView.state.doc.toString()')
            expected_so_far = test_string[:i+1]
            print(f" → content: '{current_content}' (expected: '{expected_so_far}')")

            # Check for duplication after each character
            if current_content != expected_so_far:
                print("\n   ❌ DUPLICATION DETECTED!")
                print(f"      Expected: '{expected_so_far}'")
                print(f"      Got:      '{current_content}'")
                print(f"      Character '{char}' was duplicated!")

        # Get final content
        time.sleep(0.5)  # Wait for any async updates
        final_content = page.evaluate('window.__cmView.state.doc.toString()')

        print("\n6. Final content check:")
        print(f"   Expected: '{test_string}'")
        print(f"   Got:      '{final_content}'")

        # Verification
        success = final_content == test_string

        if success:
            print("\n" + "=" * 60)
            print("✅ TEST PASSED - No character duplication detected")
            print("=" * 60)
        else:
            print("\n" + "=" * 60)
            print("❌ TEST FAILED - Character duplication detected!")
            print("=" * 60)
            print(f"\nExpected: '{test_string}' (length: {len(test_string)})")
            print(f"Got:      '{final_content}' (length: {len(final_content)})")

            # Analyze the duplication pattern
            if len(final_content) == len(test_string) * 2:
                print("\nPattern: Each character appears to be duplicated exactly once")
            else:
                print(f"\nPattern: Complex duplication (expected {len(test_string)}, got {len(final_content)})")

        browser.close()

        # Raise exception if test failed
        if not success:
            raise AssertionError(f"Keystroke duplication detected: expected '{test_string}', got '{final_content}'")

if __name__ == '__main__':
    test_single_user_no_duplication()
