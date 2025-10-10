import { Database } from '@hocuspocus/extension-database'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as Y from 'yjs'
import { decoding, encoding } from 'lib0'

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
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('documents')
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
  store: async ({ documentName, state }) => {
    console.log(`[SupabaseDB] Storing document: ${documentName}`)
    
    try {
      const supabase = getSupabaseClient()
      
      // Convert Uint8Array to hex string for Supabase BYTEA storage
      // Supabase requires hex format: \xHEXSTRING
      const buffer = Buffer.from(state)
      const hexString = '\\x' + buffer.toString('hex')
      
      console.log(`[SupabaseDB] Storing ${buffer.length} bytes as hex string`)
      
      const { error } = await supabase
        .from('documents')
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
 * Store incremental updates for audit/replay purposes
 * This is optional but useful for debugging and history
 */
export async function storeUpdate(
  documentName: string, 
  update: Uint8Array, 
  clientId: number
) {
  try {
    const supabase = getSupabaseClient()
    // Decode clock from update for tracking
    const decoder = new decoding.Decoder(update)
    const clock = decoding.readVarUint(decoder)
    
    const { error } = await supabase
      .from('document_updates')
      .insert({
        document_name: documentName,
        update: Buffer.from(update),
        client_id: clientId.toString(),
        clock: clock,
        created_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('[SupabaseDB] Update store error:', error)
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
    const supabase = getSupabaseClient()
    // Get last snapshot timestamp
    const { data: lastSnapshot } = await supabase
      .from('document_snapshots')
      .select('created_at')
      .eq('document_name', documentName)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    // Get all updates since last snapshot
    const { data: updates } = await supabase
      .from('document_updates')
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
      .from('document_snapshots')
      .insert({
        document_name: documentName,
        snapshot: Buffer.from(snapshot),
        update_count: updates.length,
        created_at: new Date().toISOString()
      })
    
    console.log(`[SupabaseDB] Created snapshot for ${documentName} with ${updates.length} updates`)
    
    // Optional: Archive old updates (keep last 30 days)
    await supabase
      .from('document_updates')
      .delete()
      .eq('document_name', documentName)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    
  } catch (error) {
    console.error('[SupabaseDB] Snapshot creation error:', error)
  }
}

