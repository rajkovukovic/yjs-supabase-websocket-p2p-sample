'use client'

import { useEffect, useState } from 'react'
import { useAwareness } from '../hooks/useYjs'
import { useAuth } from '../hooks/useAuth'
import { generateColorFromString, getShortName } from '../lib/userUtils'

interface CursorState {
  cursor?: {
    x: number
    y: number
  }
  name?: string
  email?: string
  color?: string
  shortName?: string
}

interface StageState {
  x: number
  y: number
  scale: number
}

export function Cursors() {
  const awareness = useAwareness()
  const { user } = useAuth()
  const [cursors, setCursors] = useState<Map<number, CursorState>>(new Map())
  
  useEffect(() => {
    if (!awareness || !user) return
    
    // Set local user info with real user data
    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous'
    awareness.setLocalStateField('name', userName)
    awareness.setLocalStateField('email', user.email || '')
    awareness.setLocalStateField('color', generateColorFromString(user.email || 'default'))
    awareness.setLocalStateField('shortName', getShortName(userName))
    
    const updateCursors = () => {
      const states = awareness.getStates()
      const newCursors = new Map<number, CursorState>()
      
      states.forEach((state: any, clientId: number) => {
        if (clientId !== awareness.clientID && state.cursor) {
          newCursors.set(clientId, state)
        }
      })
      
      setCursors(newCursors)
    }
    
    awareness.on('change', updateCursors)
    updateCursors()
    
    return () => awareness.off('change', updateCursors)
  }, [awareness, user])
  
  return null // Cursors are now rendered inside the Canvas SVG
}

// Export a component that can be used inside SVG
export function CanvasCursors({
  cursors,
  stage,
}: {
  cursors: Map<number, CursorState>
  stage: StageState
}) {
  return (
    <>
      {Array.from(cursors.entries()).map(([clientId, state]) => {
        if (!state.cursor) return null

        const color = state.color || '#3B82F6'
        const shortName =
          state.shortName || state.name?.substring(0, 3).toUpperCase() || 'USR'

        const cursorX = stage.x + state.cursor.x * stage.scale
        const cursorY = stage.y + state.cursor.y * stage.scale

        return (
          <g
            key={clientId}
            transform={`translate(${cursorX}, ${cursorY})`}
            style={{ pointerEvents: 'none' }}
          >
            {/* Cursor pointer */}
            <path
              d={`M 0 0 L 12 16 L 7.5 9.5 L 2 15 Z`}
              fill={color}
              stroke="white"
              strokeWidth="1.5"
            />

            {/* Label with @shortName */}
            <g transform={`translate(15, 5)`}>
              <rect
                x="0"
                y="0"
                width={shortName.length * 10 + 14}
                height="22"
                rx="4"
                fill={color}
                opacity="0.95"
              />
              <text
                x="7"
                y="15"
                fontSize="12"
                fontWeight="600"
                fill="white"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {shortName}
              </text>
            </g>
          </g>
        )
      })}
    </>
  )
}

