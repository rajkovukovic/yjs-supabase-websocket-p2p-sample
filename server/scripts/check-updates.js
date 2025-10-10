#!/usr/bin/env node

/**
 * Quick script to check document_updates table
 * Usage: node scripts/check-updates.js
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function checkUpdates() {
  console.log('\n📊 Checking document_updates table...\n')
  
  // Get count
  const { count, error: countError } = await supabase
    .from('document_updates')
    .select('*', { count: 'exact', head: true })
  
  if (countError) {
    console.error('❌ Error getting count:', countError)
    return
  }
  
  console.log(`Total updates: ${count}`)
  
  // Get latest updates
  const { data, error } = await supabase
    .from('document_updates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error('❌ Error fetching updates:', error)
    return
  }
  
  if (data.length === 0) {
    console.log('\n⚠️  No updates found in table')
    return
  }
  
  console.log('\n📝 Latest updates:')
  console.log('─'.repeat(80))
  
  data.forEach((update, i) => {
    console.log(`\n${i + 1}. Document: ${update.document_name}`)
    console.log(`   Client ID: ${update.client_id}`)
    console.log(`   Clock: ${update.clock}`)
    console.log(`   Size: ${update.update?.length || 0} bytes`)
    console.log(`   Created: ${new Date(update.created_at).toLocaleString()}`)
  })
  
  console.log('\n' + '─'.repeat(80))
  
  // Group by document
  const { data: summary, error: summaryError } = await supabase
    .from('document_updates')
    .select('document_name')
  
  if (!summaryError && summary) {
    const counts = summary.reduce((acc, row) => {
      acc[row.document_name] = (acc[row.document_name] || 0) + 1
      return acc
    }, {})
    
    console.log('\n📈 Updates per document:')
    Object.entries(counts).forEach(([doc, count]) => {
      console.log(`   ${doc}: ${count} updates`)
    })
  }
  
  console.log('\n✅ Done\n')
}

checkUpdates().catch(console.error)

