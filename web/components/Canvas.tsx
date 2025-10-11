'use client'

import React, { createContext, useContext } from 'react'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSnapshot } from 'valtio'
import {
  TransformWrapper,
  TransformComponent,
  useTransformContext,
  ReactZoomPanPinchRef,
  useControls,
  ReactZoomPanPinchState,
} from 'react-zoom-pan-pinch'
import { documentState, actions } from '../store/document'
import { useYDoc, useAwareness } from '../hooks/useYjs'
import { Rectangle } from './Rectangle'
import { ZoomControlsAndStatus } from './ZoomControlsAndStatus'
import { CanvasCursors } from './Cursors'
import { DocumentStatusToolbar } from './DocumentStatusToolbar'

// Transform state interface
interface TransformState {
  positionX: number
  positionY: number
  scale: number
}

// LocalStorage key prefix for transform states
const TRANSFORM_STATE_PREFIX = 'canvas-transform-'

// Utility functions for localStorage
const saveTransformState = (documentId: string, state: TransformState) => {
  try {
    const key = `${TRANSFORM_STATE_PREFIX}${documentId}`
    localStorage.setItem(key, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save transform state:', error)
  }
}

const loadTransformState = (documentId: string): TransformState | null => {
  try {
    const key = `${TRANSFORM_STATE_PREFIX}${documentId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('Failed to load transform state:', error)
  }
  return null
}

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
  documentName,
}: {
  isCreateRectangleMode: boolean
  setIsCreateRectangleMode: (value: boolean) => void
  documentName: string
}) {
  const { transformState } = useTransformContext();
  const { zoomIn, zoomOut, resetTransform, setTransform } = useControls();
  const snap = useSnapshot(documentState)
  const ydoc = useYDoc()
  const awareness = useAwareness()

  const svgRef = useRef<SVGSVGElement>(null)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [drawingRectangle, setDrawingRectangle] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null)
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null)
  const [selectionBox, setSelectionBox] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null)
  const [panStart, setPanStart] = useState<{x: number, y: number} | null>(null)
  const [cursors, setCursors] = useState<Map<number, any>>(new Map())

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

  // Track cursor positions from awareness
  useEffect(() => {
    if (!awareness) return

    const updateCursors = () => {
      const states = awareness.getStates()
      const newCursors = new Map<number, any>()

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

      if (e.code === 'Escape') {
        e.preventDefault()
        if (isCreateRectangleMode) {
          setIsCreateRectangleMode(false)
          setDrawingRectangle(null)
          setDragStart(null)
          setSelectionBox(null)
          setSelectionStart(null)
          setPanStart(null)
          setIsPanning(false)
        }
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
    // Always update cursor position in SVG coordinates for awareness
    const { x: svgX, y: svgY } = getSVGPoint(e.clientX, e.clientY)
    if (awareness) {
      awareness.setLocalStateField('cursor', { x: svgX, y: svgY })
    }

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
      {/* Document Status Toolbar - Top Left */}
      <DocumentStatusToolbar documentName={documentName} />

      {/* Zoom Controls Component - Bottom Left */}
      <ZoomControlsAndStatus
        transformState={transformState}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        resetTransform={resetTransform}
        isCreateRectangleMode={isCreateRectangleMode}
        setIsCreateRectangleMode={setIsCreateRectangleMode}
      />

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

          {/* Render cursors inside SVG */}
          <CanvasCursors cursors={cursors} />
        </svg>
      </TransformComponent>
    </CoordinateContext.Provider>
  )
}

export function Canvas({ documentName }: { documentName: string }) {
  const snap = useSnapshot(documentState)
  const ydoc = useYDoc()
  const [isPanning, setIsPanning] = useState(false)
  const [isCreateRectangleMode, setIsCreateRectangleMode] = useState(false)
  const transformRef = useRef<ReactZoomPanPinchRef>(null)

  // Load initial transform state from localStorage
  const [initialTransform, setInitialTransform] = useState<TransformState>(() => {
    return loadTransformState(documentName) || {
      positionX: 0,
      positionY: 0,
      scale: 1
    }
  })

  // Save transform state to localStorage when it changes
  const handleTransformed = useCallback((ref: ReactZoomPanPinchRef, state: ReactZoomPanPinchState) => {
    const transformState: TransformState = {
      positionX: state.positionX,
      positionY: state.positionY,
      scale: state.scale
    }
    saveTransformState(documentName, transformState)
  }, [documentName])

  return (
    <TransformWrapper
      initialScale={initialTransform.scale}
      initialPositionX={initialTransform.positionX}
      initialPositionY={initialTransform.positionY}
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
      onTransformed={handleTransformed}
    >
      <CanvasContent 
        isCreateRectangleMode={isCreateRectangleMode} 
        setIsCreateRectangleMode={setIsCreateRectangleMode}
        documentName={documentName}
      />
    </TransformWrapper>
  )
}

