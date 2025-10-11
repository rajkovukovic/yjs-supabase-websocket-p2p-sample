/**
 * Simple Y-WebRTC Compatible Signaling Server
 * 
 * This server implements the y-webrtc signaling protocol to enable
 * WebRTC peer-to-peer connections across browsers and devices.
 * 
 * Based on: https://github.com/yjs/y-webrtc/blob/master/bin/server.js
 */

import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import * as map from 'lib0/map'

import { config } from './config.js'

const PORT = config.yWebrtcSignaling?.port || 4445
const VERBOSE = process.env.VERBOSE === 'true'

// Room management: Map<roomName, Set<WebSocket>>
const rooms = new Map<string, Set<WebSocket>>()

// Track which room each socket is in: Map<WebSocket, Set<roomName>>
const socketRooms = new Map<WebSocket, Set<string>>()

/**
 * Get or create a room
 */
function getRoom(roomName: string): Set<WebSocket> {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set())
  }
  return rooms.get(roomName)!
}

/**
 * Send message to all peers in a room except sender
 */
function send(socket: WebSocket, roomName: string, message: Buffer) {
  const room = rooms.get(roomName)
  if (!room) return
  
  room.forEach((peer) => {
    if (peer !== socket && peer.readyState === WebSocket.OPEN) {
      peer.send(message)
    }
  })
}

/**
 * Handle WebSocket connection
 */
function setupConnection(socket: WebSocket) {
  const subscribedRooms = new Set<string>()
  socketRooms.set(socket, subscribedRooms)
  
  socket.on('message', (data: Buffer) => {
    try {
      const message = new Uint8Array(data)
      
      // Message format: [type, ...roomNameBytes, ...payload]
      // type: 'subscribe' (0) or 'publish' (1)
      const type = message[0]
      
      if (type === 0) {
        // Subscribe to room
        const roomName = Buffer.from(message.slice(1)).toString('utf8')
        
        if (VERBOSE) {
          console.log(`[Y-WebRTC] Client subscribing to room: ${roomName}`)
        }
        
        // Add socket to room
        const room = getRoom(roomName)
        room.add(socket)
        subscribedRooms.add(roomName)
        
        // Notify about new peer (send back the subscribe message to all peers)
        send(socket, roomName, data)
        
      } else if (type === 1) {
        // Publish message to room
        const roomNameLength = message[1]
        const roomName = Buffer.from(message.slice(2, 2 + roomNameLength)).toString('utf8')
        
        if (VERBOSE) {
          console.log(`[Y-WebRTC] Client publishing to room: ${roomName}`)
        }
        
        // Forward message to all peers in room
        send(socket, roomName, data)
      }
    } catch (error) {
      console.error('[Y-WebRTC] Error processing message:', error)
    }
  })
  
  socket.on('close', () => {
    // Remove socket from all rooms
    subscribedRooms.forEach((roomName) => {
      const room = rooms.get(roomName)
      if (room) {
        room.delete(socket)
        
        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(roomName)
          if (VERBOSE) {
            console.log(`[Y-WebRTC] Room ${roomName} is now empty and removed`)
          }
        }
      }
    })
    
    socketRooms.delete(socket)
    
    if (VERBOSE) {
      console.log('[Y-WebRTC] Client disconnected')
    }
  })
  
  socket.on('error', (error) => {
    console.error('[Y-WebRTC] WebSocket error:', error)
  })
  
  if (VERBOSE) {
    console.log('[Y-WebRTC] Client connected')
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
      status: 'ok', 
      service: 'y-webrtc-signaling',
      rooms: rooms.size,
      connections: socketRooms.size
    }))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

// Create WebSocket server
const wss = new WebSocketServer({ server })

wss.on('connection', setupConnection)

wss.on('error', (error) => {
  console.error('[Y-WebRTC] WebSocket server error:', error)
})

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🔄 Y-WebRTC Signaling Server Running                ║
║                                                        ║
║   Port: ${PORT}                                        ║
║   WebSocket: ws://localhost:${PORT}                    ║
║   Health Check: http://localhost:${PORT}/health        ║
║   Verbose: ${VERBOSE ? 'enabled' : 'disabled'}                               ║
║                                                        ║
║   Ready for WebRTC peer discovery! 🌐                 ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `)
})

// Periodic stats
setInterval(() => {
  if (VERBOSE) {
    console.log(`[Y-WebRTC] Stats - Rooms: ${rooms.size}, Connections: ${socketRooms.size}`)
  }
}, 60000) // Every minute

// Graceful shutdown
const shutdown = () => {
  console.log('\n[Y-WebRTC] Shutting down gracefully...')
  
  wss.clients.forEach((socket) => {
    socket.close()
  })
  
  server.close(() => {
    console.log('[Y-WebRTC] Server closed')
    process.exit(0)
  })
  
  setTimeout(() => {
    console.error('[Y-WebRTC] Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Y-WebRTC] Unhandled Rejection:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('[Y-WebRTC] Uncaught Exception:', error)
  process.exit(1)
})

export { server, wss }

