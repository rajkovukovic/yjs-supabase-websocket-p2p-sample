'use client'

import { useSnapshot } from 'valtio'
import { docState } from '../store/document'
import { HardDrive, Wifi, Users } from 'lucide-react'
import { useMemo } from 'react'

const StatusIndicator = ({ status }: { status: string }) => {
  const statusConfig = useMemo(() => {
    switch (status) {
      case 'synced':
      case 'connected':
        return { color: 'text-green-600', bgColor: 'bg-green-600', pulse: false }
      case 'syncing':
      case 'connecting':
        return { color: 'text-yellow-600', bgColor: 'bg-yellow-600', pulse: true }
      case 'disconnected':
      default:
        return { color: 'text-red-600', bgColor: 'bg-red-600', pulse: false }
    }
  }, [status])

  return (
    <div className={`flex items-center gap-2 ${statusConfig.color}`}>
      <div className={`w-2 h-2 rounded-full ${statusConfig.bgColor} ${statusConfig.pulse ? 'animate-pulse' : ''}`} />
      <span className="capitalize">{status}</span>
    </div>
  )
}

export function StatusBar() {
  const snap = useSnapshot(docState)
  
  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm">
      <div className="flex items-center gap-2" title="Local Cache (IndexedDB)">
        <HardDrive className="w-4 h-4 text-gray-500" />
        <StatusIndicator status={snap.connection.indexeddb} />
      </div>
      
      <div className="flex items-center gap-2" title="Server Connection (WebSocket)">
        <Wifi className="w-4 h-4 text-gray-500" />
        <StatusIndicator status={snap.connection.websocket} />
      </div>

      <div className="flex items-center gap-2" title="Peer-to-Peer (WebRTC)">
        <Users className="w-4 h-4 text-gray-500" />
        <StatusIndicator status={snap.connection.webrtc} />
      </div>

      <div className="text-gray-600">
        Peers: <span className="font-medium">{snap.peers}</span>
      </div>
      
      <div className="ml-auto text-gray-500 text-xs">
        Real-time collaboration powered by Yjs
      </div>
    </div>
  )
}

