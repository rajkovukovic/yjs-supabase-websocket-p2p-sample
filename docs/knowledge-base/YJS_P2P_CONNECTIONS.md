# Yjs Peer-to-Peer Connections - Complete Developer Guide

**Last Updated**: 2025-10-11  
**Yjs Version**: 13.6+  
**y-webrtc Version**: 10.3.0+

A comprehensive guide to implementing, debugging, and troubleshooting peer-to-peer connections in Yjs applications using WebRTC.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [How Yjs P2P Works](#how-yjs-p2p-works)
3. [WebRTC Fundamentals](#webrtc-fundamentals)
4. [Signaling Server](#signaling-server)
5. [Client Implementation](#client-implementation)
6. [Configuration Best Practices](#configuration-best-practices)
7. [Connection Patterns](#connection-patterns)
8. [Debugging Guide](#debugging-guide)
9. [Common Issues & Solutions](#common-issues--solutions)
10. [Production Deployment](#production-deployment)
11. [Performance & Optimization](#performance--optimization)
12. [Security Considerations](#security-considerations)

---

## Architecture Overview

### Three-Layer Sync Architecture

Yjs supports multiple sync mechanisms that work together:

```
┌─────────────────────────────────────────────────────────┐
│                    Client Application                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  IndexedDB  │  │  WebSocket  │  │   WebRTC    │     │
│  │ Persistence │  │   (Server)  │  │    (P2P)    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│       ▲                 ▲                 ▲              │
│       │                 │                 │              │
│       │                 │                 │              │
│       ▼                 ▼                 ▼              │
│  ┌──────────────────────────────────────────────┐      │
│  │            Y.Doc (CRDT Document)              │      │
│  └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

**Benefits of Multi-Provider Setup**:
1. **Offline Support**: IndexedDB caches document locally
2. **Reliability**: WebSocket provides authoritative source
3. **Performance**: P2P reduces server load and latency
4. **Scalability**: Most traffic goes peer-to-peer

### Why P2P Matters

| Metric | Server-Only | With P2P |
|--------|-------------|----------|
| Latency | 50-200ms | 10-50ms (direct) |
| Server Load | 100% | 20-40% |
| Bandwidth Cost | High | Low |
| Offline Sync | Delayed | Immediate (local network) |
| Scalability | Linear cost | Sub-linear cost |

---

## How Yjs P2P Works

### High-Level Flow

```
┌─────────┐                 ┌──────────────┐                ┌─────────┐
│ Client A│                 │   Signaling   │                │ Client B│
│         │                 │    Server     │                │         │
└────┬────┘                 └───────┬───────┘                └────┬────┘
     │                              │                             │
     │ 1. Connect to signaling      │                             │
     ├─────────────────────────────>│                             │
     │                              │                             │
     │                              │  2. Connect to signaling    │
     │                              │<────────────────────────────┤
     │                              │                             │
     │ 3. Subscribe to room         │                             │
     ├─────────────────────────────>│                             │
     │                              │                             │
     │                              │  4. Subscribe to room       │
     │                              │<────────────────────────────┤
     │                              │                             │
     │ 5. Announce presence         │                             │
     ├─────────────────────────────>│                             │
     │                              │                             │
     │                              │  6. Forward announce        │
     │                              ├────────────────────────────>│
     │                              │                             │
     │  7. WebRTC offer             │                             │
     ├─────────────────────────────>│  8. Forward offer          │
     │                              ├────────────────────────────>│
     │                              │                             │
     │                              │  9. WebRTC answer           │
     │  10. Forward answer          │<────────────────────────────┤
     │<─────────────────────────────┤                             │
     │                              │                             │
     │ 11. ICE candidate exchange   │                             │
     │<────────────────────────────────────────────────────────>│
     │                              │                             │
     │ 12. Direct P2P Connection Established                     │
     │<═══════════════════════════════════════════════════════>│
     │                              │                             │
     │ (Signaling no longer needed) │                             │
     │                              │                             │
```

### Key Phases

#### Phase 1: Signaling Connection
- Clients connect to signaling server via WebSocket
- Server manages rooms (topics) and peer lists
- Uses JSON messages for peer discovery

#### Phase 2: Peer Discovery
- Clients announce presence to room
- Signaling server forwards announcements to other peers
- Each client learns about other peers in the room

#### Phase 3: WebRTC Negotiation
- Initiator creates offer (SDP - Session Description Protocol)
- Offer exchanged via signaling server
- Responder creates answer
- Answer exchanged via signaling server

#### Phase 4: ICE Connection
- Both peers gather ICE candidates (connection methods)
- Candidates exchanged via signaling server
- WebRTC tries each candidate until connection succeeds
- Once connected, signaling server no longer needed

#### Phase 5: Data Synchronization
- Yjs document updates sent directly peer-to-peer
- CRDT ensures consistency without coordination
- Awareness (cursors, presence) shared via same channel

---

## WebRTC Fundamentals

### Understanding ICE, STUN, and TURN

WebRTC uses **ICE (Interactive Connectivity Establishment)** to find the best way to connect peers.

#### ICE Candidate Types

```
┌────────────────────────────────────────────────────────────┐
│                    Connection Hierarchy                     │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Host Candidate (Best)                                   │
│     ┌──────────┐ ←─ Direct ─→ ┌──────────┐                │
│     │ Client A │   Local LAN   │ Client B │                │
│     └──────────┘               └──────────┘                │
│     Latency: 1-5ms                                          │
│                                                              │
│  2. Server Reflexive (srflx) - via STUN                     │
│     ┌──────────┐               ┌──────────┐                │
│     │ Client A │ ←─ Internet ─→ │ Client B │                │
│     └──────────┘               └──────────┘                │
│          ↑                            ↑                     │
│          └──── STUN Server helps ─────┘                     │
│                discover public IPs                          │
│     Latency: 10-50ms                                        │
│                                                              │
│  3. Relay (relay) - via TURN (Worst)                        │
│     ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│     │ Client A │ ──→ │   TURN   │ ──→ │ Client B │          │
│     └──────────┘    │  Server  │    └──────────┘          │
│                     └──────────┘                            │
│     Latency: 50-150ms                                       │
│     (Used when direct connection impossible)                │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

#### STUN (Session Traversal Utilities for NAT)

**Purpose**: Help peers discover their public IP addresses

**How it works**:
```javascript
// Client behind NAT
Private IP: 192.168.1.100

// STUN server tells client its public IP
Public IP: 203.0.113.45:54321

// Now client can share this with peers
```

**Public STUN Servers**:
```javascript
{ urls: 'stun:stun.l.google.com:19302' }
{ urls: 'stun:stun1.l.google.com:19302' }
{ urls: 'stun:stun.services.mozilla.com' }
```

**Cost**: Free (lightweight, just IP discovery)

#### TURN (Traversal Using Relays around NAT)

**Purpose**: Relay traffic when direct connection impossible

**When needed**:
- Symmetric NAT (can't be traversed)
- Restrictive corporate firewalls
- Mobile carrier networks with NAT
- VPN connections

**How it works**:
```javascript
// Instead of direct connection:
Client A ─────────────× (blocked) ×───────────── Client B

// TURN relays the traffic:
Client A ────→ TURN Server ────→ Client B
```

**Public TURN Servers**:
```javascript
{
  urls: 'turn:openrelay.metered.ca:80',
  username: 'openrelayproject',
  credential: 'openrelayproject'
}
```

**Cost**: 
- Free (public): Limited bandwidth, shared
- Paid (Twilio, Xirsys): ~$0.40-$1.00 per GB relayed

#### NAT Types & Connection Success

| NAT Type | Direct P2P | Via STUN | Via TURN | Frequency |
|----------|------------|----------|----------|-----------|
| Full Cone | ✅ 100% | ✅ 100% | ✅ 100% | 5% |
| Restricted Cone | ✅ 90% | ✅ 95% | ✅ 100% | 30% |
| Port Restricted | ⚠️ 50% | ✅ 85% | ✅ 100% | 40% |
| Symmetric | ❌ 0% | ⚠️ 30% | ✅ 100% | 25% |

**Key Insight**: TURN servers increase connection success rate from ~60% to ~95%+

---

## Signaling Server

### Official Implementation

The official y-webrtc signaling server (`node_modules/y-webrtc/bin/server.js`):

```javascript
#!/usr/bin/env node

import { WebSocketServer } from 'ws'
import http from 'http'
import * as map from 'lib0/map'

const pingTimeout = 30000
const port = process.env.PORT || 4444

// Create HTTP server (for health checks)
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('okay')
})

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true })

// Map from topic-name to set of subscribed clients
const topics = new Map()

// Send JSON message to a connection
const send = (conn, message) => {
  if (conn.readyState !== wsReadyStateOpen) {
    conn.close()
  }
  try {
    conn.send(JSON.stringify(message))
  } catch (e) {
    conn.close()
  }
}

// Setup a new client connection
const onconnection = conn => {
  const subscribedTopics = new Set()
  let closed = false
  let pongReceived = true
  
  // Keepalive ping/pong
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      conn.close()
      clearInterval(pingInterval)
    } else {
      pongReceived = false
      conn.ping()
    }
  }, pingTimeout)
  
  conn.on('pong', () => {
    pongReceived = true
  })
  
  conn.on('close', () => {
    // Remove from all subscribed topics
    subscribedTopics.forEach(topicName => {
      const subs = topics.get(topicName)
      if (subs) {
        subs.delete(conn)
        if (subs.size === 0) {
          topics.delete(topicName)
        }
      }
    })
    closed = true
  })
  
  conn.on('message', message => {
    message = JSON.parse(message)
    
    if (message && message.type && !closed) {
      switch (message.type) {
        case 'subscribe':
          // Add connection to topics
          (message.topics || []).forEach(topicName => {
            const topic = map.setIfUndefined(topics, topicName, () => new Set())
            topic.add(conn)
            subscribedTopics.add(topicName)
          })
          break
          
        case 'unsubscribe':
          // Remove connection from topics
          (message.topics || []).forEach(topicName => {
            const subs = topics.get(topicName)
            if (subs) {
              subs.delete(conn)
            }
          })
          break
          
        case 'publish':
          // Forward message to all peers in topic (except sender)
          if (message.topic) {
            const receivers = topics.get(message.topic)
            if (receivers) {
              message.clients = receivers.size
              receivers.forEach(receiver => {
                if (receiver !== conn) {
                  send(receiver, message)
                }
              })
            }
          }
          break
          
        case 'ping':
          send(conn, { type: 'pong' })
          break
      }
    }
  })
}

wss.on('connection', onconnection)

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, ws => {
    wss.emit('connection', ws, request)
  })
})

server.listen(port)
console.log('Signaling server running on localhost:', port)
```

### Message Protocol

#### Subscribe to Room

**Client → Server**:
```json
{
  "type": "subscribe",
  "topics": ["room-name"]
}
```

**Purpose**: Join a room to receive announcements from other peers

#### Unsubscribe from Room

**Client → Server**:
```json
{
  "type": "unsubscribe",
  "topics": ["room-name"]
}
```

#### Announce Presence

**Client → Server**:
```json
{
  "type": "publish",
  "topic": "room-name",
  "data": {
    "type": "announce",
    "from": "peer-uuid-123"
  }
}
```

**Server → Other Clients**:
```json
{
  "type": "publish",
  "topic": "room-name",
  "data": {
    "type": "announce",
    "from": "peer-uuid-123"
  },
  "clients": 3
}
```

#### WebRTC Signal Exchange

**Offer** (Client A → Server → Client B):
```json
{
  "type": "publish",
  "topic": "room-name",
  "data": {
    "type": "signal",
    "from": "peer-uuid-A",
    "to": "peer-uuid-B",
    "signal": {
      "type": "offer",
      "sdp": "v=0\r\no=- ... (SDP data)"
    },
    "token": 1234567890.123  // Glare resolution token
  }
}
```

**Answer** (Client B → Server → Client A):
```json
{
  "type": "publish",
  "topic": "room-name",
  "data": {
    "type": "signal",
    "from": "peer-uuid-B",
    "to": "peer-uuid-A",
    "signal": {
      "type": "answer",
      "sdp": "v=0\r\na=... (SDP data)"
    },
    "token": 1234567890.456
  }
}
```

**ICE Candidate**:
```json
{
  "type": "publish",
  "topic": "room-name",
  "data": {
    "type": "signal",
    "from": "peer-uuid-A",
    "to": "peer-uuid-B",
    "signal": {
      "type": "candidate",
      "candidate": "candidate:... (ICE candidate data)",
      "sdpMLineIndex": 0,
      "sdpMid": "0"
    }
  }
}
```

#### Keepalive

**Client → Server**:
```json
{
  "type": "ping"
}
```

**Server → Client**:
```json
{
  "type": "pong"
}
```

**Frequency**: Every 30 seconds (server closes connection if no pong received)

### Deployment Options

#### Option 1: Use Official Server

```bash
# Install y-webrtc
npm install y-webrtc

# Run signaling server
PORT=4444 node node_modules/y-webrtc/bin/server.js
```

#### Option 2: Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

RUN npm install -g y-webrtc

EXPOSE 4444

CMD ["node", "/usr/local/lib/node_modules/y-webrtc/bin/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  y-webrtc-signaling:
    build: .
    ports:
      - "4444:4444"
    environment:
      - PORT=4444
    restart: unless-stopped
```

#### Option 3: Production with SSL

```javascript
// server.js with SSL
import { WebSocketServer } from 'ws'
import https from 'https'
import fs from 'fs'

const server = https.createServer({
  cert: fs.readFileSync('/path/to/cert.pem'),
  key: fs.readFileSync('/path/to/key.pem')
})

const wss = new WebSocketServer({ server })
// ... rest of implementation
```

---

## Client Implementation

### Basic Setup

```typescript
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'

// Create Yjs document
const ydoc = new Y.Doc()

// IndexedDB for offline persistence
const indexeddbProvider = new IndexeddbPersistence('document-name', ydoc)

// WebRTC provider for P2P
const webrtcProvider = new WebrtcProvider(
  'room-name',  // Room to join
  ydoc,         // Yjs document
  {
    signaling: ['ws://localhost:4444'],  // Signaling server(s)
    peerOpts: {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    }
  }
)
```

### Complete Configuration

```typescript
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { awarenessProtocol } from 'y-protocols/awareness'

const ydoc = new Y.Doc()

// Create custom awareness (for cursors, presence)
const awareness = new awarenessProtocol.Awareness(ydoc)

// Set local user info
awareness.setLocalState({
  user: {
    name: 'John Doe',
    color: '#ff0000',
    cursor: { x: 0, y: 0 }
  }
})

// WebRTC provider with full configuration
const webrtcProvider = new WebrtcProvider(
  'my-document-room',
  ydoc,
  {
    // Signaling servers (can specify multiple for redundancy)
    signaling: [
      'wss://signaling1.example.com',
      'wss://signaling2.example.com'
    ],
    
    // Optional: password for end-to-end encryption
    password: 'secret-room-password',
    
    // Share awareness with provider
    awareness: awareness,
    
    // Maximum number of peer connections
    // Default: 20 + random(15) to prevent clustering
    maxConns: 30,
    
    // Filter broadcast channel connections
    // Set false to allow same-browser tab connections
    filterBcConns: false,
    
    // simple-peer options
    peerOpts: {
      // Enable trickle ICE (send candidates as they're discovered)
      trickle: true,
      
      // RTCPeerConnection configuration
      config: {
        // ICE servers (STUN + TURN)
        iceServers: [
          // Google STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          
          // Mozilla STUN
          { urls: 'stun:stun.services.mozilla.com' },
          
          // TURN servers (for NAT traversal)
          {
            urls: 'turn:turn.example.com:3478',
            username: 'username',
            credential: 'password'
          },
          {
            urls: 'turn:turn.example.com:3478?transport=tcp',
            username: 'username',
            credential: 'password'
          }
        ],
        
        // ICE transport policy
        // 'all' - use all candidates (host, srflx, relay)
        // 'relay' - force TURN relay (for privacy)
        iceTransportPolicy: 'all',
        
        // Bundle policy
        // 'max-bundle' - bundle all media on single transport
        bundlePolicy: 'max-bundle',
        
        // RTCP mux policy
        // 'require' - multiplex RTP and RTCP (better NAT traversal)
        rtcpMuxPolicy: 'require'
      }
    }
  }
)

// Event listeners
webrtcProvider.on('status', ({ connected }) => {
  console.log('WebRTC status:', connected ? 'connected' : 'disconnected')
})

webrtcProvider.on('synced', ({ synced }) => {
  console.log('WebRTC synced:', synced)
})

webrtcProvider.on('peers', ({ added, removed, webrtcPeers, bcPeers }) => {
  console.log('Peers changed:', {
    added,      // Array of peer IDs added
    removed,    // Array of peer IDs removed
    webrtcPeers,  // All WebRTC peers
    bcPeers     // All BroadcastChannel peers
  })
})

// Cleanup
const cleanup = () => {
  webrtcProvider.destroy()
  ydoc.destroy()
}
```

### Provider Options Reference

```typescript
interface WebrtcProviderOptions {
  // Signaling server URLs
  signaling?: string[]  // Default: ['wss://y-webrtc-eu.fly.dev']
  
  // End-to-end encryption password
  password?: string | null  // Default: null
  
  // Awareness instance (for cursors, presence)
  awareness?: Awareness  // Default: new Awareness(doc)
  
  // Maximum WebRTC connections
  maxConns?: number  // Default: 20 + random(0-15)
  
  // Filter BroadcastChannel connections
  filterBcConns?: boolean  // Default: true
  
  // simple-peer options
  peerOpts?: {
    initiator?: boolean
    trickle?: boolean
    config?: RTCConfiguration
    // ... other simple-peer options
  }
}
```

---

## Configuration Best Practices

### Development Configuration

```typescript
const webrtcProvider = new WebrtcProvider('dev-room', ydoc, {
  signaling: ['ws://localhost:4444'],
  peerOpts: {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    }
  },
  filterBcConns: false  // Allow same-browser tabs
})
```

**Why**:
- Local signaling server
- Minimal STUN configuration
- BroadcastChannel enabled for multi-tab testing

### Production Configuration

```typescript
const webrtcProvider = new WebrtcProvider('prod-room', ydoc, {
  signaling: [
    'wss://signaling1.example.com',
    'wss://signaling2.example.com'  // Redundant server
  ],
  password: process.env.ROOM_PASSWORD,  // E2E encryption
  maxConns: 30,
  filterBcConns: true,
  peerOpts: {
    trickle: true,
    config: {
      iceServers: [
        // Multiple STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        
        // Dedicated TURN servers
        {
          urls: 'turn:turn1.example.com:443',
          username: 'turn-user',
          credential: 'turn-pass'
        },
        {
          urls: 'turn:turn2.example.com:443',
          username: 'turn-user',
          credential: 'turn-pass'
        },
        {
          urls: 'turn:turn1.example.com:443?transport=tcp',
          username: 'turn-user',
          credential: 'turn-pass'
        }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    }
  }
})
```

**Why**:
- Redundant signaling servers
- E2E encryption
- Multiple STUN/TURN servers
- TCP fallback for restricted networks

### Mobile/Restrictive Network Configuration

```typescript
const webrtcProvider = new WebrtcProvider('mobile-room', ydoc, {
  signaling: ['wss://signaling.example.com'],
  maxConns: 10,  // Fewer connections to save bandwidth
  peerOpts: {
    config: {
      iceServers: [
        // Prioritize TURN servers
        {
          urls: 'turn:turn.example.com:443',
          username: 'user',
          credential: 'pass'
        },
        {
          urls: 'turn:turn.example.com:443?transport=tcp',
          username: 'user',
          credential: 'pass'
        },
        // STUN as fallback
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      // Can force TURN for privacy
      // iceTransportPolicy: 'relay'
    }
  }
})
```

---

## Connection Patterns

### Pattern 1: Hybrid (WebSocket + WebRTC)

**Use Case**: Maximum reliability + performance

```typescript
import { HocuspocusProvider } from '@hocuspocus/provider'
import { WebrtcProvider } from 'y-webrtc'

const ydoc = new Y.Doc()

// WebSocket for reliability
const hocuspocusProvider = new HocuspocusProvider({
  url: 'wss://sync.example.com',
  name: 'document-id',
  document: ydoc
})

// WebRTC for performance
const webrtcProvider = new WebrtcProvider('document-id', ydoc, {
  signaling: ['wss://signaling.example.com'],
  awareness: hocuspocusProvider.awareness  // Share awareness
})
```

**Benefits**:
- WebSocket ensures everyone gets updates (authoritative)
- WebRTC reduces latency and server load
- Awareness shared between both providers

### Pattern 2: P2P Only

**Use Case**: Privacy, no server dependency

```typescript
const webrtcProvider = new WebrtcProvider('room-name', ydoc, {
  signaling: ['wss://signaling.example.com'],
  password: 'end-to-end-encrypted'  // E2E encryption
})
```

**Benefits**:
- No document stored on server
- End-to-end encrypted
- Lower operational cost

**Drawbacks**:
- Requires at least 2 peers online
- No historical data without IndexedDB
- Higher client bandwidth usage

### Pattern 3: BroadcastChannel Only

**Use Case**: Same browser, multiple tabs

```typescript
const webrtcProvider = new WebrtcProvider('room-name', ydoc, {
  signaling: [],  // No signaling server
  filterBcConns: false
})
```

**Benefits**:
- Zero latency (< 1ms)
- No network needed
- Instant sync across tabs

**Limitations**:
- Only works within same browser
- No cross-device sync

---

## Debugging Guide

### Connection State Monitoring

```typescript
const webrtcProvider = new WebrtcProvider('room', ydoc, options)

// Expose for debugging
if (typeof window !== 'undefined') {
  window.__WEBRTC_PROVIDER__ = webrtcProvider
  window.__YDOC__ = ydoc
}

// Monitor events
webrtcProvider.on('status', ({ connected }) => {
  console.log('Status:', connected ? 'connected' : 'disconnected')
})

webrtcProvider.on('peers', ({ webrtcPeers, webrtcConns, bcConns, added, removed }) => {
  console.log('Peers event:', {
    p2pConnections: Object.keys(webrtcConns || {}).length,
    broadcastConnections: bcConns?.size || 0,
    discoveredPeers: webrtcPeers?.length || 0,
    peersAdded: added,
    peersRemoved: removed
  })
})

webrtcProvider.on('synced', ({ synced }) => {
  console.log('Synced:', synced)
})

// Access internal state (for debugging)
setTimeout(() => {
  const room = webrtcProvider.room
  
  if (room) {
    console.log('Room state:', {
      peerId: room.peerId,
      roomName: room.name,
      synced: room.synced,
      webrtcConns: room.webrtcConns.size,
      bcConns: room.bcConns.size
    })
    
    // Inspect WebRTC peer connections
    room.webrtcConns.forEach((conn, peerId) => {
      console.log(`Peer ${peerId}:`, {
        connected: conn.connected,
        synced: conn.synced,
        closed: conn.closed
      })
      
      // Access RTCPeerConnection
      if (conn.peer && conn.peer._pc) {
        const pc = conn.peer._pc
        console.log('RTCPeerConnection:', {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          iceGatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState
        })
      }
    })
  }
}, 5000)
```

### ICE State Monitoring

```typescript
const monitorICEState = (webrtcProvider) => {
  setTimeout(() => {
    const room = webrtcProvider.room
    if (!room) return
    
    room.webrtcConns.forEach((conn, peerId) => {
      if (conn.peer && conn.peer._pc) {
        const pc = conn.peer._pc
        
        pc.addEventListener('iceconnectionstatechange', () => {
          console.log(`[${peerId}] ICE state: ${pc.iceConnectionState}`)
          
          switch (pc.iceConnectionState) {
            case 'checking':
              console.log('  → Trying to establish connection...')
              break
            case 'connected':
              console.log('  ✅ Connection established')
              break
            case 'completed':
              console.log('  ✅ All candidates processed')
              break
            case 'failed':
              console.error('  ❌ Connection failed')
              console.log('  Possible causes:')
              console.log('    - NAT/Firewall blocking')
              console.log('    - STUN servers unreachable')
              console.log('    - TURN server needed')
              break
            case 'disconnected':
              console.warn('  ⚠️ Connection lost')
              break
            case 'closed':
              console.log('  Connection closed')
              break
          }
        })
        
        pc.addEventListener('icecandidate', (event) => {
          if (event.candidate) {
            console.log(`[${peerId}] ICE candidate:`, {
              type: event.candidate.type,        // host, srflx, relay
              protocol: event.candidate.protocol, // udp, tcp
              address: event.candidate.address,
              port: event.candidate.port
            })
          }
        })
        
        pc.addEventListener('connectionstatechange', () => {
          console.log(`[${peerId}] Connection state: ${pc.connectionState}`)
        })
      }
    })
  }, 2000)
}

monitorICEState(webrtcProvider)
```

### Browser DevTools

#### Chrome: chrome://webrtc-internals

1. Open `chrome://webrtc-internals` in a new tab
2. Find your peer connections
3. Monitor:
   - ICE candidate pairs
   - Connection statistics
   - Packet loss, jitter, latency
   - Bandwidth usage

#### Firefox: about:webrtc

1. Open `about:webrtc` in a new tab
2. View:
   - Connection log
   - ICE statistics
   - Media statistics
   - Certificates

### Signaling Server Logs

```bash
# Enable verbose logging
VERBOSE=true PORT=4444 node server.js

# Monitor connections
[Y-WebRTC] Client connected
[Y-WebRTC] Client subscribing to room: my-room
[Y-WebRTC] Client publishing to room: my-room
[Y-WebRTC] Client disconnected
```

### Common Debug Patterns

```typescript
// 1. Check if signaling is working
webrtcProvider.signalingConns.forEach(conn => {
  console.log('Signaling connection:', {
    url: conn.url,
    connected: conn.connected
  })
})

// 2. Check if peers are discovered
console.log('Discovered peers:', webrtcProvider.room?.webrtcConns.size)

// 3. Check awareness
const awareness = webrtcProvider.awareness
console.log('Awareness states:', {
  myClientId: awareness.clientID,
  allClients: Array.from(awareness.getStates().keys()),
  myState: awareness.getLocalState()
})

// 4. Check document sync
const ytext = ydoc.getText('test')
ytext.observe(event => {
  console.log('Document changed:', event.changes.delta)
})
```

---

## Common Issues & Solutions

### Issue 1: Peers Discovered But Not Connecting

**Symptoms**:
```javascript
discoveredPeers: 2
p2pConnections: 0
iceConnectionState: "failed"
```

**Causes**:
1. NAT/Firewall blocking WebRTC
2. STUN servers unreachable
3. Need TURN server

**Solutions**:

```typescript
// Add TURN servers
peerOpts: {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  }
}
```

### Issue 2: No Peer Discovery

**Symptoms**:
```javascript
discoveredPeers: 0
signalingConnected: true
```

**Causes**:
1. Not in same room
2. Signaling server protocol mismatch
3. Firewall blocking WebSocket

**Solutions**:

```typescript
// 1. Verify room name matches
const roomName = 'my-room'  // Must be identical

// 2. Check signaling connection
webrtcProvider.signalingConns.forEach(conn => {
  console.log('Signaling:', conn.url, conn.connected)
})

// 3. Test signaling server
fetch('http://localhost:4444')
  .then(() => console.log('Signaling server reachable'))
  .catch(e => console.error('Signaling server unreachable:', e))
```

### Issue 3: Connection Works Locally But Not Remotely

**Causes**:
1. Different networks with symmetric NAT
2. TURN server needed
3. Corporate firewall blocking WebRTC

**Solutions**:

```typescript
// Use reliable TURN servers
peerOpts: {
  config: {
    iceServers: [
      // Multiple TURN servers for redundancy
      {
        urls: 'turn:turn1.example.com:443',
        username: 'user',
        credential: 'pass'
      },
      {
        urls: 'turn:turn1.example.com:443?transport=tcp',
        username: 'user',
        credential: 'pass'
      }
    ]
  }
}

// Or force TURN (for testing)
peerOpts: {
  config: {
    iceTransportPolicy: 'relay'  // Only use TURN
  }
}
```

### Issue 4: High CPU/Bandwidth Usage

**Causes**:
1. Too many peer connections
2. Large document syncing repeatedly
3. Awareness updates too frequent

**Solutions**:

```typescript
// Limit peer connections
maxConns: 10  // Default is 20+random(15)

// Throttle awareness updates
let awarenessThrottle = null
const updateAwareness = (state) => {
  clearTimeout(awarenessThrottle)
  awarenessThrottle = setTimeout(() => {
    awareness.setLocalState(state)
  }, 50)  // Update at most every 50ms
}

// Use filterBcConns to reduce connections
filterBcConns: true  // Filter same-browser connections
```

### Issue 5: Connection Drops Frequently

**Causes**:
1. Unstable network
2. Ping/pong timeout
3. Signaling server down

**Solutions**:

```typescript
// Monitor connection health
webrtcProvider.on('status', ({ connected }) => {
  if (!connected) {
    console.warn('WebRTC disconnected, attempting reconnect...')
    // Provider will auto-reconnect
  }
})

// Keep signaling connection alive
// (Already handled by provider's ping/pong)

// Add reconnection logic
let reconnectAttempts = 0
const maxReconnectAttempts = 5

webrtcProvider.on('status', ({ connected }) => {
  if (!connected) {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++
      console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`)
      
      setTimeout(() => {
        webrtcProvider.connect()
      }, 1000 * reconnectAttempts)
    }
  } else {
    reconnectAttempts = 0
  }
})
```

### Issue 6: "Glare" - Multiple Connection Attempts

**Symptoms**:
```javascript
console.log('offer rejected:', peerId)
```

**Explanation**:
When two peers try to initiate connection simultaneously (glare), y-webrtc uses token-based resolution.

**How it works**:
```typescript
// Each offer has a token (timestamp + random)
const glareToken = Date.now() + Math.random()

// If both send offers:
if (remoteToken > localToken) {
  // Accept remote offer, abandon local
} else {
  // Reject remote offer, continue with local
}
```

**No action needed** - this is normal behavior.

---

## Production Deployment

### Infrastructure Requirements

#### Signaling Server

**Minimum**:
- 1 CPU core
- 512 MB RAM
- 10 GB disk
- 100 Mbps network

**Recommended** (1000 concurrent users):
- 2 CPU cores
- 2 GB RAM
- 20 GB disk
- 1 Gbps network

**Scaling**:
- Signaling is lightweight (just forwarding messages)
- Horizontal scaling: Run multiple servers, clients pick randomly
- No shared state needed between servers

#### TURN Server

**Minimum**:
- 2 CPU cores
- 1 GB RAM
- 50 GB disk
- 1 Gbps network (high bandwidth!)

**Recommended** (100 relayed connections):
- 4 CPU cores
- 4 GB RAM
- 100 GB disk
- 10 Gbps network

**Bandwidth Cost**:
- Direct P2P: ~0.1-0.5 Mbps per connection
- TURN relay: ~0.5-2 Mbps per connection (2x traffic)
- Heavy use: Can reach 100+ GB/day

### TURN Server Setup (coturn)

```bash
# Install coturn
sudo apt-get install coturn

# Configure /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349

# Use fingerprints in TURN messages
fingerprint

# LT credentials mechanism
lt-cred-mech

# Realm
realm=turn.example.com

# User database
user=username:password

# External IP
external-ip=203.0.113.1

# Enable verbose logging
verbose

# SSL certificates
cert=/etc/letsencrypt/live/turn.example.com/cert.pem
pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem

# Start coturn
sudo systemctl start coturn
sudo systemctl enable coturn

# Test TURN server
npm install -g turn-test
turn-test turn.example.com username password
```

### Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  signaling:
    image: node:18-alpine
    working_dir: /app
    command: sh -c "npm install y-webrtc && node node_modules/y-webrtc/bin/server.js"
    ports:
      - "4444:4444"
    environment:
      - PORT=4444
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4444"]
      interval: 30s
      timeout: 10s
      retries: 3
  
  turn:
    image: coturn/coturn:latest
    network_mode: host
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf
      - ./certs:/etc/letsencrypt/live/turn.example.com
    restart: unless-stopped
```

### SSL/TLS Configuration

```nginx
# nginx.conf - Proxy for signaling server
server {
    listen 443 ssl http2;
    server_name signaling.example.com;
    
    ssl_certificate /etc/letsencrypt/live/signaling.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/signaling.example.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:4444;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

### Monitoring & Metrics

```javascript
// Track connection metrics
const metrics = {
  totalConnections: 0,
  directP2P: 0,
  stunRelayed: 0,
  turnRelayed: 0,
  connectionFailures: 0
}

webrtcProvider.on('peers', ({ webrtcConns }) => {
  metrics.totalConnections = Object.keys(webrtcConns || {}).length
})

// Monitor ICE candidates to track connection type
const room = webrtcProvider.room
if (room) {
  room.webrtcConns.forEach((conn) => {
    if (conn.peer && conn.peer._pc) {
      conn.peer._pc.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          switch (event.candidate.type) {
            case 'host':
              metrics.directP2P++
              break
            case 'srflx':
              metrics.stunRelayed++
              break
            case 'relay':
              metrics.turnRelayed++
              break
          }
        }
      })
      
      conn.peer._pc.addEventListener('iceconnectionstatechange', () => {
        if (conn.peer._pc.iceConnectionState === 'failed') {
          metrics.connectionFailures++
        }
      })
    }
  })
}

// Send metrics to monitoring service
setInterval(() => {
  sendToMonitoring(metrics)
}, 60000)
```

---

## Performance & Optimization

### Connection Pooling Strategy

```typescript
// Limit connections but maintain mesh topology
maxConns: 20 + Math.floor(Math.random() * 15)

// Why random?
// Prevents clustering where all peers connect to same subset
// Ensures better mesh coverage
```

### Awareness Optimization

```typescript
// Throttle awareness updates
class ThrottledAwareness {
  constructor(awareness, throttleMs = 50) {
    this.awareness = awareness
    this.throttleMs = throttleMs
    this.pending = null
    this.timeout = null
  }
  
  setLocalState(state) {
    this.pending = state
    
    if (!this.timeout) {
      this.timeout = setTimeout(() => {
        this.awareness.setLocalState(this.pending)
        this.timeout = null
        this.pending = null
      }, this.throttleMs)
    }
  }
}

const throttled = new ThrottledAwareness(awareness, 50)

// Use throttled updates for cursor movement
document.addEventListener('mousemove', (e) => {
  throttled.setLocalState({
    cursor: { x: e.clientX, y: e.clientY }
  })
})
```

### Document Size Management

```typescript
// Compress document updates before sending
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

// Periodically compact document
setInterval(() => {
  const state = Y.encodeStateAsUpdate(ydoc)
  const compacted = Y.encodeStateAsUpdate(ydoc, Y.encodeStateVector(ydoc))
  
  console.log('Document size:', {
    full: state.byteLength,
    compacted: compacted.byteLength,
    ratio: (compacted.byteLength / state.byteLength * 100).toFixed(1) + '%'
  })
}, 300000) // Every 5 minutes
```

### Network Bandwidth Optimization

```typescript
// Batch updates instead of sending immediately
let updateBatch = []
let batchTimeout = null

ydoc.on('update', (update) => {
  updateBatch.push(update)
  
  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      // Merge batched updates
      const mergedUpdate = Y.mergeUpdates(updateBatch)
      
      // Send merged update
      // (Provider handles this automatically)
      
      updateBatch = []
      batchTimeout = null
    }, 100) // Batch every 100ms
  }
})
```

### Connection Quality Monitoring

```typescript
const monitorConnectionQuality = (peer) => {
  if (!peer._pc) return
  
  setInterval(async () => {
    const stats = await peer._pc.getStats()
    
    stats.forEach(report => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        console.log('Connection quality:', {
          currentRTT: report.currentRoundTripTime,
          bytesReceived: report.bytesReceived,
          bytesSent: report.bytesSent,
          timestamp: report.timestamp
        })
      }
    })
  }, 5000)
}
```

---

## Security Considerations

### End-to-End Encryption

```typescript
// Room password provides E2E encryption
const webrtcProvider = new WebrtcProvider('room', ydoc, {
  password: 'strong-secret-password'
})
```

**How it works**:
1. Password is used to derive encryption key (via `crypto.deriveKey`)
2. All signaling messages are encrypted
3. Signaling server can't read content
4. Only peers with correct password can decrypt

**Key derivation**:
```javascript
// From y-webrtc source
import * as crypto from './crypto.js'

const key = await crypto.deriveKey(password, roomName)
// Uses PBKDF2 with salt = roomName
// 100,000 iterations
// Output: CryptoKey for AES-GCM
```

### Authentication & Authorization

```typescript
// Custom signaling server with auth
import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (request, socket, head) => {
  // Extract token from URL
  const url = new URL(request.url, 'ws://localhost')
  const token = url.searchParams.get('token')
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // Attach user info to socket
    request.userId = decoded.userId
    
    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request)
    })
  } catch (err) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
  }
})

