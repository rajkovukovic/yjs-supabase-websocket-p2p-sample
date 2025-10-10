# Yjs + React Stack Analysis: MVP-Optimized Stack

**Fast-track MVP implementation with minimal complexity**

---

## Executive Summary

This report provides a **streamlined implementation** for a collaborative graphic editing tool using:
- **Valtio** (reactive frontend state)
- **IndexedDB** (client persistence via y-indexeddb)
- **Hocuspocus** (WebSocket server)
- **y-webrtc** (peer-to-peer)
- **Supabase** (backend database - simplified, no auth)
- **Native SVG** (rendering)

**Key simplifications for MVP speed:**
- ✅ No authentication/authorization (public read/write)
- ✅ Simplified database schema (2 tables only)
- ✅ Valtio for cleaner React state management
- ✅ Docker-compose for easy server deployment
- ✅ Organized monorepo structure (`web/` + `server/`)

**Estimated MVP delivery: 1-2 weeks for 1 developer**

---

## Technology Deep Dive

### 1. Hocuspocus (Yjs WebSocket Server)

**What is Hocuspocus?**
- Official Yjs collaboration server from the Tiptap team
- Enterprise-grade WebSocket server with built-in features
- Replaces `y-websocket-server` with richer functionality

**Key Features**:
```typescript
✓ Built-in authentication
✓ Database persistence hooks
✓ Rate limiting
✓ Document lifecycle hooks (onCreate, onChange, onDestroy)
✓ Extension system
✓ Webhook support
✓ Automatic garbage collection
✓ TypeScript-first
```

**Why Hocuspocus over y-websocket?**
| Feature | y-websocket | Hocuspocus |
|---------|-------------|------------|
| Auth | Manual | Built-in |
| DB hooks | Manual | Extension system |
| TypeScript | Partial | Full |
| Monitoring | None | Built-in metrics |
| Rate limiting | Manual | Built-in |
| Production-ready | Basic | Enterprise |

**Installation**:
```bash
npm install @hocuspocus/server @hocuspocus/extension-database
```

**Basic Server Setup**:
```typescript
// server.ts
import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'

const server = Server.configure({
  port: 1234,
  
  extensions: [
    new Database({
      // Fetch document from Supabase
      fetch: async ({ documentName }) => {
        const { data } = await supabase
          .from('documents')
          .select('yjs_state')
          .eq('name', documentName)
          .single()
        
        return data?.yjs_state || null
      },
      
      // Store document updates to Supabase
      store: async ({ documentName, state }) => {
        await supabase
          .from('documents')
          .upsert({
            name: documentName,
            yjs_state: state,
            updated_at: new Date().toISOString()
          })
      }
    })
  ],
  
  // No authentication for MVP - everyone can access
  async onAuthenticate({ documentName }) {
    return {
      user: {
        id: 'anonymous',
        name: 'Guest User'
      }
    }
  },
  
  // Document lifecycle
  async onLoadDocument({ documentName }) {
    console.log(`Document loaded: ${documentName}`)
  },
  
  async onChange({ documentName, document, context }) {
    // Store incremental updates
    const update = context.update
    
    await supabase
      .from('document_updates')
      .insert({
        document_name: documentName,
        update: update,
        client_id: context.clientId,
        created_at: new Date().toISOString()
      })
  }
})

server.listen()
```

---

### 2. Supabase Integration (Simplified for MVP)

**Database Schema** (Minimal - No Auth/RLS):

```sql
-- Main documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  yjs_state BYTEA,                    -- Binary Yjs state
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incremental updates (for delta storage)
CREATE TABLE document_updates (
  id BIGSERIAL PRIMARY KEY,
  document_name TEXT REFERENCES documents(name) ON DELETE CASCADE,
  update BYTEA NOT NULL,              -- Individual Y.Update binary
  client_id TEXT,
  clock BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_doc_name ON documents(name);
CREATE INDEX idx_updates_doc ON document_updates(document_name);
CREATE INDEX idx_updates_created ON document_updates(created_at);
```

**Why no RLS/Auth for MVP?**
- ✅ **Faster development** - Focus on core collaboration features
- ✅ **Easier testing** - No login flows to manage
- ✅ **Simpler debugging** - Fewer moving parts
- ⚠️ **Add auth post-MVP** - Supabase Auth can be added later without data migration

**Supabase Client Setup** (No Auth):
```typescript
// web/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// No authentication needed for MVP
```

**Database Extension for Hocuspocus**:
```typescript
// server/extensions/supabase-db.ts
import { Database } from '@hocuspocus/extension-database'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Service role key for server
)

export const SupabaseDatabase = new Database({
  fetch: async ({ documentName }) => {
    const { data, error } = await supabase
      .from('documents')
      .select('yjs_state')
      .eq('name', documentName)
      .single()
    
    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('Fetch error:', error)
    }
    
    return data?.yjs_state || null
  },
  
  store: async ({ documentName, state }) => {
    const { error } = await supabase
      .from('documents')
      .upsert({
        name: documentName,
        yjs_state: state,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'name'
      })
    
    if (error) {
      console.error('Store error:', error)
      throw error
    }
  }
})
```

