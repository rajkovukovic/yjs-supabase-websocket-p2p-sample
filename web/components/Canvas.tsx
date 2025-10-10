'use client'

import { useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { documentState, actions } from '../store/document'
import { useYDoc } from '../hooks/useYjs'
import { Rectangle } from './Rectangle'

export function Canvas() {
  const snap = useSnapshot(documentState)
  const ydoc = useYDoc()
  
  const svgRef = useRef<SVGSVGElement>(null)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  
  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault()
        setIsSpacePressed(true)
      }
      
      if ((e.code === 'Backspace' || e.code === 'Delete') && snap.selectedRectangleId) {
        e.preventDefault()
        actions.deleteRectangle(ydoc, snap.selectedRectangleId)
        actions.setSelectedRectangle(null)
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsSpacePressed(false)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isSpacePressed, snap.selectedRectangleId, ydoc])
  
  // Handle click to add rectangle or deselect
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>, scale: number, positionX: number, positionY: number) => {
    if (isPanning) {
      return
    }
    
    if (e.target === svgRef.current || (e.target as SVGElement).id === 'background') {
      // Deselect if clicking on background
      actions.setSelectedRectangle(null)
      
      // Don't add rectangle if space is pressed (pan mode)
      if (isSpacePressed) {
        return
      }
      
              // Calculate position in SVG coordinates accounting for zoom and pan
              const rect = svgRef.current!.getBoundingClientRect()
              const x = (e.clientX - rect.left - (positionX || 0)) / (scale || 1)
              const y = (e.clientY - rect.top - (positionY || 0)) / (scale || 1)
      
      actions.addRectangle(ydoc, {
        id: crypto.randomUUID(),
        x: x - 25,
        y: y - 25,
        width: 50,
        height: 50,
        fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
        stroke: '#000',
        strokeWidth: 2
      })
    }
  }
  
  return (
    <TransformWrapper
      initialScale={1}
      minScale={0.1}
      maxScale={10}
      limitToBounds={false}
      centerOnInit={false}
      wheel={{
        step: 0.1,
        smoothStep: 0.005
      }}
      pinch={{
        step: 5
      }}
      panning={{
        disabled: !isSpacePressed,
        velocityDisabled: false
      }}
      doubleClick={{
        disabled: true
      }}
      onPanningStart={() => setIsPanning(true)}
      onPanningStop={() => setTimeout(() => setIsPanning(false), 50)}
    >
      {({ zoomIn, zoomOut, resetTransform, state }) => (
        <>
          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            <button
              onClick={() => zoomIn()}
              className="bg-white hover:bg-gray-100 p-2 rounded shadow-md transition-colors"
              title="Zoom In (Scroll Up)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => zoomOut()}
              className="bg-white hover:bg-gray-100 p-2 rounded shadow-md transition-colors"
              title="Zoom Out (Scroll Down)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={() => resetTransform()}
              className="bg-white hover:bg-gray-100 p-2 rounded shadow-md transition-colors"
              title="Reset View"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <div className="bg-white px-2 py-1 rounded shadow-md text-xs text-gray-600">
              {Math.round((state?.scale || 1) * 100)}%
            </div>
          </div>

          {/* Instructions */}
          <div className="absolute bottom-4 left-4 z-10 bg-white/90 px-3 py-2 rounded shadow-md text-sm text-gray-600">
            <div className="font-semibold mb-1">Controls:</div>
            <div>• Scroll/Pinch to zoom</div>
            <div>• Space + Drag to pan</div>
            <div>• Click to add rectangle</div>
            <div>• Delete/Backspace to remove</div>
          </div>
          
          <TransformComponent
            wrapperStyle={{
              width: '100%',
              height: '100%',
              cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'default'
            }}
          >
            <svg
              ref={svgRef}
              width={2000}
              height={2000}
              style={{ 
                background: '#f5f5f5',
                touchAction: 'none' // Prevents default touch behaviors
              }}
              onClick={(e) => handleCanvasClick(e, state?.scale || 1, state?.positionX || 0, state?.positionY || 0)}
            >
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e0e0e0" strokeWidth="1"/>
                </pattern>
              </defs>
              
              <rect id="background" width="100%" height="100%" fill="url(#grid)" />
              
              {snap.rectangles.map(rect => (
                <Rectangle 
                  key={rect.id} 
                  {...rect} 
                  isSelected={snap.selectedRectangleId === rect.id}
                  onSelect={() => actions.setSelectedRectangle(rect.id)}
                  scale={state?.scale || 1}
                />
              ))}
            </svg>
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  )
}

