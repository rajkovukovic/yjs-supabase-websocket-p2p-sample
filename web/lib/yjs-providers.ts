import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import { docState } from '@/store/document'
import { HOCUSPOCUS_URL, WEBRTC_PASSWORD, Y_WEBRTC_SIGNALING_URL } from './Env'
import { EntityType, entityConfigs } from './schemas'

export function setupProviders(
  entityType: EntityType,
  entityId: string,
  ydoc: Y.Doc,
) {
  // Use the entityId as the unique name for all providers
  const roomName = entityId

  // Initialize the Yjs document structure based on the entity type
  const config = entityConfigs[entityType]
  if (config && config.yjsBuilder) {
    config.yjsBuilder(ydoc)
  }

  // 1. IndexedDB (local persistence)
  const indexeddbProvider = new IndexeddbPersistence(roomName, ydoc)
  
  indexeddbProvider.on('synced', () => {
    console.log('✅ IndexedDB loaded')
  })
  
  // 2. Hocuspocus (WebSocket, authoritative server)
  const hocuspocusProvider = new HocuspocusProvider({
    url: HOCUSPOCUS_URL,
    name: roomName,
    document: ydoc,
    parameters: {
      entityType: entityType,
    },
    
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
    // WebRTC configuration with enhanced STUN/TURN servers
    peerOpts: {
      // Enable trickle ICE for faster connection establishment
      trickle: true,
      config: {
        iceServers: [
          // Google STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Additional public STUN servers for redundancy
          { urls: 'stun:stun.services.mozilla.com' },
          // Free TURN servers from Open Relay Project
          // These help establish connections when direct P2P fails
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        // ICE transport policy - use 'all' to try all connection methods
        iceTransportPolicy: 'all',
        // Bundle policy - use 'max-bundle' for better performance
        bundlePolicy: 'max-bundle',
        // RTCP mux policy - use 'require' for better NAT traversal
        rtcpMuxPolicy: 'require'
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
  
  const webrtcProvider = new WebrtcProvider(roomName, ydoc, webrtcOptions)
  
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
  webrtcProvider.on('peers', ({ webrtcPeers, webrtcConns, bcConns, added, removed }: any) => {
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
      peersAdded: added || [],
      peersRemoved: removed || [],
    })
    
    // Log peer connection/disconnection events
    if (added && added.length > 0) {
      console.log('✅ New peers discovered:', added)
    }
    if (removed && removed.length > 0) {
      console.warn('⚠️ Peers disconnected:', removed)
    }
    
    // Detailed connection status
    if (p2pCount > 0) {
      console.log(`🎉 Successfully established ${p2pCount} P2P connection(s)!`)
    } else if (webrtcPeers && webrtcPeers.length > 0) {
      console.warn(`⚠️ Peers discovered (${webrtcPeers.length}) but no P2P connections established yet`)
      console.log('💡 Tip: This may be normal during initial connection or due to NAT/firewall')
    }
  })
  
  webrtcProvider.on('synced', ({ synced }: any) => {
    if (synced) {
      console.log('✅ WebRTC P2P synchronized')
    } else {
      console.log('⏳ WebRTC P2P syncing...')
    }
  })
  
  // Additional debugging events
  webrtcProvider.on('status', ({ connected }: any) => {
    console.log(`📡 WebRTC provider status: ${connected ? 'connected' : 'disconnected'}`)
  })
  
  // Access internal WebRTC peer connections for detailed debugging
  // This helps identify ICE connection failures
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const room = (webrtcProvider as any).room
      if (room && room.webrtcConns) {
        console.log('🔍 Inspecting WebRTC peer connections...')
        room.webrtcConns.forEach((conn: any, peerId: string) => {
          console.log(`  Peer ${peerId}:`, {
            connected: conn.connected,
            synced: conn.synced,
            closed: conn.closed,
          })
          
          // Access the underlying simple-peer instance for ICE debugging
          if (conn.peer && conn.peer._pc) {
            const pc = conn.peer._pc
            console.log(`  → RTCPeerConnection state:`, {
              connectionState: pc.connectionState,
              iceConnectionState: pc.iceConnectionState,
              iceGatheringState: pc.iceGatheringState,
              signalingState: pc.signalingState,
            })
            
            // Monitor ICE connection state changes
            pc.addEventListener('iceconnectionstatechange', () => {
              console.log(`  → ICE state changed to: ${pc.iceConnectionState}`)
              if (pc.iceConnectionState === 'failed') {
                console.error(`  ❌ ICE connection failed for peer ${peerId}`)
                console.log('  💡 This usually means:')
                console.log('     - NAT/Firewall blocking connection')
                console.log('     - STUN servers unreachable')
                console.log('     - TURN server required but not configured properly')
              } else if (pc.iceConnectionState === 'connected') {
                console.log(`  ✅ ICE connection established for peer ${peerId}`)
              }
            })
            
            // Monitor connection state changes
            pc.addEventListener('connectionstatechange', () => {
              console.log(`  → Connection state changed to: ${pc.connectionState}`)
            })
            
            // Log ICE candidates being gathered
            pc.addEventListener('icecandidate', (event: any) => {
              if (event.candidate) {
                console.log(`  → ICE candidate:`, {
                  type: event.candidate.type,
                  protocol: event.candidate.protocol,
                  address: event.candidate.address,
                })
              }
            })
          }
        })
      }
    }, 3000) // Wait 3 seconds for connections to be established
  }
  
  // Track peer count via Hocuspocus awareness (replaces Socket.IO peer tracking)
  const updatePeerCount = () => {
    const states = Array.from(hocuspocusProvider.awareness.getStates().keys())
    // Subtract 1 to exclude self
    docState.peers = Math.max(0, states.length - 1)
    
    console.log('👥 Awareness changed:', {
      totalClients: states.length,
      peerCount: docState.peers,
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

