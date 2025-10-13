#!/usr/bin/env node

/**
 * Test Socket.IO Signaling Connection
 * 
 * This script tests the Socket.IO signaling server connection
 * to verify it's working correctly before testing with the web app.
 */

import { io } from 'socket.io-client'

const SIGNALING_URL = process.env.SIGNALING_URL || 'http://localhost:4445'
const TEST_ROOM = 'test-document-123'

console.log(`\n🧪 Testing Socket.IO Signaling Connection`)
console.log(`   URL: ${SIGNALING_URL}`)
console.log(`   Room: ${TEST_ROOM}\n`)

// Create Socket.IO client
const socket = io(SIGNALING_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000
})

let testsPassed = 0
let testsFailed = 0

// Test 1: Connection
socket.on('connect', () => {
  console.log('✅ Test 1: Connected successfully')
  console.log(`   Socket ID: ${socket.id}`)
  testsPassed++
  
  // Test 2: Join room
  console.log('\n📝 Test 2: Joining room...')
  socket.emit('join', TEST_ROOM)
})

socket.on('connect_error', (error) => {
  console.error('❌ Test 1: Connection failed')
  console.error(`   Error: ${error.message}`)
  testsFailed++
  process.exit(1)
})

// Test 3: Receive peers list
socket.on('peers', (peers) => {
  console.log('✅ Test 3: Received peers list')
  console.log(`   Peers: ${JSON.stringify(peers)}`)
  testsPassed++
  
  // Test 4: Get room info
  console.log('\n📝 Test 4: Getting room info...')
  socket.emit('room-info', TEST_ROOM, (info) => {
    console.log('✅ Test 4: Received room info')
    console.log(`   Room: ${info.room}`)
    console.log(`   Peer Count: ${info.peerCount}`)
    console.log(`   Peers: ${JSON.stringify(info.peers)}`)
    testsPassed++
    
    // Test 5: Leave room
    console.log('\n📝 Test 5: Leaving room...')
    socket.emit('leave', TEST_ROOM)
    
    setTimeout(() => {
      // Test 6: Disconnect
      console.log('\n📝 Test 6: Disconnecting...')
      socket.disconnect()
      
      console.log('\n' + '='.repeat(50))
      console.log(`\n🎉 All tests completed!`)
      console.log(`   Passed: ${testsPassed}`)
      console.log(`   Failed: ${testsFailed}`)
      console.log('\n✅ Socket.IO signaling server is working correctly!\n')
      
      process.exit(0)
    }, 500)
  })
})

socket.on('peer-joined', (peerId) => {
  console.log(`👥 Peer joined: ${peerId}`)
})

socket.on('peer-left', (peerId) => {
  console.log(`👋 Peer left: ${peerId}`)
})

socket.on('disconnect', (reason) => {
  console.log(`\n✅ Test 6: Disconnected`)
  console.log(`   Reason: ${reason}`)
  testsPassed++
})

// Timeout after 10 seconds
setTimeout(() => {
  console.error('\n❌ Tests timed out after 10 seconds')
  console.error(`   Passed: ${testsPassed}`)
  console.error(`   Failed: ${testsFailed + 1}`)
  process.exit(1)
}, 10000)

