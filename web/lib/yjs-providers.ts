import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'
import { documentState } from '@/store/document'

export function setupProviders(documentName: string, ydoc: Y.Doc) {
  // 1. IndexedDB (local persistence)
  const indexeddbProvider = new IndexeddbPersistence(documentName, ydoc)
  
  indexeddbProvider.on('synced', () => {
    console.log('✅ IndexedDB loaded')
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
  
  // 3. WebRTC (peer-to-peer) - ENABLED for P2P sync
  // WebRTC provides direct peer-to-peer connection for faster sync
  // Falls back to Hocuspocus if P2P connection fails
  let webrtcProvider: WebrtcProvider | null = null
  
  const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL
  const webrtcPassword = process.env.NEXT_PUBLIC_WEBRTC_PASSWORD
  
  if (signalingUrl) {
    console.log('🔗 Initializing WebRTC with signaling server:', signalingUrl)
    
    webrtcProvider = new WebrtcProvider(documentName, ydoc, {
      signaling: [signalingUrl],
      password: webrtcPassword || undefined,
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
    
    webrtcProvider.on('synced', ({ synced }: { synced: boolean }) => {
      console.log('✅ WebRTC synced:', synced)
    })
    
    webrtcProvider.on('peers', ({ added, removed, webrtcPeers }: any) => {
      documentState.peers = webrtcPeers.length
      console.log('👥 P2P peers:', {
        added,
        removed,
        total: webrtcPeers.length
      })
    })
  } else {
    console.warn('⚠️ NEXT_PUBLIC_SIGNALING_URL not set, WebRTC P2P disabled')
  }
  
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

