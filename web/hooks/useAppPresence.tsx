'use client'

import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useAuth } from '@/hooks/useAuth'

export interface PresenceUser {
  clientId: number
  name: string
  email: string
  avatarUrl?: string
  color: string
}

const generateColorFromString = (str: string): string => {
  // Generate a consistent color based on user email
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colors = [
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#F59E0B', // amber
    '#10B981', // emerald
    '#06B6D4', // cyan
    '#F97316', // orange
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#EF4444', // red
  ]
  
  return colors[Math.abs(hash) % colors.length]
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
      url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || 'ws://localhost:1234',
      name: '__app_presence__', // Special document name for app-level presence
      document: globalYDoc,
      token: () => 'mvp-anonymous-access',
      messageReconnectTimeout: 3600000,
    })
  }
  
  return { ydoc: globalYDoc, provider: globalProvider }
}

export const useAppPresence = () => {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!user) return

    const { provider } = getGlobalPresenceProvider()
    if (!provider || !provider.awareness) {
      console.warn('App presence awareness not available')
      return
    }

    const awareness = provider.awareness

    // Set local awareness state with user info
    const localState = {
      name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
      email: user.email || '',
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      color: generateColorFromString(user.email || 'default'),
    }

    awareness.setLocalState(localState)

    // Update online users list
    const updateOnlineUsers = () => {
      const states = awareness.getStates()
      const users: PresenceUser[] = []

      states.forEach((state: any, clientId: number) => {
        if (state && state.name) {
          users.push({
            clientId,
            name: state.name,
            email: state.email,
            avatarUrl: state.avatarUrl,
            color: state.color || generateColorFromString(state.email || String(clientId)),
          })
        }
      })

      setOnlineUsers(users)
    }

    // Initial update
    updateOnlineUsers()

    // Listen for awareness changes
    awareness.on('change', updateOnlineUsers)

    // Cleanup: remove local state when component unmounts
    return () => {
      awareness.off('change', updateOnlineUsers)
      awareness.setLocalState(null)
    }
  }, [user])

  return { onlineUsers }
}

