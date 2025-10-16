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
const WEBRTC_PASSWORD = config.yWebrtcSignaling?.password || null

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
 * Send JSON message to a socket
 */
function sendMessage(socket: WebSocket, message: any) {
  if (socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(message))
    } catch (error) {
      console.error('[Y-WebRTC] Error sending message:', error)
      socket.close()
    }
  }
}

/**
 * Handle WebSocket connection
 */
function setupConnection(socket: WebSocket) {
  const subscribedRooms = new Set<string>()
  socketRooms.set(socket, subscribedRooms)
  
  let closed = false
  let pongReceived = true
  
  // Ping/pong for keepalive
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      socket.close()
      clearInterval(pingInterval)
    } else {
      pongReceived = false
      try {
        socket.ping()
      } catch (error) {
        socket.close()
      }
    }
  }, 30000)
  
  socket.on('pong', () => {
    pongReceived = true
  })
  
  socket.on('message', (data: Buffer | string) => {
    if (closed) return
    
    try {
      // Parse JSON message
      const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString())
      
      if (!message || !message.type) {
        console.error('[Y-WebRTC] Invalid message format:', message)
        return
      }
      
      switch (message.type) {
        case 'subscribe': {
          // Subscribe to topics (rooms)
          const topics = message.topics || []
          topics.forEach((roomName: string) => {
            if (typeof roomName === 'string') {
              let Rname = roomName;
              if (WEBRTC_PASSWORD) {
                const [name, password] = roomName.split('/')
                Rname = name
                if (password !== WEBRTC_PASSWORD) {
                  console.warn(`[Y-WebRTC] Unauthorized connection to room ${Rname}: invalid password`)
                  return
                }
              }

              if (VERBOSE) {
                console.log(`[Y-WebRTC] Client subscribing to room: ${Rname}`)
              }
              
              // Add socket to room
              const room = getRoom(Rname)
              room.add(socket)
              subscribedRooms.add(Rname)
            }
          })
          break
        }
        
        case 'unsubscribe': {
          // Unsubscribe from topics
          const topics = message.topics || []
          topics.forEach((roomName: string) => {
            if (typeof roomName === 'string') {
              if (VERBOSE) {
                console.log(`[Y-WebRTC] Client unsubscribing from room: ${roomName}`)
              }
              
              const room = rooms.get(roomName)
              if (room) {
                room.delete(socket)
                if (room.size === 0) {
                  rooms.delete(roomName)
                }
              }
              subscribedRooms.delete(roomName)
            }
          })
          break
        }
        
        case 'publish': {
          // Publish message to topic
          const topic = message.topic
          if (typeof topic === 'string') {
            if (VERBOSE) {
              console.log(`[Y-WebRTC] Client publishing to room: ${topic}`)
            }
            
            const room = rooms.get(topic)
            if (room) {
              // Forward message to all peers in room except sender
              room.forEach((peer) => {
                if (peer !== socket && peer.readyState === WebSocket.OPEN) {
                  sendMessage(peer, message)
                }
              })
            }
          }
          break
        }
        
        case 'ping': {
          // Respond to ping
          sendMessage(socket, { type: 'pong' })
          break
        }
        
        default: {
          console.warn(`[Y-WebRTC] Unknown message type: ${message.type}`)
        }
      }
    } catch (error) {
      console.error('[Y-WebRTC] Error processing message:', error)
    }
  })
  
  socket.on('close', () => {
    closed = true
    clearInterval(pingInterval)
    
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

