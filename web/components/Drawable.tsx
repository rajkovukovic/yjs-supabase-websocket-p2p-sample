'use client'

import React from 'react'
import Rectangle from './Rectangle'
import Ellipse from './Ellipse'
import { Drawable as DrawableType } from '@/lib/schemas'
import { DrawableProps } from '@/types'

const Drawable = (props: Omit<DrawableProps<DrawableType>, 'shapeProps'> & { shapeProps: DrawableType }) => {
  const { shapeProps } = props

  switch (shapeProps.type) {
    case 'rectangle':
      return <Rectangle {...props} shapeProps={shapeProps} />
    case 'ellipse':
      return <Ellipse {...props} shapeProps={shapeProps} />
    default:
      // @ts-expect-error - shapeProps is never here
      console.warn(`Unknown drawable type: ${shapeProps.type}`)
      return null
  }
}

export default Drawable
