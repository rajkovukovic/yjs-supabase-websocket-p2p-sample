'use client'

import { useSnapshot } from 'valtio'
import { documentState } from '../store/document'

export function StatusBar() {
  const snap = useSnapshot(documentState)
  
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
      <div className={`flex items-center gap-2 ${snap.synced ? 'text-green-600' : 'text-yellow-600'}`}>
        <div className={`w-2 h-2 rounded-full ${snap.synced ? 'bg-green-600' : 'bg-yellow-600 animate-pulse'}`} />
        {snap.synced ? 'Synced' : 'Syncing...'}
      </div>
      
      <div className="text-gray-600 text-sm">
        Status: <span className="font-medium">{snap.status}</span>
      </div>
      
      <div className="text-gray-600 text-sm">
        Peers: <span className="font-medium">{snap.peers}</span>
      </div>
      
      <div className="text-gray-600 text-sm">
        Rectangles: <span className="font-medium">{snap.rectangles.length}</span>
      </div>
      
      <div className="ml-auto text-gray-500 text-xs">
        Click to add rectangle • Cmd+Click to pan • Scroll to zoom
      </div>
    </div>
  )
}

