// Load config FIRST - this initializes environment variables
import { config } from './config.js'
import { Server } from '@hocuspocus/server'
import { SupabaseDatabase, storeUpdate } from './extensions/supabase-db.js'

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
    SupabaseDatabase
  ],
  
  /**
   * Authentication hook
   * For MVP: Authentication is DISABLED - no onAuthenticate hook
   * When this hook is not defined, Hocuspocus allows all connections without authentication
   * TODO: Add proper auth in production by uncommenting below
   */
  // async onAuthenticate({ documentName, requestHeaders, requestParameters }) {
  //   console.log(`[Hocuspocus] Auth request for document: ${documentName}`)
  //   
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
    console.log(`[Hocuspocus] Document loaded: ${documentName}`)
    console.log(`[Hocuspocus] Document has ${document.getArray('rectangles').length} rectangles`)
  },
  
  /**
   * Called when a document changes
   * Store incremental updates for audit/debugging
   */
  async onChange({ documentName, document, context }) {
    console.log(`[Hocuspocus] Document changed: ${documentName}`)
    
    // Store incremental update (optional, for audit trail)
    if (context.update) {
      try {
        await storeUpdate(
          documentName,
          context.update,
          context.clientId || 0
        )
      } catch (error) {
        console.error('[Hocuspocus] Error storing update:', error)
      }
    }
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
  async onConnect({ documentName }) {
    console.log(`[Hocuspocus] Client connected to ${documentName}`)
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

