'use client'

import React from 'react'
import { Rect } from 'react-konva'
import { Rectangle as RectangleType } from '../types'
import Konva from 'konva'

interface RectangleProps extends RectangleType {
  isSelected: boolean
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onChange: (newAttrs: any) => void
  isSpacePressed: boolean
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void
}

const Rectangle = ({
  id,
  x,
  y,
  width,
  height,
  fill,
  stroke,
  strokeWidth,
  isSelected,
  onSelect,
  onChange,
  isSpacePressed,
  onDragStart,
  onDragMove,
}: RectangleProps) => {
  return (
    <Rect
      id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      stroke={isSelected ? '#3b82f6' : stroke}
      strokeWidth={isSelected ? 2 : strokeWidth}
      draggable={!isSpacePressed}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        onChange({
          id,
          x: e.target.x(),
          y: e.target.y(),
        })
      }}
    />
  )
}

export default Rectangle

