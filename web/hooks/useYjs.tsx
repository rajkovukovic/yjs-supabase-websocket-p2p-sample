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
  const [synced, setSynced] = useState(false)
  
  useEffect(() => {
    const providers = setupProviders(documentName, ydoc)
    
    // Sync Yjs to Valtio
    const unsyncYjs = syncYjsToValtio(ydoc)
    
    // Track sync status
    providers.hocuspocusProvider.on('synced', () => {
      documentState.synced = true
      setSynced(true)
    })
    
    providers.hocuspocusProvider.on('status', ({ status }: { status: any }) => {
      documentState.status = status
    })
    
    // Track peers
    providers.webrtcProvider.on('peers', ({ webrtcPeers }: any) => {
      documentState.peers = webrtcPeers.length
    })
    
    return () => {
      unsyncYjs()
      providers.destroy()
    }
  }, [documentName, ydoc])
  
  if (!synced) {
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