// Client side
const token = await getAuthToken()
const webrtcProvider = new WebrtcProvider('room', ydoc, {
  signaling: [`wss://signaling.example.com?token=${token}`]
})
```

### Room Access Control

```typescript
// Server-side room validation
const validateRoomAccess = (userId, roomName) => {
  // Check if user has access to room
  return db.query(
    'SELECT 1 FROM room_access WHERE user_id = ? AND room_name = ?',
    [userId, roomName]
  )
}

wss.on('connection', (ws, request) => {
  ws.on('message', async (data) => {
    const message = JSON.parse(data)
    
    if (message.type === 'subscribe') {
      for (const roomName of message.topics) {
        const hasAccess = await validateRoomAccess(request.userId, roomName)
        
        if (!hasAccess) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Access denied to room: ' + roomName
          }))
          continue
        }
        
        // Allow subscription
        const room = getRoom(roomName)
        room.add(ws)
      }
    }
  })
})
```

### Rate Limiting

```typescript
// Prevent abuse of signaling server
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
})

app.use('/ws', limiter)
```

### Security Best Practices

1. **Use HTTPS/WSS in production**
   ```typescript
   signaling: ['wss://signaling.example.com']  // Not ws://
   ```

2. **Enable password for sensitive rooms**
   ```typescript
   password: crypto.randomBytes(32).toString('hex')
   ```

3. **Validate all inputs**
   ```typescript
   if (typeof message.type !== 'string') return
   if (message.topics && !Array.isArray(message.topics)) return
   ```

4. **Implement authentication**
   - JWT tokens in WebSocket URL
   - Session-based auth
   - OAuth integration

5. **Monitor for abuse**
   - Track connection patterns
   - Detect unusual message rates
   - IP-based blocking

6. **Regular security updates**
   ```bash
   npm audit
   npm update
   ```

---

## Advanced Topics

### Custom Signaling Protocol

```typescript
// Extend y-webrtc with custom signaling
import { WebrtcProvider, SignalingConn } from 'y-webrtc'

