# Yjs + React Stack for Collaborative Graphic Editing Tool

## Overview
This document proposes a battle-tested stack using Yjs and React for building a collaborative graphic editing tool that supports multiple documents with concurrent updates to rectangles (move, resize, backgroundColor). The stack is designed for offline-first operation, resilience to unstable internet, indefinite persistence of deltas, WebSocket and P2P connections, and uses PostgreSQL (SQL) as the backend for MVP phase.

Key libraries and tools were researched using Context7 MCP tools, official Yjs and tldraw documentation, and web searches for demos.

## Proposed Stack

### Frontend
- **ReactJS**: Core framework for building the UI.
- **tldraw**: Battle-tested React-based library for collaborative whiteboarding. It supports shapes like rectangles with move, resize, and color changes out-of-the-box. Integrates seamlessly with Yjs for collaboration.
  - Why? tldraw is used in production apps (e.g., by Figma alternatives) and has direct Yjs support via examples and providers.
- **Yjs**: CRDT library for shared data types (e.g., Y.Map for document state, Y.Array for lists of shapes).
  - Use `react-yjs` or custom hooks for React integration (e.g., `useYArray`, `useYMap` from react-yjs).
- **Providers**:
  - **y-indexeddb**: For offline-first local persistence in the browser.
  - **y-webrtc**: For peer-to-peer connections.
  - **y-websocket** or **y-electric** (from ElectricSQL) for WebSocket-based sync.

### Backend
- **ElectricSQL**: Local-first sync engine with PostgreSQL backend. Provides `y-electric` provider for Yjs.
  - Why? Offline-first, resilient to poor connections (active-active replication), persists all changes/deltas in Postgres. Supports merging deltas into snapshots via Yjs APIs like `Y.mergeUpdates`.
  - Database: PostgreSQL (SQL) – scalable for MVP, can store all updates indefinitely in tables.
- Alternative for NoSQL: Use `y-mongodb-provider` with MongoDB and `y-websocket`.

### Architecture
- **Documents**: Each document is a separate `Y.Doc` identified by a unique ID (e.g., room name).
- **Shapes**: Store rectangles in a `Y.Array` or `Y.Map` within the Y.Doc, with properties like position, size, color.
- **Updates/Deltas**: Yjs natively uses updates (deltas). Persist them in ElectricSQL/Postgres without loss. Periodically merge old deltas using `Y.mergeUpdates` and `Y.createSnapshot` for optimization.
- **Connections**: Combine y-webrtc (P2P) and y-websocket (server) for hybrid resilience.
- **Offline/Resilience**: y-indexeddb caches locally; ElectricSQL handles sync and conflicts automatically.

## Key Requirements Fulfillment
- **Offline-first**: y-indexeddb + ElectricSQL ensures local edits work offline, sync when online.
- **Resilient to poor connections**: CRDT merging + P2P fallback.
- **Persist all deltas**: Store raw Yjs updates in DB; merge later without discarding.
- **MVP Scoped**: ElectricSQL is simple to set up for small user bases; no need for massive scaling yet.
- **Multiple Documents**: Load different Y.Docs per document ID.

## References
### Official Docs
- Yjs: [yjs.dev](https://docs.yjs.dev/) – Core CRDT docs, providers, and APIs.
- tldraw: [tldraw.dev](https://tldraw.dev/) – SDK for infinite canvas with collaboration.
- ElectricSQL: [electric-sql.com](https://electric-sql.com/) – Local-first sync with Yjs integration.
- Hocuspocus (alternative WebSocket server): [tiptap.dev/hocuspocus](https://tiptap.dev/docs/hocuspocus/introduction).

### Demos and Examples
- tldraw with Yjs: [Liveblocks tldraw Yjs example](https://github.com/liveblocks/liveblocks/tree/main/examples/nextjs-tldraw-whiteboard-yjs) – Collaborative whiteboard using tldraw and Yjs.
- ElectricSQL Yjs Demo: [electric-sql.com yjs example](https://github.com/electric-sql/electric/tree/main/examples/yjs) – Multiplayer Codemirror with Yjs and Postgres sync.
- Yjs Demos: [demos.yjs.dev](https://demos.yjs.dev/) – Includes collaborative text editors; extend to graphics via tldraw.
- Google Search Demos: 
  - [tldraw Yjs integration demo](https://github.com/tldraw/tldraw/examples) – Various collaborative drawing examples.
  - [Yjs collaborative drawing app](https://github.com/yjs/yjs/tree/main/demos) – Basic canvas drawing with Yjs.

### Context7 MCP Usage
- Resolved IDs: /yjs/yjs, /tldraw/tldraw, /ueberdosis/hocuspocus, /jamsocket/y-sweet.
- Fetched docs for Yjs on "React integration for collaborative graphic editing".
- Searched for "Yjs React stack for collaborative graphic editing JavaScript", "Yjs demos collaborative drawing", etc.

This stack is battle-tested (tldraw in prod, Yjs in apps like JupyterLab, ElectricSQL in local-first apps) and meets all requirements.
