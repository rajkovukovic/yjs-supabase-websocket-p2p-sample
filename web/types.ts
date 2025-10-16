import { Drawable, Comment } from './lib/schemas'

export interface Rectangle {
  id: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke?: string
  strokeWidth?: number
}

export { Drawable, Comment }

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

export interface DocumentState {
  entity: {
    name?: string
    drawables?: Drawable[]
    comments?: Comment[]
    [key: string]: any
  }
  synced: boolean
  status: 'disconnected' | 'connecting' | 'connected'
  peers: number
  selectedIds: string[]
}

export interface CursorState {
  cursor: {
    x: number
    y: number
  }
  user: {
    name: string
    color: string
  }
}

