import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'

export function setupProviders(documentName: string, ydoc: Y.Doc) {
  // 1. IndexedDB (local persistence)
  const indexeddbProvider = new IndexeddbPersistence(documentName, ydoc)
  
  indexeddbProvider.on('synced', () => {
    console.log('IndexedDB loaded')
  })
  
  // 2. Hocuspocus (WebSocket, authoritative server)
  const hocuspocusProvider = new HocuspocusProvider({
    url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || 'ws://localhost:1234',
    name: documentName,
    document: ydoc,
    
    // MVP: Provide a dummy token to satisfy HocuspocusProvider v2.15.3 client-side validation
    // The server's onAuthenticate hook accepts all connections without checking the token
    // Any non-empty string works - using a function ensures it's available on reconnection
    token: () => 'mvp-anonymous-access',
    
    // Set a very high message reconnect timeout to prevent premature disconnections
    // This prevents the "authentication token required" warning during long sessions
    // 3600000 ms = 1 hour
    messageReconnectTimeout: 3600000,
    
    onSynced: ({ state }) => {
      console.log('Hocuspocus synced:', state)
    },
    
    onStatus: ({ status }) => {
      console.log('Connection status:', status)
    },
    
    onAuthenticationFailed: ({ reason }) => {
      console.error('❌ Authentication failed:', reason)
      console.error('Error details:', JSON.stringify(reason, null, 2))
      console.error('This usually indicates a server-side authentication rejection')
    },
    
    onClose: ({ event }) => {
      console.warn('Connection closed:', event.code, event.reason)
    },
    
    onOpen: () => {
      console.log('✅ Connection opened successfully')
    }
  })
  
  // 3. WebRTC (peer-to-peer) - DISABLED FOR MVP
  // WebRTC is optional and not required when using Hocuspocus
  // To enable WebRTC, you need a compatible signaling server
  // (not Socket.IO - requires y-webrtc's WebSocket protocol)
  // For now, we rely on Hocuspocus for all real-time sync
  let webrtcProvider: any = null
  
  // Uncomment to enable WebRTC with custom signaling server:
  /*
  webrtcProvider = new WebrtcProvider(documentName, ydoc, {
    signaling: ['ws://your-signaling-server:port'],
    awareness: hocuspocusProvider.awareness,
    maxConns: 20,
    filterBcConns: true,
    peerOpts: {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    }
  })
  
  webrtcProvider.on('synced', (synced: boolean) => {
    console.log('WebRTC synced:', synced)
  })
  
  webrtcProvider.on('peers', ({ added, removed, webrtcPeers }: any) => {
    documentState.peers = webrtcPeers.length
    console.log('P2P peers:', {
      added,
      removed,
      total: webrtcPeers.length
    })
  })
  */
  
  return {
    indexeddbProvider,
    hocuspocusProvider,
    webrtcProvider,
    
    destroy: () => {
      indexeddbProvider.destroy()
      hocuspocusProvider.destroy()
      if (webrtcProvider) {
        webrtcProvider.destroy()
      }
    }
  }
}

