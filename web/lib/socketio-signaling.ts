/**
 * Socket.IO Signaling Adapter for y-webrtc
 * 
 * This module bridges Socket.IO-based signaling with y-webrtc's WebRTC provider.
 * It replaces the default WebSocket signaling mechanism with Socket.IO client.
 */

import { io, Socket } from 'socket.io-client'
import { Observable } from 'lib0/observable'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

export interface SocketIOSignalingOptions {
  url: string
  room: string
  awareness?: awarenessProtocol.Awareness
}

/**
 * Socket.IO-based signaling for WebRTC connections
 * Compatible with y-webrtc's peer discovery mechanism
 */
export class SocketIOSignaling extends Observable<string> {
  public socket: Socket
  public room: string
  public connected: boolean = false
  private awareness?: awarenessProtocol.Awareness
  
  constructor(options: SocketIOSignalingOptions) {
    super()
    
    this.room = options.room
    this.awareness = options.awareness
    
    // Create Socket.IO connection
    this.socket = io(options.url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    })
    
    this.setupEventHandlers()
  }
  
  private setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('🔗 Socket.IO signaling connected')
      this.connected = true
      
      // Join the room
      this.socket.emit('join', this.room)
    })
    
    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO signaling disconnected:', reason)
      this.connected = false
    })
    
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message)
    })
    
    // Handle existing peers list
    this.socket.on('peers', (peers: string[]) => {
      console.log('👥 Existing peers in room:', peers.length)
      peers.forEach(peerId => {
        this.emit('peer', [{ type: 'announce', from: peerId }])
      })
    })
    
    // Handle new peer joining
    this.socket.on('peer-joined', (peerId: string) => {
      console.log('➕ New peer joined:', peerId)
      this.emit('peer', [{ type: 'announce', from: peerId }])
    })
    
    // Handle peer leaving
    this.socket.on('peer-left', (peerId: string) => {
      console.log('➖ Peer left:', peerId)
      this.emit('peer', [{ type: 'leave', from: peerId }])
    })
    
    // Handle WebRTC signals
    this.socket.on('signal', ({ from, signal }: { from: string; signal: any }) => {
      this.emit('peer', [{ type: 'signal', from, signal }])
    })
    
    // Handle broadcasts
    this.socket.on('broadcast', ({ from, data }: { from: string; data: any }) => {
      this.emit('peer', [{ type: 'broadcast', from, data }])
    })
  }
  
  /**
   * Send a signal to a specific peer
   */
  public signal(to: string, signal: any) {
    if (!this.connected) {
      console.warn('⚠️ Cannot send signal - not connected')
      return
    }
    
    this.socket.emit('signal', { to, signal })
  }
  
  /**
   * Broadcast to all peers in the room
   */
  public broadcast(data: any) {
    if (!this.connected) {
      console.warn('⚠️ Cannot broadcast - not connected')
      return
    }
    
    this.socket.emit('broadcast', { room: this.room, data })
  }
  
  /**
   * Announce presence to the room
   */
  public announce() {
    if (!this.connected) {
      return
    }
    
    // Emit announce event to notify peers
    this.broadcast({ type: 'announce' })
  }
  
  /**
   * Get room information
   */
  public getRoomInfo(): Promise<any> {
    return new Promise((resolve) => {
      if (!this.connected) {
        resolve({ peerCount: 0, peers: [] })
        return
      }
      
      this.socket.emit('room-info', this.room, (info: any) => {
        resolve(info)
      })
    })
  }
  
  /**
   * Disconnect and clean up
   */
  public destroy() {
    if (this.connected) {
      this.socket.emit('leave', this.room)
      this.socket.disconnect()
    }
    
    this.socket.removeAllListeners()
    this.connected = false
    
    console.log('🧹 Socket.IO signaling destroyed')
  }
}

