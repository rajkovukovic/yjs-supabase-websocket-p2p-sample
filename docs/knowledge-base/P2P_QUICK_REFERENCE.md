# Yjs P2P Quick Reference

Quick reference guide for common Yjs P2P patterns and troubleshooting.

---

## Quick Start

### Minimal Setup

```typescript
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

const ydoc = new Y.Doc()
const provider = new WebrtcProvider('room-name', ydoc, {
  signaling: ['ws://localhost:4445']
})
```

### Production Setup

```typescript
const provider = new WebrtcProvider('room-name', ydoc, {
  signaling: ['wss://signaling.example.com'],
  password: 'room-password',
  peerOpts: {
    trickle: true,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:turn.example.com:443',
          username: 'user',
          credential: 'pass'
        }
      ]
    }
  }
})
```

---

## Common Patterns

### Pattern: Hybrid WebSocket + P2P

```typescript
// Best reliability + performance
const hocuspocus = new HocuspocusProvider({
  url: 'wss://sync.example.com',
  name: 'doc-id',
  document: ydoc
})

const webrtc = new WebrtcProvider('doc-id', ydoc, {
  signaling: ['wss://signaling.example.com'],
  awareness: hocuspocus.awareness  // Share awareness
})
```

### Pattern: Offline-First with P2P

```typescript
import { IndexeddbPersistence } from 'y-indexeddb'

// Local persistence
const indexeddb = new IndexeddbPersistence('doc-name', ydoc)

// P2P sync
const webrtc = new WebrtcProvider('doc-name', ydoc, {
  signaling: ['wss://signaling.example.com']
})

// Instant load from IndexedDB, sync via P2P
```

### Pattern: Same-Browser Tabs Only

```typescript
const provider = new WebrtcProvider('room', ydoc, {
  signaling: [],  // No signaling server
  filterBcConns: false  // Enable BroadcastChannel
})
```

---

## Configuration Cheatsheet

### ICE Server Types

| Type | Purpose | Example | When to Use |
|------|---------|---------|-------------|
| STUN | Discover public IP | `stun:stun.l.google.com:19302` | Always |
| TURN (UDP) | Relay via UDP | `turn:turn.example.com:3478` | NAT traversal |
| TURN (TCP) | Relay via TCP | `turn:turn.example.com:3478?transport=tcp` | Firewall bypass |
| TURN (TLS) | Encrypted relay | `turns:turn.example.com:5349` | Corporate networks |

### Provider Options

```typescript
{
  signaling: string[]           // Default: ['wss://y-webrtc-eu.fly.dev']
  password: string | null       // Default: null (no encryption)
  awareness: Awareness          // Default: new Awareness(doc)
  maxConns: number             // Default: 20 + random(15)
  filterBcConns: boolean       // Default: true
  peerOpts: SimplePeerOptions  // Default: {}
}
```

### RTCConfiguration Options

```typescript
{
  iceServers: RTCIceServer[]       // STUN/TURN servers
  iceTransportPolicy: 'all' | 'relay'  // Connection method
  bundlePolicy: 'balanced' | 'max-compat' | 'max-bundle'
  rtcpMuxPolicy: 'negotiate' | 'require'
}
```

---

## Debugging Checklist

### 1. Check Signaling Connection

```typescript
provider.signalingConns.forEach(conn => {
  console.log('Signaling:', conn.url, conn.connected)
})
```

✅ Should show `connected: true`

### 2. Check Peer Discovery

```typescript
provider.on('peers', ({ webrtcPeers }) => {
  console.log('Discovered peers:', webrtcPeers.length)
})
```

✅ Should show > 0 peers

### 3. Check P2P Connections

```typescript
provider.on('peers', ({ webrtcConns }) => {
  console.log('P2P connections:', Object.keys(webrtcConns || {}).length)
})
```

✅ Should show > 0 connections

### 4. Check ICE State

```typescript
const room = provider.room
room?.webrtcConns.forEach((conn, peerId) => {
  if (conn.peer?._pc) {
    console.log(`[${peerId}]`, conn.peer._pc.iceConnectionState)
  }
})
```

✅ Should show `connected` or `completed`

### 5. Check Document Sync

```typescript
ydoc.getText('test').observe(() => {
  console.log('Document synced')
})
```

✅ Should fire when remote changes occur

---

## Troubleshooting Guide

### ❌ No Peer Discovery

**Symptoms**: `discoveredPeers: 0`

**Check**:
```bash
# 1. Signaling server running?
curl http://localhost:4445

# 2. Correct room name?
# Must match exactly between clients

# 3. WebSocket connection?
# Check browser network tab for WS connection
```

**Fix**:
```typescript
// Verify signaling URL
signaling: ['ws://localhost:4445']  // Development
signaling: ['wss://signaling.example.com']  // Production
```

---

### ❌ Peers Discovered But Not Connecting

**Symptoms**: `discoveredPeers: 2, p2pConnections: 0`

**Check ICE State**:
```typescript
// Should see: checking → connected
// If stuck on checking or shows failed, need TURN
```

**Fix**: Add TURN servers
```typescript
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

---

### ⚠️ High Latency

**Symptoms**: Changes take 100-200ms to sync

**Check Connection Type**:
```typescript
// Look for relay candidates
→ ICE candidate: { type: "relay" }  // Using TURN relay
```

**Why**: Using TURN relay instead of direct connection

**Solutions**:
1. This is expected when direct P2P impossible
2. Deploy geographically closer TURN servers
3. Check if firewall can be configured to allow WebRTC

---

### ⚠️ Connection Drops

**Symptoms**: Frequent `status: disconnected` events

**Check**:
```bash
# Network stability
ping signaling.example.com

