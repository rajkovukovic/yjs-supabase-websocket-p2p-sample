'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSnapshot } from 'valtio'
import { documentState } from '@/store/document'
import { useAwareness, useYDoc } from '@/hooks/useYjs'
import { useAppPresence } from '@/hooks/useAppPresence'
import { useAuth } from '@/hooks/useAuth'
import { PresenceUser } from '@/hooks/usePresence'
import { getShortName } from '@/lib/userUtils'
import {
  Wifi,
  WifiOff,
  CloudCheck,
  Loader,
  ArrowLeft,
  Users,
} from 'lucide-react'

interface DocumentStatusToolbarProps {
  documentName: string
}

export function DocumentStatusToolbar({
  documentName,
}: DocumentStatusToolbarProps) {
  const router = useRouter()
  const snap = useSnapshot(documentState)
  const awareness = useAwareness()
  const ydoc = useYDoc()
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [webrtcPeerIds, setWebrtcPeerIds] = useState<Set<number>>(new Set())

  const { user } = useAuth()
  const {
    onlineUsers: appOnlineUsers,
    localClientId,
    setCurrentDocumentId,
  } = useAppPresence()

  // Set current document for app-level presence tracking
  useEffect(() => {
    if (documentName) {
      setCurrentDocumentId(documentName)
    }
    return () => {
      setCurrentDocumentId(null)
    }
  }, [documentName, setCurrentDocumentId])

  // Track presence users from awareness
  useEffect(() => {
    if (!awareness) return

    const updatePresenceUsers = () => {
      const states = awareness.getStates()
      const users: PresenceUser[] = []

      states.forEach((state: any, clientId: number) => {
        if (state && state.name) {
          users.push({
            clientId,
            name: state.name,
            email: state.email,
            avatarUrl: state.avatarUrl,
            color: state.color,
          })
        }
      })

      setPresenceUsers(users)
    }

    updatePresenceUsers()
    awareness.on('change', updatePresenceUsers)

    return () => awareness.off('change', updatePresenceUsers)
  }, [awareness])

  // Track WebRTC P2P connections
  useEffect(() => {
    if (!ydoc || !awareness) return

    // Get WebRTC provider if available
    const webrtcProvider = (ydoc as any)._webrtcProvider
    if (!webrtcProvider) {
      console.log('⚠️ WebRTC provider not available')
      return
    }

    console.log('✅ WebRTC provider found, setting up peer tracking')

    const updateWebrtcPeers = ({ webrtcConns, webrtcPeers }: any) => {
      // webrtcConns is a Map where keys are peer UUIDs (y-webrtc's room.peerId)
      // These UUIDs are NOT the same as awareness client IDs
      // If we have ANY WebRTC connections, mark all other awareness users as P2P connected
      const connectedPeerIds = new Set<number>()
      
      // webrtcConns is a Map, so use .size instead of Object.keys()
      const hasAnyP2PConnections = webrtcConns && webrtcConns.size > 0
      
      if (hasAnyP2PConnections) {
        // Get all awareness states
        const states = awareness.getStates()
        
        console.log('🔍 Checking P2P connections:', {
          webrtcConnectionCount: webrtcConns.size,
          awarenessStates: Array.from(states.keys()),
          myClientId: awareness.clientID
        })
        
        // If we have WebRTC connections, mark ALL other awareness users as P2P connected
        // This is correct because y-webrtc connects to peers discovered via awareness
        states.forEach((state: any, clientId: number) => {
          // Skip self
          if (clientId === awareness.clientID) return
          
          // If we have any P2P connections and this is another user, they're connected via P2P
          console.log(`✅ P2P connection found for client ${clientId}`)
          connectedPeerIds.add(clientId)
        })
        
        console.log('🔗 P2P Status:', {
          totalP2PConnections: webrtcConns.size,
          connectedPeerIds: Array.from(connectedPeerIds),
          awarenessStates: Array.from(states.keys()),
          webrtcPeersCount: webrtcPeers?.length || 0
        })
      }
      
      setWebrtcPeerIds(connectedPeerIds)
    }

    webrtcProvider.on('peers', updateWebrtcPeers)
    webrtcProvider.on('synced', () => {
      // When synced event fires, check for P2P connections
      const currentConns = webrtcProvider.room?.webrtcConns || new Map()
      const currentPeers = webrtcProvider.room?.webrtcPeers || []
      updateWebrtcPeers({ webrtcConns: currentConns, webrtcPeers: currentPeers })
    })
    
    // Initial update - webrtcConns is a Map, keep it as is or use an empty Map
    const initialConns = webrtcProvider.room?.webrtcConns || new Map()
    const initialPeers = webrtcProvider.room?.webrtcPeers || []
    updateWebrtcPeers({ webrtcConns: initialConns, webrtcPeers: initialPeers })
    
    // Poll for connection status changes since 'peers' event only fires on discovery
    const pollInterval = setInterval(() => {
      const currentConns = webrtcProvider.room?.webrtcConns || new Map()
      const currentPeers = webrtcProvider.room?.webrtcPeers || []
      updateWebrtcPeers({ webrtcConns: currentConns, webrtcPeers: currentPeers })
    }, 2000)

    return () => {
      webrtcProvider.off('peers', updateWebrtcPeers)
      webrtcProvider.off('synced')
      clearInterval(pollInterval)
    }
  }, [ydoc, awareness])

  // Filter users who are in this document (excluding self)
  const documentPresenceUsers = presenceUsers.filter(
    (user) => awareness && user.clientId !== awareness.clientID,
  )

  // Get emails of users in the current document to filter them out from the app-level list
  const emailsInThisDocument = new Set(presenceUsers.map((u) => u.email))

  const otherOnlineUsers = appOnlineUsers.filter(
    (u) => u.email !== user?.email && !emailsInThisDocument.has(u.email),
  )

  return (
    <div className="fixed top-6 left-6 z-20 flex items-center gap-3 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-lg border border-gray-200/50">
      {/* Back Button */}
      <button
        onClick={() => router.push('/')}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        title="Back to Home"
      >
        <ArrowLeft className="w-4 h-4 text-gray-700" />
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-300" />

      {/* Sync Status */}
      <div
        className={`flex items-center gap-1.5 ${
          snap.synced ? 'text-emerald-600' : 'text-amber-600'
        }`}
        title={snap.synced ? 'Synced' : 'Syncing...'}
      >
        {snap.synced ? (
          <CloudCheck className="w-4 h-4" />
        ) : (
          <Loader className="w-4 h-4 animate-spin" />
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-300" />

      {/* Connection Status */}
      <div
        className={`flex items-center gap-1.5 ${
          snap.status === 'connected' ? 'text-emerald-600' : 'text-gray-400'
        }`}
        title={`Status: ${snap.status}`}
      >
        {snap.status === 'connected' ? (
          <Wifi className="w-4 h-4" />
        ) : (
          <WifiOff className="w-4 h-4" />
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-300" />

      {/* Presence Users */}
      <div className="flex items-center gap-3">
        {/* Group 1: Document name and users in this document */}
        <div className="flex items-center gap-2">
          <span
            className="truncate max-w-[150px] text-sm font-semibold text-gray-800"
            title={documentName}
          >
            {documentName}
          </span>

          {documentPresenceUsers.length > 0 && (
            <div className="flex -space-x-2">
              {documentPresenceUsers.slice(0, 5).map((user) => {
                const hasP2PConnection = webrtcPeerIds.has(user.clientId)
                const shortName = getShortName(user.name)

                return (
                  <div key={user.clientId} className="group relative">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-md ring-2 ${
                        hasP2PConnection
                          ? 'ring-[3px] ring-emerald-400'
                          : 'ring-white'
                      }`}
                      style={{ backgroundColor: user.color }}
                      title={`${user.name}${
                        hasP2PConnection ? ' (P2P)' : ''
                      }`}
                    >
                      {shortName}
                    </div>

                    {/* Tooltip */}
                    <div className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100">
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-[10px] text-gray-300">
                        {hasP2PConnection
                          ? 'Connected via P2P'
                          : 'Connected via server'}
                      </div>
                      <div className="absolute bottom-full left-1/2 mb-[-4px] -translate-x-1/2">
                        <div className="border-4 border-transparent border-b-gray-900" />
                      </div>
                    </div>
                  </div>
                )
              })}
              {documentPresenceUsers.length > 5 && (
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-400 text-xs font-bold text-white shadow-md ring-2 ring-white"
                  title={`+${documentPresenceUsers.length - 5} more`}
                >
                  +{documentPresenceUsers.length - 5}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider and Group 2: Other online users */}
        {otherOnlineUsers.length > 0 && (
          <>
            <div className="w-px h-5 bg-gray-300" />
            <div className="flex -space-x-2 opacity-60">
              {otherOnlineUsers.slice(0, 5).map((otherUser) => (
                <div key={otherUser.email} className="group relative">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md ring-2 ring-white"
                    style={{ backgroundColor: otherUser.color }}
                    title={otherUser.name}
                  >
                    {getShortName(otherUser.name)}
                  </div>
                  <div className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100">
                    <div className="font-semibold">{otherUser.name}</div>
                    <div className="text-[10px] text-gray-300">Online</div>
                    <div className="absolute bottom-full left-1/2 mb-[-4px] -translate-x-1/2">
                      <div className="border-4 border-transparent border-b-gray-900" />
                    </div>
                  </div>
                </div>
              ))}
              {otherOnlineUsers.length > 5 && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-400 text-white font-bold text-xs shadow-md ring-2 ring-white"
                  title={`+${otherOnlineUsers.length - 5} more`}
                >
                  +{otherOnlineUsers.length - 5}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

