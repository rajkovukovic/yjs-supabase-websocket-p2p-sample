import { Extension, onChangePayload } from '@hocuspocus/server'
import { storeUpdate } from './supabase-db.js'

/**
 * Update Tracker Extension
 * 
 * This extension captures individual Yjs updates using the onChange hook.
 * According to Hocuspocus documentation, onChange provides the update data.
 * 
 * From the docs:
 * const data = {
 *   update: Uint8Array,
 *   documentName: string,
 *   document: Doc,
 *   socketId: string,
 *   context: any,
 *   ...
 * }
 */
export const UpdateTracker: Extension = {
  /**
   * Called when a document changes
   * The update parameter contains the incremental Yjs update
   */
  async onChange(data: onChangePayload) {
    const { documentName: entityId, update, socketId, context } = data
    const { entityType } = context

    if (!entityType) {
      console.error('[UpdateTracker] entityType is missing from context.')
      return
    }

    if (update && update instanceof Uint8Array) {
      try {
        const clientId = socketId
          ? Array.from(socketId).reduce((acc, char) => acc + char.charCodeAt(0), 0)
          : 0
        
        await storeUpdate(
          entityId,
          entityType as string,
          update,
          clientId
        )
      } catch (error) {
        console.error('[UpdateTracker] Error storing update:', error)
      }
    }
  }
}