# Signaling server logs
docker logs server-signaling-1
```

**Fix**:
```typescript
// Monitor and auto-reconnect (provider does this automatically)
provider.on('status', ({ connected }) => {
  if (!connected) {
    console.warn('Disconnected, will auto-reconnect')
  }
})
```

---

### ⚠️ High CPU/Bandwidth

**Symptoms**: Browser slowing down, high network usage

**Check**:
```typescript
console.log('Connections:', provider.room?.webrtcConns.size)
```

**Fix**: Limit connections
```typescript
maxConns: 10  // Reduce from default 20+random(15)

// Throttle awareness updates
let throttle = null
const updateAwareness = (state) => {
  clearTimeout(throttle)
  throttle = setTimeout(() => {
    awareness.setLocalState(state)
  }, 50)
}
```

---

## Browser DevTools

### Chrome: `chrome://webrtc-internals`

**What to check**:
- Active peer connections
- ICE candidate pairs (host/srflx/relay)
- Connection state (new/checking/connected/failed)
- Statistics (bytes sent/received, RTT)

### Firefox: `about:webrtc`

**What to check**:
- ICE statistics
- Connection log
- Certificates
- Session statistics

### Console Commands

```javascript
// Get provider instance
const provider = window.__WEBRTC_PROVIDER__

// Check signaling
provider.signalingConns.forEach(c => 
  console.log(c.url, c.connected)
)

// Check peers
console.log('Room:', provider.room?.name)
console.log('Peer ID:', provider.room?.peerId)
console.log('Connections:', provider.room?.webrtcConns.size)

// Check awareness
const awareness = provider.awareness
console.log('My ID:', awareness.clientID)
console.log('All clients:', Array.from(awareness.getStates().keys()))

// Force reconnect
provider.disconnect()
provider.connect()
```

---

## Testing Scenarios

### Test 1: Same Browser Tabs

```bash
# Open in 2 tabs
http://localhost:3000/document/test

# Expected: BroadcastChannel connection
# Latency: < 1ms
```

### Test 2: Different Browsers, Same Network

```bash
# Chrome + Firefox on same machine
http://localhost:3000/document/test

# Expected: Direct P2P (host/srflx candidates)
# Latency: 10-50ms
```

### Test 3: Different Networks

```bash
# Different machines, different networks
http://your-server.com/document/test

# Expected: P2P via TURN relay (if configured)
# Latency: 50-150ms
```

### Test 4: Behind Firewall

```bash
# Corporate network, restrictive firewall
http://your-server.com/document/test

# Expected: TURN required
# Check: ICE candidates should show type "relay"
```

---

## Performance Benchmarks

### Connection Latency

| Method | Latency | Use Case |
|--------|---------|----------|
| BroadcastChannel | < 1ms | Same browser tabs |
| Direct P2P (LAN) | 1-5ms | Same local network |
| P2P via STUN | 10-50ms | Different networks |
| P2P via TURN | 50-150ms | Behind NAT/firewall |
| WebSocket only | 50-200ms | Server relay |

### Connection Success Rate

| Configuration | Success Rate |
|--------------|--------------|
| STUN only | 60-70% |
| STUN + TURN | 90-95% |
| TURN only (relay) | 95-99% |

### Resource Usage

| Metric | BroadcastChannel | Direct P2P | TURN Relay |
|--------|-----------------|------------|------------|
| CPU | Low | Low | Low |
| Memory | Low | Low | Low |
| Bandwidth | None | 0.1-0.5 Mbps | 0.5-2 Mbps |
| Server Load | None | None | High |

---

## Production Checklist

- [ ] Multiple signaling servers for redundancy
- [ ] Dedicated TURN servers configured
- [ ] SSL/TLS enabled (wss://, turns://)
- [ ] Authentication & authorization implemented
- [ ] Rate limiting on signaling server
- [ ] Monitoring & alerting setup
- [ ] Backup sync method (WebSocket)
- [ ] Load tested with expected user count
- [ ] Documented for team

---

## Common Configurations

### Development

```typescript
{
  signaling: ['ws://localhost:4445'],
  filterBcConns: false,
  peerOpts: {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    }
  }
}
```

### Production (Minimum)

```typescript
{
  signaling: ['wss://signaling.example.com'],
  peerOpts: {
    trickle: true,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:turn.example.com:443',
          username: 'user',
          credential: 'pass'
        }
      ]
    }
  }
}
```

### Production (Recommended)

```typescript
{
  signaling: [
    'wss://signaling1.example.com',
    'wss://signaling2.example.com'
  ],
  password: process.env.ROOM_PASSWORD,
  maxConns: 30,
  filterBcConns: true,
  peerOpts: {
    trickle: true,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        {
          urls: 'turn:turn1.example.com:443',
          username: 'user',
          credential: 'pass'
        },
        {
          urls: 'turn:turn2.example.com:443',
          username: 'user',
          credential: 'pass'
        },
        {
          urls: 'turn:turn1.example.com:443?transport=tcp',
          username: 'user',
          credential: 'pass'
        }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    }
  }
}
```

---

## Useful Links

- [Full Knowledge Base](./YJS_P2P_CONNECTIONS.md)
- [Yjs Docs](https://docs.yjs.dev/)
- [y-webrtc GitHub](https://github.com/yjs/y-webrtc)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Free TURN Servers](https://www.metered.ca/tools/openrelay/)

---

**Last Updated**: 2025-10-11