**Delta Storage Strategy**:
```typescript
// Store incremental updates for audit/replay
async function storeUpdate(documentName: string, update: Uint8Array, clientId: string) {
  // Decode clock from update
  const decoder = new lib0.decoding.Decoder(update)
  const clock = lib0.decoding.readVarUint(decoder)
  
  await supabase
    .from('document_updates')
    .insert({
      document_name: documentName,
      update: Buffer.from(update),
      client_id: clientId,
      clock: clock
    })
}

// Periodic snapshot creation (run as cron job)
async function createSnapshot(documentName: string) {
  // Get all updates since last snapshot
  const { data: lastSnapshot } = await supabase
    .from('document_snapshots')
    .select('created_at')
    .eq('document_name', documentName)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  const { data: updates } = await supabase
    .from('document_updates')
    .select('update')
    .eq('document_name', documentName)
    .gt('created_at', lastSnapshot?.created_at || '1970-01-01')
    .order('created_at', { ascending: true })
  
  if (!updates || updates.length < 100) return // Wait for more updates
  
  // Merge updates into snapshot
  const ydoc = new Y.Doc()
  updates.forEach(({ update }) => {
    Y.applyUpdate(ydoc, new Uint8Array(update))
  })
  
  const snapshot = Y.encodeStateAsUpdate(ydoc)
  
  await supabase
    .from('document_snapshots')
    .insert({
      document_name: documentName,
      snapshot: Buffer.from(snapshot),
      update_count: updates.length
    })
  
  // Archive old updates (optional)
  await supabase
    .from('document_updates')
    .delete()
    .eq('document_name', documentName)
    .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30 days
}
```

---

### 3. Peer-to-Peer with y-webrtc

**Why P2P Alongside Hocuspocus?**
```
Hybrid Architecture:
┌─────────────┐
│   Client A  │────┐
└─────────────┘    │
       │           │
       │ WebRTC ───┼──► Direct P2P (low latency)
       │           │
       │           │
       ▼           │
  Hocuspocus ◄─────┘
   (Server)         
       ▲           
       │           
       │           
┌─────────────┐    
│   Client B  │────┘
└─────────────┘
```

**Benefits**:
- **Low latency**: Direct connection between peers (20-50ms vs 100-200ms through server)
- **Reduced server load**: Updates sent P2P don't hit server
- **Offline collaboration**: Two clients on same network can collaborate without internet
- **Fallback**: Hocuspocus ensures reliability when P2P fails (NAT issues)

**Implementation**:
```typescript
// web/lib/yjs-providers.ts
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'

export function setupProviders(documentName: string, ydoc: Y.Doc) {
  // 1. IndexedDB (local persistence)
  const indexeddbProvider = new IndexeddbPersistence(documentName, ydoc)
  
  indexeddbProvider.on('synced', () => {
    console.log('IndexedDB loaded')
  })
  
  // 2. Hocuspocus (WebSocket, authoritative server)
  const hocuspocusProvider = new HocuspocusProvider({
    url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || 'ws://localhost:1234',
    name: documentName,
    document: ydoc,
    
    // No token needed for MVP
    
    onSynced: ({ state }) => {
      console.log('Hocuspocus synced:', state)
    },
    
    onStatus: ({ status }) => {
      console.log('Connection status:', status)
    }
  })
  
  // 3. WebRTC (peer-to-peer) - Use local signaling server
  const webrtcProvider = new WebrtcProvider(documentName, ydoc, {
    // Use local signaling server (from docker-compose)
    signaling: [
      process.env.NEXT_PUBLIC_SIGNALING_URL || 'ws://localhost:4444'
    ],
    
    // Awareness for cursor sharing
    awareness: hocuspocusProvider.awareness,
    
    // Max connections
    maxConns: 20,
    
    // Filter connections (optional)
    filterBcConns: true,
    
    // STUN servers for WebRTC
    peerOpts: {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    }
  })
  
  webrtcProvider.on('synced', (synced) => {
    console.log('WebRTC synced:', synced)
  })
  
  webrtcProvider.on('peers', ({ added, removed, webrtcPeers }) => {
    console.log('P2P peers:', {
      added,
      removed,
      total: webrtcPeers.length
    })
  })
  
  return {
    indexeddbProvider,
    hocuspocusProvider,
    webrtcProvider,
    
    destroy: () => {
      indexeddbProvider.destroy()
      hocuspocusProvider.destroy()
      webrtcProvider.destroy()
    }
  }
}
```

**Connection Priority** (automatic in Yjs):
```
1. IndexedDB loads local state immediately
2. WebRTC connects to peers (if available)
3. Hocuspocus connects to server
4. All providers merge their states
5. Conflicts resolved via Yjs CRDT
```

