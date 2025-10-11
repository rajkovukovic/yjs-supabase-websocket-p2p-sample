'use client'

import React, { useEffect, useState, useContext, createContext } from 'react'
import * as Y from 'yjs'
import { setupProviders } from '../lib/yjs-providers'
import { syncYjsToValtio, documentState } from '../store/document'

const YjsContext = createContext<Y.Doc | null>(null)

export function YjsProvider({ 
  documentName, 
  children 
}: { 
  documentName: string
  children: React.ReactNode 
}) {
  const [ydoc] = useState(() => new Y.Doc())
  const [ready, setReady] = useState(false)
  
  useEffect(() => {
    const providers = setupProviders(documentName, ydoc)
    
    // Store the hocuspocus provider on the ydoc for access by other hooks
    ;(ydoc as any)._hocuspocusProvider = providers.hocuspocusProvider
    
    // Sync Yjs to Valtio
    const unsyncYjs = syncYjsToValtio(ydoc)
    
    // Show UI as soon as IndexedDB loads (don't wait for network)
    providers.indexeddbProvider.on('synced', () => {
      setReady(true)
    })
    
    // Also set ready after a short timeout as fallback
    const timeout = setTimeout(() => {
      setReady(true)
    }, 1000)
    
    // Track sync status for Hocuspocus
    providers.hocuspocusProvider.on('synced', () => {
      documentState.synced = true
    })
    
    providers.hocuspocusProvider.on('status', ({ status }: { status: any }) => {
      documentState.status = status
    })
    
    // Track connected users via Awareness (works with Hocuspocus, no WebRTC needed)
    const awareness = providers.hocuspocusProvider.awareness
    
    const updatePeerCount = () => {
      // Get all awareness states (including self)
      const states = Array.from(awareness.getStates().keys())
      // Subtract 1 to exclude self
      documentState.peers = Math.max(0, states.length - 1)
    }
    
    awareness.on('change', updatePeerCount)
    updatePeerCount() // Initial count
    
    // Also track WebRTC peers if enabled (optional)
    if (providers.webrtcProvider) {
      providers.webrtcProvider.on('peers', ({ webrtcPeers }: any) => {
        // Use WebRTC peer count if available (more accurate for P2P)
        documentState.peers = webrtcPeers.length
      })
    }
    
    return () => {
      clearTimeout(timeout)
      unsyncYjs()
      // Clean up the provider reference
      delete (ydoc as any)._hocuspocusProvider
      providers.destroy()
    }
  }, [documentName, ydoc])
  
  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }
  
  return (
    <YjsContext.Provider value={ydoc}>
      {children}
    </YjsContext.Provider>
  )
}

export function useYDoc() {
  const ydoc = useContext(YjsContext)
  if (!ydoc) throw new Error('useYDoc must be used within YjsProvider')
  return ydoc
}

// Hook for awareness (cursors, presence)
export function useAwareness() {
  const ydoc = useYDoc()
  const [awareness, setAwareness] = useState<any>(null)
  
  useEffect(() => {
    // Get awareness from hocuspocus provider
    const provider = (ydoc as any)._hocuspocusProvider
    if (provider) {
      setAwareness(provider.awareness)
    }
  }, [ydoc])
  
  return awareness
}

