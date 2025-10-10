'use client'

import React, { createContext, useContext } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import {
  TransformWrapper,
  TransformComponent,
  useTransformContext,
  ReactZoomPanPinchRef,
  useControls,
} from 'react-zoom-pan-pinch'
import { documentState, actions } from '../store/document'
import { useYDoc } from '../hooks/useYjs'
import { Rectangle } from './Rectangle'

// Context for coordinate transformation
interface CoordinateContextType {
  getSVGPoint: (clientX: number, clientY: number) => { x: number; y: number }
}

const CoordinateContext = createContext<CoordinateContextType | null>(null)

export const useCoordinateContext = () => {
  const context = useContext(CoordinateContext)
  if (!context) {
    throw new Error('useCoordinateContext must be used within CoordinateContext.Provider')
  }
  return context
}

// Separate component to use transform context
function CanvasContent({
  isCreateRectangleMode,
  setIsCreateRectangleMode,
}: {
  isCreateRectangleMode: boolean
  setIsCreateRectangleMode: (value: boolean) => void
}) {
  const { transformState } = useTransformContext();
  const { zoomIn, zoomOut, resetTransform, setTransform } = useControls();
  const snap = useSnapshot(documentState)
  const ydoc = useYDoc()

  const svgRef = useRef<SVGSVGElement>(null)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [drawingRectangle, setDrawingRectangle] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null)
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null)
  const [selectionBox, setSelectionBox] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null)
  const [panStart, setPanStart] = useState<{x: number, y: number} | null>(null)
  const [showInfoPopup, setShowInfoPopup] = useState(false)

  const getSVGPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }

    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY

    const ctm = svg.getScreenCTM()
    if (ctm) {
      const invertedCtm = ctm.inverse()
      return point.matrixTransform(invertedCtm)
    }

    // Fallback for initial render or environments where CTM is not available
    const { scale, positionX, positionY } = transformState
    const rect = svg.getBoundingClientRect()
    const x = (clientX - rect.left - positionX) / scale
    const y = (clientY - rect.top - positionY) / scale
    return { x, y }
  }

  // Reset pan and zoom to initial state
  const handleResetView = () => {
    resetTransform(300, 'easeOut')
  }

  // Helper function to check if two rectangles intersect
  const rectanglesIntersect = (rect1: {x: number, y: number, width: number, height: number}, rect2: {x: number, y: number, width: number, height: number}) => {
    return !(rect1.x + rect1.width < rect2.x ||
             rect2.x + rect2.width < rect1.x ||
             rect1.y + rect1.height < rect2.y ||
             rect2.y + rect2.height < rect1.y)
  }

  // Reset drawing state when exiting create mode
  useEffect(() => {
    if (!isCreateRectangleMode) {
      setDrawingRectangle(null)
      setDragStart(null)
      setTouchStart(null)
      setSelectionBox(null)
      setSelectionStart(null)
      setPanStart(null)
      setIsPanning(false)
    }
  }, [isCreateRectangleMode])

  // Touch event handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (isPanning || isSpacePressed) {
      return
    }

    e.preventDefault() // Prevent default touch behaviors

    const touch = e.touches[0]
    const { x, y } = getSVGPoint(touch.clientX, touch.clientY)

    if (isCreateRectangleMode) {
      setTouchStart({ x, y })
      setDrawingRectangle({ x, y, width: 0, height: 0 })
    } else if (e.target === svgRef.current || (e.target as SVGElement).id === 'background') {
      actions.setSelectedRectangle(null)
    }
  }

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isCreateRectangleMode || !touchStart || isPanning || isSpacePressed) {
      return
    }

    e.preventDefault()

    const touch = e.touches[0]
    const { x: currentX, y: currentY } = getSVGPoint(touch.clientX, touch.clientY)

    const width = currentX - touchStart.x
    const height = currentY - touchStart.y

    setDrawingRectangle({
      x: width < 0 ? currentX : touchStart.x,
      y: height < 0 ? currentY : touchStart.y,
      width: Math.abs(width),
      height: Math.abs(height)
    })
  }

  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isCreateRectangleMode || !touchStart) {
      return
    }

    e.preventDefault()

    const touch = e.changedTouches[0]
    const { x: currentX, y: currentY } = getSVGPoint(touch.clientX, touch.clientY)

    const width = currentX - touchStart.x
    const height = currentY - touchStart.y

    if (Math.abs(width) > 5 && Math.abs(height) > 5) {
      const rectId = crypto.randomUUID()
      actions.addRectangle(ydoc, {
        id: rectId,
        x: width < 0 ? currentX : touchStart.x,
        y: height < 0 ? currentY : touchStart.y,
        width: Math.abs(width),
        height: Math.abs(height),
        fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
        stroke: '#000',
        strokeWidth: 2
      })
      actions.setSelectedRectangle(rectId)
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

      if ((e.code === 'Backspace' || e.code === 'Delete') && snap.selectedRectangleIds.length > 0) {
        e.preventDefault()
        snap.selectedRectangleIds.forEach(id => {
          actions.deleteRectangle(ydoc, id)
        })
        actions.setSelectedRectangle(null)
      }

      if (e.code === 'Escape' && isCreateRectangleMode) {
        e.preventDefault()
        setIsCreateRectangleMode(false)
        setDrawingRectangle(null)
        setDragStart(null)
        setSelectionBox(null)
        setSelectionStart(null)
        setPanStart(null)
        setIsPanning(false)
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
  }, [isSpacePressed, snap.selectedRectangleIds, isCreateRectangleMode, ydoc, dragStart, drawingRectangle, setIsCreateRectangleMode])

  // Handle mouse down for rectangle creation, selection, or panning
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      return
    }

    if (isSpacePressed) {
      // Start manual panning
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      e.preventDefault()
    } else if (isCreateRectangleMode) {
      // Start drawing rectangle
      const { x, y } = getSVGPoint(e.clientX, e.clientY)
      setDragStart({ x, y })
      setDrawingRectangle({ x, y, width: 0, height: 0 })
    } else if (e.target === svgRef.current || (e.target as SVGElement).id === 'background') {
      // Start selection box if clicking on background
      const { x, y } = getSVGPoint(e.clientX, e.clientY)
      setSelectionStart({ x, y })
      setSelectionBox({ x, y, width: 0, height: 0 })
      // Don't deselect immediately - wait for mouseup to see if it was just a click
    }
  }

  // Handle mouse move for rectangle drawing, selection, or panning
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning && panStart) {
      // Handle manual panning
      const deltaX = e.clientX - panStart.x
      const deltaY = e.clientY - panStart.y

      setTransform(
        transformState.positionX + deltaX,
        transformState.positionY + deltaY,
        transformState.scale,
        0 // No animation for smooth panning
      )

      setPanStart({ x: e.clientX, y: e.clientY })
      e.preventDefault()
    } else if (isSpacePressed) {
      // Space is pressed but not panning yet, ignore
      return
    } else {
      // Handle rectangle drawing or selection
      const { x: currentX, y: currentY } = getSVGPoint(e.clientX, e.clientY)

      if (isCreateRectangleMode && dragStart) {
        // Update drawing rectangle
        const width = currentX - dragStart.x
        const height = currentY - dragStart.y

        setDrawingRectangle({
          x: width < 0 ? currentX : dragStart.x,
          y: height < 0 ? currentY : dragStart.y,
          width: Math.abs(width),
          height: Math.abs(height)
        })
      } else if (!isCreateRectangleMode && selectionStart) {
        // Update selection box
        const width = currentX - selectionStart.x
        const height = currentY - selectionStart.y

        const newSelectionBox = {
          x: width < 0 ? currentX : selectionStart.x,
          y: height < 0 ? currentY : selectionStart.y,
          width: Math.abs(width),
          height: Math.abs(height)
        }

        setSelectionBox(newSelectionBox)

        // Select rectangles that intersect with the selection box in real-time
        if (newSelectionBox.width > 5 && newSelectionBox.height > 5) {
          const intersectingRects = snap.rectangles.filter(rect => rectanglesIntersect(newSelectionBox, rect))
          const intersectingIds = intersectingRects.map(rect => rect.id)
          actions.setSelectedRectangle(intersectingIds)
        } else {
          actions.setSelectedRectangle(null)
        }
      }
    }
  }

  // Handle mouse up to complete rectangle creation, selection, or panning
  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      // Stop manual panning
      setIsPanning(false)
      setPanStart(null)
    } else if (isCreateRectangleMode && dragStart) {
      // Complete rectangle creation
      const { x: currentX, y: currentY } = getSVGPoint(e.clientX, e.clientY)

      const width = currentX - dragStart.x
      const height = currentY - dragStart.y

      // Only create rectangle if it has meaningful size (more than 5px in each dimension)
      if (Math.abs(width) > 5 && Math.abs(height) > 5) {
        const rectId = crypto.randomUUID()
        actions.addRectangle(ydoc, {
          id: rectId,
          x: width < 0 ? currentX : dragStart.x,
          y: height < 0 ? currentY : dragStart.y,
          width: Math.abs(width),
          height: Math.abs(height),
          fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
          stroke: '#000',
          strokeWidth: 2
        })
        actions.setSelectedRectangle(rectId)
      }

      // Reset drawing state
      setDrawingRectangle(null)
      setDragStart(null)
    } else if (!isCreateRectangleMode && selectionStart && selectionBox) {
      // Handle small clicks (less than minimum selection size)
      const minSize = 5 // Minimum size to be considered a selection rather than a click

      if (selectionBox.width <= minSize && selectionBox.height <= minSize) {
        // It was just a click, deselect everything
        actions.setSelectedRectangle(null)
      }
      // For larger selections, the selection is already handled in real-time during mouse move

      // Reset selection state
      setSelectionBox(null)
      setSelectionStart(null)
    }
  }

  return (
    <CoordinateContext.Provider value={{ getSVGPoint }}>
      {/* Zoom Controls and Status - Bottom Left */}
      <div className="fixed bottom-6 left-6 z-20 flex items-center gap-3 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-lg border border-gray-200/50">
        {/* Sync Status */}
        <div className={`flex items-center gap-1.5 ${snap.synced ? 'text-emerald-600' : 'text-amber-600'}`} title={snap.synced ? 'Synced' : 'Syncing...'}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {snap.synced ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="2s" repeatCount="indefinite" />
              </path>
            )}
          </svg>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300" />

        {/* Connection Status */}
        <div className={`flex items-center gap-1.5 ${snap.status === 'connected' ? 'text-emerald-600' : 'text-gray-400'}`} title={`Status: ${snap.status}`}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300" />

        {/* Connected Peers */}
        <div className="flex items-center gap-1.5 text-gray-700" title={`Connected peers: ${snap.peers}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="text-sm font-medium">{snap.peers}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300" />

        {/* Zoom Out */}
        <button
          onClick={() => zoomOut(0.2, 300, 'easeOut')}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        {/* Zoom Percentage - Clickable to Reset */}
        <button
          onClick={handleResetView}
          className="min-w-[3rem] text-center hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors"
          title="Reset zoom and pan"
        >
          <span className="text-sm font-medium text-gray-700">{Math.round(transformState.scale * 100)}%</span>
        </button>

        {/* Zoom In */}
        <button
          onClick={() => zoomIn(0.2, 300, 'easeOut')}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title="Zoom In"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300" />

        {/* Info Button */}
        <button
          onClick={() => setShowInfoPopup(!showInfoPopup)}
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            showInfoPopup
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          title="Show help and commands"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300" />

        {/* Create Rectangle Mode */}
        <button
          onClick={() => {
            setIsCreateRectangleMode(!isCreateRectangleMode)
            setDrawingRectangle(null)
            setDragStart(null)
            setSelectionBox(null)
            setSelectionStart(null)
            setPanStart(null)
            setIsPanning(false)
          }}
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            isCreateRectangleMode
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          title={isCreateRectangleMode ? 'Exit Create Rectangle Mode (Esc)' : 'Create Rectangle Mode'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
          </svg>
        </button>
      </div>

      {/* Info Popup */}
      {showInfoPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInfoPopup(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">How to Use the Document</h3>
              <button
                onClick={() => setShowInfoPopup(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Navigation</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Scroll</kbd> to zoom in/out</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Space + Drag</kbd> to pan around</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Click zoom %</kbd> to reset view</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">Creating Shapes</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Click the <span className="inline-flex items-center px-1 py-0.5 bg-gray-100 rounded text-xs">□</span> button to enter rectangle mode</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Click & Drag</kbd> to create rectangles</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> to exit rectangle mode</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">Selecting & Editing</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Click</kbd> rectangles to select them</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Shift + Click</kbd> to select multiple</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Drag</kbd> selected rectangles to move them</li>
                  <li>• <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Delete</kbd> or <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Backspace</kbd> to remove selected</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">Collaboration</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• See other users' cursors in real-time</li>
                  <li>• Changes sync automatically across all users</li>
                  <li>• Green indicator shows when fully synced</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <TransformComponent
        wrapperStyle={{
          width: '100%',
          height: '100%',
          cursor: isCreateRectangleMode ? 'crosshair' : isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'default'
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
              isSelected={snap.selectedRectangleIds.includes(rect.id)}
              onSelect={(id, isMultiSelect) => {
                if (isMultiSelect) {
                  // Shift+Click: toggle selection
                  const isCurrentlySelected = snap.selectedRectangleIds.includes(id)
                  if (isCurrentlySelected) {
                    // Remove from selection
                    actions.setSelectedRectangle(snap.selectedRectangleIds.filter(selectedId => selectedId !== id))
                  } else {
                    // Add to selection
                    actions.setSelectedRectangle([...snap.selectedRectangleIds, id])
                  }
                } else {
                  // Regular click: select only this rectangle
                  actions.setSelectedRectangle(id)
                }
              }}
              scale={transformState.scale}
            />
          ))}

          {/* Preview rectangle while drawing */}
          {drawingRectangle && isCreateRectangleMode && (
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

          {/* Selection box */}
          {selectionBox && !isCreateRectangleMode && (
            <rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              strokeWidth="1"
              strokeDasharray="3,3"
              style={{
                pointerEvents: 'none'
              }}
            />
          )}
        </svg>
      </TransformComponent>
    </CoordinateContext.Provider>
  )
}

export function Canvas() {
  const snap = useSnapshot(documentState)
  const ydoc = useYDoc()

  const [isPanning, setIsPanning] = useState(false)
  const [isCreateRectangleMode, setIsCreateRectangleMode] = useState(false)
  const transformRef = useRef<ReactZoomPanPinchRef>(null)


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
        disabled: true, // Disable library panning, we'll handle it manually
        velocityDisabled: false
      }}
      doubleClick={{
        disabled: true,
      }}
    >
      <CanvasContent isCreateRectangleMode={isCreateRectangleMode} setIsCreateRectangleMode={setIsCreateRectangleMode} />
    </TransformWrapper>
  )
}