**Custom Signaling Server** (Included in server/):
```typescript
// server/signaling-server.ts
import { Server } from 'socket.io'
import http from 'http'

const PORT = process.env.SIGNALING_PORT || 4444

const server = http.createServer()
const io = new Server(server, {
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  }
})

const rooms = new Map()

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)
  
  socket.on('join', (room) => {
    socket.join(room)
    
    if (!rooms.has(room)) {
      rooms.set(room, new Set())
    }
    rooms.get(room).add(socket.id)
    
    // Send list of peers in room
    socket.emit('peers', Array.from(rooms.get(room)))
    
    // Notify others
    socket.to(room).emit('peer-joined', socket.id)
    
    console.log(`Client ${socket.id} joined room ${room}. Total: ${rooms.get(room).size}`)
  })
  
  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', {
      from: socket.id,
      signal
    })
  })
  
  socket.on('disconnect', () => {
    rooms.forEach((peers, room) => {
      if (peers.has(socket.id)) {
        peers.delete(socket.id)
        io.to(room).emit('peer-left', socket.id)
        console.log(`Client ${socket.id} left room ${room}. Remaining: ${peers.size}`)
      }
    })
  })
})

server.listen(PORT, () => {
  console.log(`✅ Signaling server running on port ${PORT}`)
})
```

---

### 4. Native SVG Rendering

**Why SVG over Konva/Canvas?**

| Feature | SVG | Canvas (Konva) |
|---------|-----|----------------|
| DOM integration | ✓ Native | ✗ Separate tree |
| Accessibility | ✓ Screen readers | ✗ Requires ARIA |
| Styling | ✓ CSS | ✗ Programmatic |
| Events | ✓ Per-element | ✗ Manual hit detection |
| Performance (small) | ✓ Fast | ~ Similar |
| Performance (1000+) | ✗ Slow | ✓ Fast |
| Animations | ✓ CSS/SMIL | ✗ Manual |
| Crisp at all zooms | ✓ Vector | ✗ Pixelated |

**Best for MVP**: SVG (easier development, better DX)

**React + SVG Architecture**:
```typescript
// types.ts
interface Rectangle {
  id: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke?: string
  strokeWidth?: number
}

interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}
```

**SVG Canvas Component**:
```tsx
// components/Canvas.tsx
import { useCallback, useRef, useState } from 'react'
import { Rectangle } from './Rectangle'
import { useYArray } from '@/hooks/useYjs'

export function Canvas() {
  const [rectangles] = useYArray<Rectangle>('rectangles')
  const [viewBox, setViewBox] = useState<ViewBox>({
    x: 0, y: 0, width: 1000, height: 1000
  })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  
  const svgRef = useRef<SVGSVGElement>(null)
  
  // Pan handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.metaKey)) { // Middle or Cmd+Click
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    
    const dx = (e.clientX - panStart.x) * (viewBox.width / window.innerWidth)
    const dy = (e.clientY - panStart.y) * (viewBox.height / window.innerHeight)
    
    setViewBox(prev => ({
      ...prev,
      x: prev.x - dx,
      y: prev.y - dy
    }))
    
    setPanStart({ x: e.clientX, y: e.clientY })
  }, [isPanning, panStart, viewBox])
  
  const handleMouseUp = () => setIsPanning(false)
  
  // Zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    
    const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9
    const newWidth = viewBox.width * scaleFactor
    const newHeight = viewBox.height * scaleFactor
    
    // Zoom towards mouse position
    const rect = svgRef.current!.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const mouseXRatio = mouseX / rect.width
    const mouseYRatio = mouseY / rect.height
    
    setViewBox({
      x: viewBox.x - (newWidth - viewBox.width) * mouseXRatio,
      y: viewBox.y - (newHeight - viewBox.height) * mouseYRatio,
      width: newWidth,
      height: newHeight
    })
  }
  
  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      style={{ width: '100%', height: '100vh', cursor: isPanning ? 'grabbing' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e0e0e0" strokeWidth="1"/>
        </pattern>
      </defs>
      
      <rect width="100%" height="100%" fill="url(#grid)" />
      
      {rectangles.map(rect => (
        <Rectangle key={rect.id} {...rect} />
      ))}
    </svg>
  )
}
```

