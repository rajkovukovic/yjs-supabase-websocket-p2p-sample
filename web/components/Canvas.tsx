'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { documentState, actions } from '../store/document'
import { useYDoc } from '../hooks/useYjs'
import { Rectangle } from './Rectangle'
import { ViewBox } from '../types'

export function Canvas() {
  const snap = useSnapshot(documentState) // Auto-subscribes to changes
  const ydoc = useYDoc()
  
  const [viewBox, setViewBox] = useState<ViewBox>({
    x: 0, y: 0, width: 1000, height: 1000
  })
  const [isPanning, setIsPanning] = useState(false)
  const [hasPanned, setHasPanned] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  
  const svgRef = useRef<SVGSVGElement>(null)
  
  // Pan handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.metaKey)) { // Middle or Cmd+Click
      e.preventDefault()
      setIsPanning(true)
      setHasPanned(false)
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    
    // Mark that we've actually panned (mouse moved)
    setHasPanned(true)
    
    const dx = (e.clientX - panStart.x) * (viewBox.width / window.innerWidth)
    const dy = (e.clientY - panStart.y) * (viewBox.height / window.innerHeight)
    
    setViewBox(prev => ({
      ...prev,
      x: prev.x - dx,
      y: prev.y - dy
    }))
    
    setPanStart({ x: e.clientX, y: e.clientY })
  }, [isPanning, panStart, viewBox])
  
  const handleMouseUp = () => {
    setIsPanning(false)
    // Keep hasPanned state for a brief moment to prevent click event
    setTimeout(() => setHasPanned(false), 50)
  }
  
  // Click to add rectangle
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Don't create rectangle if we just panned
    if (hasPanned) {
      return
    }
    
    if (e.target === svgRef.current || (e.target as SVGElement).id === 'background') {
      const rect = svgRef.current!.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x
      const y = ((e.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y
      
      actions.addRectangle(ydoc, {
        id: crypto.randomUUID(),
        x: x - 50,
        y: y - 50,
        width: 100,
        height: 100,
        fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
        stroke: '#000',
        strokeWidth: 2
      })
    }
  }
  
  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      style={{ 
        width: '100%', 
        height: '100vh', 
        cursor: isPanning ? 'grabbing' : 'default',
        background: '#f5f5f5'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    >
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e0e0e0" strokeWidth="1"/>
        </pattern>
      </defs>
      
      <rect id="background" width="100%" height="100%" fill="url(#grid)" />
      
      {snap.rectangles.map(rect => (
        <Rectangle key={rect.id} {...rect} />
      ))}
    </svg>
  )
}

