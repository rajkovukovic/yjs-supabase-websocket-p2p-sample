// Load config FIRST - this initializes environment variables
import { config } from './config.js'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'

const PORT = config.signaling.port
const CORS_ORIGIN = config.cors.origin

/**
 * WebRTC Signaling Server
 * 
 * This server facilitates peer-to-peer WebRTC connections between clients.
 * It manages:
 * - Room management for document collaboration
 * - Peer discovery and connection signaling
 * - Signal relay between peers for WebRTC handshake
 */

// Create HTTP server
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'webrtc-signaling' }))
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }
})

// Create Socket.IO server with CORS configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000
})

// Room management
interface RoomData {
  peers: Set<string>
  createdAt: Date
}

const rooms = new Map<string, RoomData>()

/**
 * Connection event handler
 */
io.on('connection', (socket) => {
  console.log(`[Signaling] Client connected: ${socket.id}`)
  
  /**
   * Join a room (document collaboration space)
   */
  socket.on('join', (room: string) => {
    console.log(`[Signaling] Client ${socket.id} joining room: ${room}`)
    
    socket.join(room)
    
    // Create room if it doesn't exist
    if (!rooms.has(room)) {
      rooms.set(room, {
        peers: new Set(),
        createdAt: new Date()
      })
    }
    
    const roomData = rooms.get(room)!
    roomData.peers.add(socket.id)
    
    // Send list of existing peers to the new client
    const existingPeers = Array.from(roomData.peers).filter(id => id !== socket.id)
    socket.emit('peers', existingPeers)
    
    // Notify other peers in the room about the new peer
    socket.to(room).emit('peer-joined', socket.id)
    
    console.log(
      `[Signaling] Client ${socket.id} joined room ${room}. ` +
      `Total peers in room: ${roomData.peers.size}`
    )
  })
  
  /**
   * Leave a room
   */
  socket.on('leave', (room: string) => {
    console.log(`[Signaling] Client ${socket.id} leaving room: ${room}`)
    
    socket.leave(room)
    
    const roomData = rooms.get(room)
    if (roomData) {
      roomData.peers.delete(socket.id)
      
      // Notify other peers
      socket.to(room).emit('peer-left', socket.id)
      
      // Clean up empty rooms
      if (roomData.peers.size === 0) {
        rooms.delete(room)
        console.log(`[Signaling] Room ${room} is empty and has been removed`)
      }
    }
  })
  
  /**
   * Relay WebRTC signaling data between peers
   */
  socket.on('signal', ({ to, signal }: { to: string; signal: any }) => {
    console.log(`[Signaling] Relaying signal from ${socket.id} to ${to}`)
    
    io.to(to).emit('signal', {
      from: socket.id,
      signal
    })
  })
  
  /**
   * Broadcast to all peers in a room
   */
  socket.on('broadcast', ({ room, data }: { room: string; data: any }) => {
    console.log(`[Signaling] Broadcasting to room ${room} from ${socket.id}`)
    socket.to(room).emit('broadcast', {
      from: socket.id,
      data
    })
  })
  
  /**
   * Get room info
   */
  socket.on('room-info', (room: string, callback: (info: any) => void) => {
    const roomData = rooms.get(room)
    
    if (roomData) {
      callback({
        room,
        peerCount: roomData.peers.size,
        peers: Array.from(roomData.peers),
        createdAt: roomData.createdAt
      })
    } else {
      callback({
        room,
        peerCount: 0,
        peers: [],
        createdAt: null
      })
    }
  })
  
  /**
   * Handle disconnection
   */
  socket.on('disconnect', (reason) => {
    console.log(`[Signaling] Client ${socket.id} disconnected. Reason: ${reason}`)
    
    // Remove from all rooms
    rooms.forEach((roomData, roomName) => {
      if (roomData.peers.has(socket.id)) {
        roomData.peers.delete(socket.id)
        
        // Notify other peers in the room
        io.to(roomName).emit('peer-left', socket.id)
        
        console.log(
          `[Signaling] Client ${socket.id} removed from room ${roomName}. ` +
          `Remaining peers: ${roomData.peers.size}`
        )
        
        // Clean up empty rooms
        if (roomData.peers.size === 0) {
          rooms.delete(roomName)
          console.log(`[Signaling] Room ${roomName} is empty and has been removed`)
        }
      }
    })
  })
  
  /**
   * Error handling
   */
  socket.on('error', (error) => {
    console.error(`[Signaling] Socket error for ${socket.id}:`, error)
  })
})

// Start the server
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🔄 WebRTC Signaling Server Running                  ║
║                                                        ║
║   Port: ${PORT}                                        ║
║   WebSocket: ws://localhost:${PORT}                    ║
║   Health Check: http://localhost:${PORT}/health        ║
║   Environment: ${config.nodeEnv}                       ║
║                                                        ║
║   Ready for peer-to-peer connections! 🌐              ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `)
})

// Periodic room cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  const ONE_HOUR = 60 * 60 * 1000
  
  rooms.forEach((roomData, roomName) => {
    // Remove rooms that have been empty for over an hour
    if (roomData.peers.size === 0 && now - roomData.createdAt.getTime() > ONE_HOUR) {
      rooms.delete(roomName)
      console.log(`[Signaling] Cleaned up stale room: ${roomName}`)
    }
  })
}, 5 * 60 * 1000)

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[Signaling] Shutting down gracefully...')
  
  // Notify all clients
  io.emit('server-shutdown', { message: 'Server is shutting down' })
  
  // Close all connections
  io.close(() => {
    console.log('[Signaling] All connections closed')
    httpServer.close(() => {
      console.log('[Signaling] HTTP server closed')
      process.exit(0)
    })
  })
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[Signaling] Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Signaling] Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('[Signaling] Uncaught Exception:', error)
  process.exit(1)
})

// Export for testing
export { io, httpServer }