**Interactive Rectangle Component**:
```tsx
// components/Rectangle.tsx
import { useCallback, useState } from 'react'
import { useYDoc } from '@/hooks/useYjs'

interface RectangleProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke?: string
  strokeWidth?: number
}

export function Rectangle(props: RectangleProps) {
  const ydoc = useYDoc()
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  // Update Yjs document
  const updateRect = useCallback((updates: Partial<RectangleProps>) => {
    ydoc.transact(() => {
      const rectangles = ydoc.getArray('rectangles')
      const index = rectangles.toArray().findIndex(r => r.id === props.id)
      
      if (index !== -1) {
        const current = rectangles.get(index)
        rectangles.delete(index, 1)
        rectangles.insert(index, [{ ...current, ...updates }])
      }
    })
  }, [ydoc, props.id])
  
  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - props.x,
      y: e.clientY - props.y
    })
  }
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    const svg = e.currentTarget as SVGSVGElement
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    
    updateRect({
      x: svgP.x - dragStart.x,
      y: svgP.y - dragStart.y
    })
  }, [isDragging, dragStart, updateRect])
  
  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }
  
  // Resize handlers (SE corner)
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }
  
  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    
    updateRect({
      width: Math.max(20, props.width + dx),
      height: Math.max(20, props.height + dy)
    })
    
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [isResizing, dragStart, props.width, props.height, updateRect])
  
  // Global event listeners
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousemove', handleResizeMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, handleMouseMove, handleResizeMouseMove])
  
  return (
    <g>
      <rect
        x={props.x}
        y={props.y}
        width={props.width}
        height={props.height}
        fill={props.fill}
        stroke={props.stroke || '#000'}
        strokeWidth={props.strokeWidth || 2}
        style={{ cursor: 'move' }}
        onMouseDown={handleMouseDown}
      />
      
      {/* Resize handle (SE corner) */}
      <circle
        cx={props.x + props.width}
        cy={props.y + props.height}
        r={6}
        fill="white"
        stroke="#000"
        strokeWidth={2}
        style={{ cursor: 'se-resize' }}
        onMouseDown={handleResizeMouseDown}
      />
    </g>
  )
}
```

**Performance Optimization for SVG**:
```tsx
// Virtual rendering for large documents
function useVisibleRectangles(
  rectangles: Rectangle[],
  viewBox: ViewBox
) {
  return useMemo(() => {
    return rectangles.filter(rect => {
      // Simple AABB intersection test
      return !(
        rect.x + rect.width < viewBox.x ||
        rect.x > viewBox.x + viewBox.width ||
        rect.y + rect.height < viewBox.y ||
        rect.y > viewBox.y + viewBox.height
      )
    })
  }, [rectangles, viewBox])
}

// In Canvas component:
const visibleRects = useVisibleRectangles(rectangles, viewBox)

return (
  <svg>
    {visibleRects.map(rect => <Rectangle key={rect.id} {...rect} />)}
  </svg>
)
```

**CSS-based animations**:
```css
/* Smooth transitions for non-dragging updates */
rect {
  transition: x 0.1s, y 0.1s, width 0.1s, height 0.1s;
}

rect:hover {
  stroke-width: 3;
  filter: drop-shadow(0 0 5px rgba(0,0,0,0.3));
}
```

---

### 5. IndexedDB Deep Dive

**y-indexeddb Provider**:
```typescript
import { IndexeddbPersistence } from 'y-indexeddb'

const persistence = new IndexeddbPersistence('document-name', ydoc)

persistence.on('synced', () => {
  console.log('Content from IndexedDB loaded')
})

// Manual operations
persistence.clearData() // Clear all local data
persistence.destroy()   // Clean up
```

**Storage Architecture**:
```
IndexedDB Database: "y-indexeddb"
├── Object Store: "updates" (auto-increment key)
│   ├── { id: 1, value: Uint8Array(...) }  // Update 1
│   ├── { id: 2, value: Uint8Array(...) }  // Update 2
│   └── ...
└── Object Store: "custom" (key-value)
    └── { key: "document-name", value: {...} }
```

**Direct IndexedDB Access** (for debugging):
```typescript
// Check storage size
async function getStorageSize(dbName: string) {
  const db = await indexedDB.open(dbName)
  
  return new Promise((resolve) => {
    const tx = db.transaction(['updates'], 'readonly')
    const store = tx.objectStore('updates')
    const getAllKeys = store.getAllKeys()
    
    getAllKeys.onsuccess = () => {
      const count = getAllKeys.result.length
      console.log(`Updates stored: ${count}`)
      resolve(count)
    }
  })
}

// Clear old data
async function clearOldUpdates(dbName: string, keepLast = 1000) {
  const db = await indexedDB.open(dbName)
  const tx = db.transaction(['updates'], 'readwrite')
  const store = tx.objectStore('updates')
  
  const count = await store.count()
  if (count > keepLast) {
    const cursor = await store.openCursor()
    let deleted = 0
    
    while (cursor && deleted < count - keepLast) {
      cursor.delete()
      deleted++
      await cursor.continue()
    }
  }
}
```

**Quota Management**:
```typescript
// Check available storage
async function checkQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate()
    const usage = estimate.usage || 0
    const quota = estimate.quota || 0
    
    console.log(`Using ${(usage / 1024 / 1024).toFixed(2)} MB of ${(quota / 1024 / 1024).toFixed(2)} MB`)
    
    return {
      usage,
      quota,
      percentUsed: (usage / quota) * 100
    }
  }
}

// Request persistent storage (prevents eviction)
async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist()
    console.log(`Persistent storage: ${isPersisted ? 'granted' : 'denied'}`)
    return isPersisted
  }
}
```

