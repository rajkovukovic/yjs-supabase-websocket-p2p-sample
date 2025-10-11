'use client'

import React from 'react'
import { Rect, Transformer } from 'react-konva'
import { Rectangle as RectangleType } from '../types'
import Konva from 'konva'

interface RectangleProps extends RectangleType {
  isSelected: boolean
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onChange: (newAttrs: any) => void
  isSpacePressed: boolean
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
}: RectangleProps) => {
  const shapeRef = React.useRef<Konva.Rect>(null)
  const trRef = React.useRef<Konva.Transformer>(null)

  React.useEffect(() => {
    if (isSelected) {
      if (trRef.current) {
        trRef.current.nodes([shapeRef.current!])
        trRef.current.getLayer()?.batchDraw()
      }
    }
  }, [isSelected])

  return (
    <>
      <Rect
        ref={shapeRef}
        id={id}
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        draggable={!isSpacePressed}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            id,
            x: e.target.x(),
            y: e.target.y(),
          })
        }}
        onTransformEnd={() => {
          const node = shapeRef.current
          if (!node) return
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()

          node.scaleX(1)
          node.scaleY(1)

          onChange({
            id,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
          })
        }}
      />
      {isSelected && <Transformer ref={trRef} />}
    </>
  )
}

export default Rectangle

