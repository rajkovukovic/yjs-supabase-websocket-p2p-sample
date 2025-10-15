# Frontend Implementation Guide: Hocuspocus & P2P Connections

This document provides detailed instructions for implementing the frontend side of Hocuspocus and P2P connections for real-time collaborative applications using Yjs CRDT.

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [Environment Configuration](#environment-configuration)
3. [Core Dependencies](#core-dependencies)
4. [Provider Setup](#provider-setup)
5. [State Management](#state-management)
6. [Presence & Awareness](#presence--awareness)
7. [Connection Resilience](#connection-resilience)
8. [Complete Code Examples](#complete-code-examples)
9. [Testing & Debugging](#testing--debugging)

## 🗄️ Database Schema

### Supabase Tables

```sql
-- Main documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  yjs_state BYTEA,                    -- Binary Yjs state (Y.encodeStateAsUpdate)
  metadata JSONB DEFAULT '{}',        -- Optional metadata (title, description, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incremental updates (for audit trail and debugging)
CREATE TABLE document_updates (
  id BIGSERIAL PRIMARY KEY,
  document_name TEXT NOT NULL REFERENCES documents(name) ON DELETE CASCADE,
  update BYTEA NOT NULL,              -- Individual Y.Update binary
  client_id TEXT,                     -- Client that made the update
  clock BIGINT,                       -- Logical clock from update
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Periodic snapshots to compress update history
CREATE TABLE document_snapshots (
  id BIGSERIAL PRIMARY KEY,
  document_name TEXT NOT NULL REFERENCES documents(name) ON DELETE CASCADE,
  snapshot BYTEA NOT NULL,            -- Snapshot of document state
  update_count INTEGER,               -- Number of updates in this snapshot
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_doc_name ON documents(name);
CREATE INDEX idx_doc_updated ON documents(updated_at DESC);
CREATE INDEX idx_updates_doc ON document_updates(document_name);
CREATE INDEX idx_updates_created ON document_updates(created_at DESC);
CREATE INDEX idx_updates_clock ON document_updates(clock);
CREATE INDEX idx_snapshots_doc ON document_snapshots(document_name);
CREATE INDEX idx_snapshots_created ON document_snapshots(created_at DESC);
```

## 🔧 Environment Configuration

### Frontend Environment Variables

Create `.env.local` in your web directory:

```env
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# WebSocket Servers
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234
NEXT_PUBLIC_Y_WEBRTC_SIGNALING_URL=ws://localhost:4445

# WebRTC Configuration (Optional)
NEXT_PUBLIC_WEBRTC_PASSWORD=your-secure-password
```

### Environment Validation

```typescript
// lib/Env.ts
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const HOCUSPOCUS_URL = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL
export const Y_WEBRTC_SIGNALING_URL = process.env.NEXT_PUBLIC_Y_WEBRTC_SIGNALING_URL
export const WEBRTC_PASSWORD = process.env.NEXT_PUBLIC_WEBRTC_PASSWORD

export function validateEnvironment() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing required Supabase environment variables')
  }
  console.log('✅ Environment variables validated successfully')
}
```

## 📦 Core Dependencies

### Package.json Dependencies

```json
{
  "dependencies": {
    "@hocuspocus/provider": "^2.15.3",
    "@supabase/supabase-js": "^2.39.0",
    "y-indexeddb": "^9.0.12",
    "y-webrtc": "^10.3.0",
    "yjs": "^13.6.10",
    "valtio": "^1.12.0",
    "ua-parser-js": "^1.0.37"
  }
}
```

## 🔌 Provider Setup

### Core Provider Configuration

```typescript
// lib/yjs-providers.ts
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import { HOCUSPOCUS_URL, WEBRTC_PASSWORD, Y_WEBRTC_SIGNALING_URL } from './Env'

export function setupProviders(documentName: string, ydoc: Y.Doc) {
  // 1. IndexedDB (local persistence)
  const indexeddbProvider = new IndexeddbPersistence(documentName, ydoc)
  
  indexeddbProvider.on('synced', () => {
    console.log('✅ IndexedDB loaded')
  })
  
  // 2. Hocuspocus (WebSocket, authoritative server)
  const hocuspocusProvider = new HocuspocusProvider({
    url: HOCUSPOCUS_URL,
    name: documentName,
    document: ydoc,
    
    // MVP: Provide a dummy token to satisfy HocuspocusProvider v2.15.3 client-side validation
    token: () => 'mvp-anonymous-access',
    
    onSynced: ({ state }) => {
      console.log('✅ Hocuspocus synced:', state)
    },
    
    onStatus: ({ status }) => {
      console.log('📡 Connection status:', status)
    },
    
    onAuthenticationFailed: ({ reason }) => {
      console.error('❌ Authentication failed:', reason)
    },
    
    onClose: ({ event }) => {
      console.warn('⚠️ Connection closed:', event.code, event.reason)
    },
    
    onOpen: () => {
      console.log('✅ WebSocket connection opened successfully')
    }
  })
  
  // 3. WebRTC Provider (peer-to-peer document sync)
  const signalingServers = Y_WEBRTC_SIGNALING_URL ? [Y_WEBRTC_SIGNALING_URL] : []
  
  const webrtcOptions: any = {
    signaling: signalingServers,
    password: WEBRTC_PASSWORD,
    awareness: hocuspocusProvider.awareness,
    maxConns: 20,
    filterBcConns: false,
  }
  
  const webrtcProvider = new WebrtcProvider(documentName, ydoc, webrtcOptions)
  
  // Debug WebRTC connection states
  webrtcProvider.on('peers', ({ webrtcConns, webrtcPeers }) => {
    console.log('🔗 WebRTC peers:', {
      connections: webrtcConns.size,
      peers: webrtcPeers.length
    })
  })
  
  webrtcProvider.on('connection-error', ({ error }) => {
    console.error('❌ WebRTC connection error:', error)
  })
  
  return {
    indexeddbProvider,
    hocuspocusProvider,
    webrtcProvider
  }
}
```

## 🏪 State Management

### Valtio Store Integration

```typescript
// store/document.ts
import { proxy } from 'valtio'
import * as Y from 'yjs'
import { Rectangle, DocumentState } from '../types'

export const documentState = proxy<DocumentState>({
  rectangles: [],
  synced: false,
  status: 'disconnected',
  peers: 0,
  selectedRectangleIds: [],
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

### Yjs Context Provider

```typescript
// hooks/useYjs.tsx
'use client'

import React, { useEffect, useState, useContext, createContext } from 'react'
import * as Y from 'yjs'
import { setupProviders } from '../lib/yjs-providers'
import { syncYjsToValtio, documentState } from '../store/document'

const YjsContext = createContext<Y.Doc | null>(null)

export function YjsProvider({ 
  documentName, 
  children 
}: { 
  documentName: string
  children: React.ReactNode 
}) {
  const [ydoc] = useState(() => new Y.Doc())
  const [ready, setReady] = useState(false)
  
  useEffect(() => {
    const providers = setupProviders(documentName, ydoc)
    
    // Store providers on the ydoc for access by other hooks
    ;(ydoc as any)._hocuspocusProvider = providers.hocuspocusProvider
    ;(ydoc as any)._webrtcProvider = providers.webrtcProvider
    
    // Sync Yjs to Valtio
    const unsyncYjs = syncYjsToValtio(ydoc)
    
    // Show UI as soon as IndexedDB loads (don't wait for network)
    providers.indexeddbProvider.on('synced', () => {
      setReady(true)
    })
    
    // Track sync status for Hocuspocus
    providers.hocuspocusProvider.on('synced', () => {
      documentState.synced = true
    })
    
    providers.hocuspocusProvider.on('status', ({ status }: { status: any }) => {
      documentState.status = status
    })
    
    // Track connected users via Awareness
    const awareness = providers.hocuspocusProvider.awareness
    
    const updatePeerCount = () => {
      const states = Array.from(awareness.getStates().keys())
      documentState.peers = Math.max(0, states.length - 1)
    }
    
    awareness.on('change', updatePeerCount)
    updatePeerCount()
    
    return () => {
      unsyncYjs()
      providers.hocuspocusProvider.destroy()
      providers.webrtcProvider.destroy()
      providers.indexeddbProvider.destroy()
    }
  }, [documentName])
  
  return (
    <YjsContext.Provider value={ydoc}>
      {ready ? children : <div>Loading...</div>}
    </YjsContext.Provider>
  )
}

export const useYDoc = () => {
  const context = useContext(YjsContext)
  if (!context) {
    throw new Error('useYDoc must be used within a YjsProvider')
  }
  return context
}

export const useAwareness = () => {
  const ydoc = useYDoc()
  const provider = (ydoc as any)._hocuspocusProvider
  return provider?.awareness
}
```

## 👥 Presence & Awareness

### User Presence Management

```typescript
// hooks/usePresence.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useYDoc } from '@/hooks/useYjs'

export interface PresenceUser {
  clientId: number
  name: string
  email: string
  avatarUrl?: string
  color: string
  cursor?: { x: number; y: number }
  device?: string
}

const generateColorFromString = (str: string): string => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colors = [
    '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
    '#06B6D4', '#F97316', '#6366F1', '#14B8A6', '#EF4444'
  ]
  
  return colors[Math.abs(hash) % colors.length]
}

export const usePresence = () => {
  const { user } = useAuth()
  const ydoc = useYDoc()
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!ydoc || !user) return

    const provider = (ydoc as any)._hocuspocusProvider
    if (!provider || !provider.awareness) return

    const awareness = provider.awareness

    // Set local awareness state with user info
    const localState = {
      name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
      email: user.email || '',
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      color: generateColorFromString(user.email || 'default'),
    }

    awareness.setLocalState(localState)

    // Update online users list
    const updateOnlineUsers = () => {
      const states = awareness.getStates()
      const users: PresenceUser[] = []

      states.forEach((state: any, clientId: number) => {
        if (state && state.name) {
          users.push({
            clientId,
            name: state.name,
            email: state.email,
            avatarUrl: state.avatarUrl,
            color: state.color || generateColorFromString(state.email || String(clientId)),
          })
        }
      })

      setOnlineUsers(users)
    }

    updateOnlineUsers()
    awareness.on('change', updateOnlineUsers)

    return () => {
      awareness.off('change', updateOnlineUsers)
      awareness.setLocalState(null)
    }
  }, [ydoc, user])

  return { onlineUsers }
}
```

### Live Cursors Implementation

```typescript
// components/Cursors.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAwareness } from '../hooks/useYjs'
import { useAuth } from '../hooks/useAuth'
import { generateColorFromString, getShortName } from '../lib/userUtils'
import { getDeviceInfo } from '@/lib/deviceInfo'

interface CursorState {
  cursor?: { x: number; y: number }
  name?: string
  email?: string
  color?: string
  shortName?: string
}

export function Cursors() {
  const awareness = useAwareness()
  const { user } = useAuth()
  const [cursors, setCursors] = useState<Map<number, CursorState>>(new Map())
  
  useEffect(() => {
    if (!awareness || !user) return
    
    // Set local user info with real user data
    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous'
    const deviceInfo = getDeviceInfo()
    awareness.setLocalStateField('name', userName)
    awareness.setLocalStateField('email', user.email || '')
    awareness.setLocalStateField('color', generateColorFromString(user.email || 'default'))
    awareness.setLocalStateField('shortName', getShortName(userName))
    awareness.setLocalStateField('device', deviceInfo.full)
    
    const updateCursors = () => {
      const states = awareness.getStates()
      const newCursors = new Map<number, CursorState>()
      
      states.forEach((state: any, clientId: number) => {
        if (clientId !== awareness.clientID && state.cursor) {
          newCursors.set(clientId, state)
        }
      })
      
      setCursors(newCursors)
    }
    
    awareness.on('change', updateCursors)
    updateCursors()
    
    return () => awareness.off('change', updateCursors)
  }, [awareness, user])
  
  return null // Cursors are rendered inside the Canvas SVG
}

// Export a component that can be used inside SVG
export function CanvasCursors({
  cursors,
  stage,
}: {
  cursors: Map<number, CursorState>
  stage: { x: number; y: number; scale: number }
}) {
  return (
    <>
      {Array.from(cursors.entries()).map(([clientId, state]) => {
        if (!state.cursor) return null

        const color = state.color || '#3B82F6'
        const shortName = state.shortName || state.name?.substring(0, 3).toUpperCase() || 'USR'

        const cursorX = stage.x + state.cursor.x * stage.scale
        const cursorY = stage.y + state.cursor.y * stage.scale

        return (
          <g
            key={clientId}
            transform={`translate(${cursorX}, ${cursorY})`}
            style={{ pointerEvents: 'none' }}
          >
            {/* Cursor pointer */}
            <path
              d={`M 0 0 L 12 16 L 7.5 9.5 L 2 15 Z`}
              fill={color}
              stroke="white"
              strokeWidth="1.5"
            />

            {/* Label with @shortName */}
            <g transform={`translate(15, 5)`}>
              <rect
                x="0"
                y="0"
                width={shortName.length * 10 + 14}
                height="22"
                rx="4"
                fill={color}
                opacity="0.95"
              />
              <text
                x="7"
                y="15"
                fontSize="12"
                fontWeight="600"
                fill="white"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {shortName}
              </text>
            </g>
          </g>
        )
      })}
    </>
  )
}
```

## 🔄 Connection Resilience

### Connection Status Tracking

```typescript
// components/DocumentStatusToolbar.tsx
'use client'

import { useEffect, useState } from 'react'
import { useYDoc } from '@/hooks/useYjs'
import { useSnapshot } from 'valtio'
import { documentState } from '@/store/document'

export function DocumentStatusToolbar({ documentName }: { documentName: string }) {
  const ydoc = useYDoc()
  const { synced, status, peers } = useSnapshot(documentState)
  const [webrtcPeerIds, setWebrtcPeerIds] = useState<Set<number>>(new Set())

  // Track WebRTC P2P connections
  useEffect(() => {
    if (!ydoc) return

    const webrtcProvider = (ydoc as any)._webrtcProvider
    const awareness = (ydoc as any)._hocuspocusProvider?.awareness

    if (!webrtcProvider || !awareness) return

    const updateWebrtcPeers = ({ webrtcConns, webrtcPeers }: any) => {
      const connectedPeerIds = new Set<number>()
      const hasAnyP2PConnections = webrtcConns && webrtcConns.size > 0
      
      if (hasAnyP2PConnections) {
        const states = awareness.getStates()
        
        states.forEach((state: any, clientId: number) => {
          if (clientId === awareness.clientID) return
          connectedPeerIds.add(clientId)
        })
      }
      
      setWebrtcPeerIds(connectedPeerIds)
    }

    webrtcProvider.on('peers', updateWebrtcPeers)
    webrtcProvider.on('synced', () => {
      const currentConns = webrtcProvider.room?.webrtcConns || new Map()
      const currentPeers = webrtcProvider.room?.webrtcPeers || []
      updateWebrtcPeers({ webrtcConns: currentConns, webrtcPeers: currentPeers })
    })
    
    // Initial update
    const initialConns = webrtcProvider.room?.webrtcConns || new Map()
    const initialPeers = webrtcProvider.room?.webrtcPeers || []
    updateWebrtcPeers({ webrtcConns: initialConns, webrtcPeers: initialPeers })
    
    // Poll for connection status changes
    const pollInterval = setInterval(() => {
      const currentConns = webrtcProvider.room?.webrtcConns || new Map()
      const currentPeers = webrtcProvider.room?.webrtcPeers || []
      updateWebrtcPeers({ webrtcConns: currentConns, webrtcPeers: currentPeers })
    }, 2000)

    return () => {
      webrtcProvider.off('peers', updateWebrtcPeers)
      clearInterval(pollInterval)
    }
  }, [ydoc])

  return (
    <div className="flex items-center gap-4 p-2 bg-gray-100 rounded">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          synced ? 'bg-green-500' : 'bg-yellow-500'
        }`} />
        <span className="text-sm">
          {synced ? 'Synced' : 'Syncing...'}
        </span>
      </div>
      
      <div className="text-sm text-gray-600">
        {peers} peer{peers !== 1 ? 's' : ''} online
      </div>
      
      {webrtcPeerIds.size > 0 && (
        <div className="text-sm text-blue-600">
          {webrtcPeerIds.size} P2P connection{webrtcPeerIds.size !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
```

### App-Level Presence Tracking

```typescript
// hooks/useAppPresence.tsx
'use client'

import { useEffect, useState } from 'react'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { useAuth } from './useAuth'
import { HOCUSPOCUS_URL } from '@/lib/Env'

export interface OnlineUser {
  clientId: number
  name: string
  email: string
  color: string
  currentDocumentId?: string | null
  device?: string
}

// Singleton Yjs document and provider for app-level presence
let globalYDoc: Y.Doc | null = null
let globalProvider: HocuspocusProvider | null = null
let providerInitialized = false

const getGlobalPresenceProvider = () => {
  if (!globalYDoc) {
    globalYDoc = new Y.Doc()
  }
  
  if (!globalProvider && !providerInitialized) {
    providerInitialized = true
    globalProvider = new HocuspocusProvider({
      url: HOCUSPOCUS_URL,
      name: '__app_presence_tracker__', // Special document name for app-level presence
      document: globalYDoc,
      token: () => 'mvp-anonymous-access',
    })
  }
  
  return { ydoc: globalYDoc, provider: globalProvider }
}

export const useAppPresence = () => {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  useEffect(() => {
    if (!user) return

    const { ydoc, provider } = getGlobalPresenceProvider()
    if (!provider || !provider.awareness) return

    const awareness = provider.awareness

    // Set local user info
    const localState = {
      name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
      email: user.email || '',
      color: generateColorFromString(user.email || 'default'),
      device: getDeviceInfo().full,
    }

    awareness.setLocalState(localState)

    // Update online users list
    const updateOnlineUsers = () => {
      const states = awareness.getStates()
      const users: OnlineUser[] = []

      states.forEach((state: any, clientId: number) => {
        if (state && state.name) {
          users.push({
            clientId,
            name: state.name,
            email: state.email,
            color: state.color || generateColorFromString(state.email || String(clientId)),
            currentDocumentId: state.currentDocumentId,
            device: state.device,
          })
        }
      })

      setOnlineUsers(users)
    }

    updateOnlineUsers()
    awareness.on('change', updateOnlineUsers)

    return () => {
      awareness.off('change', updateOnlineUsers)
      awareness.setLocalState(null)
    }
  }, [user])

  return { onlineUsers }
}
```

## 👥 Advanced Presence Implementation

### User Presence with Device Information

```typescript
// lib/deviceInfo.ts
import UAParser from 'ua-parser-js'

export const getDeviceInfo = (): {
  browser: string
  device: string
  os: string
  full: string
} => {
  if (typeof window === 'undefined') {
    return {
      browser: 'Unknown',
      device: 'Server',
      os: 'Unknown',
      full: 'Server',
    }
  }
  
  const parser = new UAParser()
  const result = parser.getResult()

  const browser = result.browser.name || 'Unknown Browser'
  const os = `${result.os.name || ''} ${result.os.version || ''}`.trim()

  let device = 'Desktop'
  if (result.device.vendor && result.device.model) {
    device = `${result.device.vendor} ${result.device.model}`
  } else if (result.device.type) {
    device = result.device.type.charAt(0).toUpperCase() + result.device.type.slice(1)
  } else if (os.toLowerCase().includes('mac')) {
    device = 'Mac'
  } else if (os.toLowerCase().includes('windows')) {
    device = 'PC'
  }

  const full = `${browser} on ${device}`

  return { browser, device, os, full }
}
```

### User Utilities for Presence

```typescript
// lib/userUtils.ts
export const generateColorFromString = (str: string): string => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colors = [
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#F59E0B', // amber
    '#10B981', // emerald
    '#06B6D4', // cyan
    '#F97316', // orange
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#EF4444', // red
  ]
  
  return colors[Math.abs(hash) % colors.length]
}

export const getShortName = (name: string): string => {
  if (!name) return 'USR'
  
  const words = name.trim().split(' ')
  if (words.length === 1) {
    return words[0].substring(0, 3).toUpperCase()
  }
  
  return words
    .slice(0, 2)
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
}
```

### Enhanced Presence Hook

```typescript
// hooks/usePresence.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useYDoc } from '@/hooks/useYjs'
import { generateColorFromString, getShortName } from '@/lib/userUtils'
import { getDeviceInfo } from '@/lib/deviceInfo'

export interface PresenceUser {
  clientId: number
  name: string
  email: string
  avatarUrl?: string
  color: string
  cursor?: { x: number; y: number }
  device?: string
  shortName?: string
  isTyping?: boolean
  lastSeen?: Date
}

export const usePresence = () => {
  const { user } = useAuth()
  const ydoc = useYDoc()
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!ydoc || !user) return

    const provider = (ydoc as any)._hocuspocusProvider
    if (!provider || !provider.awareness) return

    const awareness = provider.awareness
    const deviceInfo = getDeviceInfo()

    // Set local awareness state with comprehensive user info
    const localState = {
      name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
      email: user.email || '',
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      color: generateColorFromString(user.email || 'default'),
      shortName: getShortName(user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous'),
      device: deviceInfo.full,
      lastSeen: new Date().toISOString(),
    }

    awareness.setLocalState(localState)

    // Update online users list
    const updateOnlineUsers = () => {
      const states = awareness.getStates()
      const users: PresenceUser[] = []

      states.forEach((state: any, clientId: number) => {
        if (state && state.name) {
          users.push({
            clientId,
            name: state.name,
            email: state.email,
            avatarUrl: state.avatarUrl,
            color: state.color || generateColorFromString(state.email || String(clientId)),
            cursor: state.cursor,
            device: state.device,
            shortName: state.shortName,
            isTyping: state.isTyping,
            lastSeen: state.lastSeen ? new Date(state.lastSeen) : new Date(),
          })
        }
      })

      setOnlineUsers(users)
    }

    updateOnlineUsers()
    awareness.on('change', updateOnlineUsers)

    // Update last seen periodically
    const updateLastSeen = () => {
      awareness.setLocalStateField('lastSeen', new Date().toISOString())
    }
    const lastSeenInterval = setInterval(updateLastSeen, 30000) // Every 30 seconds

    return () => {
      awareness.off('change', updateOnlineUsers)
      clearInterval(lastSeenInterval)
      awareness.setLocalState(null)
    }
  }, [ydoc, user])

  return { onlineUsers }
}
```

## 🖱️ Live Cursors Implementation

### Cursor Tracking Hook

```typescript
// hooks/useCursorTracking.tsx
'use client'

import { useEffect, useCallback } from 'react'
import { useAwareness } from '@/hooks/useYjs'
import { useAuth } from '@/hooks/useAuth'
import { generateColorFromString, getShortName } from '@/lib/userUtils'
import { getDeviceInfo } from '@/lib/deviceInfo'

interface CursorState {
  cursor?: { x: number; y: number }
  name?: string
  email?: string
  color?: string
  shortName?: string
  device?: string
  isTyping?: boolean
}

export const useCursorTracking = () => {
  const awareness = useAwareness()
  const { user } = useAuth()

  useEffect(() => {
    if (!awareness || !user) return

    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous'
    const deviceInfo = getDeviceInfo()

    // Set up local user state
    awareness.setLocalStateField('name', userName)
    awareness.setLocalStateField('email', user.email || '')
    awareness.setLocalStateField('color', generateColorFromString(user.email || 'default'))
    awareness.setLocalStateField('shortName', getShortName(userName))
    awareness.setLocalStateField('device', deviceInfo.full)

    // Mouse move handler for cursor tracking
    const handleMouseMove = (event: MouseEvent) => {
      if (!awareness) return

      const rect = (event.target as Element)?.getBoundingClientRect()
      if (!rect) return

      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height

      awareness.setLocalStateField('cursor', { x, y })
    }

    // Mouse leave handler to hide cursor
    const handleMouseLeave = () => {
      if (!awareness) return
      awareness.setLocalStateField('cursor', null)
    }

    // Typing detection
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!awareness) return
      
      // Show typing indicator for text input keys
      if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
        awareness.setLocalStateField('isTyping', true)
        
        // Clear typing indicator after 2 seconds
        setTimeout(() => {
          awareness.setLocalStateField('isTyping', false)
        }, 2000)
      }
    }

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('keydown', handleKeyDown)
      
      // Clean up awareness state
      awareness.setLocalStateField('cursor', null)
      awareness.setLocalStateField('isTyping', false)
    }
  }, [awareness, user])
}
```

### Cursor Display Component

```typescript
// components/Cursors.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAwareness } from '@/hooks/useYjs'
import { useAuth } from '@/hooks/useAuth'

interface CursorState {
  cursor?: { x: number; y: number }
  name?: string
  email?: string
  color?: string
  shortName?: string
  device?: string
  isTyping?: boolean
}

interface StageState {
  x: number
  y: number
  scale: number
}

export function Cursors() {
  const awareness = useAwareness()
  const { user } = useAuth()
  const [cursors, setCursors] = useState<Map<number, CursorState>>(new Map())
  
  useEffect(() => {
    if (!awareness || !user) return
    
    const updateCursors = () => {
      const states = awareness.getStates()
      const newCursors = new Map<number, CursorState>()
      
      states.forEach((state: any, clientId: number) => {
        if (clientId !== awareness.clientID && state.cursor) {
          newCursors.set(clientId, state)
        }
      })
      
      setCursors(newCursors)
    }
    
    awareness.on('change', updateCursors)
    updateCursors()
    
    return () => awareness.off('change', updateCursors)
  }, [awareness, user])
  
  return null // Cursors are rendered inside the Canvas SVG
}

// SVG-compatible cursor component
export function CanvasCursors({
  cursors,
  stage,
}: {
  cursors: Map<number, CursorState>
  stage: StageState
}) {
  return (
    <>
      {Array.from(cursors.entries()).map(([clientId, state]) => {
        if (!state.cursor) return null

        const color = state.color || '#3B82F6'
        const shortName = state.shortName || state.name?.substring(0, 3).toUpperCase() || 'USR'

        const cursorX = stage.x + state.cursor.x * stage.scale
        const cursorY = stage.y + state.cursor.y * stage.scale

        return (
          <g
            key={clientId}
            transform={`translate(${cursorX}, ${cursorY})`}
            style={{ pointerEvents: 'none' }}
          >
            {/* Cursor pointer */}
            <path
              d={`M 0 0 L 12 16 L 7.5 9.5 L 2 15 Z`}
              fill={color}
              stroke="white"
              strokeWidth="1.5"
            />

            {/* User label */}
            <g transform={`translate(15, 5)`}>
              <rect
                x="0"
                y="0"
                width={shortName.length * 10 + 14}
                height="22"
                rx="4"
                fill={color}
                opacity="0.95"
              />
              <text
                x="7"
                y="15"
                fontSize="12"
                fontWeight="600"
                fill="white"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {shortName}
              </text>
            </g>

            {/* Typing indicator */}
            {state.isTyping && (
              <g transform={`translate(15, 30)`}>
                <rect
                  x="0"
                  y="0"
                  width="60"
                  height="16"
                  rx="8"
                  fill={color}
                  opacity="0.8"
                />
                <text
                  x="30"
                  y="11"
                  fontSize="10"
                  fontWeight="500"
                  fill="white"
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  typing...
                </text>
              </g>
            )}
          </g>
        )
      })}
    </>
  )
}
```

### Online Users Component

```typescript
// components/OnlineUsers.tsx
'use client'

import { usePresence } from '@/hooks/usePresence'
import { User, Monitor } from 'lucide-react'

export function OnlineUsers() {
  const { onlineUsers } = usePresence()

  if (onlineUsers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <User className="w-4 h-4" />
        <span>No other users online</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <User className="w-4 h-4 text-gray-600" />
      <div className="flex -space-x-2">
        {onlineUsers.map((user) => (
          <div
            key={user.clientId}
            className="relative group"
            title={`${user.name} (${user.device})`}
          >
            {/* Avatar circle */}
            <div
              className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: user.color }}
            >
              {user.shortName}
            </div>
            
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              <div className="font-medium">{user.name}</div>
              <div className="text-gray-300 text-xs">{user.device}</div>
              {user.isTyping && (
                <div className="text-blue-300 text-xs">typing...</div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <span className="text-sm text-gray-600">
        {onlineUsers.length} user{onlineUsers.length !== 1 ? 's' : ''} online
      </span>
    </div>
  )
}
```

### Document Presence Component

```typescript
// components/DocumentPresence.tsx
'use client'

import { usePresence } from '@/hooks/usePresence'
import { useAuth } from '@/hooks/useAuth'
import { User, Monitor, Clock } from 'lucide-react'

export function DocumentPresence() {
  const { onlineUsers } = usePresence()
  const { user } = useAuth()

  // Filter out current user
  const otherUsers = onlineUsers.filter(u => u.email !== user?.email)

  if (otherUsers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <User className="w-4 h-4" />
        <span>You're the only one here</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <User className="w-4 h-4" />
        <span>{otherUsers.length} other user{otherUsers.length !== 1 ? 's' : ''} in this document</span>
      </div>
      
      <div className="space-y-1">
        {otherUsers.map((user) => (
          <div
            key={user.clientId}
            className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
          >
            {/* User avatar */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: user.color }}
            >
              {user.shortName}
            </div>
            
            {/* User info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {user.name}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Monitor className="w-3 h-3" />
                <span className="truncate">{user.device}</span>
              </div>
            </div>
            
            {/* Status indicators */}
            <div className="flex items-center gap-1">
              {user.isTyping && (
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## 🧪 Testing & Debugging

### Connection Testing

```typescript
// Debug connection status
export function useConnectionDebug() {
  const ydoc = useYDoc()
  
  useEffect(() => {
    if (!ydoc) return

    const hocuspocusProvider = (ydoc as any)._hocuspocusProvider
    const webrtcProvider = (ydoc as any)._webrtcProvider

    // Log connection events
    hocuspocusProvider.on('status', ({ status }) => {
      console.log('📡 Hocuspocus status:', status)
    })

    webrtcProvider.on('peers', ({ webrtcConns, webrtcPeers }) => {
      console.log('🔗 WebRTC peers:', {
        connections: webrtcConns.size,
        peers: webrtcPeers.length
      })
    })

    webrtcProvider.on('connection-error', ({ error }) => {
      console.error('❌ WebRTC error:', error)
    })

    // Expose for debugging
    if (typeof window !== 'undefined') {
      (window as any).__DEBUG_YJS__ = {
        ydoc,
        hocuspocusProvider,
        webrtcProvider,
        awareness: hocuspocusProvider.awareness
      }
    }
  }, [ydoc])
}
```

### Environment Validation

```typescript
// lib/Env.ts - Complete implementation
export function validateEnvironment() {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing required Supabase environment variables')
    }
    
    console.log('✅ Environment variables validated successfully')
    console.log('📡 Hocuspocus URL:', HOCUSPOCUS_URL)
    console.log('🔄 WebRTC Signaling URL:', Y_WEBRTC_SIGNALING_URL || 'Not configured (BroadcastChannel only)')
  } catch (error) {
    console.error('❌ Environment validation failed:', error)
    throw error
  }
}
```

## 🎨 Canvas Integration with Cursors

### Canvas Component with Live Cursors

```typescript
// components/DocumentCanvas.tsx
'use client'

import { useState, useEffect } from 'react'
import { useYDoc } from '@/hooks/useYjs'
import { useCursorTracking } from '@/hooks/useCursorTracking'
import { CanvasCursors } from '@/components/Cursors'
import { useSnapshot } from 'valtio'
import { documentState, actions } from '@/store/document'

interface StageState {
  x: number
  y: number
  scale: number
}

export function DocumentCanvas() {
  const ydoc = useYDoc()
  const { rectangles } = useSnapshot(documentState)
  const [cursors, setCursors] = useState<Map<number, any>>(new Map())
  const [stage, setStage] = useState<StageState>({ x: 0, y: 0, scale: 1 })
  
  // Enable cursor tracking
  useCursorTracking()

  // Handle mouse events for canvas interaction
  const handleCanvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!ydoc) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left - stage.x) / stage.scale
    const y = (event.clientY - rect.top - stage.y) / stage.scale

    // Create new rectangle
    const newRect = {
      id: crypto.randomUUID(),
      x,
      y,
      width: 100,
      height: 60,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    }

    actions.addRectangle(ydoc, newRect)
  }

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    // Update cursor position for awareness
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left - stage.x) / stage.scale
    const y = (event.clientY - rect.top - stage.y) / stage.scale
    
    // This will be handled by useCursorTracking hook
  }

  return (
    <div className="flex-1 relative overflow-hidden bg-gray-50">
      <svg
        className="w-full h-full cursor-crosshair"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        style={{ background: 'radial-gradient(circle, #f3f4f6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      >
        {/* Canvas content */}
        <g transform={`translate(${stage.x}, ${stage.y}) scale(${stage.scale})`}>
          {/* Render rectangles */}
          {rectangles.map((rect) => (
            <g key={rect.id}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill={rect.color}
                stroke="#374151"
                strokeWidth="2"
                rx="4"
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
            </g>
          ))}
          
          {/* Render live cursors */}
          <CanvasCursors cursors={cursors} stage={stage} />
        </g>
      </svg>
    </div>
  )
}
```

### Complete Document Page with Presence

```typescript
// app/document/[id]/page.tsx
'use client'

import { YjsProvider } from '@/hooks/useYjs'
import { DocumentCanvas } from '@/components/DocumentCanvas'
import { DocumentStatusToolbar } from '@/components/DocumentStatusToolbar'
import { DocumentPresence } from '@/components/DocumentPresence'
import { OnlineUsers } from '@/components/OnlineUsers'
import { validateEnvironment } from '@/lib/Env'

// Validate environment on page load
validateEnvironment()

function DocumentContent({ documentName }: { documentName: string }) {
  return (
    <YjsProvider documentName={documentName}>
      <div className="h-screen flex flex-col">
        {/* Top toolbar with status and online users */}
        <div className="flex items-center justify-between p-4 bg-white border-b">
          <DocumentStatusToolbar documentName={documentName} />
          <OnlineUsers />
        </div>
        
        {/* Main content area */}
        <div className="flex flex-1">
          {/* Canvas area */}
          <div className="flex-1">
            <DocumentCanvas />
          </div>
          
          {/* Sidebar with presence info */}
          <div className="w-80 bg-white border-l p-4">
            <DocumentPresence />
          </div>
        </div>
      </div>
    </YjsProvider>
  )
}

export default function DocumentPage({ params }: { params: { id: string } }) {
  const documentName = params.id || 'default-document'
  
  return <DocumentContent documentName={documentName} />
}
```

## 🔧 Advanced Presence Features

### Typing Indicators

```typescript
// hooks/useTypingIndicator.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useAwareness } from '@/hooks/useYjs'

export const useTypingIndicator = () => {
  const awareness = useAwareness()
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!awareness) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only show typing for text input keys
      if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
        awareness.setLocalStateField('isTyping', true)
        
        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        
        // Set new timeout to clear typing indicator
        typingTimeoutRef.current = setTimeout(() => {
          awareness.setLocalStateField('isTyping', false)
        }, 2000)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      awareness.setLocalStateField('isTyping', false)
    }
  }, [awareness])
}
```

### User Activity Tracking

```typescript
// hooks/useUserActivity.tsx
'use client'