---

## Complete React Integration with Valtio

### Why Valtio?

**Valtio** simplifies React state management with proxies:
- ✅ **Zero boilerplate** - No actions, reducers, or dispatch
- ✅ **Automatic reactivity** - Components re-render on state changes
- ✅ **Better DX** - Mutate state directly (like Yjs!)
- ✅ **TypeScript-first** - Excellent type inference
- ✅ **Tiny bundle** - ~2KB gzipped

**Integration with Yjs:**
```
Yjs (CRDT) → Valtio Proxy → React Component
    ↓
  Y.Array observes changes
    ↓
  Updates Valtio state
    ↓
  React re-renders
```

### Valtio Store

```typescript
// web/store/document.ts
import { proxy, subscribe } from 'valtio'
import * as Y from 'yjs'

export interface Rectangle {
  id: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke?: string
  strokeWidth?: number
}

export interface DocumentState {
  rectangles: Rectangle[]
  synced: boolean
  status: 'disconnected' | 'connecting' | 'connected'
  peers: number
}

export const documentState = proxy<DocumentState>({
  rectangles: [],
  synced: false,
  status: 'disconnected',
  peers: 0
})

// Sync Yjs to Valtio
export function syncYjsToValtio(ydoc: Y.Doc) {
  const yRectangles = ydoc.getArray<Rectangle>('rectangles')
  
  const observer = () => {
    documentState.rectangles = yRectangles.toArray()
  }
  
  yRectangles.observe(observer)
  observer() // Initial sync
  
  return () => yRectangles.unobserve(observer)
}

// Valtio actions (update Yjs document)
export const actions = {
  addRectangle(ydoc: Y.Doc, rect: Rectangle) {
    const yRectangles = ydoc.getArray('rectangles')
    yRectangles.push([rect])
  },
  
  updateRectangle(ydoc: Y.Doc, id: string, updates: Partial<Rectangle>) {
    ydoc.transact(() => {
      const yRectangles = ydoc.getArray('rectangles')
      const index = yRectangles.toArray().findIndex((r: Rectangle) => r.id === id)
      
      if (index !== -1) {
        const current = yRectangles.get(index) as Rectangle
        yRectangles.delete(index, 1)
        yRectangles.insert(index, [{ ...current, ...updates }])
      }
    })
  },
  
  deleteRectangle(ydoc: Y.Doc, id: string) {
    const yRectangles = ydoc.getArray('rectangles')
    const index = yRectangles.toArray().findIndex((r: Rectangle) => r.id === id)
    
    if (index !== -1) {
      yRectangles.delete(index, 1)
    }
  }
}
```

### Custom Hooks

```typescript
// web/hooks/useYjs.ts
import { useEffect, useState, useContext } from 'react'
import * as Y from 'yjs'
import { setupProviders } from '../lib/yjs-providers'
import { syncYjsToValtio, documentState } from '../store/document'

const YjsContext = React.createContext<Y.Doc | null>(null)

export function YjsProvider({ 
  documentName, 
  children 
}: { 
  documentName: string
  children: React.ReactNode 
}) {
  const [ydoc] = useState(() => new Y.Doc())
  const [synced, setSynced] = useState(false)
  
  useEffect(() => {
    const providers = setupProviders(documentName, ydoc)
    
    // Sync Yjs to Valtio
    const unsyncYjs = syncYjsToValtio(ydoc)
    
    // Track sync status
    providers.hocuspocusProvider.on('synced', () => {
      documentState.synced = true
      setSynced(true)
    })
    
    providers.hocuspocusProvider.on('status', ({ status }) => {
      documentState.status = status
    })
    
    // Track peers
    providers.webrtcProvider.on('peers', ({ webrtcPeers }) => {
      documentState.peers = webrtcPeers.length
    })
    
    return () => {
      unsyncYjs()
      providers.destroy()
    }
  }, [documentName, ydoc])
  
  if (!synced) {
    return <div>Loading document...</div>
  }
  
  return (
    <YjsContext.Provider value={ydoc}>
      {children}
    </YjsContext.Provider>
  )
}

export function useYDoc() {
  const ydoc = useContext(YjsContext)
  if (!ydoc) throw new Error('useYDoc must be used within YjsProvider')
  return ydoc
}

// Hook for awareness (cursors, presence)
export function useAwareness() {
  const ydoc = useYDoc()
  const [awareness, setAwareness] = useState<any>(null)
  
  useEffect(() => {
    // Get awareness from hocuspocus provider
    const provider = (ydoc as any)._hocuspocusProvider
    if (provider) {
      setAwareness(provider.awareness)
    }
  }, [ydoc])
  
  return awareness
}
```

### Valtio-Powered React Components

