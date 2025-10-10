'use client'

import { useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { TransformWrapper, TransformComponent, useTransformContext } from 'react-zoom-pan-pinch'
import { documentState, actions } from '../store/document'
import { useYDoc } from '../hooks/useYjs'
import { Rectangle } from './Rectangle'

// Separate component to use transform context
function CanvasContent() {
  const { transformState, instance } = useTransformContext()
  const snap = useSnapshot(documentState)
  const ydoc = useYDoc()

  const svgRef = useRef<SVGSVGElement>(null)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [drawingRectangle, setDrawingRectangle] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null)
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null)

  // Reset drawing state when exiting create mode
  useEffect(() => {
    if (!snap.isCreateRectangleMode) {
      setDrawingRectangle(null)
      setDragStart(null)
      setTouchStart(null)
    }
  }, [snap.isCreateRectangleMode])

  // Touch event handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>, scale: number, positionX: number, positionY: number) => {
    if (isPanning || isSpacePressed) {
      return
    }

    e.preventDefault() // Prevent default touch behaviors

    const touch = e.touches[0]
    const rect = svgRef.current!.getBoundingClientRect()
    const x = (touch.clientX - rect.left - (positionX || 0)) / (scale || 1)
    const y = (touch.clientY - rect.top - (positionY || 0)) / (scale || 1)

    if (snap.isCreateRectangleMode) {
      setTouchStart({ x, y })
      setDrawingRectangle({ x, y, width: 0, height: 0 })
    } else if (e.target === svgRef.current || (e.target as SVGElement).id === 'background') {
      actions.setSelectedRectangle(null)
    }
  }

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>, scale: number, positionX: number, positionY: number) => {
    if (!snap.isCreateRectangleMode || !touchStart || isPanning || isSpacePressed) {
      return
    }

    e.preventDefault()

    const touch = e.touches[0]
    const rect = svgRef.current!.getBoundingClientRect()
    const currentX = (touch.clientX - rect.left - (positionX || 0)) / (scale || 1)
    const currentY = (touch.clientY - rect.top - (positionY || 0)) / (scale || 1)

    const width = currentX - touchStart.x
    const height = currentY - touchStart.y

    setDrawingRectangle({
      x: width < 0 ? currentX : touchStart.x,
      y: height < 0 ? currentY : touchStart.y,
      width: Math.abs(width),
      height: Math.abs(height)
    })
  }

  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>, scale: number, positionX: number, positionY: number) => {
    if (!snap.isCreateRectangleMode || !touchStart) {
      return
    }

    e.preventDefault()

    const touch = e.changedTouches[0]
    const rect = svgRef.current!.getBoundingClientRect()
    const currentX = (touch.clientX - rect.left - (positionX || 0)) / (scale || 1)
    const currentY = (touch.clientY - rect.top - (positionY || 0)) / (scale || 1)

    const width = currentX - touchStart.x
    const height = currentY - touchStart.y

    if (Math.abs(width) > 5 && Math.abs(height) > 5) {
      actions.addRectangle(ydoc, {
        id: crypto.randomUUID(),
        x: width < 0 ? currentX : touchStart.x,
        y: height < 0 ? currentY : touchStart.y,
        width: Math.abs(width),
        height: Math.abs(height),
        fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
        stroke: '#000',
        strokeWidth: 2
      })
    }

    setDrawingRectangle(null)
    setTouchStart(null)
  }

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

      if (e.code === 'Escape' && snap.isCreateRectangleMode) {
        e.preventDefault()
        actions.setCreateRectangleMode(false)
        setDrawingRectangle(null)
        setDragStart(null)
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
  }, [isSpacePressed, snap.selectedRectangleId, snap.isCreateRectangleMode, ydoc, dragStart, drawingRectangle])

  // Handle mouse down for rectangle creation or selection
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>, scale: number, positionX: number, positionY: number) => {
    if (isPanning || isSpacePressed) {
      return
    }

    // Calculate position in SVG coordinates accounting for zoom and pan
    const rect = svgRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left - (positionX || 0)) / (scale || 1)
    const y = (e.clientY - rect.top - (positionY || 0)) / (scale || 1)

    if (snap.isCreateRectangleMode) {
      // Start drawing rectangle
      setDragStart({ x, y })
      setDrawingRectangle({ x, y, width: 0, height: 0 })
    } else if (e.target === svgRef.current || (e.target as SVGElement).id === 'background') {
      // Deselect if clicking on background
      actions.setSelectedRectangle(null)
    }
  }

  // Handle mouse move for rectangle drawing
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>, scale: number, positionX: number, positionY: number) => {
    if (!snap.isCreateRectangleMode || !dragStart || isPanning || isSpacePressed) {
      return
    }

    // Calculate current position in SVG coordinates
    const rect = svgRef.current!.getBoundingClientRect()
    const currentX = (e.clientX - rect.left - (positionX || 0)) / (scale || 1)
    const currentY = (e.clientY - rect.top - (positionY || 0)) / (scale || 1)

    // Update drawing rectangle
    const width = currentX - dragStart.x
    const height = currentY - dragStart.y

    setDrawingRectangle({
      x: width < 0 ? currentX : dragStart.x,
      y: height < 0 ? currentY : dragStart.y,
      width: Math.abs(width),
      height: Math.abs(height)
    })
  }

  // Handle mouse up to complete rectangle creation
  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>, scale: number, positionX: number, positionY: number) => {
    if (!snap.isCreateRectangleMode || !dragStart) {
      return
    }

    // Calculate final position in SVG coordinates
    const rect = svgRef.current!.getBoundingClientRect()
    const currentX = (e.clientX - rect.left - (positionX || 0)) / (scale || 1)
    const currentY = (e.clientY - rect.top - (positionY || 0)) / (scale || 1)

    const width = currentX - dragStart.x
    const height = currentY - dragStart.y

    // Only create rectangle if it has meaningful size (more than 5px in each dimension)
    if (Math.abs(width) > 5 && Math.abs(height) > 5) {
      actions.addRectangle(ydoc, {
        id: crypto.randomUUID(),
        x: width < 0 ? currentX : dragStart.x,
        y: height < 0 ? currentY : dragStart.y,
        width: Math.abs(width),
        height: Math.abs(height),
        fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
        stroke: '#000',
        strokeWidth: 2
      })
    }

    // Reset drawing state
    setDrawingRectangle(null)
    setDragStart(null)
  }

  return (
    <>
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => instance.zoomIn()}
          className="bg-white hover:bg-gray-100 p-2 rounded shadow-md transition-colors"
          title="Zoom In (Scroll Up)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={() => instance.zoomOut()}
          className="bg-white hover:bg-gray-100 p-2 rounded shadow-md transition-colors"
          title="Zoom Out (Scroll Down)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={() => instance.resetTransform()}
          className="bg-white hover:bg-gray-100 p-2 rounded shadow-md transition-colors"
          title="Reset View"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <button
          onClick={() => {
            actions.setCreateRectangleMode(!snap.isCreateRectangleMode)
            setDrawingRectangle(null)
            setDragStart(null)
          }}
          className={`p-2 rounded shadow-md transition-colors ${
            snap.isCreateRectangleMode
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-white hover:bg-gray-100'
          }`}
          title={snap.isCreateRectangleMode ? "Exit Create Rectangle Mode (Esc)" : "Create Rectangle Mode"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM9 9h6v6H9V9z" />
          </svg>
        </button>
        <div className="bg-white px-2 py-1 rounded shadow-md text-xs text-gray-600">
          {Math.round(transformState.scale * 100)}%
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 px-3 py-2 rounded shadow-md text-sm text-gray-600">
        <div className="font-semibold mb-1">Controls:</div>
        <div>• Scroll/Pinch to zoom</div>
        <div>• Space + Drag to pan</div>
        {snap.isCreateRectangleMode ? (
          <>
            <div>• Drag to draw rectangle</div>
            <div>• Click rectangle button or Esc to exit mode</div>
          </>
        ) : (
          <>
            <div>• Click to deselect</div>
            <div>• Click rectangle button for create mode</div>
          </>
        )}
        <div>• Delete/Backspace to remove selected</div>
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
          onMouseDown={(e) => handleMouseDown(e, transformState.scale, transformState.positionX, transformState.positionY)}
          onMouseMove={(e) => handleMouseMove(e, transformState.scale, transformState.positionX, transformState.positionY)}
          onMouseUp={(e) => handleMouseUp(e, transformState.scale, transformState.positionX, transformState.positionY)}
          onTouchStart={(e) => handleTouchStart(e, transformState.scale, transformState.positionX, transformState.positionY)}
          onTouchMove={(e) => handleTouchMove(e, transformState.scale, transformState.positionX, transformState.positionY)}
          onTouchEnd={(e) => handleTouchEnd(e, transformState.scale, transformState.positionX, transformState.positionY)}
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
              scale={transformState.scale}
            />
          ))}

          {/* Preview rectangle while drawing */}
          {drawingRectangle && snap.isCreateRectangleMode && (
            <rect
              x={drawingRectangle.x}
              y={drawingRectangle.y}
              width={drawingRectangle.width}
              height={drawingRectangle.height}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
              style={{
                pointerEvents: 'none',
                cursor: dragStart ? 'crosshair' : 'default'
              }}
            />
          )}
        </svg>
      </TransformComponent>
    </>
  )
}

export function Canvas() {
  const snap = useSnapshot(documentState)
  const ydoc = useYDoc()

  const [isPanning, setIsPanning] = useState(false)

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
        disabled: false,
        velocityDisabled: false
      }}
      doubleClick={{
        disabled: true
      }}
      onPanningStart={() => setIsPanning(true)}
      onPanningStop={() => setTimeout(() => setIsPanning(false), 50)}
    >
      <CanvasContent />
    </TransformWrapper>
  )
}

