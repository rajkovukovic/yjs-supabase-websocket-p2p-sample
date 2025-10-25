#!/usr/bin/env node

/**
 * Connection Test Script
 * 
 * Tests WebSocket connections to both Hocuspocus and Signaling servers
 */

import WebSocket from 'ws'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env') })

const HOCUSPOCUS_PORT = process.env.HOCUSPOCUS_PORT || 1234
const SIGNALING_PORT = process.env.Y_WEBRTC_SIGNALING_PORT || 4445

function log(type, message) {
  const colors = {
    success: '\x1b[32m✓\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    info: '\x1b[36mℹ\x1b[0m'
  }
  console.log(`${colors[type]} ${message}`)
}

function testWebSocket(url, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('Connection timeout'))
    }, 5000)
    
    ws.on('open', () => {
      clearTimeout(timeout)
      log('success', `${name} connection established`)
      ws.close()
      resolve(true)
    })
    
    ws.on('error', (error) => {
      clearTimeout(timeout)
      log('error', `${name} connection failed: ${error.message}`)
      reject(error)
    })
  })
}

async function testHTTPHealth(url, name) {
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    if (response.ok && data.status === 'ok') {
      log('success', `${name} health check passed`)
      return true
    } else {
      log('error', `${name} health check failed`)
      return false
    }
  } catch (error) {
    log('error', `${name} health check failed: ${error.message}`)
    return false
  }
}

async function main() {
  console.log('\n🧪 Testing Server Connections\n')
  console.log('Make sure both servers are running first!')
  console.log('  npm run dev\n')
  
  let allPassed = true
  
  // Test Hocuspocus WebSocket
  console.log('Testing Hocuspocus Server...')
  try {
    await testWebSocket(`ws://localhost:${HOCUSPOCUS_PORT}`, 'Hocuspocus WebSocket')
  } catch (error) {
    allPassed = false
    console.log(`  Is the server running? Try: npm run dev:hocuspocus`)
  }
  
  console.log()
  
  // Test Signaling WebSocket
  console.log('Testing Signaling Server...')
  try {
    await testWebSocket(`ws://localhost:${SIGNALING_PORT}`, 'Signaling WebSocket')
    await testHTTPHealth(`http://localhost:${SIGNALING_PORT}/health`, 'Signaling HTTP')
  } catch (error) {
    allPassed = false
    console.log(`  Is the server running? Try: npm run dev:signaling`)
  }
  
  console.log()
  
  if (allPassed) {
    log('success', 'All connection tests passed!')
    console.log('\n  Your servers are ready for clients to connect.')
  } else {
    log('error', 'Some tests failed')
    console.log('\n  Troubleshooting:')
    console.log('  1. Ensure servers are running: npm run dev')
    console.log('  2. Check ports are not in use: lsof -i :1234 -i :4445')
    console.log('  3. Verify .env configuration')
  }
  
  console.log()
  process.exit(allPassed ? 0 : 1)
}

main().catch(error => {
  console.error('\n❌ Test failed:', error.message)
  process.exit(1)
})

