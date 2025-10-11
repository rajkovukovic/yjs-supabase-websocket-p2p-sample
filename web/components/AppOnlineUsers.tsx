'use client'

import { useAppPresence, type PresenceUser } from '@/hooks/useAppPresence'

export function AppOnlineUsers() {
  const { onlineUsers } = useAppPresence()

  if (onlineUsers.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-white">
          {onlineUsers.length} {onlineUsers.length === 1 ? 'user' : 'users'} online
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        {onlineUsers.map((user) => (
          <div
            key={user.clientId}
            className="group relative"
            title={`${user.name} (${user.email})`}
          >
            {user.avatarUrl ? (
              <div className="relative">
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-9 h-9 rounded-lg border-2 border-white shadow-md hover:scale-110 transition-transform duration-200"
                  style={{ borderColor: user.color }}
                />
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                  style={{ backgroundColor: user.color }}
                />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-md hover:scale-110 transition-transform duration-200 border-2 border-white"
                style={{ backgroundColor: user.color }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl">
              <div className="font-semibold">{user.name}</div>
              <div className="text-gray-300 text-[10px]">{user.email}</div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

