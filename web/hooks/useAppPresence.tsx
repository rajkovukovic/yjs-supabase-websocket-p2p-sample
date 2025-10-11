'use client'

import { useEffect, useState, createContext, useCallback } from 'react'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useAuth } from '@/hooks/useAuth'
import { generateColorFromString, getShortName, userColors } from '@/lib/userUtils'
import { HOCUSPOCUS_URL } from '@/lib/Env'
import { RealtimeChannel } from '@supabase/supabase-js'
import { getDeviceInfo } from '@/lib/deviceInfo'

const PRESENCE_CHANNEL = 'app-presence'

export interface OnlineUser {
  clientId: number
  name: string
  shortName: string
  email: string
  avatarUrl?: string
  color: string
  currentDocumentId?: string | null
  device?: string
}

// Singleton Yjs document and provider for app-level presence
let globalYDoc: Y.Doc | null = null
let globalProvider: HocuspocusProvider | null = null
let providerInitialized = false

const getGlobalPresenceProvider = () => {
  if (!globalYDoc) {
    globalYDoc = new Y.Doc()
  }
  
  if (!globalProvider && !providerInitialized) {
    providerInitialized = true
    globalProvider = new HocuspocusProvider({
      url: HOCUSPOCUS_URL,
      name: '__app_presence_tracker__', // Special document name for app-level presence
      document: globalYDoc,
      token: () => 'mvp-anonymous-access',
    })
  }
  
  return { ydoc: globalYDoc, provider: globalProvider }
}

export const useAppPresence = () => {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [localClientId, setLocalClientId] = useState<number | null>(null)
  const [awarenessInstance, setAwarenessInstance] = useState<any>(null)

  useEffect(() => {
    if (!user) return

    const { provider } = getGlobalPresenceProvider()
    if (!provider || !provider.awareness) {
      console.warn('App presence awareness not available')
      return
    }

    const awareness = provider.awareness
    setLocalClientId(awareness.clientID)
    setAwarenessInstance(awareness)

    // Set local awareness state with user info
    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous'
    const deviceInfo = getDeviceInfo()
    const localState = {
      name: userName,
      email: user.email || '',
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      color: generateColorFromString(user.email || 'default'),
      currentDocumentId: null,
      device: deviceInfo.full,
    }

    awareness.setLocalState(localState)

    // Throttle updates to prevent flickering
    let updateTimeout: NodeJS.Timeout | null = null
    
    // Update online users list
    const updateOnlineUsers = () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout)
      }
      
      updateTimeout = setTimeout(() => {
        const states = awareness.getStates()
        const users: OnlineUser[] = []

        states.forEach((state: any, clientId: number) => {
          if (state && state.name) {
            users.push({
              clientId,
              name: state.name,
              shortName: getShortName(state.name),
              email: state.email,
              avatarUrl: state.avatarUrl,
              color: state.color || generateColorFromString(state.email || String(clientId)),
              currentDocumentId: state.currentDocumentId || null,
              device: state.device,
            })
          }
        })

        setOnlineUsers(users)
      }, 150) // Throttle updates to 150ms
    }

    // Initial update
    updateOnlineUsers()

    // Listen for awareness changes
    awareness.on('change', updateOnlineUsers)

    // Cleanup: remove local state when component unmounts
    return () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout)
      }
      awareness.off('change', updateOnlineUsers)
      if (awareness.getLocalState() !== null) {
        awareness.setLocalState(null)
      }
    }
  }, [user])

  // Function to set the current document ID for presence
  const setCurrentDocumentId = useCallback(
    (documentId: string | null) => {
      if (awarenessInstance) {
        awarenessInstance.setLocalStateField('currentDocumentId', documentId)
      }
    },
    [awarenessInstance]
  )

  return { onlineUsers, localClientId, setCurrentDocumentId }
}

