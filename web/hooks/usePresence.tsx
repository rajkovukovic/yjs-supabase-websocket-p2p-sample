'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useYDoc } from '@/hooks/useYjs'

export interface PresenceUser {
  clientId: number
  name: string
  email: string
  avatarUrl?: string
  color: string
  cursor?: { x: number; y: number }
  device?: string
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

export const usePresence = () => {
  const { user } = useAuth()
  const ydoc = useYDoc()
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!ydoc || !user) return

    // Get awareness from the hocuspocus provider
    const provider = (ydoc as any)._hocuspocusProvider
    if (!provider || !provider.awareness) {
      console.warn('Awareness not available')
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
  }, [ydoc, user])

  return { onlineUsers }
}

