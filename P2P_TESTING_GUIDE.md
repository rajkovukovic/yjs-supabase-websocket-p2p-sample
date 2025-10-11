# P2P WebRTC Testing Guide

This guide helps you test the P2P WebRTC connection fixes and verify that P2P connections are working correctly.

---

## Quick Test

### 1. Start the development server

```bash
cd web
pnpm dev
```

### 2. Open browser console (F12 or Cmd+Option+I)

Watch for these log messages that indicate P2P status.

### 3. Test Scenarios

#### Test 1: Same Browser, Different Tabs (BroadcastChannel)

**Setup**:
1. Open http://localhost:3000/document/test-doc in one tab
2. Open http://localhost:3000/document/test-doc in another tab (same browser)

**Expected Output**:
```javascript
📡 WebRTC provider configured (BroadcastChannel mode only)
🔗 WebRTC connection state: {
  p2pConnections: 0,
  broadcastConnections: 1,  // ✅ Connected via BroadcastChannel
  discoveredPeers: 0
}
```

**Verification**:
- Type in one tab, see it appear in the other tab instantly
- BroadcastChannel is working ✅

---

#### Test 2: Different Browsers, Same Machine (WebRTC P2P)

**Setup**:
1. Chrome: http://localhost:3000/document/test-doc
2. Firefox: http://localhost:3000/document/test-doc

**Expected Output** (in both browsers):
```javascript
📡 WebRTC provider configured with signaling server: ws://localhost:4445
✅ P2P enabled across browsers and devices

🔗 WebRTC connection state: {
  p2pConnections: 1,        // ✅ P2P connection established!
  broadcastConnections: 0,
  discoveredPeers: 1,
  connectedPeerIds: ['peer-uuid-123'],
  peersAdded: ['peer-uuid-123']
}

✅ New peers discovered: ['peer-uuid-123']
🎉 Successfully established 1 P2P connection(s)!

🔍 Inspecting WebRTC peer connections...
  Peer peer-uuid-123: {
    connected: true,
    synced: true,
    closed: false
  }
  → RTCPeerConnection state: {
    connectionState: "connected",
    iceConnectionState: "connected",    // ✅ Key indicator
    iceGatheringState: "complete",
    signalingState: "stable"
  }
  ✅ ICE connection established for peer peer-uuid-123
```

**ICE Candidates** (indicates connection method):
```javascript
→ ICE candidate: {
  type: "host",      // Local network
  protocol: "udp",
  address: "192.168.1.100"
}

→ ICE candidate: {
  type: "srflx",     // Server reflexive (through STUN)
  protocol: "udp",
  address: "203.0.113.1"
}
```

**Verification**:
- Type in Chrome, see it in Firefox instantly
- Console shows `iceConnectionState: "connected"`
- ICE candidates of type "host" or "srflx" (direct connection) ✅

---

#### Test 3: Different Networks (WebRTC with TURN)

**Setup**:
1. Machine 1: Behind NAT/firewall
2. Machine 2: Behind different NAT/firewall
3. Both open http://your-server:3000/document/test-doc

**Expected Output**:
```javascript
🔗 WebRTC connection state: {
  p2pConnections: 1,        // ✅ Connection via TURN relay
  discoveredPeers: 1,
  connectedPeerIds: ['peer-uuid-456']
}

→ ICE candidate: {
  type: "relay",     // ✅ Using TURN relay
  protocol: "udp",
  address: "turnserver.example.com"
}

✅ ICE connection established for peer peer-uuid-456
```

**Verification**:
- Type on one machine, see it on the other
- ICE candidate type is "relay" (using TURN server) ✅
- Latency is higher (~50-150ms) but connection works

---

## Detailed Console Monitoring

### Success Indicators

✅ **Peer Discovery**:
```
✅ New peers discovered: ['peer-123']
```

✅ **P2P Connection Established**:
```
🎉 Successfully established 1 P2P connection(s)!
```

✅ **ICE Connection**:
```
→ ICE state changed to: connected
✅ ICE connection established for peer peer-123
```

✅ **WebRTC Sync**:
```
✅ WebRTC P2P synchronized
```

### Warning Indicators

⚠️ **Peers Discovered but Not Connected**:
```
⚠️ Peers discovered (2) but no P2P connections established yet
💡 Tip: This may be normal during initial connection or due to NAT/firewall
```

**Action**: Wait a few more seconds. If still not connected, check ICE state.

⚠️ **ICE Checking**:
```
→ ICE state changed to: checking
```

**Action**: This is normal. Wait for it to change to "connected" or "failed".

### Error Indicators

❌ **ICE Connection Failed**:
```
→ ICE state changed to: failed
❌ ICE connection failed for peer peer-123
💡 This usually means:
   - NAT/Firewall blocking connection
   - STUN servers unreachable
   - TURN server required but not configured properly
```

**Action**: 
1. Check firewall settings
2. Verify TURN servers are accessible
3. Try different network or browser

---

## Connection States Reference

### ICE Connection States

| State | Meaning | Action |
|-------|---------|--------|
| `new` | Initial state | Wait |
| `checking` | Trying to establish connection | Wait (normal) |
| `connected` | ✅ Connection established | Success! |
| `completed` | ✅ All candidates processed | Success! |
| `failed` | ❌ Connection failed | Check troubleshooting |
| `disconnected` | Connection lost | May reconnect automatically |
| `closed` | Connection closed | Normal cleanup |

### RTCPeerConnection States

