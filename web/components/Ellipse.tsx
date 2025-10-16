'use client'

import React from 'react'
import { Ellipse as KonvaEllipse } from 'react-konva'
import { Ellipse as EllipseType } from '@/lib/schemas'
import { DrawableProps } from '@/types'

const Ellipse = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
  isSpacePressed,
  onDragStart,
  onDragMove,
}: DrawableProps<EllipseType>) => {
  const { id, x, y, radiusX, radiusY, fill } = shapeProps
  return (
    <KonvaEllipse
      id={id}
      x={x}
      y={y}
      radiusX={radiusX}
      radiusY={radiusY}
      fill={fill}
      stroke={isSelected ? '#3b82f6' : 'black'}
      strokeWidth={isSelected ? 2 : 1}
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

export default Ellipse
