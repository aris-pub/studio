#!/usr/bin/env python3
"""
Proof-of-Concept: Test pycrdt basic operations

This script verifies that pycrdt is installed correctly and that
basic Y.Doc and Y.Text operations work as expected.
"""

from pycrdt import Doc, Text


def test_basic_operations():
    """Test basic Y.Doc and Y.Text operations"""
    print("=" * 60)
    print("Testing pycrdt basic operations")
    print("=" * 60)

    # Create document
    print("\n1. Creating Y.Doc...")
    doc = Doc()
    print("   ✓ Y.Doc created")

    # Get Y.Text object
    print("\n2. Getting Y.Text object...")
    text = doc.get('text', type=Text)
    print("   ✓ Y.Text object retrieved")

    # Check initial state
    print("\n3. Checking initial state...")
    content = str(text)
    print(f"   Initial content: '{content}' (length: {len(content)})")
    assert content == "", "Initial content should be empty"
    print("   ✓ Initial state is empty")

    # Modify within transaction
    print("\n4. Adding content via transaction...")
    with doc.transaction():
        text += "Hello from backend!"
    print("   ✓ Content added")

    # Read content back
    print("\n5. Reading content back...")
    content = str(text)
    print(f"   Content: '{content}' (length: {len(content)})")
    assert content == "Hello from backend!", "Content mismatch"
    print("   ✓ Content matches expected value")

    # Test append
    print("\n6. Appending more content...")
    with doc.transaction():
        text += " This is a test."
    content = str(text)
    print(f"   Content: '{content}' (length: {len(content)})")
    assert content == "Hello from backend! This is a test.", "Append failed"
    print("   ✓ Append successful")

    # Test observer
    print("\n7. Testing observer pattern...")
    changes_detected = []

    def on_change(event):
        changes_detected.append(str(event.target))

    text.observe(on_change)

    with doc.transaction():
        text += " Observer works!"

    assert len(changes_detected) == 1, "Observer not called"
    assert "Observer works!" in changes_detected[0], "Observer got wrong content"
    print(f"   Observer detected change: '{changes_detected[0][-15:]}'")
    print("   ✓ Observer pattern works")

    print("\n" + "=" * 60)
    print("✅ All pycrdt operations working correctly!")
    print("=" * 60)


def test_document_sync():
    """Test syncing state between two documents"""
    print("\n" + "=" * 60)
    print("Testing Y.Doc state synchronization")
    print("=" * 60)

    # Create first document
    print("\n1. Creating document 1 with content...")
    doc1 = Doc()
    text1 = doc1.get('text', type=Text)
    with doc1.transaction():
        text1 += "Synced content"
    print(f"   Doc1 content: '{str(text1)}'")

    # Create second document
    print("\n2. Creating document 2 (empty)...")
    doc2 = Doc()
    text2 = doc2.get('text', type=Text)
    print(f"   Doc2 content: '{str(text2)}' (empty)")

    # Sync state from doc1 to doc2
    print("\n3. Syncing state from doc1 to doc2...")
    state_vector = doc2.get_state()
    update = doc1.get_update(state_vector)
    doc2.apply_update(update)
    print(f"   Doc2 content after sync: '{str(text2)}'")

    # Verify sync worked
    assert str(text1) == str(text2), "Sync failed - content mismatch"
    print("   ✓ Documents successfully synchronized")

    print("\n" + "=" * 60)
    print("✅ Document synchronization working correctly!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_basic_operations()
        test_document_sync()
        print("\n🎉 All tests passed! pycrdt is ready to use.\n")
    except Exception as e:
        print(f"\n❌ Test failed: {e}\n")
        raise
