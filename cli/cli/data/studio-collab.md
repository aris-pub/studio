---
name: studio-collab
description: Collaborate on RSM documents in Studio via the CLI. Use when asked to read, edit, or review RSM documents, respond to reviewer comments, or work with a human on a paper. Provides the full agent workflow for document collaboration through Studio's annotation system.
---

# Studio Collaboration Skill

Enables an AI agent to collaborate with a human researcher on RSM documents through the Studio CLI. The human uses the browser; the agent uses the CLI. They share the same workspace.

## When to Use

Auto-invoke when:
- Asked to work on, read, or edit an RSM document in Studio
- Asked to review or respond to comments/annotations on a document
- A `studio watch` process reports new annotations
- Asked to collaborate with someone on a paper in Studio

## Prerequisites

The agent must be logged in. If any command fails with "Not logged in", run:

```bash
studio login -u <email> -p <password> --server <api-url>
```

The `--server` URL is stored in the session file (`~/.studio/session.json`) so subsequent commands don't need it.

## Commands Reference

### Discover available documents

```bash
studio files
```

Lists all documents the agent has been invited to collaborate on. The agent cannot create documents — the human creates them and invites the agent.

### Read a document

```bash
studio file <file_id>                          # Print RSM source to stdout (default)
studio file <file_id> read                     # Same as above
studio file <file_id> read --output draft.rsm  # Save to file
studio file <file_id> read --json              # JSON with file_id and content
```

Connects to Y.js WebSocket, syncs the current document state, prints the RSM source, and disconnects. Always read before editing to avoid overwriting the human's changes.

### Edit a document

```bash
studio file <file_id> edit --source revised.rsm   # From file
studio file <file_id> edit --stdin                  # From stdin
```

Connects to Y.js, applies the new source as a diff, and disconnects. The edit appears in real-time for any human with the document open in their browser. Always read first, apply changes locally, then edit.

### Check for comments

```bash
studio file <file_id> comments                        # Rich table output
studio file <file_id> comments --json                  # Machine-readable JSON
studio file <file_id> comments --since 2026-03-18T10:00:00  # Only recent
```

Lists all shared annotations and their message threads. Use `--json` for parsing. Use `--since` to avoid re-processing old comments.

### Watch for new comments (background)

```bash
studio watch <file_id>                    # Poll every 10s
studio watch <file_id> --interval 30      # Poll every 30s
```

Long-running process that outputs JSON lines:
- `{"type": "new", "annotation": {...}}` — new comment
- `{"type": "updated", "annotation": {...}}` — new reply in existing thread
- `{"type": "deleted", "annotation_id": N}` — comment resolved

Run in the background. Check output when ready to process feedback.

### Reply to a comment

```bash
studio file <file_id> reply <annotation_id> "Your response text"
studio file <file_id> reply <annotation_id> --stdin       # Pipe longer responses
```

Posts a message to an existing annotation thread. The human sees it immediately in their browser.

### Resolve a comment

```bash
studio file <file_id> resolve <annotation_id>
```

Soft-deletes the annotation, marking the comment as addressed. Use after editing the document to reflect the feedback.

## The Collaboration Workflow

### Phase 1: Read and understand

```bash
studio files                              # Find the document
studio file <file_id> read -o doc.rsm     # Download current state
# Read and understand the document content
```

### Phase 2: Review loop

```bash
studio file <file_id> comments --json     # Check for human feedback
# For each annotation:
#   1. Read the comment and understand what the human wants
#   2. Read the current document: studio file <file_id> read -o doc.rsm
#   3. Make edits locally to doc.rsm
#   4. Upload: studio file <file_id> edit --source doc.rsm
#   5. Reply: studio file <file_id> reply <ann_id> "Addressed — see revised section 3.2"
#   6. Resolve: studio file <file_id> resolve <ann_id>
```

### Phase 3: Continuous collaboration

```bash
# Start watching in background
studio watch <file_id> &
# When new comments appear, repeat Phase 2
```

## Key Rules

- **Always read before editing.** The human may have made changes since your last read.
- **Reply before resolving.** Tell the human what you changed, then mark it done.
- **One annotation at a time.** Read the comment, edit the document, reply, resolve. Don't batch.
- **The human is the owner.** You are a collaborator. You cannot create documents, delete documents, or manage permissions.
- **Use `--json` for parsing.** When processing comments programmatically, always use `--json` output.
