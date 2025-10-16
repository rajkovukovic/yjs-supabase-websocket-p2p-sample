import { Database } from '@hocuspocus/extension-database'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as Y from 'yjs'
import { decoding } from 'lib0'
import { z } from 'zod'

const YJS_ENTITIES_TABLE = 'yjs_entities'
const YJS_ENTITY_DELTAS_TABLE = 'yjs_entity_deltas'

const genericEntitySchema = z.object({
  id: z.string(),
  type: z.string(),
})

let supabase: SupabaseClient | null = null
function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials.')
    }
    supabase = createClient(supabaseUrl, supabaseKey)
  }
  return supabase
}

export const SupabaseDatabase = new Database({
  fetch: async ({ documentName: entityId, context }) => {
    try {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from(YJS_ENTITIES_TABLE)
        .select('yjs_state')
        .eq('id', entityId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      if (!data?.yjs_state) return null

      const hexString = data.yjs_state as string
      
      if (hexString.startsWith('\\x')) {
        return Buffer.from(hexString.slice(2), 'hex')
      }

      console.warn(`[SupabaseDB] yjs_state for ${entityId} was in an unexpected format.`)
      return null
    } catch (error) {
      console.error('[SupabaseDB] Fetch error:', error)
      return null
    }
  },
  
  store: async ({ documentName: entityId, state, document, context }) => {
    try {
      const { entityType } = context
      if (!entityType) throw new Error('entityType is missing from the context.')

      const validation = z.array(genericEntitySchema.partial()).safeParse(document.getArray('drawables').toJSON())
      if (!validation.success) {
        console.error('[SupabaseDB] Validation failed:', validation.error)
        return
      }

      const supabase = getSupabaseClient()
      const hexString = '\\x' + Buffer.from(state).toString('hex')

      const { error } = await supabase
        .from(YJS_ENTITIES_TABLE)
        .upsert({
          id: entityId,
          type: entityType,
          yjs_state: hexString,
        }, { onConflict: 'id' })

      if (error) throw error
    } catch (error) {
      console.error('[SupabaseDB] Store error:', error)
      throw error
    }
  }
})

export async function storeUpdate(
  entityId: string,
  entityType: string,
  update: Uint8Array,
  clientId: number
) {
  try {
    const supabase = getSupabaseClient()
    
    const decoder = new decoding.Decoder(update)
    const clock = decoding.readVarUint(decoder)
    const hexString = '\\x' + Buffer.from(update).toString('hex')
    
    const { error } = await supabase
      .from(YJS_ENTITY_DELTAS_TABLE)
      .insert({
        entity_id: entityId,
        entity_type: entityType,
        update: hexString,
        client_id: String(clientId),
        clock,
      })
    
    if (error) console.error('[SupabaseDB] Update store error:', error)
  } catch (error) {
    console.error('[SupabaseDB] Unexpected update store error:', error)
  }
}

