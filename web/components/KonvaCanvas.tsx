'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Rect, Transformer, Line, Group } from 'react-konva'
import { useSnapshot } from 'valtio'
import { documentState, actions } from '../store/document'
import { useYDoc, useAwareness } from '../hooks/useYjs'
import Konva from 'konva'
import Rectangle from './Rectangle'
import { DocumentStatusToolbar } from './DocumentStatusToolbar'
import { ZoomControlsAndStatus } from './ZoomControlsAndStatus'

type DragContext = {
  initialPositions: Map<string, { x: number; y: number }>
  dragStartPointerPos: { x: number; y: number }
} | null

const TRANSFORM_STATE_PREFIX = 'canvas-transform-'

const saveTransformState = (documentId: string, state: { x: number; y: number; scale: number }) => {
  try {
    const key = `${TRANSFORM_STATE_PREFIX}${documentId}`
    localStorage.setItem(key, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save transform state:', error)
  }
}

const loadTransformState = (documentId: string): { x: number; y: number; scale: number } | null => {
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

const GRID_SIZE = 50

const Grid = ({
  width,
  height,
  scale,
  x,
  y,
}: {
  width: number
  height: number
  scale: number
  x: number
  y: number
}) => {
  const lines = []

  const viewRect = {
    x1: -x / scale,
    y1: -y / scale,
    x2: (-x + width) / scale,
    y2: (-y + height) / scale,
  }

  const scaledGridSize = GRID_SIZE

  const firstVerticalLine = Math.ceil(viewRect.x1 / scaledGridSize) * scaledGridSize
  const lastVerticalLine = Math.floor(viewRect.x2 / scaledGridSize) * scaledGridSize

  const firstHorizontalLine = Math.ceil(viewRect.y1 / scaledGridSize) * scaledGridSize
  const lastHorizontalLine = Math.floor(viewRect.y2 / scaledGridSize) * scaledGridSize

  for (let i = firstVerticalLine; i <= lastVerticalLine; i += scaledGridSize) {
    lines.push(
      <Line
        key={`v-${i}`}
        points={[i, viewRect.y1, i, viewRect.y2]}
        stroke="#e0e0e0"
        strokeWidth={1 / scale}
      />,
    )
  }

  for (let i = firstHorizontalLine; i <= lastHorizontalLine; i += scaledGridSize) {
    lines.push(
      <Line
        key={`h-${i}`}
        points={[viewRect.x1, i, viewRect.x2, i]}
        stroke="#e0e0e0"
        strokeWidth={1 / scale}
      />,
    )
  }

  return <Group>{lines}</Group>
}

const KonvaCanvas = ({ documentName }: { documentName: string }) => {
  const snap = useSnapshot(documentState)
  const ydoc = useYDoc()
  const selectionRectRef = useRef<Konva.Rect>(null)
  const selectionBox = useRef({ x1: 0, y1: 0, x2: 0, y2: 0 })
  const [selecting, setSelecting] = useState(false)
  const [isCreateRectangleMode, setIsCreateRectangleMode] = useState(false)
  const [newRectangle, setNewRectangle] = useState<any[]>([])
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const stageRef = useRef<Konva.Stage>(null)
  const [dragContext, setDragContext] = useState<DragContext>(null)

  useEffect(() => {
    const handleSelectAll = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        const allRectangleIds = snap.rectangles.map((r) => r.id)
        actions.setSelectedRectangle(allRectangleIds)
      }
    }

    window.addEventListener('keydown', handleSelectAll)
    return () => {
      window.removeEventListener('keydown', handleSelectAll)
    }
  }, [snap.rectangles])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsSpacePressed(true)
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
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (stage) {
      if (isSpacePressed) {
        stage.container().style.cursor = 'grab'
      } else if (isCreateRectangleMode) {
        stage.container().style.cursor = 'crosshair'
      } else {
        stage.container().style.cursor = 'default'
      }
    }
  }, [isSpacePressed, isCreateRectangleMode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCreateRectangleMode(false)
        setNewRectangle([])
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (snap.selectedRectangleIds.length > 0) {
          actions.deleteRectangles(ydoc, [...snap.selectedRectangleIds])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [snap.selectedRectangleIds, ydoc, isCreateRectangleMode])

  const [stage, setStage] = useState(() => {
    return loadTransformState(documentName) || {
      scale: 1,
      x: 0,
      y: 0,
    }
  })

  useEffect(() => {
    saveTransformState(documentName, stage)
  }, [stage, documentName])

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()

    const scaleBy = 1.1
    const stage = e.target.getStage()
    if (!stage) return

    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()

    if (!pointer) return

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy

    setStage({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
  }

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      setStage({
        ...stage,
        x: e.target.x(),
        y: e.target.y(),
      })
    }
  }

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isSpacePressed) return

    if (isCreateRectangleMode) {
      const stage = e.target.getStage()
      if (!stage) return
      const pos = stage.getRelativePointerPosition()
      if (!pos) return
      setNewRectangle([{ x: pos.x, y: pos.y, width: 0, height: 0, id: 'new' }])
      return
    }

    if (e.target !== e.target.getStage()) {
      return
    }
    e.evt.preventDefault()
    setSelecting(true)
    actions.setSelectedRectangle([])
    const stage = e.target.getStage()
    if (!stage) return
    const pos = stage.getRelativePointerPosition()
    if (!pos) return
    selectionBox.current = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isCreateRectangleMode) {
      if (newRectangle.length === 0) return
      const stage = e.target.getStage()
      if (!stage) return
      const pos = stage.getRelativePointerPosition()
      if (!pos) return
      const rect = newRectangle[0]
      rect.width = pos.x - rect.x
      rect.height = pos.y - rect.y
      setNewRectangle([rect])
      return
    }

    if (!selecting) {
      return
    }
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    const pos = stage.getRelativePointerPosition()
    if (!pos) return
    selectionBox.current.x2 = pos.x
    selectionBox.current.y2 = pos.y

    const x1 = Math.min(selectionBox.current.x1, selectionBox.current.x2)
    const y1 = Math.min(selectionBox.current.y1, selectionBox.current.y2)
    const x2 = Math.max(selectionBox.current.x1, selectionBox.current.x2)
    const y2 = Math.max(selectionBox.current.y1, selectionBox.current.y2)

    if (selectionRectRef.current) {
      selectionRectRef.current.visible(true)
      selectionRectRef.current.x(x1)
      selectionRectRef.current.y(y1)
      selectionRectRef.current.width(x2 - x1)
      selectionRectRef.current.height(y2 - y1)
    }

    const box = {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
    }
    
    const selected = snap.rectangles.filter((rect) =>
      Konva.Util.haveIntersection(box, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }),
    )
    actions.setSelectedRectangle(selected.map((rect) => rect.id))
  }

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isCreateRectangleMode) {
      if (newRectangle.length > 0) {
        const rect = newRectangle[0]
        if (Math.abs(rect.width) > 5 && Math.abs(rect.height) > 5) {
          actions.addRectangle(ydoc, {
            id: crypto.randomUUID(),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
            stroke: '#000',
            strokeWidth: 2,
          })
        }
        setNewRectangle([])
      }
      return
    }

    if (!selecting) {
      return
    }
    e.evt.preventDefault()
    setSelecting(false)
    if (selectionRectRef.current) {
      selectionRectRef.current.visible(false)
    }
  }

  const zoom = (direction: 'in' | 'out') => {
    const scaleBy = 1.2
    const stageEl = selectionRectRef.current?.getStage()
    if (!stageEl) return

    const oldScale = stageEl.scaleX()
    const center = {
      x: stageEl.width() / 2,
      y: stageEl.height() / 2,
    }

    const mousePointTo = {
      x: (center.x - stageEl.x()) / oldScale,
      y: (center.y - stageEl.y()) / oldScale,
    }

    const newScale = direction === 'in' ? oldScale * scaleBy : oldScale / scaleBy

    setStage({
      scale: newScale,
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
    })
  }

  const resetTransform = () => {
    setStage({
      scale: 1,
      x: 0,
      y: 0,
    })
  }

  const transformState = {
    scale: stage.scale,
    positionX: stage.x,
    positionY: stage.y,
    previousScale: stage.scale,
  }

  return (
    <div className="relative w-full h-full">
      <DocumentStatusToolbar documentName={documentName} />
      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="bg-gray-100"
        draggable={isSpacePressed}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragEnd={handleDragEnd}
        scaleX={stage.scale}
        scaleY={stage.scale}
        x={stage.x}
        y={stage.y}
      >
        <Layer>
          <Grid
            width={window.innerWidth}
            height={window.innerHeight}
            scale={stage.scale}
            x={stage.x}
            y={stage.y}
          />
          {snap.rectangles.map((rect) => (
            <Rectangle
              key={rect.id}
              {...rect}
              isSelected={snap.selectedRectangleIds.includes(rect.id)}
              isSpacePressed={isSpacePressed}
              onSelect={(e) => {
                const isSelected = snap.selectedRectangleIds.includes(rect.id)
                if (e.evt.shiftKey) {
                  if (isSelected) {
                    actions.setSelectedRectangle(
                      snap.selectedRectangleIds.filter((id) => id !== rect.id),
                    )
                  } else {
                    actions.setSelectedRectangle([
                      ...snap.selectedRectangleIds,
                      rect.id,
                    ])
                  }
                } else {
                  actions.setSelectedRectangle(isSelected ? [] : [rect.id])
                }
              }}
              onDragStart={(e) => {
                if (snap.selectedRectangleIds.length > 1 && snap.selectedRectangleIds.includes(rect.id)) {
                  const stage = e.target.getStage()
                  const pointerPos = stage?.getPointerPosition()
                  if (!pointerPos) return

                  const initialPositions = new Map<string, { x: number; y: number }>()
                  snap.selectedRectangleIds.forEach((id) => {
                    const r = snap.rectangles.find((r) => r.id === id)
                    if (r) {
                      initialPositions.set(id, { x: r.x, y: r.y })
                    }
                  })
                  setDragContext({
                    initialPositions,
                    dragStartPointerPos: pointerPos,
                  })
                }
              }}
              onDragMove={(e) => {
                if (dragContext) {
                  const draggedRect = e.target
                  const draggedRectId = draggedRect.id()
                  const initialPos = dragContext.initialPositions.get(draggedRectId)
                  if (!initialPos) return

                  const dx = draggedRect.x() - initialPos.x
                  const dy = draggedRect.y() - initialPos.y

                  const updates = snap.selectedRectangleIds
                    .filter((id) => id !== draggedRectId)
                    .map((id) => {
                      const startPos = dragContext.initialPositions.get(id)
                      if (startPos) {
                        return {
                          id,
                          x: startPos.x + dx,
                          y: startPos.y + dy,
                        }
                      }
                      return null
                    })
                    .filter((u): u is { id: string; x: number; y: number } => u !== null)

                  if (updates.length > 0) {
                    actions.updateRectangles(ydoc, updates)
                  }
                }
              }}
              onChange={(newAttrs) => {
                if (dragContext) {
                  const { id: draggedId, x: finalX, y: finalY } = newAttrs
                  const initialPos = dragContext.initialPositions.get(draggedId)
                  if (!initialPos) {
                    setDragContext(null)
                    return
                  }

                  const dx = finalX - initialPos.x
                  const dy = finalY - initialPos.y

                  const finalUpdates = snap.selectedRectangleIds
                    .map((id) => {
                      const startPos = dragContext.initialPositions.get(id)
                      if (startPos) {
                        return {
                          id: id,
                          x: startPos.x + dx,
                          y: startPos.y + dy,
                        }
                      }
                      return null
                    })
                    .filter((u): u is { id: string; x: number; y: number } => u !== null)

                  actions.updateRectangles(ydoc, finalUpdates)
                  setDragContext(null)
                } else {
                  actions.updateRectangle(ydoc, newAttrs.id, newAttrs)
                }
              }}
            />
          ))}
          {newRectangle.map((rect) => {
            return (
              <Rect
                key={rect.id}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#3b82f6"
                strokeWidth={2 / stage.scale}
              />
            )
          })}
          <Rect ref={selectionRectRef} fill="rgba(0,0,255,0.2)" visible={false} />
        </Layer>
      </Stage>
      <ZoomControlsAndStatus
        transformState={transformState}
        zoomIn={() => zoom('in')}
        zoomOut={() => zoom('out')}
        resetTransform={resetTransform}
        isCreateRectangleMode={isCreateRectangleMode}
        setIsCreateRectangleMode={setIsCreateRectangleMode}
      />
    </div>
  )
}

export default KonvaCanvas
