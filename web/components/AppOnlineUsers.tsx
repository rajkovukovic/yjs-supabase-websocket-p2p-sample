'use client'

import { type PresenceUser } from '@/hooks/useAppPresence'

interface AppOnlineUsersProps {
  onlineUsers: PresenceUser[]
}

export function AppOnlineUsers({ onlineUsers }: AppOnlineUsersProps) {
  if (onlineUsers.length === 0) {
    return null
  }

  return (
    <div className="flex -space-x-2">
      {onlineUsers.map((user) => (
        <div
          key={user.clientId}
          className="group relative"
        >
          {/* Short Name Card */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 ring-2 ring-blue-500 cursor-pointer"
            style={{ backgroundColor: user.color }}
          >
            {user.shortName}
          </div>
          
          {/* Rich Tooltip with Photo and Details - Below the card */}
          <div className="absolute top-full left-0 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
            {/* Tooltip Arrow - Above the card */}
            <div className="absolute bottom-full left-5 transform -translate-x-1/2 mb-[-1px]">
              <div className="border-8 border-transparent border-b-gray-900" />
            </div>
            
            <div className="bg-gray-900 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
              {/* User Photo */}
              {user.avatarUrl && (
                <div className="p-3 bg-gradient-to-br from-gray-800 to-gray-900 flex justify-center">
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-16 h-16 rounded-lg border-2 border-white/20"
                  />
                </div>
              )}
              
              {/* User Details */}
              <div className="p-3 space-y-1">
                <div className="font-semibold text-white text-sm">{user.name}</div>
                <div className="text-gray-300 text-xs">{user.email}</div>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-700">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: user.color }}
                  />
                  <span className="text-gray-400 text-[10px]">Online now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

