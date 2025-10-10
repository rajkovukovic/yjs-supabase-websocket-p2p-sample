'use client'

import { useState, useCallback, useEffect } from 'react'
import { actions } from '../store/document'
import { useYDoc } from '../hooks/useYjs'
import { Rectangle as RectangleType } from '../types'

interface RectangleProps extends RectangleType {
  isSelected?: boolean
  onSelect?: () => void
  scale?: number
}

export function Rectangle(props: RectangleProps) {
  const ydoc = useYDoc()
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Select rectangle when clicked
    if (props.onSelect) {
      props.onSelect()
    }
    
    setIsDragging(true)
    
    // Convert screen coordinates to SVG coordinates
    const svg = document.querySelector('svg')
    if (!svg) return
    
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const matrix = svg.getScreenCTM()
    if (!matrix) return
    
    const svgP = pt.matrixTransform(matrix.inverse())
    
    // Calculate offset in SVG coordinate space
    setDragStart({ x: svgP.x - props.x, y: svgP.y - props.y })
  }
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging && !isResizing) return
    
    if (isDragging) {
      const svg = document.querySelector('svg')
      if (!svg) return
      
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const matrix = svg.getScreenCTM()
      if (!matrix) return
      
      const svgP = pt.matrixTransform(matrix.inverse())
      
      actions.updateRectangle(ydoc, props.id, {
        x: svgP.x - dragStart.x,
        y: svgP.y - dragStart.y
      })
    }
    
    if (isResizing) {
      const svg = document.querySelector('svg')
      if (!svg) return
      
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const matrix = svg.getScreenCTM()
      if (!matrix) return
      
      const svgP = pt.matrixTransform(matrix.inverse())
      
      const newWidth = Math.max(20, svgP.x - props.x)
      const newHeight = Math.max(20, svgP.y - props.y)
      
      actions.updateRectangle(ydoc, props.id, {
        width: newWidth,
        height: newHeight
      })
    }
  }, [isDragging, isResizing, dragStart, ydoc, props.id, props.x, props.y])
  
  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }
  
  // Resize handlers (SE corner)
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
  }
  
  // Global event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, handleMouseMove])
  
  // Calculate inverse scale for consistent visual size
  const handleSize = (props.scale || 1) > 0 ? 6 / (props.scale || 1) : 6
  const strokeWidth = (props.scale || 1) > 0 ? 2 / (props.scale || 1) : 2
  
  return (
    <g>
      <rect
        x={props.x}
        y={props.y}
        width={props.width}
        height={props.height}
        fill={props.fill}
        stroke={props.isSelected ? '#2563eb' : (props.stroke || '#000')}
        strokeWidth={props.isSelected ? 3 : (props.strokeWidth || 2)}
        className={(isDragging || isResizing) ? 'no-transition' : ''}
        style={{ cursor: isDragging ? 'grabbing' : 'move' }}
        onMouseDown={handleMouseDown}
      />
      
      {/* Resize handle (SE corner) - size inversely scaled to stay consistent */}
      {props.isSelected && (
        <circle
          cx={props.x + props.width}
          cy={props.y + props.height}
          r={handleSize}
          fill="white"
          stroke="#2563eb"
          strokeWidth={strokeWidth}
          style={{ cursor: 'se-resize' }}
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </g>
  )
}

