#!/usr/bin/env node

/**
 * Setup Verification Script
 * 
 * This script verifies that the server environment is correctly configured
 * and all dependencies are properly installed.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') })

const CHECKS = {
  passed: 0,
  failed: 0,
  warnings: 0
}

function log(type, message) {
  const colors = {
    success: '\x1b[32m✓\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    warning: '\x1b[33m⚠\x1b[0m',
    info: '\x1b[36mℹ\x1b[0m'
  }
  console.log(`${colors[type]} ${message}`)
}

function header(text) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${text}`)
  console.log(`${'='.repeat(60)}\n`)
}

async function checkEnvironmentVariables() {
  header('Environment Variables')
  
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'HOCUSPOCUS_PORT',
    'SIGNALING_PORT'
  ]
  
  let allPresent = true
  
  for (const varName of required) {
    if (process.env[varName]) {
      log('success', `${varName} is set`)
      CHECKS.passed++
    } else {
      log('error', `${varName} is missing`)
      CHECKS.failed++
      allPresent = false
    }
  }
  
  // Check for sensitive data exposure
  if (process.env.SUPABASE_SERVICE_KEY && process.env.SUPABASE_SERVICE_KEY.includes('anon')) {
    log('warning', 'Using anon key instead of service_role key (server needs service_role)')
    CHECKS.warnings++
  }
  
  return allPresent
}

async function checkSupabaseConnection() {
  header('Supabase Connection')
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    log('error', 'Supabase credentials not configured, skipping connection test')
    CHECKS.failed++
    return false
  }
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )
    
    // Test connection
    const { data, error } = await supabase.from('documents').select('count').limit(1)
    
    if (error) {
      if (error.message.includes('does not exist')) {
        log('error', 'Documents table does not exist. Run supabase-schema.sql first.')
        CHECKS.failed++
        return false
      }
      log('error', `Supabase connection failed: ${error.message}`)
      CHECKS.failed++
      return false
    }
    
    log('success', 'Supabase connection successful')
    CHECKS.passed++
    
    // Check tables
    const tables = ['documents', 'document_updates', 'document_snapshots']
    for (const table of tables) {
      const { error: tableError } = await supabase.from(table).select('count').limit(1)
      if (tableError) {
        log('error', `Table '${table}' not found or not accessible`)
        CHECKS.failed++
      } else {
        log('success', `Table '${table}' exists and accessible`)
        CHECKS.passed++
      }
    }
    
    return true
  } catch (error) {
    log('error', `Unexpected error: ${error.message}`)
    CHECKS.failed++
    return false
  }
}

async function checkDependencies() {
  header('Dependencies')
  
  const packageJsonPath = join(__dirname, '..', 'package.json')
  
  if (!existsSync(packageJsonPath)) {
    log('error', 'package.json not found')
    CHECKS.failed++
    return false
  }
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
    
    const critical = [
      '@hocuspocus/server',
      '@hocuspocus/extension-database',
      '@supabase/supabase-js',
      'socket.io',
      'yjs',
      'dotenv'
    ]
    
    let allInstalled = true
    
    for (const dep of critical) {
      if (dependencies[dep]) {
        try {
          await import(dep)
          log('success', `${dep} is installed`)
          CHECKS.passed++
        } catch {
          log('error', `${dep} is listed but not installed. Run 'npm install'`)
          CHECKS.failed++
          allInstalled = false
        }
      } else {
        log('error', `${dep} is missing from package.json`)
        CHECKS.failed++
        allInstalled = false
      }
    }
    
    return allInstalled
  } catch (error) {
    log('error', `Failed to check dependencies: ${error.message}`)
    CHECKS.failed++
    return false
  }
}

function checkPortAvailability() {
  header('Port Configuration')
  
  const hocuspocusPort = parseInt(process.env.HOCUSPOCUS_PORT || '1234')
  const signalingPort = parseInt(process.env.SIGNALING_PORT || '4445')
  
  if (hocuspocusPort === signalingPort) {
    log('error', `Hocuspocus and Signaling servers are using the same port (${hocuspocusPort})`)
    CHECKS.failed++
    return false
  }
  
  log('success', `Hocuspocus port: ${hocuspocusPort}`)
  log('success', `Signaling port: ${signalingPort}`)
  CHECKS.passed += 2
  
  if (hocuspocusPort < 1024 || signalingPort < 1024) {
    log('warning', 'Using privileged ports (< 1024) may require elevated permissions')
    CHECKS.warnings++
  }
  
  return true
}

function checkFileStructure() {
  header('File Structure')
  
  const requiredFiles = [
    'hocuspocus-server.ts',
    'signaling-server.ts',
    'extensions/supabase-db.ts',
    'package.json',
    'tsconfig.json',
    'docker-compose.yml',
    'Dockerfile.hocuspocus',
    'Dockerfile.signaling'
  ]
  
  let allPresent = true
  
  for (const file of requiredFiles) {
    const filePath = join(__dirname, '..', file)
    if (existsSync(filePath)) {
      log('success', `${file} exists`)
      CHECKS.passed++
    } else {
      log('error', `${file} is missing`)
      CHECKS.failed++
      allPresent = false
    }
  }
  
  return allPresent
}

function printSummary() {
  header('Summary')
  
  console.log(`  Passed:   ${CHECKS.passed}`)
  console.log(`  Failed:   ${CHECKS.failed}`)
  console.log(`  Warnings: ${CHECKS.warnings}`)
  console.log()
  
  if (CHECKS.failed === 0) {
    log('success', 'All checks passed! Your server is ready to run.')
    console.log()
    console.log('  Next steps:')
    console.log('  1. Start development: npm run dev')
    console.log('  2. Or use Docker: docker-compose up -d')
    console.log()
    return 0
  } else {
    log('error', 'Some checks failed. Please fix the issues above.')
    console.log()
    console.log('  Common fixes:')
    console.log('  1. Copy env.example to .env and fill in values')
    console.log('  2. Run: npm install')
    console.log('  3. Execute supabase-schema.sql in Supabase dashboard')
    console.log()
    return 1
  }
}

async function main() {
  console.log('\n🔍 Server Setup Verification\n')
  
  await checkFileStructure()
  await checkEnvironmentVariables()
  await checkDependencies()
  checkPortAvailability()
  await checkSupabaseConnection()
  
  const exitCode = printSummary()
  process.exit(exitCode)
}

main().catch(error => {
  console.error('\n❌ Verification failed with error:', error.message)
  process.exit(1)
})

