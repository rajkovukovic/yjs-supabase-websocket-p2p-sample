import { Extension, onChangePayload, afterLoadDocumentPayload } from '@hocuspocus/server'
import { storeUpdate, ensureDocumentExists } from './supabase-db.js'

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
   * Called after a document is loaded
   * Ensure the document exists in the database before updates are stored
   */
  async afterLoadDocument(data: afterLoadDocumentPayload) {
    const { documentName } = data
    
    try {
      // Ensure document row exists in database (for foreign key constraint)
      await ensureDocumentExists(documentName)
    } catch (error) {
      console.error(`[UpdateTracker] Error ensuring document exists:`, error)
    }
  },
  
  /**
   * Called when a document changes
   * The update parameter contains the incremental Yjs update
   */
  async onChange(data: onChangePayload) {
    const { documentName, update, socketId, context } = data
    
    if (update && update instanceof Uint8Array) {
      console.log(`[UpdateTracker] Captured update for ${documentName} (${update.length} bytes, socketId: ${socketId})`)
      
      try {
        // Extract client ID from socketId (convert string to number hash) or use 0
        const clientId = socketId ? socketId.charCodeAt(0) : 0
        
        await storeUpdate(
          documentName,
          update,
          clientId
        )
      } catch (error) {
        console.error('[UpdateTracker] Error storing update:', error)
      }
    } else {
      console.warn(`[UpdateTracker] onChange called for ${documentName} but no update data available`)
    }
  }
}

