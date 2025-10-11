'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSnapshot } from 'valtio'
import { documentState } from '@/store/document'
import { useAwareness, useYDoc } from '@/hooks/useYjs'
import { PresenceUser } from '@/hooks/usePresence'
import { getShortName } from '@/lib/userUtils'

interface DocumentStatusToolbarProps {
  documentName: string
}

export function DocumentStatusToolbar({ documentName }: DocumentStatusToolbarProps) {
  const router = useRouter()
  const snap = useSnapshot(documentState)
  const awareness = useAwareness()
  const ydoc = useYDoc()
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [webrtcPeerIds, setWebrtcPeerIds] = useState<Set<number>>(new Set())

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
      // webrtcConns is an object where keys are peer IDs (as strings)
      // webrtcPeers is an array of peer IDs that have been discovered
      const connectedPeerIds = new Set<number>()
      
      if (webrtcConns && Object.keys(webrtcConns).length > 0) {
        // Get all awareness states
        const states = awareness.getStates()
        
        // y-webrtc uses awareness clientID as the peer ID
        // webrtcConns keys are these IDs as strings
        const webrtcConnKeys = Object.keys(webrtcConns)
        
        console.log('🔍 Checking P2P connections:', {
          webrtcConnKeys,
          awarenessStates: Array.from(states.keys()),
          myClientId: awareness.clientID
        })
        
        states.forEach((state: any, clientId: number) => {
          // Skip self
          if (clientId === awareness.clientID) return
          
          // Check if this awareness client ID is in the WebRTC connections
          // The webrtcConns keys are peer IDs as strings
          const clientIdStr = String(clientId)
          const hasP2PConnection = webrtcConnKeys.includes(clientIdStr)
          
          if (hasP2PConnection) {
            console.log(`✅ P2P connection found for client ${clientId}`)
            connectedPeerIds.add(clientId)
          }
        })
        
        console.log('🔗 P2P Status:', {
          totalConnections: Object.keys(webrtcConns).length,
          connectedPeerIds: Array.from(connectedPeerIds),
          awarenessStates: Array.from(states.keys()),
          webrtcPeersCount: webrtcPeers?.length || 0
        })
      }
      
      setWebrtcPeerIds(connectedPeerIds)
    }

    webrtcProvider.on('peers', updateWebrtcPeers)
    
    // Initial update
    const initialConns = webrtcProvider.room?.webrtcConns || {}
    const initialPeers = webrtcProvider.room?.webrtcPeers || []
    updateWebrtcPeers({ webrtcConns: initialConns, webrtcPeers: initialPeers })

    return () => webrtcProvider.off('peers', updateWebrtcPeers)
  }, [ydoc, awareness])

  // Filter users who are in this document (excluding self)
  const currentDocumentUsers = presenceUsers.filter(
    (user) => awareness && user.clientId !== awareness.clientID
  )

  return (
    <div className="fixed top-6 left-6 z-20 flex items-center gap-3 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-lg border border-gray-200/50">
      {/* Back Button */}
      <button
        onClick={() => router.push('/')}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        title="Back to Home"
      >
        <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-300" />

      {/* Sync Status */}
      <div 
        className={`flex items-center gap-1.5 ${snap.synced ? 'text-emerald-600' : 'text-amber-600'}`} 
        title={snap.synced ? 'Synced' : 'Syncing...'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {snap.synced ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="2s" repeatCount="indefinite" />
            </path>
          )}
        </svg>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-300" />

      {/* Connection Status */}
      <div 
        className={`flex items-center gap-1.5 ${snap.status === 'connected' ? 'text-emerald-600' : 'text-gray-400'}`} 
        title={`Status: ${snap.status}`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-300" />

      {/* Presence Users */}
      {currentDocumentUsers.length > 0 && (
        <div className="flex -space-x-2">
          {currentDocumentUsers.slice(0, 5).map((user) => {
            const hasP2PConnection = webrtcPeerIds.has(user.clientId)
            const shortName = getShortName(user.name)
            
            return (
              <div
                key={user.clientId}
                className="group relative"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md ring-2 ${
                    hasP2PConnection 
                      ? 'ring-emerald-400 ring-[3px]' 
                      : 'ring-white'
                  }`}
                  style={{ backgroundColor: user.color }}
                  title={`${user.name}${hasP2PConnection ? ' (P2P)' : ''}`}
                >
                  {shortName}
                </div>
                
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-gray-300 text-[10px]">
                    {hasP2PConnection ? 'Connected via P2P' : 'Connected via server'}
                  </div>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-[-4px]">
                    <div className="border-4 border-transparent border-b-gray-900" />
                  </div>
                </div>
              </div>
            )
          })}
          {currentDocumentUsers.length > 5 && (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-400 text-white font-bold text-xs shadow-md ring-2 ring-white"
              title={`+${currentDocumentUsers.length - 5} more`}
            >
              +{currentDocumentUsers.length - 5}
            </div>
          )}
        </div>
      )}
      
      {currentDocumentUsers.length === 0 && (
        <div className="flex items-center gap-1.5 text-gray-500 text-sm" title="No other users online">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="text-xs">Just you</span>
        </div>
      )}
    </div>
  )
}

