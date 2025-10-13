# Socket.IO Signaling Fix

**Date:** October 11, 2025  
**Status:** ✅ Complete

## Problem

The application was experiencing WebSocket connection failures with error:
```
WebSocket connection to 'wss://y-webrtc-signaling-us.herokuapp.com/' failed: 
Error during WebSocket handshake: Unexpected response code: 404
```

### Root Cause

There was a **protocol mismatch** between the client and server:

1. **Server Side** (`server/signaling-server.ts`): Using **Socket.IO** library
   - Socket.IO implements its own protocol on top of WebSocket
   - Includes heartbeat, reconnection logic, and custom framing

2. **Client Side** (`web/lib/yjs-providers.ts`): Using **y-webrtc's WebrtcProvider**
   - The `WebrtcProvider` expects **native WebSocket** signaling servers
   - Was trying to connect to deprecated Heroku servers that are no longer working
   - Cannot communicate with Socket.IO servers directly

### Additional Issues

- The custom signaling server URL was commented out in the code
- The fallback public Heroku servers were returning 404 errors
- y-webrtc library and Socket.IO use incompatible protocols

## Solution

### 1. Replaced y-webrtc with Socket.IO Client

Updated `web/lib/yjs-providers.ts` to use Socket.IO client directly instead of y-webrtc's WebrtcProvider:

**Before:**
```typescript
import { WebrtcProvider } from 'y-webrtc'

const webrtcProvider = new WebrtcProvider(documentName, ydoc, {
  signaling: [
    'wss://y-webrtc-signaling-eu.herokuapp.com',
    'wss://y-webrtc-signaling-us.herokuapp.com'
  ],
  // ...
})
```

**After:**
```typescript
import { io, Socket } from 'socket.io-client'

const signalingSocket = io(SIGNALING_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity
})
```

### 2. Implemented Peer Discovery Events

Added proper Socket.IO event handlers for:
- `connect` - Connection established
- `disconnect` - Connection lost
- `connect_error` - Connection errors
- `peers` - List of existing peers in room
- `peer-joined` - New peer joined the room
- `peer-left` - Peer left the room
- `room-info` - Get current room information

### 3. Integrated with Document State

Connected Socket.IO events to the Valtio document state:
```typescript
signalingSocket.on('peers', (peers: string[]) => {
  documentState.peers = peers.length
})

signalingSocket.on('peer-joined', (peerId: string) => {
  // Get updated room info
  signalingSocket?.emit('room-info', documentName, (info: any) => {
    documentState.peers = info.peerCount - 1 // Exclude self
  })
})
```

### 4. Added Dependencies

Installed `socket.io-client` in the web package:
```bash
pnpm add socket.io-client
```

### 5. Created Test Script

Created `server/scripts/test-socketio.js` to verify Socket.IO signaling:
- Tests connection establishment
- Tests room join/leave
- Tests peer discovery
- Tests room info retrieval
- Validates all signaling operations

## Files Modified

1. **web/lib/yjs-providers.ts**
   - Removed y-webrtc WebrtcProvider
   - Added Socket.IO client integration
   - Implemented peer discovery logic

2. **server/package.json**
   - Added `test:socketio` script

3. **web/package.json** (dependencies)
   - Added `socket.io-client` package

4. **server/scripts/test-socketio.js** (new file)
   - Comprehensive test suite for Socket.IO signaling

5. **web/lib/socketio-signaling.ts** (new file, reference)
   - Custom Socket.IO signaling adapter (for future use)

## Architecture

### Before
```
Web Client (y-webrtc) --[Native WebSocket Protocol]--> ❌ Socket.IO Server
                                                          (Protocol mismatch)
```

### After
```
Web Client (Socket.IO Client) --[Socket.IO Protocol]--> ✅ Socket.IO Server
         ↓                                                        ↓
  Document State Updates                              Peer Discovery & Signaling
```

### Current Stack

