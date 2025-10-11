'use client'

import { OnlineUser } from '@/hooks/useAppPresence'
import { getShortName } from '@/lib/userUtils'

interface AppOnlineUsersProps {
  onlineUsers: OnlineUser[]
}

export function AppOnlineUsers({ onlineUsers }: AppOnlineUsersProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {onlineUsers.slice(0, 5).map((user) => (
          <div
            key={user.clientId}
            className="group relative"
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-md ring-2 ring-white"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {getShortName(user.name)}
            </div>
            <div className="pointer-events-none absolute top-full left-0 z-50 mt-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100">
              <div className="font-semibold">{user.name}</div>
              {user.device && (
                <div className="text-[11px] text-gray-400">{user.device}</div>
              )}
              <div className="text-[10px] text-gray-300">
                {user.currentDocumentId
                  ? `in ${user.currentDocumentId}`
                  : 'Online'}
              </div>
              <div className="absolute bottom-full left-3">
                <div className="border-4 border-transparent border-b-gray-900" />
              </div>
            </div>
          </div>
        ))}
        {onlineUsers.length > 5 && (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-400 text-[10px] font-bold text-white shadow-md ring-2 ring-white"
            title={`+${onlineUsers.length - 5} more`}
          >
            +{onlineUsers.length - 5}
          </div>
        )}
      </div>
      <span className="text-sm text-gray-500">
        {onlineUsers.length} {onlineUsers.length === 1 ? 'other' : 'others'}{' '}
        online
      </span>
    </div>
  )
}