class CustomSignalingConn extends SignalingConn {
  constructor(url) {
    super(url)
    
    // Add custom message handling
    this.on('message', (m) => {
      if (m.type === 'custom') {
        this.handleCustomMessage(m)
      }
    })
  }
  
  handleCustomMessage(message) {
    console.log('Custom message:', message)
  }
  
  sendCustomMessage(data) {
    this.send({
      type: 'custom',
      data
    })
  }
}
```

### Multiple Signaling Servers

```typescript
// Automatic failover between servers
const webrtcProvider = new WebrtcProvider('room', ydoc, {
  signaling: [
    'wss://signaling1.example.com',
    'wss://signaling2.example.com',
    'wss://signaling3.example.com'
  ]
})

// Provider automatically:
// 1. Connects to all servers
// 2. Uses first successful connection
// 3. Falls back if one fails
```

### Connection Topology

```typescript
// Full mesh (default)
// Everyone connects to everyone
maxConns: 999999  // Unlimited

// Partial mesh (recommended)
// Random subset of connections
maxConns: 20 + Math.random() * 15

// Star topology (custom)
// One "hub" peer, others connect to hub only
// Requires custom implementation

// Hybrid mesh
// Hub peers have more connections
const isHub = checkIfHub(userId)
maxConns: isHub ? 100 : 20
```

---

## Testing Strategies

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

describe('WebRTC Provider', () => {
  it('should connect two peers', async () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()
    
    const provider1 = new WebrtcProvider('test-room', doc1, {
      signaling: ['ws://localhost:4444']
    })
    
    const provider2 = new WebrtcProvider('test-room', doc2, {
      signaling: ['ws://localhost:4444']
    })
    
    // Wait for connection
    await new Promise(resolve => {
      provider1.on('peers', ({ webrtcPeers }) => {
        if (webrtcPeers.length > 0) resolve()
      })
    })
    
    // Test sync
    const text1 = doc1.getText('test')
    text1.insert(0, 'hello')
    
    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const text2 = doc2.getText('test')
    expect(text2.toString()).toBe('hello')
    
    provider1.destroy()
    provider2.destroy()
  })
})
```

