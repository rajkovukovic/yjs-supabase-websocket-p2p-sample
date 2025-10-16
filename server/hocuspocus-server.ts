// Load config FIRST - this initializes environment variables
import { config } from './config.js'
import { Server } from '@hocuspocus/server'
import { SupabaseDatabase } from './extensions/supabase-db.js'
import { UpdateTracker } from './extensions/update-tracker.js'

const PORT = config.hocuspocus.port
const CORS_ORIGIN = config.cors.origin

/**
 * Hocuspocus WebSocket Server
 * 
 * This server provides real-time collaboration capabilities using Yjs CRDT.
 * It handles:
 * - WebSocket connections for real-time sync
 * - Document persistence via Supabase
 * - Document lifecycle management
 * - Incremental update tracking
 */
const server = Server.configure({
  port: PORT,
  
  // Database extension for Supabase persistence
  extensions: [
    SupabaseDatabase,
    UpdateTracker  // Track individual updates for audit trail
  ],
  
  /**
   * Authentication hook
   * For MVP: Explicitly allow all connections without authentication
   * In Hocuspocus v2.15+, the provider expects this hook to exist even if auth is disabled
   * This prevents the "authentication token required" warning on the client
   */
  async onAuthenticate() {
    // Allow all connections - no authentication required for MVP
    // Simply return without checking any tokens
    return {
      user: {
        id: 'anonymous-' + Math.random().toString(36).substr(2, 9),
        name: 'Anonymous User'
      }
    }
  },
  
  // Production authentication example (uncomment when needed):
  // async onAuthenticate({ requestHeaders, requestParameters }) {
  //   const token = requestHeaders.authorization?.split(' ')[1] || requestParameters.token
  //   
  //   if (!token) {
  //     throw new Error('No token provided')
  //   }
  //   
  //   // Verify token with Supabase Auth
  //   const { data: { user }, error } = await supabase.auth.getUser(token)
  //   
  //   if (error || !user) {
  //     throw new Error('Invalid token')
  //   }
  //   
  //   return {
  //     user: {
  //       id: user.id,
  //       name: user.email || 'Unknown User'
  //     }
  //   }
  // },
  
  /**
   * Called when a document is loaded into memory
   */
  async onLoadDocument({ documentName, document }) {
    try {
      console.log(`[Hocuspocus] Document loaded: ${documentName}`)
      // Example of interacting with a generic Yjs doc
      const drawables = document.getArray('drawables')
      console.log(`[Hocuspocus] Document has ${drawables.length} drawables`)
    } catch (error: any) {
      console.error(`[onLoadDocument] Error:`, error?.message || error)
      console.error(`[onLoadDocument] Full error:`, error)
    }
  },
  
  /**
   * Called when a document changes
   * Note: UpdateTracker extension handles storing individual updates
   */
  async onChange({ documentName }) {
    console.log(`[Hocuspocus] Document changed: ${documentName}`)
  },
  
  /**
   * Called when a document is unloaded from memory
   */
  async afterUnloadDocument({ documentName }) {
    console.log(`[Hocuspocus] Document unloaded: ${documentName}`)
  },
  
  /**
   * Called when a connection is established
   */
  async onConnect({ documentName, requestParameters, context }) {
    console.log(`[Hocuspocus] Client connected to ${documentName}`)
    
    // Set a default entityType for all documents
    context.entityType = 'generic'
  },
  
  /**
   * Called when a connection is closed
   */
  async onDisconnect({ documentName, clientsCount }) {
    console.log(`[Hocuspocus] Client disconnected from ${documentName}. Remaining clients: ${clientsCount}`)
  },
  
  /**
   * CORS configuration
   */
  async onConfigure({ configuration }) {
    return {
      ...configuration,
      quiet: config.nodeEnv === 'production',
    }
  }
})

// Start the server
server.listen()

console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Hocuspocus Server Running                         ║
║                                                        ║
║   Port: ${PORT}                                        ║
║   WebSocket: ws://localhost:${PORT}                    ║
║   Environment: ${config.nodeEnv}                       ║
║                                                        ║
║   Ready for real-time collaboration! ✨               ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`)

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Hocuspocus] Shutting down gracefully...')
  await server.destroy()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n[Hocuspocus] Shutting down gracefully...')
  await server.destroy()
  process.exit(0)
})

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Hocuspocus] Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('[Hocuspocus] Uncaught Exception:', error)
  process.exit(1)
})

