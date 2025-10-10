## Yjs + React stack for a collaborative graphic editing MVP

Date: 2025-10-10

### TL;DR (recommended, battle‑tested stack)
- **Frontend (ReactJS)**: React + SVG or `react-konva` for rectangles. State via Yjs shared types: `Y.Array<Y.Map>` where each `Y.Map` is a rectangle `{ id, x, y, width, height, backgroundColor }`.
- **Realtime providers (both enabled)**:
  - **WebSocket**: `y-websocket` or **Hocuspocus** server (production‑grade Yjs WebSocket backend).
  - **Peer‑to‑peer**: `y-webrtc` with configured STUN/TURN for NAT traversal.
- **Offline‑first**: `y-indexeddb` for local persistence + **Workbox** service worker for static asset caching.
- **Persistence (MVP)**:
  - Easiest: **Hocuspocus + SQLite/Postgres** using `@hocuspocus/extension-sqlite` or `@hocuspocus/extension-database` with `onStoreDocument`/`onChange` hooks.
  - Alternative: **Y‑Sweet** (drop‑in Yjs store) persisting to local path or S3‑compatible storage.
- **Delta log + snapshots**: Store every Yjs `update` (Uint8Array) append‑only; periodically merge older updates into a `snapshot` (binary state) using Yjs `mergeUpdates` and `encodeStateVector` APIs.
- **Multiple documents**: One Y.Doc per document; each joins room `{documentId}` on both providers; optionally keep a metadata collection for a document list.

Why this stack
- **Yjs** is a proven CRDT with rich update APIs and a large ecosystem.
- **Hocuspocus** is widely deployed with Tiptap; ships persistence extensions and HA (Redis) options.
- **y‑websocket / y‑webrtc** are the canonical providers; Yjs supports using both simultaneously for resiliency.
- **y‑indexeddb** enables true offline edits; Workbox improves offline UX for the shell.
- The **delta log + snapshot** approach matches Yjs primitives and enables indefinite retention, time‑travel, and compaction.

---

### Architecture (MVP)
- React app renders rectangles on Canvas/SVG; binds to Yjs types via lightweight hooks.
- Each document has a `Y.Doc` with:
  - `Y.Array` named `rects` containing `Y.Map` items with rectangle properties
  - optional `Y.Map` `meta` for document metadata
- Providers connected concurrently:
  - `y-webrtc` for P2P swarms
  - `y-websocket` (or Hocuspocus) for server‑mediated sync and long‑haul bridging
  - `y-indexeddb` for local cache and instant load
- Server persists:
  - Append‑only `updates` table (every raw Yjs update)
  - Periodic `snapshots` table (merged Y state as binary)
- Background job compacts old updates into snapshots; retains audit history as needed.

Networking & resiliency
- Use both providers: if WebRTC fails (NAT/TURN), WebSocket carries sync; if server blips, peers still sync over WebRTC; offline changes accumulate and sync on reconnect.
- Enable exponential backoff (`maxBackoffTime`) for WebSocket reconnections.
- Configure STUN/TURN (e.g., coTURN) for `y-webrtc` in production.

Offline‑first
- `y-indexeddb` loads the local doc instantly and syncs diffs later, minimizing bandwidth.
- Add a Workbox service worker for precaching and `StaleWhileRevalidate` for images and assets to keep the shell usable offline.

---

### Yjs data model for rectangles
```ts
// Types shown for shape only; implement with Yjs runtime types
type Rect = {
  id: string
  x: number
  y: number
  width: number
  height: number
  backgroundColor: string
}
// Yjs structure
// ydoc.getArray('rects') -> Y.Array<Y.Map>
// each rect: new Y.Map([["id", id], ["x", x], ...])
```

Concurrent ops mapping
- **move**: set `x`,`y` on the `Y.Map`
- **resize**: set `width`,`height`
- **backgroundColor**: set `backgroundColor`
- All ops are commutative via CRDT semantics; UI listens to `observeDeep`.

Presence (optional)
- Use Yjs Awareness (built into providers) to show cursors/selection per user.

---

### Providers wiring (both WebSocket and WebRTC + offline)
```ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'

const ydoc = new Y.Doc()
const docId = 'my-document-id'

const idb = new IndexeddbPersistence(docId, ydoc)
await idb.whenSynced

const webrtc = new WebrtcProvider(docId, ydoc, {
  // configure STUN/TURN here for production
})

const ws = new WebsocketProvider('wss://your-ws-host', docId, ydoc, {
  maxBackoffTime: 2500,
})
```

---

### Persistence: delta log + snapshots (SQL example)

Tables (PostgreSQL)
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE y_updates (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id TEXT,
  update BYTEA NOT NULL,
  meta JSONB
);

