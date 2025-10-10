# Yjs + React Stack Analysis: IndexedDB + Hocuspocus + P2P + Supabase + SVG

**Comprehensive research report for MVP development with specified technologies**

---

## Executive Summary

This report validates and provides implementation guidance for a collaborative graphic editing tool using:
- **IndexedDB** (client persistence)
- **Hocuspocus** (WebSocket server)
- **y-webrtc** (peer-to-peer)
- **Supabase** (backend database)
- **Native SVG** (rendering)

All components are production-ready and well-suited for an offline-first collaborative application.

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
  
  // Authentication
  async onAuthenticate({ token, documentName }) {
    const { data: { user } } = await supabase.auth.getUser(token)
    
    if (!user) {
      throw new Error('Unauthorized')
    }
    
    // Check document permissions
    const hasAccess = await checkDocumentAccess(user.id, documentName)
    if (!hasAccess) {
      throw new Error('Forbidden')
    }
    
    return {
      user: {
        id: user.id,
        name: user.user_metadata.name
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

### 2. Supabase Integration

**Database Schema**:

```sql
-- Main documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
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

-- Snapshots (for performance)
CREATE TABLE document_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_name TEXT REFERENCES documents(name) ON DELETE CASCADE,
  snapshot BYTEA NOT NULL,
  update_count INTEGER,               -- Number of updates merged
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document access control
CREATE TABLE document_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_name TEXT REFERENCES documents(name) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_name, user_id)
);

-- Indexes
CREATE INDEX idx_doc_name ON documents(name);
CREATE INDEX idx_updates_doc ON document_updates(document_name);
CREATE INDEX idx_updates_created ON document_updates(created_at);
CREATE INDEX idx_access_user ON document_access(user_id);
CREATE INDEX idx_access_doc ON document_access(document_name);
```

**Row Level Security (RLS)**:
```sql
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access ENABLE ROW LEVEL SECURITY;

-- Users can only read documents they have access to
CREATE POLICY "Users can read accessible documents"
  ON documents FOR SELECT
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM document_access
      WHERE document_name = documents.name
      AND user_id = auth.uid()
    )
  );

-- Users can update documents they have editor/owner access to
CREATE POLICY "Users can update their documents"
  ON documents FOR UPDATE
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM document_access
      WHERE document_name = documents.name
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
    )
  );
```

**Supabase Client Setup**:
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Get authenticated user's token for Hocuspocus
export async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}
```

**Database Extension for Hocuspocus**:
```typescript
// extensions/supabase-db.ts
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
// lib/yjs-providers.ts
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
    url: 'ws://localhost:1234',
    name: documentName,
    document: ydoc,
    
    token: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || ''
    },
    
    onAuthenticationFailed: ({ reason }) => {
      console.error('Auth failed:', reason)
    },
    
    onSynced: ({ state }) => {
      console.log('Hocuspocus synced:', state)
    },
    
    onStatus: ({ status }) => {
      console.log('Connection status:', status)
    }
  })
  
  // 3. WebRTC (peer-to-peer)
  const webrtcProvider = new WebrtcProvider(documentName, ydoc, {
    // Use public signaling servers or your own
    signaling: [
      'wss://signaling.yjs.dev',
      'wss://y-webrtc-signaling-eu.herokuapp.com',
      'wss://y-webrtc-signaling-us.herokuapp.com'
    ],
    
    // Password for room encryption (optional)
    password: process.env.NEXT_PUBLIC_WEBRTC_PASSWORD,
    
    // Awareness for cursor sharing
    awareness: hocuspocusProvider.awareness,
    
    // Max connections
    maxConns: 20,
    
    // Filter connections (optional)
    filterBcConns: true,
    
    // Prefer P2P over broadcast channel
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

**Custom Signaling Server** (optional, for production):
```typescript
// signaling-server.ts
import { Server } from 'socket.io'
import http from 'http'

const server = http.createServer()
const io = new Server(server, {
  cors: { origin: '*' }
})

const rooms = new Map()

io.on('connection', (socket) => {
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
      }
    })
  })
})

server.listen(4444)
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

## Complete React Integration

### Custom Hooks

```typescript
// hooks/useYjs.ts
import { useEffect, useState, useCallback, useContext } from 'react'
import * as Y from 'yjs'

const YjsContext = React.createContext<Y.Doc | null>(null)

export function YjsProvider({ 
  documentName, 
  children 
}: { 
  documentName: string
  children: React.ReactNode 
}) {
  const [ydoc] = useState(() => new Y.Doc())
  const [providers, setProviders] = useState<any>(null)
  const [synced, setSynced] = useState(false)
  
  useEffect(() => {
    const p = setupProviders(documentName, ydoc)
    setProviders(p)
    
    // Wait for all providers to sync
    Promise.all([
      new Promise(resolve => p.indexeddbProvider.once('synced', resolve)),
      new Promise(resolve => p.hocuspocusProvider.once('synced', resolve))
    ]).then(() => setSynced(true))
    
    return () => p.destroy()
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

// Hook for Y.Array
export function useYArray<T>(path: string): [T[], (items: T[]) => void] {
  const ydoc = useYDoc()
  const [items, setItems] = useState<T[]>([])
  
  useEffect(() => {
    const yarray = ydoc.getArray<T>(path)
    
    const observer = () => {
      setItems(yarray.toArray())
    }
    
    yarray.observe(observer)
    observer() // Initial load
    
    return () => yarray.unobserve(observer)
  }, [ydoc, path])
  
  const updateItems = useCallback((newItems: T[]) => {
    ydoc.transact(() => {
      const yarray = ydoc.getArray<T>(path)
      yarray.delete(0, yarray.length)
      yarray.insert(0, newItems)
    })
  }, [ydoc, path])
  
  return [items, updateItems]
}

// Hook for Y.Map
export function useYMap<T>(path: string): [Map<string, T>, (key: string, value: T) => void] {
  const ydoc = useYDoc()
  const [map, setMap] = useState<Map<string, T>>(new Map())
  
  useEffect(() => {
    const ymap = ydoc.getMap<T>(path)
    
    const observer = () => {
      setMap(new Map(ymap.entries()))
    }
    
    ymap.observe(observer)
    observer()
    
    return () => ymap.unobserve(observer)
  }, [ydoc, path])
  
  const updateMap = useCallback((key: string, value: T) => {
    ydoc.transact(() => {
      ydoc.getMap<T>(path).set(key, value)
    })
  }, [ydoc, path])
  
  return [map, updateMap]
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

**App Structure**:
```tsx
// app/document/[id]/page.tsx
'use client'

import { YjsProvider } from '@/hooks/useYjs'
import { Canvas } from '@/components/Canvas'
import { Toolbar } from '@/components/Toolbar'
import { Cursors } from '@/components/Cursors'

export default function DocumentPage({ params }: { params: { id: string } }) {
  return (
    <YjsProvider documentName={params.id}>
      <div className="h-screen flex flex-col">
        <Toolbar />
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

## Production Deployment

### Hocuspocus Server (Docker)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 1234

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  hocuspocus:
    build: .
    ports:
      - "1234:1234"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    restart: unless-stopped
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

```json
{
  "name": "collaborative-editor",
  "version": "0.1.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "^14.0.0",
    
    "yjs": "^13.6.10",
    "@hocuspocus/provider": "^2.10.0",
    "@hocuspocus/server": "^2.10.0",
    "@hocuspocus/extension-database": "^2.10.0",
    "y-indexeddb": "^9.0.12",
    "y-webrtc": "^10.3.0",
    "y-protocols": "^1.0.6",
    
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/auth-helpers-nextjs": "^0.8.7",
    
    "zustand": "^4.4.7",
    "lib0": "^0.2.94"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.10.0",
    
    "vitest": "^1.0.0",
    "@playwright/test": "^1.40.0",
    
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "server": "node server/index.js",
    "test": "vitest",
    "test:e2e": "playwright test"
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

## Conclusion

This stack is **production-ready** for MVP with:

✅ **Offline-first**: IndexedDB persists all changes locally  
✅ **Low latency**: WebRTC P2P for sub-50ms updates  
✅ **Reliable sync**: Hocuspocus server ensures eventual consistency  
✅ **Scalable storage**: Supabase handles auth + delta storage  
✅ **Simple rendering**: Native SVG eliminates canvas complexity  
✅ **Battle-tested**: All components used in production apps  

**Estimated MVP timeline**: 3-4 weeks for 1 developer

**Next steps**:
1. Set up Supabase project
2. Implement Hocuspocus server
3. Build basic SVG canvas
4. Add collaboration features
5. Test offline scenarios