```tsx
// web/components/Canvas.tsx
import { useSnapshot } from 'valtio'
import { documentState, actions } from '../store/document'
import { useYDoc } from '../hooks/useYjs'
import { Rectangle } from './Rectangle'

export function Canvas() {
  const snap = useSnapshot(documentState) // Auto-subscribes to changes
  const ydoc = useYDoc()
  
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    actions.addRectangle(ydoc, {
      id: crypto.randomUUID(),
      x: x - 50,
      y: y - 50,
      width: 100,
      height: 100,
      fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
      stroke: '#000',
      strokeWidth: 2
    })
  }
  
  return (
    <svg
      width="100%"
      height="100vh"
      onClick={handleCanvasClick}
      style={{ background: '#f5f5f5' }}
    >
      {snap.rectangles.map(rect => (
        <Rectangle key={rect.id} {...rect} />
      ))}
    </svg>
  )
}
```

```tsx
// web/components/Rectangle.tsx
import { useState, useCallback } from 'react'
import { actions } from '../store/document'
import { useYDoc } from '../hooks/useYjs'

export function Rectangle(props: Rectangle) {
  const ydoc = useYDoc()
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging(true)
    setDragStart({ x: e.clientX - props.x, y: e.clientY - props.y })
  }
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    actions.updateRectangle(ydoc, props.id, {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }, [isDragging, dragStart, ydoc, props.id])
  
  const handleMouseUp = () => setIsDragging(false)
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove])
  
  return (
    <rect
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      fill={props.fill}
      stroke={props.stroke}
      strokeWidth={props.strokeWidth}
      style={{ cursor: isDragging ? 'grabbing' : 'move' }}
      onMouseDown={handleMouseDown}
    />
  )
}
```

```tsx
// web/components/StatusBar.tsx
import { useSnapshot } from 'valtio'
import { documentState } from '../store/document'

export function StatusBar() {
  const snap = useSnapshot(documentState)
  
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-100 border-b">
      <div className={`flex items-center gap-2 ${snap.synced ? 'text-green-600' : 'text-yellow-600'}`}>
        <div className={`w-2 h-2 rounded-full ${snap.synced ? 'bg-green-600' : 'bg-yellow-600'}`} />
        {snap.synced ? 'Synced' : 'Syncing...'}
      </div>
      
      <div className="text-gray-600">
        Status: {snap.status}
      </div>
      
      <div className="text-gray-600">
        Peers: {snap.peers}
      </div>
      
      <div className="text-gray-600">
        Rectangles: {snap.rectangles.length}
      </div>
    </div>
  )
}
```

**App Structure**:
```tsx
// web/app/document/[id]/page.tsx
'use client'

import { YjsProvider } from '@/hooks/useYjs'
import { Canvas } from '@/components/Canvas'
import { StatusBar } from '@/components/StatusBar'
import { Cursors } from '@/components/Cursors'

export default function DocumentPage({ params }: { params: { id: string } }) {
  return (
    <YjsProvider documentName={params.id}>
      <div className="h-screen flex flex-col">
        <StatusBar />
        <div className="flex-1 relative">
          <Canvas />
          <Cursors />
        </div>
      </div>
    </YjsProvider>
  )
}
```

---

## Cursor Sharing with Awareness

```tsx
// components/Cursors.tsx
import { useEffect, useState } from 'react'
import { useAwareness } from '@/hooks/useYjs'

interface CursorState {
  x: number
  y: number
  user: {
    name: string
    color: string
  }
}

export function Cursors() {
  const awareness = useAwareness()
  const [cursors, setCursors] = useState<Map<number, CursorState>>(new Map())
  
  useEffect(() => {
    if (!awareness) return
    
    const updateCursors = () => {
      const states = awareness.getStates()
      const newCursors = new Map()
      
      states.forEach((state, clientId) => {
        if (clientId !== awareness.clientID && state.cursor) {
          newCursors.set(clientId, state)
        }
      })
      
      setCursors(newCursors)
    }
    
    awareness.on('change', updateCursors)
    updateCursors()
    
    return () => awareness.off('change', updateCursors)
  }, [awareness])
  
  // Set local cursor position
  useEffect(() => {
    if (!awareness) return
    
    const handleMouseMove = (e: MouseEvent) => {
      awareness.setLocalStateField('cursor', {
        x: e.clientX,
        y: e.clientY
      })
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [awareness])
  
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from(cursors.entries()).map(([clientId, state]) => (
        <div
          key={clientId}
          className="absolute transition-transform duration-100"
          style={{
            left: state.cursor.x,
            top: state.cursor.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path
              d="M5 3L19 12L12 13L9 19L5 3Z"
              fill={state.user.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          <div
            className="mt-1 px-2 py-1 rounded text-xs text-white"
            style={{ backgroundColor: state.user.color }}
          >
            {state.user.name}
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

## Project Structure

```
project-root/
├── web/                          # Next.js frontend
│   ├── app/
│   │   ├── document/[id]/
│   │   │   └── page.tsx         # Document editor page
│   │   ├── layout.tsx
│   │   └── page.tsx             # Landing page
│   ├── components/
│   │   ├── Canvas.tsx           # SVG canvas component
│   │   ├── Rectangle.tsx        # Rectangle component
│   │   ├── StatusBar.tsx        # Connection status
│   │   └── Cursors.tsx          # User cursors
│   ├── hooks/
│   │   └── useYjs.ts            # Yjs provider hook
│   ├── lib/
│   │   ├── yjs-providers.ts     # Setup providers
│   │   └── supabase.ts          # Supabase client
│   ├── store/
│   │   └── document.ts          # Valtio state
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
│
├── server/                       # Backend services
│   ├── hocuspocus-server.ts     # WebSocket server
│   ├── signaling-server.ts      # P2P signaling
│   ├── extensions/
│   │   └── supabase-db.ts       # Supabase integration
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile.hocuspocus
│   ├── Dockerfile.signaling
│   └── docker-compose.yml       # All servers
│
├── .env.example
└── README.md
```

---

## Production Deployment

### Server Docker Setup

```dockerfile
# server/Dockerfile.hocuspocus
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN npm run build

