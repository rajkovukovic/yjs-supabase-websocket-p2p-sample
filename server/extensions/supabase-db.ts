import { Database } from '@hocuspocus/extension-database'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as Y from 'yjs'
import { decoding } from 'lib0'
import { z } from 'zod'
import { config } from '../config.js'

// Define a simple schema for validation before storing.
// This should ideally be shared with the frontend.
const genericEntitySchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  // Add other common fields if necessary
})
// Lazy initialization of Supabase client
// This will be initialized on first use, after config is loaded
let supabase: SupabaseClient | null = null

function getSupabaseClient() {
  if (!supabase) {
    // Get env vars - they should be loaded by config.ts before this is called
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing Supabase credentials. Please ensure config.ts is imported first and .env file is properly configured.'
      )
    }
    
    supabase = createClient(supabaseUrl, supabaseKey)
    console.log('✓ Supabase client initialized')
  }
  return supabase
}

/**
 * Parses the documentName to extract entityType and entityId.
 * @param documentName - The name of the document, e.g., "document:123-abc".
 * @returns An object with entityType and entityId.
 */
const parseDocumentName = (documentName: string) => {
  const [entityType, entityId] = documentName.split(':')
  if (!entityType || !entityId) {
    throw new Error(`Invalid documentName format: ${documentName}`)
  }
  return { entityType, entityId }
}

/**
 * Retrieves the table name for a given entity type from the database.
 * @param entityType - The type of the entity (e.g., "document").
 * @returns The corresponding table name.
 */
const getTableNameForEntityType = async (entityType: string): Promise<string> => {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('entity_types')
    .select('table_name')
    .eq('name', entityType)
    .single()

  if (error || !data) {
    console.error(`[SupabaseDB] Entity type '${entityType}' not found in entity_types table.`)
    throw new Error(`Entity type not found: ${entityType}`)
  }

  return data.table_name
}

/**
 * Supabase Database Extension for Hocuspocus
 * 
 * This extension provides persistent storage for Yjs documents using Supabase.
 * It handles fetching and storing document state to PostgreSQL.
 */
export const SupabaseDatabase = new Database({
  /**
   * Fetch document from Supabase
   * Returns null if document doesn't exist (which is OK for new documents)
   */
  fetch: async ({ documentName }) => {
    console.log(`[SupabaseDB] Fetching document: ${documentName}`)
    
    try {
      const { entityType } = parseDocumentName(documentName)
      const tableName = await getTableNameForEntityType(entityType)
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from(tableName)
        .select('yjs_state')
        .eq('name', documentName)
        .single()
      
      if (error) {
        // PGRST116 = Row not found, which is OK for new documents
        if (error.code === 'PGRST116') {
          console.log(`[SupabaseDB] Document not found (new document): ${documentName}`)
          return null
        }
        
        console.error('[SupabaseDB] Fetch error:', error)
        throw error
      }
      
      if (!data?.yjs_state) {
        console.log(`[SupabaseDB] Document exists but has no state: ${documentName}`)
        return null
      }
      
      console.log(`[SupabaseDB] Successfully fetched document: ${documentName}`)
      
      // Supabase returns BYTEA as hex-encoded string (e.g., "\x7b2274797065...")
      // We need to convert it to Uint8Array
      let binaryData = data.yjs_state
      
      // If it's a hex string starting with \x, convert it
      if (typeof binaryData === 'string' && binaryData.startsWith('\\x')) {
        // Remove \x prefix and convert hex to buffer
        const hexString = binaryData.slice(2)
        binaryData = Buffer.from(hexString, 'hex')
        console.log(`[SupabaseDB] Converted hex string to buffer (${binaryData.length} bytes)`)
      }
      
      // Convert Buffer to Uint8Array if needed
      if (Buffer.isBuffer(binaryData)) {
        return new Uint8Array(binaryData)
      }
      
      // If it's already a Uint8Array or Buffer, use it
      return binaryData
    } catch (error) {
      console.error('[SupabaseDB] Unexpected fetch error:', error)
      return null
    }
  },
  
  /**
   * Store document updates to Supabase
   * Uses upsert to create or update the document
   */
  store: async ({ documentName, state, document }) => {
    console.log(`[SupabaseDB] Storing document: ${documentName}`)
    
    try {
      // Server-side Zod validation before storing
      const drawables = document.getArray('drawables').toJSON()
      const validationResult = z.array(genericEntitySchema.partial()).safeParse(drawables)

      if (!validationResult.success) {
        console.error('[SupabaseDB] Server-side validation failed:', validationResult.error)
        // Do not store invalid data. You might want to log this or notify someone.
        return
      }

      const { entityType } = parseDocumentName(documentName)
      const tableName = await getTableNameForEntityType(entityType)
      const supabase = getSupabaseClient()
      
      // Convert Uint8Array to hex string for Supabase BYTEA storage
      // Supabase requires hex format: \xHEXSTRING
      const buffer = Buffer.from(state)
      const hexString = '\\x' + buffer.toString('hex')
      
      console.log(`[SupabaseDB] Storing ${buffer.length} bytes as hex string`)
      
      const { error } = await supabase
        .from(tableName)
        .upsert({
          name: documentName,
          yjs_state: hexString,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'name'
        })
      
      if (error) {
        console.error('[SupabaseDB] Store error:', error)
        throw error
      }
      
      console.log(`[SupabaseDB] Successfully stored document: ${documentName}`)
    } catch (error) {
      console.error('[SupabaseDB] Unexpected store error:', error)
      throw error
    }
  }
})