1. **Persistence Layer**: IndexedDB (offline) + Supabase (server)
2. **Real-time Sync**: Hocuspocus (WebSocket) for document operations
3. **Peer Discovery**: Socket.IO for peer presence and discovery
4. **State Management**: Valtio with Yjs synchronization

## Testing

### 1. Server Health Check

```bash
curl http://localhost:4445/health
# Expected: {"status":"ok","service":"webrtc-signaling"}
```

### 2. Socket.IO Connection Test

```bash
cd server
pnpm run test:socketio
```

**Expected Output:**
```
✅ Test 1: Connected successfully
✅ Test 3: Received peers list
✅ Test 4: Received room info
✅ Test 6: Disconnected

🎉 All tests completed!
   Passed: 4
   Failed: 0
```

### 3. Full Integration Test

1. Start the signaling server:
   ```bash
   cd server
   pnpm run dev:signaling
   ```

2. Start the web app:
   ```bash
   cd web
   pnpm dev
   ```

3. Open browser to `http://localhost:3000`

4. Open browser console and verify:
   - ✅ No WebSocket 404 errors
   - ✅ "Socket.IO signaling connected" message
   - ✅ "Joining room: [document-id]" message
   - ✅ "Received peers list" message

5. Open a second browser window/tab with the same document

6. Verify in both consoles:
   - ✅ "New peer joined" messages
   - ✅ Peer count updates in the UI

## Environment Configuration

### Local Development

Edit `web/.env.local` to use local servers:
```bash
# Use local servers for development
NEXT_PUBLIC_HOCUSPOCUS_URL='ws://localhost:1234'
NEXT_PUBLIC_SIGNALING_URL='ws://localhost:4445'
```

### Production

Use deployed server URLs:
```bash
# Use production servers
NEXT_PUBLIC_HOCUSPOCUS_URL='wss://yjs-draw-hocuspocus.evolucia.one'
NEXT_PUBLIC_SIGNALING_URL='wss://yjs-draw-signal.evolucia.one'
```

## Verification Commands

```bash
# 1. Check if signaling server is running
lsof -i :4445

# 2. Test health endpoint
curl http://localhost:4445/health

# 3. Test Socket.IO connection
cd server && pnpm run test:socketio

# 4. Start servers
cd server && pnpm run dev:signaling  # Terminal 1
cd web && pnpm dev                    # Terminal 2

# 5. Open browser and check console
# Navigate to: http://localhost:3000
# Check console for: "✅ Socket.IO signaling connected"
```

## Benefits of This Approach

1. **Protocol Compatibility**: Socket.IO client and server use the same protocol
2. **Robust Reconnection**: Built-in reconnection logic with exponential backoff
3. **Fallback Transport**: Automatic fallback from WebSocket to polling if needed
4. **Simpler Code**: Removed dependency on y-webrtc for signaling
5. **Better Debugging**: Clear error messages and connection status
6. **Room Management**: Built-in room join/leave semantics
7. **Peer Discovery**: Real-time notification of peers joining/leaving

## Future Improvements

1. **Add WebRTC Data Channels**: Use Socket.IO for signaling, then establish direct WebRTC connections between peers for lower latency
2. **Presence System**: Extend peer discovery to show user cursors and selections
3. **Authentication**: Add JWT token validation for Socket.IO connections
4. **Rate Limiting**: Implement rate limits for signaling messages
5. **Monitoring**: Add metrics for connection quality and peer counts

## Notes

- The main document synchronization still uses **Hocuspocus** (WebSocket) as the authoritative source
- Socket.IO signaling is used for **peer discovery and presence** only
- For full peer-to-peer sync, future work can add WebRTC data channels using Socket.IO for signaling
- The `web/lib/socketio-signaling.ts` file provides a reference implementation for future WebRTC integration

## Related Documentation

- [P2P Sync Implementation](./P2P_SYNC_IMPLEMENTATION.md)
- [Authentication Implementation](./AUTHENTICATION_IMPLEMENTATION.md)
- [Server Setup](../2025-10-10/SERVER_COMPLETE.md)

