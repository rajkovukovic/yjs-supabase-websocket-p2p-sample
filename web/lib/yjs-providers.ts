import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import { io, Socket } from 'socket.io-client'
import { documentState } from '@/store/document'
import { HOCUSPOCUS_URL, SIGNALING_URL } from './Env'

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
    // The server's onAuthenticate hook accepts all connections without checking the token
    // Any non-empty string works - using a function ensures it's available on reconnection
    token: () => 'mvp-anonymous-access',
    
    onSynced: ({ state }) => {
      console.log('✅ Hocuspocus synced:', state)
    },
    
    onStatus: ({ status }) => {
      console.log('📡 Connection status:', status)
    },
    
    onAuthenticationFailed: ({ reason }) => {
      console.error('❌ Authentication failed:', reason)
      console.error('Error details:', JSON.stringify(reason, null, 2))
      console.error('This usually indicates a server-side authentication rejection')
    },
    
    onClose: ({ event }) => {
      console.warn('⚠️ Connection closed:', event.code, event.reason)
    },
    
    onOpen: () => {
      console.log('✅ WebSocket connection opened successfully')
    }
  })
  
  // 3. Socket.IO Signaling (peer-to-peer discovery)
  // Uses Socket.IO for peer discovery and presence
  let signalingSocket: Socket | null = null
  
  if (SIGNALING_URL) {
    console.log('🔗 Connecting to Socket.IO signaling server:', SIGNALING_URL)
    
    signalingSocket = io(SIGNALING_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    })
    
    signalingSocket.on('connect', () => {
      console.log('✅ Socket.IO signaling connected')
      
      // Join the document room
      signalingSocket?.emit('join', documentName)
    })
    
    signalingSocket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO signaling disconnected:', reason)
      documentState.peers = 0
    })
    
    signalingSocket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message)
    })
    
    // Handle existing peers list
    signalingSocket.on('peers', (peers: string[]) => {
      console.log('👥 Existing peers in room:', peers.length)
      documentState.peers = peers.length
    })
    
    // Handle new peer joining
    signalingSocket.on('peer-joined', (peerId: string) => {
      console.log('➕ New peer joined:', peerId)
      
      // Get updated room info
      signalingSocket?.emit('room-info', documentName, (info: any) => {
        documentState.peers = info.peerCount - 1 // Exclude self
        console.log('👥 Total peers in room:', documentState.peers)
      })
    })
    
    // Handle peer leaving
    signalingSocket.on('peer-left', (peerId: string) => {
      console.log('➖ Peer left:', peerId)
      
      // Get updated room info
      signalingSocket?.emit('room-info', documentName, (info: any) => {
        documentState.peers = info.peerCount - 1 // Exclude self
        console.log('👥 Total peers in room:', documentState.peers)
      })
    })
  } else {
    console.warn('⚠️ NEXT_PUBLIC_SIGNALING_URL not set, peer discovery disabled')
  }
  
  return {
    indexeddbProvider,
    hocuspocusProvider,
    signalingSocket,
    
    destroy: () => {
      indexeddbProvider.destroy()
      hocuspocusProvider.destroy()
      if (signalingSocket) {
        signalingSocket.emit('leave', documentName)
        signalingSocket.disconnect()
      }
    }
  }
}