EXPOSE 1234

CMD ["node", "dist/hocuspocus-server.js"]
```

```dockerfile
# server/Dockerfile.signaling
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY signaling-server.ts ./
RUN npm install -g typescript
RUN tsc signaling-server.ts

EXPOSE 4444

CMD ["node", "signaling-server.js"]
```

```yaml
# server/docker-compose.yml
version: '3.8'

services:
  hocuspocus:
    build:
      context: .
      dockerfile: Dockerfile.hocuspocus
    ports:
      - "1234:1234"
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - PORT=1234
    restart: unless-stopped
    networks:
      - collab-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:1234"]
      interval: 30s
      timeout: 10s
      retries: 3

  signaling:
    build:
      context: .
      dockerfile: Dockerfile.signaling
    ports:
      - "4444:4444"
    environment:
      - NODE_ENV=production
      - SIGNALING_PORT=4444
    restart: unless-stopped
    networks:
      - collab-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:4444"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  collab-network:
    driver: bridge
```

### Start All Servers

```bash
cd server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://your-domain.com
NEXT_PUBLIC_WEBRTC_PASSWORD=your-secret-password

# Server only
SUPABASE_SERVICE_KEY=eyJhbGc... (service_role key)
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/yjs-integration.test.ts
import * as Y from 'yjs'
import { describe, it, expect } from 'vitest'

describe('Yjs Rectangle Operations', () => {
  it('should add rectangle to array', () => {
    const ydoc = new Y.Doc()
    const rectangles = ydoc.getArray('rectangles')
    
    rectangles.push([{
      id: '1',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: '#ff0000'
    }])
    
    expect(rectangles.length).toBe(1)
    expect(rectangles.get(0).fill).toBe('#ff0000')
  })
  
  it('should merge concurrent updates', () => {
    const ydoc1 = new Y.Doc()
    const ydoc2 = new Y.Doc()
    
    const rect1 = ydoc1.getArray('rectangles')
    const rect2 = ydoc2.getArray('rectangles')
    
    // Client 1 adds rectangle
    rect1.push([{ id: '1', x: 0, y: 0, width: 100, height: 100, fill: '#f00' }])
    
    // Client 2 adds different rectangle
    rect2.push([{ id: '2', x: 50, y: 50, width: 100, height: 100, fill: '#0f0' }])
    
    // Sync updates
    const update1 = Y.encodeStateAsUpdate(ydoc1)
    const update2 = Y.encodeStateAsUpdate(ydoc2)
    
    Y.applyUpdate(ydoc2, update1)
    Y.applyUpdate(ydoc1, update2)
    
    // Both should have 2 rectangles
    expect(rect1.length).toBe(2)
    expect(rect2.length).toBe(2)
  })
})
```

### Integration Tests (Playwright)

```typescript
// e2e/collaboration.spec.ts
import { test, expect } from '@playwright/test'

test('two users can collaborate', async ({ page, context }) => {
  // User 1
  await page.goto('/document/test-doc')
  await page.waitForSelector('svg')
  
  // Add rectangle
  await page.click('button:has-text("Add Rectangle")')
  await expect(page.locator('rect')).toHaveCount(1)
  
  // User 2 (new tab)
  const page2 = await context.newPage()
  await page2.goto('/document/test-doc')
  await page2.waitForSelector('svg')
  
  // Should see rectangle from user 1
  await expect(page2.locator('rect')).toHaveCount(1)
  
  // User 2 adds rectangle
  await page2.click('button:has-text("Add Rectangle")')
  
  // User 1 should see both
  await expect(page.locator('rect')).toHaveCount(2)
})

