import { io, Socket } from 'socket.io-client'
import { eventBus } from './event'

export interface SocketConfig {
  serverUrl?: string
  autoConnect?: boolean
}

export class SocketIOManager {
  private socket: Socket | null = null
  private connected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(private config: SocketConfig = {}) {
    if (config.autoConnect !== false) {
      this.connect()
    }
  }

  connect(serverUrl?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const url = serverUrl || this.config.serverUrl

      if (this.socket) {
        this.socket.disconnect()
      }

      this.socket = io(url, {
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
      })

      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', this.socket?.id)
        this.connected = true
        this.reconnectAttempts = 0
        resolve(true)
      })

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error)
        this.connected = false
        this.reconnectAttempts++

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(
            new Error(
              `Failed to connect after ${this.maxReconnectAttempts} attempts`
            )
          )
        }
      })

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO disconnected:', reason)
        this.connected = false
      })

      this.registerEventHandlers()
    })
  }

  private registerEventHandlers() {
    if (!this.socket) return

    this.socket.on('connected', (data) => {
      console.log('🔗 Socket.IO connection confirmed:', data)
    })

    this.socket.on('init_done', (data) => {
      console.log('🔗 Server initialization done:', data)
    })

    this.socket.on('session_update', (data) => {
      this.handleSessionUpdate(data)
    })

    this.socket.on('canvas_data', (data) => {
      console.log('🔗 Canvas data received:', data)
    })

    this.socket.on('session_data', (data) => {
      console.log('🔗 Session data received:', data)
    })

    this.socket.on('error', (data) => {
      console.error('🔗 Socket.IO error:', data)
      eventBus.emit('Socket::Error', {
        type: 'error',
        error: data.message || 'Unknown error',
      })
    })

    this.socket.on('pong', (data) => {
      console.log('🔗 Pong received:', data)
    })
  }

  private handleSessionUpdate(data: any) {
    const { session_id, type, ...eventData } = data

    if (!session_id) {
      console.warn('⚠️ Session update missing session_id:', data)
      return
    }

    switch (type) {
      case 'delta':
        eventBus.emit('Socket::Delta', { type, session_id, ...eventData })
        break
      case 'tool_call':
        eventBus.emit('Socket::ToolCall', { type, session_id, ...eventData })
        break
      case 'tool_call_arguments':
        eventBus.emit('Socket::ToolCallArguments', {
          type,
          session_id,
          ...eventData,
        })
        break
      case 'tool_call_result':
        eventBus.emit('Socket::ToolCallResult', {
          type,
          session_id,
          ...eventData,
        })
        break
      case 'tool_call_progress':
        eventBus.emit('Socket::ToolCallProgress', {
          type,
          session_id,
          ...eventData,
        })
        break
      case 'image_generated':
        eventBus.emit('Socket::ImageGenerated', {
          type,
          session_id,
          ...eventData,
        })
        break
      case 'all_messages':
        eventBus.emit('Socket::AllMessages', { type, session_id, ...eventData })
        break
      case 'done':
        eventBus.emit('Socket::Done', { type, session_id })
        break
      case 'error':
        eventBus.emit('Socket::Error', { type, error: eventData.error })
        break
      case 'info':
        eventBus.emit('Socket::Info', { type, info: eventData.info })
        break
      default:
        console.log('⚠️ Unknown session update type:', type)
    }
  }

  getCanvasData(canvasId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Socket not connected'))
        return
      }

      const handleResponse = (data: any) => {
        if (data.canvas_id === canvasId) {
          this.socket?.off('canvas_data', handleResponse)
          resolve(data.data)
        }
      }

      this.socket.on('canvas_data', handleResponse)
      this.socket.emit('get_canvas_data', { canvas_id: canvasId })

      setTimeout(() => {
        this.socket?.off('canvas_data', handleResponse)
        reject(new Error('Timeout waiting for canvas data'))
      }, 5000)
    })
  }

  getSessionData(sessionId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Socket not connected'))
        return
      }

      const handleResponse = (data: any) => {
        if (data.session_id === sessionId) {
          this.socket?.off('session_data', handleResponse)
          resolve(data.data)
        }
      }

      this.socket.on('session_data', handleResponse)
      this.socket.emit('get_session_data', { session_id: sessionId })

      setTimeout(() => {
        this.socket?.off('session_data', handleResponse)
        reject(new Error('Timeout waiting for session data'))
      }, 5000)
    })
  }

  ping(data: any = {}) {
    if (this.socket && this.connected) {
      this.socket.emit('ping', data)
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      console.log('🔌 Socket.IO manually disconnected')
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }

  getSocket(): Socket | null {
    return this.socket
  }
}

export const socketManager = new SocketIOManager({
  serverUrl: 'http://localhost:57988',
})

export function useSocketConnection() {
  return {
    isConnected: socketManager.isConnected(),
    socketId: socketManager.getSocketId(),
    connect: socketManager.connect.bind(socketManager),
    disconnect: socketManager.disconnect.bind(socketManager),
  }
}
