'use client'

import React, { useEffect, useState, useContext, createContext } from 'react'
import * as Y from 'yjs'
import { setupProviders } from '../lib/yjs-providers'
import { syncYjsToValtio, docState } from '../store/document'
import { getDeviceInfo } from '@/lib/deviceInfo'
import { EntityType } from '@/lib/schemas'

const YjsContext = createContext<Y.Doc | null>(null)

export function YjsProvider({
  entityType,
  entityId,
  children,
}: {
  entityType: EntityType
  entityId: string
  children: React.ReactNode
}) {
  const [ydoc] = useState(() => new Y.Doc())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const providers = setupProviders(entityType, entityId, ydoc)

    // Store providers on the ydoc for access by other hooks
    ;(ydoc as any)._hocuspocusProvider = providers.hocuspocusProvider
    ;(ydoc as any)._webrtcProvider = providers.webrtcProvider

    // Sync Yjs to Valtio
    const unsyncYjs = syncYjsToValtio(ydoc, entityType)

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
      docState.synced = true
    })

    providers.hocuspocusProvider.on('status', ({ status }: { status: any }) => {
      docState.status = status
    })

    // Track connected users via Awareness (works with Hocuspocus, no WebRTC needed)
    const awareness = providers.hocuspocusProvider.awareness

    const updatePeerCount = () => {
      // Get all awareness states (including self)
      const states = Array.from(awareness.getStates().keys())
      // Subtract 1 to exclude self
      docState.peers = Math.max(0, states.length - 1)
    }

    awareness.on('change', updatePeerCount)
    updatePeerCount() // Initial count

    // The Hocuspocus awareness is the source of truth for connected users.
    // WebRTC peer count reflects only direct P2P connections and can be a subset.
    // Relying on awareness alone provides a more consistent user count.
    // if (providers.webrtcProvider) {
    //   providers.webrtcProvider.on('peers', ({ webrtcPeers }: any) => {
    //     // Use WebRTC peer count if available (more accurate for P2P)
    //     docState.peers = webrtcPeers.length
    //   })
    // }

    return () => {
      clearTimeout(timeout)
      unsyncYjs()
      // Clean up provider references
      delete (ydoc as any)._hocuspocusProvider
      delete (ydoc as any)._webrtcProvider
      providers.destroy()
    }
  }, [entityType, entityId, ydoc])

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

  useEffect(() => {
    if (awareness) {
      const deviceInfo = getDeviceInfo()
      awareness.setLocalStateField('device', deviceInfo.full)
    }
  }, [awareness])

  return awareness
}