### Integration Tests

```typescript
// Test with real signaling server
describe('Integration Tests', () => {
  let signalingServer
  
  beforeAll(async () => {
    // Start signaling server
    signalingServer = await startSignalingServer(4444)
  })
  
  afterAll(async () => {
    await signalingServer.close()
  })
  
  it('should sync across multiple peers', async () => {
    const peers = []
    
    // Create 5 peers
    for (let i = 0; i < 5; i++) {
      const doc = new Y.Doc()
      const provider = new WebrtcProvider('test', doc, {
        signaling: ['ws://localhost:4444']
      })
      peers.push({ doc, provider })
    }
    
    // Wait for all to connect
    await waitForFullMesh(peers)
    
    // Make change on peer 0
    peers[0].doc.getText('test').insert(0, 'hello')
    
    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Verify all peers have same content
    peers.forEach(({ doc }) => {
      expect(doc.getText('test').toString()).toBe('hello')
    })
    
    // Cleanup
    peers.forEach(({ provider }) => provider.destroy())
  })
})
```

### Load Tests

```typescript
// Simulate many concurrent connections
async function loadTest() {
  const peers = []
  const roomName = 'load-test'
  
  console.log('Creating 100 peers...')
  
  for (let i = 0; i < 100; i++) {
    const doc = new Y.Doc()
    const provider = new WebrtcProvider(roomName, doc, {
      signaling: ['ws://localhost:4444'],
      maxConns: 10  // Limit connections
    })
    
    peers.push({ doc, provider, id: i })
    
    // Stagger creation
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('All peers created')
  
  // Monitor connection stats
  setInterval(() => {
    const stats = peers.map(({ provider }) => {
      const room = provider.room
      return room ? room.webrtcConns.size : 0
    })
    
    console.log('Connection stats:', {
      min: Math.min(...stats),
      max: Math.max(...stats),
      avg: stats.reduce((a, b) => a + b, 0) / stats.length,
      total: stats.reduce((a, b) => a + b, 0)
    })
  }, 5000)
  
  // Simulate activity
  setInterval(() => {
    const peer = peers[Math.floor(Math.random() * peers.length)]
    peer.doc.getText('test').insert(0, 'x')
  }, 1000)
}
```