CREATE TABLE y_snapshots (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  state BYTEA NOT NULL,
  version BIGINT NOT NULL
);
```

Write path
- On every change, capture the Yjs binary `update` and append to `y_updates`.
- Debounce full‑state writes (e.g., Hocuspocus `onStoreDocument`) to update `y_snapshots.state`.

Read path (materialize current doc)
1. Load latest snapshot `state` (if any) into a fresh `Y.Doc`.
2. Stream `y_updates.update` after the snapshot’s version and `applyUpdate` in order.

Compaction job
```ts
// Pseudo-code
const base = latestSnapshotState // Uint8Array
const updates = getUpdatesAfterVersion()
const merged = Y.mergeUpdates([base, ...updates])
// Write new snapshot (version = last update id) and optionally archive/delete old updates
```

Notes
- You can compute incremental diffs with `encodeStateVector` + `diffUpdate` for bandwidth‑efficient syncs.
- Store updates indefinitely to satisfy audit/versioning; periodically coalesce old ranges into checkpoint snapshots to keep hot replay small.

NoSQL variant (MongoDB)
- Collections: `documents`, `y_updates` (capped or TTL‑less), `y_snapshots`.
- Index `(document_id, _id)` for ordered update streaming.

---

### Server options

Option A — Hocuspocus (recommended for DB persistence)
- Mature WebSocket backend for Yjs; used broadly with Tiptap.
- Extensions:
  - `@hocuspocus/extension-sqlite` quick persistence for MVP
  - `@hocuspocus/extension-database` to wire Postgres/MySQL/Mongo via `fetch`/`store`
  - Redis extension for multi‑instance coordination
- Hooks: `onChange` (access raw update), `onStoreDocument` (persist doc state), `onLoadDocument` (hydrate).

Option B — Y‑Sweet (fastest path to hosted‑style store)
- Yjs‑native store persisting to directory or S3; simple local run via `npx y-sweet serve`.
- Solid DX with `@y-sweet/react` hooks; good for small teams and MVPs.

Option C — Minimal `@y/websocket-server`
- One‑liner WebSocket server; pair with your own persistence layer (more work).

---

### Multiple documents
- One room per documentId on both providers; mount/unmount providers as users switch docs.
- Keep a separate metadata list (SQL table or collection) for document titles/owners.

---

### Security & operations (MVP scope)
- Gate WebSocket connections with an auth token (e.g., Hocuspocus `onAuthenticate`).
- Limit document size and update rate; apply server‑side size guards.
- Set TURN credentials (don’t rely on public/free STUN in production).

---

### Implementation checklist (MVP)
1) React app with rectangle layer (SVG or Konva) bound to Yjs types.
2) Initialize `y-indexeddb`, then connect `y-webrtc` and `y-websocket`.
3) Hocuspocus server with SQLite (or Postgres) + `onChange` appending to `y_updates` and `onStoreDocument` maintaining `y_snapshots`.
4) Compaction cron: merge old updates into snapshot; keep updates indefinitely or archive.
5) Workbox service worker for app shell caching.

---

### References (official docs and Google demos)
- Yjs core: conflict‑free sync, update APIs, diff/snapshot functions — [yjs README](https://github.com/yjs/yjs#readme)
  - `applyUpdate`, `encodeStateAsUpdate`, `encodeStateVector`, `diffUpdate`, `mergeUpdates` (see README)
- Providers together (WebRTC + WebSocket + IndexedDB) — [yjs README example](https://github.com/yjs/yjs#readme)
- `y-websocket` client/server and reconnection flags — [y-websocket README](https://github.com/yjs/y-websocket#readme)
- `y-indexeddb` offline cache — [y-indexeddb README](https://github.com/yjs/y-indexeddb#readme)
- Hocuspocus persistence & hooks — [Hocuspocus docs](https://github.com/ueberdosis/hocuspocus)
  - Database/SQLite extensions, `onStoreDocument`, `onLoadDocument`, `onChange`
- Y‑Sweet quick start & React hooks — [y-sweet](https://github.com/jamsocket/y-sweet)
- Google Workbox (offline shell) — [workbox](https://github.com/GoogleChrome/workbox)
- Google WebRTC samples (P2P) — [webrtc/samples](https://github.com/webrtc/samples)

Context7 documentation excerpts used
- Yjs update/snapshot APIs and combined providers
- Hocuspocus database/SQLite extensions and hooks
- Workbox precaching/strategies examples
- WebRTC sample setup commands
- Y‑Sweet server and React SDK snippets

---

### Appendix: tiny snippets

Service worker (Workbox) example
```js
import {registerRoute} from 'workbox-routing'
import {StaleWhileRevalidate} from 'workbox-strategies'
import {precacheAndRoute} from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)
registerRoute(({request}) => request.destination === 'image', new StaleWhileRevalidate())
```

Start minimal y-websocket server
```bash
HOST=localhost PORT=1234 npx y-websocket
```

Start Hocuspocus with SQLite (JS)
```js
import { Server } from '@hocuspocus/server'
import { SQLite } from '@hocuspocus/extension-sqlite'

new Server({ port: 1234, extensions: [new SQLite({ database: 'db.sqlite' })] }).listen()
```


