import { proxy } from 'valtio'
import * as Y from 'yjs'
import { Rectangle, DocumentState } from '../types'

export const documentState = proxy<DocumentState>({
  rectangles: [],
  synced: false,
  status: 'disconnected',
  peers: 0,
  selectedRectangleIds: [],
})

// Sync Yjs to Valtio
export function syncYjsToValtio(ydoc: Y.Doc) {
  const yRectangles = ydoc.getArray<Rectangle>('rectangles')
  
  const observer = () => {
    documentState.rectangles = yRectangles.toArray()
  }
  
  yRectangles.observe(observer)
  observer() // Initial sync
  
  return () => yRectangles.unobserve(observer)
}

// Valtio actions (update Yjs document)
export const actions = {
  addRectangle(ydoc: Y.Doc, rect: Rectangle) {
    const yRectangles = ydoc.getArray('rectangles')
    yRectangles.push([rect])
  },
  
  updateRectangle(ydoc: Y.Doc, id: string, updates: Partial<Rectangle>) {
    ydoc.transact(() => {
      const yRectangles = ydoc.getArray('rectangles')
      const index = yRectangles.toArray().findIndex((r: Rectangle) => r.id === id)
      
      if (index !== -1) {
        const current = yRectangles.get(index) as Rectangle
        yRectangles.delete(index, 1)
        yRectangles.insert(index, [{ ...current, ...updates }])
      }
    })
  },
  
  deleteRectangle(ydoc: Y.Doc, id: string) {
    const yRectangles = ydoc.getArray('rectangles')
    const index = yRectangles.toArray().findIndex((r: Rectangle) => r.id === id)
    
    if (index !== -1) {
      yRectangles.delete(index, 1)
    }
  },
  
  setSelectedRectangle(ids: string[] | string | null) {
    if (ids === null) {
      documentState.selectedRectangleIds = []
    } else if (typeof ids === 'string') {
      documentState.selectedRectangleIds = [ids]
    } else {
      documentState.selectedRectangleIds = ids
    }
  },

  updateRectangles(ydoc: Y.Doc, updates: { id: string; x: number; y: number }[]) {
    ydoc.transact(() => {
      const yRectangles = ydoc.getArray('rectangles')
      const rects = yRectangles.toArray()

      updates.forEach(update => {
        const index = rects.findIndex((r: Rectangle) => r.id === update.id)
        if (index !== -1) {
          const current = yRectangles.get(index) as Rectangle
          yRectangles.delete(index, 1)
          yRectangles.insert(index, [{ ...current, x: update.x, y: update.y }])
        }
      })
    })
  },
}

