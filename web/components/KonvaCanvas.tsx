'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Rect, Transformer, Line, Group } from 'react-konva'
import { useSnapshot } from 'valtio'
import { docState, actions } from '../store/document'
import { useYDoc, useAwareness } from '../hooks/useYjs'
import Konva from 'konva'
import Drawable from './Drawable'
import { CanvasCursors } from './Cursors'
import { DocumentStatusToolbar } from './DocumentStatusToolbar'
import { ZoomControlsAndStatus } from './ZoomControlsAndStatus'
import { Drawable as DrawableType } from '@/lib/schemas'

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
  const snap = useSnapshot(docState)
  const ydoc = useYDoc()
  const awareness = useAwareness()
  const selectionRectRef = useRef<Konva.Rect>(null)
  const selectionBox = useRef({ x1: 0, y1: 0, x2: 0, y2: 0 })
  const [selecting, setSelecting] = useState(false)
  const [isCreateShapeMode, setIsCreateShapeMode] = useState(false)
  const [newShape, setNewShape] = useState<any[]>([])
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [dragContext, setDragContext] = useState<DragContext>(null)
  const [cursors, setCursors] = useState<Map<number, any>>(new Map())
  const lastCenter = useRef<{ x: number; y: number } | null>(null)
  const lastDist = useRef(0)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !transformerRef.current) return

    const selectedNodes = snap.selectedIds
      .map((id) => stage.findOne('#' + id))
      .filter((node): node is Konva.Node => !!node)

    transformerRef.current.nodes(selectedNodes)
    transformerRef.current.getLayer()?.batchDraw()
  }, [snap.selectedIds])

  const handleSelectAll = useCallback((e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        const allDrawableIds = (snap.entity.drawables || []).map((d) => d.id)
        actions.setSelectedIds(allDrawableIds)
      }
    },[snap.entity.drawables])

  useEffect(() => {

    window.addEventListener('keydown', handleSelectAll)
    return () => {
      window.removeEventListener('keydown', handleSelectAll)
    }
  }, [handleSelectAll])

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
      } else if (isCreateShapeMode) {
        stage.container().style.cursor = 'crosshair'
      } else {
        stage.container().style.cursor = 'default'
      }
    }
  }, [isSpacePressed, isCreateShapeMode])

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

    return () => {
      awareness.off('change', updateCursors)
    }
  }, [awareness])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCreateShapeMode(false)
        setNewShape([])
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (snap.selectedIds.length > 0) {
          actions.deleteDrawables(ydoc, [...snap.selectedIds])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [snap.selectedIds, ydoc, isCreateShapeMode])

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

    const scaleBy = 1.03
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

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isSpacePressed) return

    if (isCreateShapeMode) {
      const stage = e.target.getStage()
      if (!stage) return
      const pos = stage.getRelativePointerPosition()
      if (!pos) return
      setNewShape([{ x: pos.x, y: pos.y, width: 0, height: 0, id: 'new' }])
      return
    }

    if (e.target !== e.target.getStage()) {
      return
    }
    e.evt.preventDefault()
    setSelecting(true)
    actions.setSelectedIds([])
    const stage = e.target.getStage()
    if (!stage) return
    const pos = stage.getRelativePointerPosition()
    if (!pos) return
    selectionBox.current = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return

    const pos = stage.getRelativePointerPosition()

    if (pos && awareness) {
      awareness.setLocalStateField('cursor', { x: pos.x, y: pos.y })
    }

    if (isCreateShapeMode) {
      if (newShape.length === 0) return
      if (!pos) return
      const shape = newShape[0]
      shape.width = pos.x - shape.x
      shape.height = pos.y - shape.y
      setNewShape([shape])
      return
    }

    if (!selecting) {
      return
    }
    e.evt.preventDefault()
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

    const selected = (snap.entity.drawables || []).filter((drawable) => {
      if (drawable.type === 'rectangle') {
        return Konva.Util.haveIntersection(box, {
          x: drawable.x,
          y: drawable.y,
          width: drawable.width,
          height: drawable.height,
        })
      }
      if (drawable.type === 'ellipse') {
        // A simple bounding box intersection for ellipses
        return Konva.Util.haveIntersection(box, {
          x: drawable.x - drawable.radiusX,
          y: drawable.y - drawable.radiusY,
          width: drawable.radiusX * 2,
          height: drawable.radiusY * 2,
        })
      }
      return false
    })
    actions.setSelectedIds(selected.map((drawable) => drawable.id))
  }

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touch1 = e.evt.touches[0]
    const touch2 = e.evt.touches[1]
    const stage = e.target.getStage()

    if (touch1 && touch2 && stage) {
      e.evt.preventDefault()
      const p1 = { x: touch1.clientX, y: touch1.clientY }
      const p2 = { x: touch2.clientX, y: touch2.clientY }

      if (!lastCenter.current) {
        lastCenter.current = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
        return
      }
      const newCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))

      if (lastDist.current === 0) {
        lastDist.current = dist
      }

      const pointTo = {
        x: (newCenter.x - stage.x()) / stage.scaleX(),
        y: (newCenter.y - stage.y()) / stage.scaleY(),
      }

      const scale = stage.scaleX() * (dist / lastDist.current)

      const dx = newCenter.x - lastCenter.current.x
      const dy = newCenter.y - lastCenter.current.y

      const newPos = {
        x: newCenter.x - pointTo.x * scale + dx,
        y: newCenter.y - pointTo.y * scale + dy,
      }

      setStage({
        scale: scale,
        x: newPos.x,
        y: newPos.y,
      })

      lastDist.current = dist
      lastCenter.current = newCenter
    } else {
      handleMouseMove(e)
    }
  }

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isCreateShapeMode) {
      if (newShape.length > 0) {
        const shape = newShape[0]
        if (Math.abs(shape.width) > 5 && Math.abs(shape.height) > 5) {
          // simple logic to decide shape, can be improved
          const type = Math.random() > 0.5 ? 'rectangle' : 'ellipse'
          const newDrawable: DrawableType =
            type === 'rectangle'
              ? {
                  id: crypto.randomUUID(),
                  type: 'rectangle',
                  x: shape.x,
                  y: shape.y,
                  width: shape.width,
                  height: shape.height,
                  fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
                }
              : {
                  id: crypto.randomUUID(),
                  type: 'ellipse',
                  x: shape.x + shape.width / 2,
                  y: shape.y + shape.height / 2,
                  radiusX: Math.abs(shape.width) / 2,
                  radiusY: Math.abs(shape.height) / 2,
                  fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
                }
          actions.addDrawable(ydoc, newDrawable)
        }
        setNewShape([])
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
    lastDist.current = 0
    lastCenter.current = null
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
        onTouchStart={handleMouseDown}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
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
          {(snap.entity.drawables || []).map((drawable) => (
            <Drawable
              key={drawable.id}
              shapeProps={drawable}
              isSelected={snap.selectedIds.includes(drawable.id)}
              isSpacePressed={isSpacePressed}
              onSelect={(e) => {
                if (e.evt.shiftKey) {
                  if (snap.selectedIds.includes(drawable.id)) {
                    actions.setSelectedIds(
                      snap.selectedIds.filter((id) => id !== drawable.id),
                    )
                  } else {
                    actions.setSelectedIds([
                      ...snap.selectedIds,
                      drawable.id,
                    ])
                  }
                } else {
                  actions.setSelectedIds(
                    snap.selectedIds.includes(drawable.id) ? [] : [drawable.id],
                  )
                }
              }}
              onDragStart={(e) => {
                if (
                  snap.selectedIds.length > 1 &&
                  snap.selectedIds.includes(drawable.id)
                ) {
                  const stage = e.target.getStage()
                  const pointerPos = stage?.getPointerPosition()
                  if (!pointerPos) return

                  const initialPositions = new Map<string, { x: number; y: number }>()
                  snap.selectedIds.forEach((id) => {
                    const d = (snap.entity.drawables || []).find((d) => d.id === id)
                    if (d) {
                      initialPositions.set(id, { x: d.x, y: d.y })
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
                  const draggedShape = e.target
                  const draggedShapeId = draggedShape.id()
                  const initialPos = dragContext.initialPositions.get(draggedShapeId)
                  if (!initialPos) return

                  const dx = draggedShape.x() - initialPos.x
                  const dy = draggedShape.y() - initialPos.y

                  const updates = snap.selectedIds
                    .filter((id) => id !== draggedShapeId)
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
                    actions.updateDrawables(ydoc, updates)
                  }
                }
              }}
              onChange={(newAttrs) => {
                if (dragContext) {
                  const { id: draggedId, x: finalX, y: finalY } = newAttrs as any
                  const initialPos = dragContext.initialPositions.get(draggedId)
                  if (!initialPos) {
                    setDragContext(null)
                    return
                  }

                  const dx = finalX - initialPos.x
                  const dy = finalY - initialPos.y

                  const finalUpdates = snap.selectedIds
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

                  actions.updateDrawables(ydoc, finalUpdates)
                  setDragContext(null)
                } else {
                  actions.updateDrawable(ydoc, (newAttrs as any).id, newAttrs)
                }
              }}
            />
          ))}
          {newShape.map((shape) => {
            return (
              <Rect
                key={shape.id}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#3b82f6"
                strokeWidth={2 / stage.scale}
              />
            )
          })}
          <Rect ref={selectionRectRef} fill="rgba(0,0,255,0.2)" visible={false} />
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            onTransformEnd={() => {
              const nodes = transformerRef.current?.nodes()
              if (!nodes) return

              const updates = nodes.map((node) => {
                const scaleX = node.scaleX()
                const scaleY = node.scaleY()

                node.scaleX(1)
                node.scaleY(1)
                const drawable = (snap.entity.drawables || []).find((d) => d.id === node.id())

                if (drawable?.type === 'rectangle') {
                  return {
                    id: node.id(),
                    x: node.x(),
                    y: node.y(),
                    width: Math.max(5, node.width() * scaleX),
                    height: Math.max(5, node.height() * scaleY),
                  }
                } else if (drawable?.type === 'ellipse') {
                  return {
                    id: node.id(),
                    x: node.x(),
                    y: node.y(),
                    radiusX: Math.max(5, (node as Konva.Ellipse).radiusX() * scaleX),
                    radiusY: Math.max(5, (node as Konva.Ellipse).radiusY() * scaleY),
                  }
                }
                return null
              }).filter((u): u is Exclude<typeof u, null> => u !== null)
              actions.updateDrawables(ydoc, updates)
            }}
          />
        </Layer>
      </Stage>
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <CanvasCursors cursors={cursors} stage={stage} />
      </svg>
      <ZoomControlsAndStatus
        transformState={transformState}
        zoomIn={() => zoom('in')}
        zoomOut={() => zoom('out')}
        resetTransform={resetTransform}
        isCreateRectangleMode={isCreateShapeMode}
        setIsCreateRectangleMode={setIsCreateShapeMode}
      />
    </div>
  )
}

export default KonvaCanvas