---

## Resources

### Official Documentation
- [Yjs Documentation](https://docs.yjs.dev/)
- [y-webrtc GitHub](https://github.com/yjs/y-webrtc)
- [simple-peer Documentation](https://github.com/feross/simple-peer)

### WebRTC Resources
- [WebRTC MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [WebRTC for the Curious](https://webrtcforthecurious.com/)
- [STUN/TURN Setup Guide](https://www.html5rocks.com/en/tutorials/webrtc/infrastructure/)

### TURN Server Providers
- [Twilio TURN](https://www.twilio.com/stun-turn) - $0.40-1.00/GB
- [Xirsys](https://xirsys.com/) - $0.50/GB
- [Metered](https://www.metered.ca/) - $0.25/GB
- [Open Relay Project](https://www.metered.ca/tools/openrelay/) - Free (limited)

### Tools
- [chrome://webrtc-internals](chrome://webrtc-internals) - Chrome DevTools
- [about:webrtc](about:webrtc) - Firefox DevTools
- [coturn](https://github.com/coturn/coturn) - Open-source TURN server
- [WebRTC Test](https://test.webrtc.org/) - Connection tester

---

## Conclusion

Yjs P2P connections via y-webrtc provide:

✅ **Low latency** (10-50ms vs 50-200ms server-only)  
✅ **Reduced server load** (80% of traffic P2P)  
✅ **Better scalability** (sub-linear cost growth)  
✅ **Offline sync** (works on local network)  
✅ **End-to-end encryption** (optional password)

**Key Takeaways**:

1. **Use hybrid approach**: WebSocket + WebRTC for best reliability
2. **Configure TURN servers**: Essential for production (95%+ success rate)
3. **Monitor ICE states**: Understand why connections succeed/fail
4. **Optimize awareness**: Throttle cursor updates to reduce bandwidth
5. **Test thoroughly**: Different networks, browsers, NAT types
6. **Plan for scale**: Signaling is cheap, TURN bandwidth is expensive

**Production Checklist**:

- [ ] Multiple signaling servers (redundancy)
- [ ] Dedicated TURN servers (reliability)
- [ ] SSL/TLS everywhere (security)
- [ ] Authentication & authorization (access control)
- [ ] Rate limiting (abuse prevention)
- [ ] Monitoring & metrics (observability)
- [ ] Load testing (performance validation)
- [ ] Backup/fallback strategy (WebSocket sync)

---

**Maintained by**: [Your Team]  
**Last Updated**: 2025-10-11  
**Version**: 1.0.0

For questions, issues, or contributions, please open an issue or PR in the repository.

