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

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

export interface DocumentState {
  rectangles: Rectangle[]
  synced: boolean
  status: 'disconnected' | 'connecting' | 'connected'
  peers: number
  selectedRectangleId: string | null
}

export interface CursorState {
  x: number
  y: number
  user: {
    name: string
    color: string
  }
}

