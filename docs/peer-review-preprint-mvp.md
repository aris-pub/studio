# Peer Review & Preprint MVP Specification

## Overview

This document outlines the Minimum Viable Product (MVP) features for RSM Studio's peer review and preprint portal functionality. The goal is to create a focused, achievable feature set that delivers real value to researchers from day one.

## Core MVP Features

### Peer Review Features

#### 1. Contextual Comment System
- **Selection-based anchoring**: Comments are tied to user-selected text ranges within manuscripts
- **AST-backed positioning**: Leverages existing RSM rendering engine's AST to maintain comment positions through document changes
- **Graceful degradation**: When automatic repositioning fails, comments become "orphaned" but preserved, allowing users to manually re-anchor them
- **Flexible threading**: Support both threaded replies to existing comments and new top-level comments

#### 2. Reviewer Identity Management
- **Anonymous/identified toggle**: Reviewers can choose per-review whether to remain anonymous or reveal their identity
- **Consistent pseudonymous option**: Allow reviewers to maintain a consistent anonymous identity across reviews without revealing real names

#### 3. Version and Change Tracking
- **Linear version history**: Git-like diff visualization without the complexity of branching/merging
- **Pinnable milestones**: Users can mark important document versions (e.g., "Initial submission", "Post-review revision")
- **Comment-version linking**: Each comment is tied to a specific document version
- **Change visualization**: Clear diff views showing what changed between versions

### Preprint Portal Features

#### 1. Search and Discovery
- **Basic search functionality**: Full-text search across titles, abstracts, authors, and content
- **Filtering capabilities**: Filter by publication date, research field, review status
- **Relevance ranking**: Search results ranked by relevance and recency

#### 2. Categorization and Tagging
- **Hierarchical taxonomy**: Use arXiv's established field classification as the foundation
  - Major fields (e.g., Computer Science, Biology, Physics)
  - Subfields (e.g., cs.AI, q-bio.NC, physics.bio-ph)
- **Free-form keyword tags**: User-defined tags for specific topics, methods, or themes
- **AI-assisted tagging**: Ari suggests relevant tags based on content analysis
- **Tag-based discovery**: Browse and search by categories and tags

#### 3. Author and Content Following
- **Author following**: Users can follow specific researchers to get notified of their new publications
- **Institution following**: Follow research groups or institutions
- **Notification preferences**: 
  - Email notifications (immediate, daily digest, weekly digest)
  - In-app notifications
  - User-configurable frequency and delivery method

#### 4. Basic Sharing
- **Social media integration**: One-click sharing to Twitter, LinkedIn, etc.
- **Direct link sharing**: Clean, shareable URLs for each preprint
- **Email sharing**: Built-in email sharing with customizable messages
- **Citation export**: Export citations in standard formats (BibTeX, RIS, etc.)

## Technical Architecture

### Document AST Integration
The peer review system builds on RSM Studio's existing RSM (Readable Research Markup) rendering engine:

- **AST Foundation**: Each document is parsed into an Abstract Syntax Tree that represents the semantic structure
- **Node-based anchoring**: Comments are anchored to specific AST nodes rather than character positions
- **Structural awareness**: The system understands document elements (paragraphs, headings, figures, citations) for intelligent comment positioning
- **Change resilience**: When documents are edited, the AST diff helps maintain comment positions even through structural changes

### Comment Persistence Strategy
```
Comment Structure:
- ID: Unique identifier
- Document ID: Which manuscript
- Version ID: Which document version
- Anchor: AST node reference + text selection range
- Content: Comment text and metadata
- Thread: Parent comment ID (for replies)
- Author: Reviewer information
- Timestamp: Creation and modification times
- Status: Active, orphaned, resolved
```

### Version Management
- **Linear history**: Each document edit creates a new version with incremental ID
- **Milestone tagging**: Users can label specific versions with meaningful names
- **Diff computation**: Generate semantic diffs between any two versions
- **Comment migration**: Automatic repositioning of comments across versions with fallback to orphaned status

## User Experience Flows

### Review Workflow
1. **Initiate Review**: Author requests reviews on their preprint
2. **Reviewer Invitation**: Author invites reviewers (with Ari assistance for suggestions)
3. **Review Interface**: Reviewers use contextual commenting to provide feedback
4. **Author Response**: Authors respond to feedback and make revisions
5. **Iteration**: Process repeats until satisfactory resolution

### Discovery Workflow
1. **Browse/Search**: Users discover preprints through search, categories, or following
2. **Read**: Clean, web-native reading experience with annotation capabilities
3. **Engage**: Comment, follow authors, add to reading lists
4. **Share**: Distribute interesting papers through various channels

## Implementation Priorities

### Phase 1: Core Infrastructure
1. Comment system with AST anchoring
2. Basic version tracking and diff visualization
3. Simple search and filtering

### Phase 2: User Experience
1. Reviewer identity management
2. Notification system
3. Author/institution following

### Phase 3: Discovery Features
1. Advanced tagging and categorization
2. AI-assisted suggestions
3. Enhanced sharing capabilities

## Success Metrics

- **Engagement**: Number of comments and reviews per preprint
- **Retention**: Users returning to review additional papers
- **Network Effects**: Growth in author following and cross-references
- **Quality**: Depth and usefulness of review discussions (qualitative assessment)

## Future Considerations (Beyond MVP)

- Reading lists and collections
- Citation network visualization
- Collaborative review (multi-reviewer discussions)
- Integration with journal submission workflows
- Advanced AI assistance from Ari
- Review templates and checklists
- Author response tracking and resolution workflows

---

*Document Version: 1.0*  
*Last Updated: 2025-06-29*  
*Status: MVP Specification - Ready for Implementation*