import { useEffect } from 'react'
import { useAwareness } from '@/hooks/useYjs'

export const useUserActivity = () => {
  const awareness = useAwareness()

  useEffect(() => {
    if (!awareness) return

    let lastActivity = Date.now()
    const activityThreshold = 30000 // 30 seconds

    const updateActivity = () => {
      lastActivity = Date.now()
      awareness.setLocalStateField('lastActivity', lastActivity)
    }

    const checkInactivity = () => {
      const now = Date.now()
      const timeSinceActivity = now - lastActivity
      
      if (timeSinceActivity > activityThreshold) {
        awareness.setLocalStateField('isActive', false)
      } else {
        awareness.setLocalStateField('isActive', true)
      }
    }

    // Track various user activities
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    // Check for inactivity every 10 seconds
    const inactivityInterval = setInterval(checkInactivity, 10000)

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity)
      })
      clearInterval(inactivityInterval)
      awareness.setLocalStateField('isActive', false)
    }
  }, [awareness])
}
```

### Enhanced Presence with Activity Status

```typescript
// components/EnhancedPresence.tsx
'use client'

import { usePresence } from '@/hooks/usePresence'
import { User, Monitor, Clock, Activity } from 'lucide-react'

export function EnhancedPresence() {
  const { onlineUsers } = usePresence()

  const getActivityStatus = (user: any) => {
    if (user.isTyping) return { text: 'typing...', color: 'text-blue-600', icon: Activity }
    if (user.isActive === false) return { text: 'away', color: 'text-gray-500', icon: Clock }
    return { text: 'active', color: 'text-green-600', icon: Activity }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <User className="w-4 h-4" />
        Online Users ({onlineUsers.length})
      </h3>
      
      <div className="space-y-2">
        {onlineUsers.map((user) => {
          const status = getActivityStatus(user)
          const StatusIcon = status.icon
          
          return (
            <div
              key={user.clientId}
              className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {/* User avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white relative"
                style={{ backgroundColor: user.color }}
              >
                {user.shortName}
                
                {/* Activity indicator */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                  user.isActive === false ? 'bg-gray-400' : 'bg-green-500'
                }`} />
              </div>
              
              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Monitor className="w-3 h-3" />
                  <span className="truncate">{user.device}</span>
                </div>
              </div>
              
              {/* Status */}
              <div className={`flex items-center gap-1 text-xs ${status.color}`}>
                <StatusIcon className="w-3 h-3" />
                <span>{status.text}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

## 🚀 Complete Implementation Example

### Main Document Page

```typescript
// app/document/[id]/page.tsx
'use client'

import { YjsProvider } from '@/hooks/useYjs'
import { DocumentCanvas } from '@/components/DocumentCanvas'
import { DocumentStatusToolbar } from '@/components/DocumentStatusToolbar'
import { EnhancedPresence } from '@/components/EnhancedPresence'
import { validateEnvironment } from '@/lib/Env'

// Validate environment on page load
validateEnvironment()

function DocumentContent({ documentName }: { documentName: string }) {
  return (
    <YjsProvider documentName={documentName}>
      <div className="h-screen flex flex-col">
        {/* Top toolbar */}
        <div className="flex items-center justify-between p-4 bg-white border-b">
          <DocumentStatusToolbar documentName={documentName} />
        </div>
        
        {/* Main content */}
        <div className="flex flex-1">
          {/* Canvas */}
          <div className="flex-1">
            <DocumentCanvas />
          </div>
          
          {/* Presence sidebar */}
          <div className="w-80 bg-white border-l p-4">
            <EnhancedPresence />
          </div>
        </div>
      </div>
    </YjsProvider>
  )
}

export default function DocumentPage({ params }: { params: { id: string } }) {
  const documentName = params.id || 'default-document'
  
  return <DocumentContent documentName={documentName} />
}
```

## 🔧 Key Implementation Notes

### 1. **Provider Order Matters**
- IndexedDB loads first (offline support)
- Hocuspocus provides authoritative sync
- WebRTC enables P2P for low latency

### 2. **Awareness Integration**
- Use Hocuspocus awareness for user presence
- WebRTC awareness is optional for P2P-only features
- Always clean up awareness state on unmount

### 3. **Connection Resilience**
- IndexedDB provides offline fallback
- Hocuspocus handles reconnection automatically
- WebRTC connections are ephemeral and rebuild as needed

### 4. **State Management**
- Valtio provides reactive UI updates
- Yjs handles conflict-free collaboration
- Sync Yjs changes to Valtio for UI reactivity

### 5. **Error Handling**
- Always handle connection failures gracefully
- Provide user feedback for connection status
- Implement fallback strategies for offline scenarios

## 🎯 Best Practices & Troubleshooting

### Performance Optimization

```typescript
// Optimize cursor updates with throttling
export const useThrottledCursorTracking = () => {
  const awareness = useAwareness()
  const { user } = useAuth()
  const lastUpdateRef = useRef(0)
  const THROTTLE_MS = 16 // ~60fps

  useEffect(() => {
    if (!awareness || !user) return

    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now()
      if (now - lastUpdateRef.current < THROTTLE_MS) return
      
      lastUpdateRef.current = now
      
      const rect = (event.target as Element)?.getBoundingClientRect()
      if (!rect) return

      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height

      awareness.setLocalStateField('cursor', { x, y })
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      awareness.setLocalStateField('cursor', null)
    }
  }, [awareness, user])
}
```

### Error Handling & Recovery

```typescript
// Enhanced error handling for presence
export const usePresenceWithErrorHandling = () => {
  const { user } = useAuth()
  const ydoc = useYDoc()
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ydoc || !user) return

    try {
      const provider = (ydoc as any)._hocuspocusProvider
      if (!provider || !provider.awareness) {
        setError('Awareness not available')
        return
      }

      const awareness = provider.awareness
      setError(null)

      // Set up error handling for awareness
      awareness.on('error', (error: any) => {
        console.error('Awareness error:', error)
        setError('Presence sync error')
      })

      // Rest of presence logic...
      
    } catch (error) {
      console.error('Presence setup error:', error)
      setError('Failed to initialize presence')
    }
  }, [ydoc, user])

  return { onlineUsers, error }
}
```

### Connection Quality Monitoring

```typescript
// Monitor connection quality
export const useConnectionQuality = () => {
  const ydoc = useYDoc()
  const [quality, setQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('offline')

  useEffect(() => {
    if (!ydoc) return

    const hocuspocusProvider = (ydoc as any)._hocuspocusProvider
    const webrtcProvider = (ydoc as any)._webrtcProvider

    const updateQuality = () => {
      const hocuspocusStatus = hocuspocusProvider.status
      const webrtcConnections = webrtcProvider.room?.webrtcConns?.size || 0
      
      if (hocuspocusStatus === 'connected' && webrtcConnections > 0) {
        setQuality('excellent')
      } else if (hocuspocusStatus === 'connected') {
        setQuality('good')
      } else if (hocuspocusStatus === 'connecting') {
        setQuality('poor')
      } else {
        setQuality('offline')
      }
    }

    hocuspocusProvider.on('status', updateQuality)
    webrtcProvider.on('peers', updateQuality)
    
    updateQuality()

    return () => {
      hocuspocusProvider.off('status', updateQuality)
      webrtcProvider.off('peers', updateQuality)
    }
  }, [ydoc])

  return quality
}
```

### Common Issues & Solutions

#### Issue: Cursors not appearing
**Solution:**
```typescript
// Ensure awareness is properly initialized
useEffect(() => {
  if (!awareness) {
    console.warn('Awareness not available - cursors will not work')
    return
  }
  
  // Set up cursor tracking only after awareness is ready
  const setupCursorTracking = () => {
    // Cursor tracking logic here
  }
  
  if (awareness.getStates().size > 0) {
    setupCursorTracking()
  } else {
    awareness.on('change', setupCursorTracking)
  }
}, [awareness])
```

#### Issue: Presence not syncing across clients
**Solution:**
```typescript
// Ensure proper cleanup and re-initialization
useEffect(() => {
  if (!awareness || !user) return

  // Clear any existing state first
  awareness.setLocalState(null)
  
  // Set up new state
  const localState = {
    name: user.name,
    email: user.email,
    // ... other fields
  }
  
  awareness.setLocalState(localState)
  
  return () => {
    awareness.setLocalState(null)
  }
}, [awareness, user])
```

#### Issue: WebRTC connections failing
**Solution:**
```typescript
// Add connection retry logic
const webrtcProvider = new WebrtcProvider(documentName, ydoc, {
  ...webrtcOptions,
  // Add retry configuration
  maxConns: 20,
  filterBcConns: false,
  // Add connection timeout
  connectionTimeout: 10000,
})

// Handle connection failures
webrtcProvider.on('connection-error', ({ error }) => {
  console.error('WebRTC connection failed:', error)
  // Implement retry logic if needed
})
```

### Testing Presence & Cursors

```typescript
// Test utilities for presence
export const usePresenceDebug = () => {
  const awareness = useAwareness()
  
  useEffect(() => {
    if (!awareness) return

    const logAwarenessState = () => {
      const states = awareness.getStates()
      console.log('Awareness states:', Array.from(states.entries()))
    }

    awareness.on('change', logAwarenessState)
    logAwarenessState()

    return () => awareness.off('change', logAwarenessState)
  }, [awareness])
}

// Test cursor tracking
export const useCursorDebug = () => {
  const awareness = useAwareness()
  
  useEffect(() => {
    if (!awareness) return

    const logCursorUpdates = () => {
      const states = awareness.getStates()
      states.forEach((state, clientId) => {
        if (state.cursor) {
          console.log(`Client ${clientId} cursor:`, state.cursor)
        }
      })
    }

    awareness.on('change', logCursorUpdates)
    
    return () => awareness.off('change', logCursorUpdates)
  }, [awareness])
}
```

This implementation provides a robust foundation for real-time collaborative applications with both server-backed reliability and P2P performance benefits.

## 📚 Additional Resources

- **Yjs Documentation**: https://docs.yjs.dev/
- **Hocuspocus Provider**: https://github.com/ueberdosis/hocuspocus
- **WebRTC Provider**: https://github.com/yjs/y-webrtc
- **Valtio State Management**: https://valtio.pmnd.rs/
- **Supabase Real-time**: https://supabase.com/docs/guides/realtime
