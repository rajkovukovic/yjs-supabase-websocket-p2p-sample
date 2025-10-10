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
    
    // No token needed for MVP
    
    onSynced: ({ state }) => {
      console.log('Hocuspocus synced:', state)
    },
    
    onStatus: ({ status }) => {
      console.log('Connection status:', status)
    }
  })
  
  // 3. WebRTC (peer-to-peer) - Use local signaling server
  const webrtcProvider = new WebrtcProvider(documentName, ydoc, {
    // Use local signaling server (from docker-compose)
    signaling: [
      process.env.NEXT_PUBLIC_SIGNALING_URL || 'ws://localhost:4444'
    ],
    
    // Awareness for cursor sharing
    awareness: hocuspocusProvider.awareness,
    
    // Max connections
    maxConns: 20,
    
    // Filter connections (optional)
    filterBcConns: true,
    
    // STUN servers for WebRTC
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
    console.log('P2P peers:', {
      added,
      removed,
      total: webrtcPeers.length
    })
  })
  
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

