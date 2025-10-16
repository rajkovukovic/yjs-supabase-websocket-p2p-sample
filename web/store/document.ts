import { proxy } from 'valtio'
import * as Y from 'yjs'
import { DocumentState } from '../types'
import {
  EntityType,
  entityConfigs,
  Drawable,
  drawableSchema,
  Rectangle,
  rectangleSchema,
} from '@/lib/schemas'
import { z } from 'zod'

export const docState = proxy<DocumentState>({
  entity: {
    name: '',
    drawables: [],
    comments: [],
  },
  synced: false,
  status: 'disconnected',
  peers: 0,
  selectedIds: [],
  connection: {
    indexeddb: 'syncing',
    websocket: 'disconnected',
    webrtc: 'disconnected',
  },
})

// Sync Yjs to Valtio
export function syncYjsToValtio(ydoc: Y.Doc, entityType: EntityType) {
  const config = entityConfigs[entityType]
  if (!config) {
    console.error(`No entity config found for type: ${entityType}`)
    return () => {}
  }

  const schemaDef = (config.schema as z.ZodObject<any>).shape
  const topLevelKeys = Object.keys(schemaDef)
  const unsubs: (() => void)[] = []

  const observer = () => {
    const newEntity: { [key: string]: any } = {}
    for (const key of topLevelKeys) {
      const ytype = ydoc.get(key)
      if (ytype instanceof Y.Text) {
        newEntity[key] = ytype.toString()
      } else if (ytype instanceof Y.Array || ytype instanceof Y.Map) {
        newEntity[key] = ytype.toJSON()
      }
    }
    docState.entity = newEntity
  }

  topLevelKeys.forEach((key) => {
    const ytype = ydoc.get(key)
    if (ytype instanceof Y.Array || ytype instanceof Y.Map) {
      ytype.observeDeep(observer)
      unsubs.push(() => ytype.unobserveDeep(observer))
    } else {
      ytype.observe(observer)
      unsubs.push(() => ytype.unobserve(observer))
    }
  })

  observer() // initial sync

  return () => {
    unsubs.forEach((unsub) => unsub())
  }
}

// Valtio actions (update Yjs document)
// TODO: These actions are still specific to the 'document' entity.
// In the future, we may want a more generic action system.
export const actions = {
  addDrawable(ydoc: Y.Doc, drawable: Drawable) {
    const validation = drawableSchema.safeParse(drawable)
    if (!validation.success) {
      console.error('Invalid drawable data:', validation.error)
      return
    }

    const yDrawables = ydoc.getArray<Y.Map<any>>('drawables')
    const ymap = new Y.Map()
    for (const [key, value] of Object.entries(validation.data)) {
      ymap.set(key, value)
    }
    yDrawables.push([ymap])
  },

  updateDrawable(ydoc: Y.Doc, id: string, updates: Partial<Drawable>) {
    ydoc.transact(() => {
      const yDrawables = ydoc.getArray<Y.Map<any>>('drawables')
      const index = yDrawables.toArray().findIndex((d) => d.get('id') === id)

      if (index !== -1) {
        const ymap = yDrawables.get(index)
        for (const [key, value] of Object.entries(updates)) {
          ymap.set(key, value)
        }
      }
    })
  },

  deleteDrawable(ydoc: Y.Doc, id: string) {
    const yDrawables = ydoc.getArray<Y.Map<any>>('drawables')
    const index = yDrawables.toArray().findIndex((d) => d.get('id') === id)

    if (index !== -1) {
      yDrawables.delete(index, 1)
    }
  },

  deleteDrawables(ydoc: Y.Doc, ids: string[]) {
    ydoc.transact(() => {
      const yDrawables = ydoc.getArray<Y.Map<any>>('drawables')
      const indicesToDelete = ids
        .map((id) => yDrawables.toArray().findIndex((d) => d.get('id') === id))
        .filter((index) => index !== -1)
        .sort((a, b) => b - a)

      indicesToDelete.forEach((index) => {
        yDrawables.delete(index, 1)
      })
    })
    docState.selectedIds = []
  },

  setSelectedIds(ids: string[] | string | null) {
    if (ids === null) {
      docState.selectedIds = []
    } else if (typeof ids === 'string') {
      docState.selectedIds = [ids]
    } else {
      docState.selectedIds = ids
    }
  },

  updateDrawables(
    ydoc: Y.Doc,
    updates: (Partial<Drawable> & { id: string })[],
  ) {
    ydoc.transact(() => {
      const yDrawables = ydoc.getArray<Y.Map<any>>('drawables')
      updates.forEach((update) => {
        const index = yDrawables
          .toArray()
          .findIndex((d) => d.get('id') === update.id)
        if (index !== -1) {
          const ymap = yDrawables.get(index)
          for (const [key, value] of Object.entries(update)) {
            ymap.set(key, value)
          }
        }
      })
    })
  },
}