test('offline editing syncs on reconnect', async ({ page, context }) => {
  await page.goto('/document/test-doc')
  
  // Go offline
  await context.setOffline(true)
  
  // Edit while offline
  await page.click('button:has-text("Add Rectangle")')
  await expect(page.locator('rect')).toHaveCount(1)
  
  // Reconnect
  await context.setOffline(false)
  
  // Wait for sync
  await page.waitForSelector('[data-sync-status="synced"]')
  
  // Changes should persist
  await page.reload()
  await expect(page.locator('rect')).toHaveCount(1)
})
```

---

## Package.json

### Web (Frontend)

```json
{
  "name": "collaborative-editor-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "^14.0.0",
    
    "yjs": "^13.6.10",
    "@hocuspocus/provider": "^2.10.0",
    "y-indexeddb": "^9.0.12",
    "y-webrtc": "^10.3.0",
    "y-protocols": "^1.0.6",
    "lib0": "^0.2.94",
    
    "valtio": "^1.12.0",
    
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.10.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

### Server (Backend)

```json
{
  "name": "collaborative-editor-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch hocuspocus-server.ts",
    "build": "tsc",
    "start": "node dist/hocuspocus-server.js",
    "signaling": "tsx watch signaling-server.ts"
  },
  "dependencies": {
    "yjs": "^13.6.10",
    "@hocuspocus/server": "^2.10.0",
    "@hocuspocus/extension-database": "^2.10.0",
    "@supabase/supabase-js": "^2.39.0",
    "socket.io": "^4.6.0",
    "lib0": "^0.2.94"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0"
  }
}
```

---

## Performance Benchmarks

Expected performance for MVP:

| Metric | Target | Notes |
|--------|--------|-------|
| Initial load | < 2s | With 100 rectangles |
| Update latency (local) | < 16ms | 60 FPS |
| Update latency (WebRTC) | < 50ms | P2P connection |
| Update latency (Hocuspocus) | < 200ms | Server roundtrip |
| Offline storage | Unlimited | IndexedDB quota |
| Concurrent users | 20-50 | Per document (MVP) |
| Document size | < 5MB | Before snapshot |

---

## Final Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    React Application                     │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │  Canvas  │  │ Toolbar  │  │ Cursors  │             │
│  │  (SVG)   │  │          │  │          │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │             │              │                    │
│       └─────────────┴──────────────┘                    │
│                     │                                   │
│       ┌─────────────▼──────────────┐                   │
│       │    Yjs Document (Y.Doc)     │                   │
│       │  ┌────────────────────────┐ │                   │
│       │  │ Y.Array('rectangles')  │ │                   │
│       │  └────────────────────────┘ │                   │
│       └─────────────┬──────────────┘                   │
└─────────────────────┼────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
    ┌─────▼─────┐ ┌──▼───┐ ┌────▼────────┐
    │ IndexedDB │ │ P2P  │ │ Hocuspocus  │
    │ (y-idb)   │ │(WebRTC)│ │ (WebSocket) │
    └───────────┘ └──────┘ └─────┬───────┘
                                  │
                           ┌──────▼──────┐
                           │  Supabase   │
                           │ PostgreSQL  │
                           └─────────────┘
```

---

## Quick Start Guide

### 1. Setup Supabase

```bash
# Create project at supabase.com
# Run SQL schema (2 tables only)
# Copy SUPABASE_URL and SUPABASE_SERVICE_KEY
```

### 2. Clone and Setup

```bash
git clone <your-repo>
cd project-root

# Web setup
cd web
npm install
cp .env.example .env.local
# Fill in env vars

# Server setup
cd ../server
npm install
cp .env.example .env
# Fill in env vars
```

### 3. Start Development

```bash
# Terminal 1: Start servers
cd server
docker-compose up

# Terminal 2: Start web
cd web
npm run dev
```

Visit `http://localhost:3000/document/test-doc` and open in multiple tabs!

---

## Conclusion

This stack is **MVP-optimized** with:

✅ **Valtio state** - Zero boilerplate, auto-reactive  
✅ **No auth** - Focus on core features first  
✅ **2 tables** - Minimal database complexity  
✅ **Docker-compose** - All servers in one command  
✅ **Offline-first**: IndexedDB persists all changes locally  
✅ **Low latency**: WebRTC P2P for sub-50ms updates  
✅ **Reliable sync**: Hocuspocus server ensures eventual consistency  
✅ **Simple rendering**: Native SVG eliminates canvas complexity  
✅ **Battle-tested**: All components used in production apps  

**Estimated MVP timeline**: **1-2 weeks for 1 developer**

**Complexity reduction vs. original:**
- ❌ Removed: Authentication, RLS, access control tables
- ❌ Removed: Snapshot tables (can add later)
- ❌ Removed: Custom React hooks (Valtio handles it)
- ✅ Added: Valtio for cleaner state management
- ✅ Added: Docker-compose for easy deployment
- ✅ Added: Organized monorepo structure

**Next steps**:
1. Set up Supabase project (5 min)
2. Run SQL schema (2 min)
3. Start docker-compose servers (1 min)
4. Start web dev server (1 min)
5. Build features! 🚀

**Post-MVP additions:**
1. Add Supabase Auth (1-2 days)
2. Add RLS policies (1 day)
3. Add snapshot merging (2-3 days)
4. Production deployment (1-2 days)