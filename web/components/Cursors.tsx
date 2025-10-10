'use client'

import { useEffect, useState } from 'react'
import { useAwareness } from '../hooks/useYjs'
import { CursorState } from '../types'

export function Cursors() {
  const awareness = useAwareness()
  const [cursors, setCursors] = useState<Map<number, CursorState>>(new Map())
  
  useEffect(() => {
    if (!awareness) return
    
    // Set local user info
    awareness.setLocalStateField('user', {
      name: `User ${Math.floor(Math.random() * 1000)}`,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    })
    
    const updateCursors = () => {
      const states = awareness.getStates()
      const newCursors = new Map()
      
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
  }, [awareness])
  
  // Set local cursor position
  useEffect(() => {
    if (!awareness) return
    
    const handleMouseMove = (e: MouseEvent) => {
      awareness.setLocalStateField('cursor', {
        x: e.clientX,
        y: e.clientY
      })
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [awareness])
  
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from(cursors.entries()).map(([clientId, state]) => (
        <div
          key={clientId}
          className="absolute transition-transform duration-100"
          style={{
            left: state.cursor.x,
            top: state.cursor.y,
            transform: 'translate(-2px, -2px)'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path
              d="M5 3L19 12L12 13L9 19L5 3Z"
              fill={state.user.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          <div
            className="mt-1 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
            style={{ backgroundColor: state.user.color }}
          >
            {state.user.name}
          </div>
        </div>
      ))}
    </div>
  )
}