| State | Meaning |
|-------|---------|
| `new` | Initial state |
| `connecting` | Establishing connection |
| `connected` | ✅ Connection active |
| `disconnected` | Connection lost |
| `failed` | ❌ Connection failed |
| `closed` | Connection terminated |

---

## Advanced Debugging

### Chrome DevTools

1. Open: `chrome://webrtc-internals`
2. Look for your connection
3. Check:
   - ICE candidate pairs
   - Connection statistics
   - Data channel status

### Firefox DevTools

1. Open: `about:webrtc`
2. Check:
   - ICE statistics
   - Connection log
   - Signaling state

### Network Debugging

```bash
# Check signaling server health
curl http://localhost:4445/health

# Expected response:
# {"status":"ok","service":"y-webrtc-signaling","rooms":1,"connections":2}
```

### WebSocket Debugging

```bash
# Monitor signaling server logs
docker logs -f server-y-webrtc-signaling-1
```

Expected logs:
```
[Y-WebRTC] Client connected
[Y-WebRTC] Client subscribing to room: test-doc
[Y-WebRTC] Client publishing to room: test-doc
```

---

## Troubleshooting

### Issue: No P2P connections, only server sync

**Symptoms**:
```javascript
p2pConnections: 0
discoveredPeers: 0
```

**Solutions**:
1. Verify signaling server is running:
   ```bash
   curl http://localhost:4445/health
   ```

2. Check environment variable:
   ```bash
   # In web/.env.local
   NEXT_PUBLIC_Y_WEBRTC_SIGNALING_URL=ws://localhost:4445
   ```

3. Restart development server:
   ```bash
   cd web
   pnpm dev
   ```

---

### Issue: Peers discovered but not connecting

**Symptoms**:
```javascript
discoveredPeers: 2
p2pConnections: 0
```

**Solutions**:

1. **Wait 5-10 seconds** - ICE negotiation takes time

2. **Check ICE state** in console:
   ```
   → ICE state changed to: checking    // Still trying
   → ICE state changed to: failed      // Problem!
   ```

3. **If ICE failed**, check:
   - Firewall blocking WebRTC
   - STUN servers unreachable
   - Need TURN server

4. **Test TURN server**:
   ```javascript
   // In browser console
   fetch('https://openrelay.metered.ca')
     .then(() => console.log('TURN server accessible'))
     .catch(e => console.error('TURN server blocked:', e))
   ```

---

### Issue: High latency

**Symptoms**:
- Changes take 100-200ms to sync
- ICE candidate type is "relay"

**Explanation**:
Using TURN relay server (indirect connection) instead of direct P2P.

**Solutions**:
1. This is **expected behavior** when direct P2P is impossible
2. Still better than server-only sync
3. For production, deploy dedicated TURN server for better performance

---

### Issue: Browser security warnings

**Symptoms**:
- WebRTC blocked by browser
- Can't access `_pc` property

**Solutions**:
1. Use HTTPS in production (WebRTC requires secure context)
2. For localhost, HTTP is fine
3. Check browser's WebRTC settings (usually allowed by default)

---

## Performance Benchmarks

### Expected Latency

| Connection Type | Latency | Use Case |
|----------------|---------|----------|
| BroadcastChannel | < 1ms | Same browser, different tabs |
| Direct P2P (host) | 1-5ms | Same local network |
| P2P via STUN (srflx) | 10-50ms | Different networks, direct connection possible |
| P2P via TURN (relay) | 50-150ms | Behind restrictive NAT/firewall |
| Server sync (Hocuspocus) | 50-200ms | Fallback when P2P fails |

### Connection Success Rate

With the enhanced configuration (STUN + TURN):
- **Same network**: 95-100% success (direct P2P)
- **Different networks**: 80-90% success (direct P2P via STUN)
- **Restrictive NAT**: 70-80% success (relay via TURN)
- **Overall**: 85-95% P2P success rate

---

## Production Testing

### Before Deployment

1. ✅ Test on same network
2. ✅ Test on different networks
3. ✅ Test behind corporate firewall
4. ✅ Test on mobile networks
5. ✅ Test with multiple peers (5+)

### Monitoring

Add to your monitoring:

```typescript
// Track connection method
webrtcProvider.on('peers', ({ webrtcConns }: any) => {
  const room = (webrtcProvider as any).room
  if (room && room.webrtcConns) {
    room.webrtcConns.forEach((conn: any) => {
      if (conn.peer && conn.peer._pc) {
        const pc = conn.peer._pc
        pc.addEventListener('icecandidate', (event: any) => {
          if (event.candidate) {
            // Track connection type
            analytics.track('P2P Connection Method', {
              type: event.candidate.type,  // host, srflx, or relay
              protocol: event.candidate.protocol
            })
          }
        })
      }
    })
  }
})
```

---

## Next Steps

1. **Test the fixes** using this guide
2. **Monitor console** for success/error indicators
3. **Report results** back with console logs
4. **Deploy** once P2P connections are verified

For production deployment:
- Consider dedicated TURN server
- Add connection metrics
- Implement user-facing connection status indicators

---

**Related Documentation**:
- [P2P_CONNECTION_FIX.md](docs/vibe-coding-logs/2025-10-11/P2P_CONNECTION_FIX.md) - Technical details
- [P2P_SIGNALING_PROTOCOL_FIX.md](docs/vibe-coding-logs/2025-10-11/P2P_SIGNALING_PROTOCOL_FIX.md) - Signaling server fix
- [P2P_SETUP_GUIDE.md](P2P_SETUP_GUIDE.md) - Initial setup guide