/**
 * Ensure document exists in database (for foreign key constraint)
 * This creates an empty document row if it doesn't exist
 */
export async function ensureDocumentExists(documentName: string) {
  try {
    const { entityType } = parseDocumentName(documentName)
    const tableName = await getTableNameForEntityType(entityType)
    const supabase = getSupabaseClient()
    
    const { error } = await supabase
      .from(tableName)
      .upsert({
        name: documentName,
        yjs_state: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'name',
        ignoreDuplicates: true // Don't update if already exists
      })
    
    if (error) {
      console.error(`[SupabaseDB] Error ensuring document exists:`, error)
    } else {
      console.log(`[SupabaseDB] Document ${documentName} exists in database`)
    }
  } catch (error) {
    console.error(`[SupabaseDB] Unexpected error ensuring document exists:`, error)
  }
}

/**
 * Store incremental updates for audit/replay purposes
 * This is optional but useful for debugging and history
 */
export async function storeUpdate(
  documentName: string, 
  update: Uint8Array, 
  clientId: number
) {
  try {
    const { entityType } = parseDocumentName(documentName)
    const supabase = getSupabaseClient()
    
    // Decode clock from update for tracking
    const decoder = new decoding.Decoder(update)
    const clock = decoding.readVarUint(decoder)
    
    // Convert Uint8Array to hex string for Supabase BYTEA storage
    // Same format as the main store function
    const buffer = Buffer.from(update)
    const hexString = '\\x' + buffer.toString('hex')
    
    console.log(`[SupabaseDB] Storing update for ${documentName} (${buffer.length} bytes, clock: ${clock})`)
    
    const { error } = await supabase
      .from(config.tables.documentUpdates)
      .insert({
        document_name: documentName,
        entity_type: entityType,
        update: hexString,
        client_id: clientId.toString(),
        clock: clock,
        created_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('[SupabaseDB] Update store error:', error)
      console.error('[SupabaseDB] Error details:', JSON.stringify(error, null, 2))
    } else {
      console.log(`[SupabaseDB] Successfully stored update for ${documentName}`)
    }
  } catch (error) {
    console.error('[SupabaseDB] Unexpected update store error:', error)
  }
}

/**
 * Create snapshot from accumulated updates (optional, for optimization)
 * This can be run as a periodic cron job to compress old updates
 */
export async function createSnapshot(documentName: string) {
  try {
    const { entityType } = parseDocumentName(documentName)
    const tableName = await getTableNameForEntityType(entityType)
    const supabase = getSupabaseClient()

    // Get last snapshot timestamp
    const { data: lastSnapshot } = await supabase
      .from(config.tables.documentSnapshots)
      .select('created_at')
      .eq('document_name', documentName)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    // Get all updates since last snapshot
    const { data: updates } = await supabase
      .from(config.tables.documentUpdates)
      .select('update')
      .eq('document_name', documentName)
      .gt('created_at', lastSnapshot?.created_at || '1970-01-01')
      .order('created_at', { ascending: true })
    
    if (!updates || updates.length < 100) {
      console.log(`[SupabaseDB] Not enough updates to create snapshot (${updates?.length || 0})`)
      return
    }
    
    // Merge updates into snapshot
    const ydoc = new Y.Doc()
    updates.forEach(({ update }) => {
      Y.applyUpdate(ydoc, new Uint8Array(update))
    })
    
    const snapshot = Y.encodeStateAsUpdate(ydoc)
    
    // Store snapshot
    await supabase
      .from(config.tables.documentSnapshots)
      .insert({
        document_name: documentName,
        snapshot: Buffer.from(snapshot),
        update_count: updates.length,
        created_at: new Date().toISOString()
      })
    
    console.log(`[SupabaseDB] Created snapshot for ${documentName} with ${updates.length} updates`)
    
    // Optional: Archive old updates (keep last 30 days)
    await supabase
      .from(config.tables.documentUpdates)
      .delete()
      .eq('document_name', documentName)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    
  } catch (error) {
    console.error('[SupabaseDB] Snapshot creation error:', error)
  }
}

