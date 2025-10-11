'use client'

import { useMemo } from 'react'
import { type PresenceUser } from '@/hooks/useAppPresence'

interface DocumentPresenceProps {
  documentName: string
  onlineUsers: PresenceUser[]
}

export function DocumentPresence({ documentName, onlineUsers }: DocumentPresenceProps) {
  // Filter users who are currently viewing this document - use useMemo to prevent flickering
  const usersOnDocument = useMemo(() => {
    return onlineUsers.filter(
      (user) => user.currentDocumentId === documentName
    )
  }, [onlineUsers, documentName])

  if (usersOnDocument.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="flex -space-x-1.5">
        {usersOnDocument.slice(0, 3).map((user) => (
          <div
            key={user.clientId}
            className="group relative"
            title={`${user.name} (${user.email})`}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[9px] shadow-md ring-2 ring-white"
              style={{ backgroundColor: user.color }}
            >
              {user.shortName}
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl">
              <div className="font-semibold">{user.name}</div>
              <div className="text-gray-300 text-[10px]">Viewing now</div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>
        ))}
        {usersOnDocument.length > 3 && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-400 text-white font-bold text-[9px] shadow-md ring-2 ring-white"
            title={`+${usersOnDocument.length - 3} more`}
          >
            +{usersOnDocument.length - 3}
          </div>
        )}
      </div>
    </div>
  )
}

