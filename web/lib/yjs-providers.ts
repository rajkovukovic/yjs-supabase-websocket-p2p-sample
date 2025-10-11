import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import { documentState } from '@/store/document'
import { HOCUSPOCUS_URL, WEBRTC_PASSWORD, Y_WEBRTC_SIGNALING_URL } from './Env'

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
  
  // 3. WebRTC Provider (peer-to-peer document sync)
  // Uses y-webrtc signaling server for peer discovery
  console.log('🚀 Initializing WebRTC provider for P2P sync')
  
  // Determine signaling configuration
  const signalingServers = Y_WEBRTC_SIGNALING_URL ? [Y_WEBRTC_SIGNALING_URL] : []
  
  const webrtcOptions: any = {
    // Signaling servers for peer discovery across browsers/devices
    // If empty, only BroadcastChannel works (same-browser tabs only)
    signaling: signalingServers,
    // WebRTC configuration with STUN servers
    peerOpts: {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      }
    },
    // Share awareness with Hocuspocus for presence info
    awareness: hocuspocusProvider.awareness,
    // Max number of WebRTC connections
    maxConns: 20,
    // Enable BroadcastChannel for same-browser P2P
    filterBcConns: false,
  }
  
  // Add password only if provided
  if (WEBRTC_PASSWORD) {
    webrtcOptions.password = WEBRTC_PASSWORD
  }
  
  const webrtcProvider = new WebrtcProvider(documentName, ydoc, webrtcOptions)
  
  if (Y_WEBRTC_SIGNALING_URL) {
    console.log('📡 WebRTC provider configured with signaling server:', Y_WEBRTC_SIGNALING_URL)
    console.log('✅ P2P enabled across browsers and devices')
  } else {
    console.log('📡 WebRTC provider configured (BroadcastChannel mode only)')
    console.warn('⚠️ P2P only works within same browser. Set NEXT_PUBLIC_Y_WEBRTC_SIGNALING_URL for cross-browser P2P')
  }
  
  // Expose for debugging
  if (typeof window !== 'undefined') {
    const win = window as any
    win.__WEBRTC_PROVIDER__ = webrtcProvider
    win.__YDOC__ = ydoc
  }
  
  // Debug WebRTC connection states
  webrtcProvider.on('peers', ({ webrtcPeers, webrtcConns, bcConns }: any) => {
    const p2pCount = Object.keys(webrtcConns || {}).length
    const bcCount = bcConns?.size || 0
    const awarenessStates = Array.from(hocuspocusProvider.awareness.getStates().keys())
    
    console.log(`🔗 WebRTC connection state:`, {
      p2pConnections: p2pCount,
      broadcastConnections: bcCount,
      discoveredPeers: webrtcPeers?.length || 0,
      connectedPeerIds: Object.keys(webrtcConns || {}),
      allPeers: webrtcPeers || [],
      awarenessStates: awarenessStates,
      myClientId: hocuspocusProvider.awareness.clientID,
    })
  })
  
  webrtcProvider.on('synced', ({ synced }: any) => {
    if (synced) {
      console.log('✅ WebRTC P2P synchronized')
    }
  })
  
  // Additional debugging events
  webrtcProvider.on('status', ({ status }: any) => {
    console.log('📡 WebRTC status:', status)
  })
  
  // Track peer count via Hocuspocus awareness (replaces Socket.IO peer tracking)
  const updatePeerCount = () => {
    const states = Array.from(hocuspocusProvider.awareness.getStates().keys())
    // Subtract 1 to exclude self
    documentState.peers = Math.max(0, states.length - 1)
    
    console.log('👥 Awareness changed:', {
      totalClients: states.length,
      peerCount: documentState.peers,
      clientIds: states,
      myId: hocuspocusProvider.awareness.clientID
    })
  }
  
  // Initial peer count
  updatePeerCount()
  
  // Update peer count when awareness changes
  hocuspocusProvider.awareness.on('change', updatePeerCount)
  
  return {
    indexeddbProvider,
    hocuspocusProvider,
    webrtcProvider,
    
    destroy: () => {
      indexeddbProvider.destroy()
      hocuspocusProvider.destroy()
      webrtcProvider.destroy()
    }
  }
}

