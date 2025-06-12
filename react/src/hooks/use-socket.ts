import { socketManager } from '@/lib/socket'
import { useEffect, useState } from 'react'

/**
 * Socket.IO Hook
 */
export function useSocket() {
  const [connected, setConnected] = useState(socketManager.isConnected())
  const [socketId, setSocketId] = useState(socketManager.getSocketId())

  useEffect(() => {
    const checkConnection = () => {
      const isConnected = socketManager.isConnected()
      const currentSocketId = socketManager.getSocketId()

      setConnected(isConnected)
      setSocketId(currentSocketId)
    }

    checkConnection()

    const socket = socketManager.getSocket()
    if (socket) {
      const handleConnect = () => {
        setConnected(true)
        setSocketId(socketManager.getSocketId())
      }

      const handleDisconnect = () => {
        setConnected(false)
        setSocketId(undefined)
      }

      socket.on('connect', handleConnect)
      socket.on('disconnect', handleDisconnect)

      return () => {
        socket.off('connect', handleConnect)
        socket.off('disconnect', handleDisconnect)
      }
    }
  }, [])

  const connect = async (serverUrl?: string) => {
    try {
      await socketManager.connect(serverUrl)
      setConnected(true)
      setSocketId(socketManager.getSocketId())
    } catch (error) {
      console.error('Failed to connect:', error)
      setConnected(false)
      setSocketId(undefined)
    }
  }

  const disconnect = () => {
    socketManager.disconnect()
    setConnected(false)
    setSocketId(undefined)
  }

  const getCanvasData = (canvasId: string) => {
    return socketManager.getCanvasData(canvasId)
  }

  const getSessionData = (sessionId: string) => {
    return socketManager.getSessionData(sessionId)
  }

  const ping = (data?: any) => {
    socketManager.ping(data)
  }

  return {
    connected,
    socketId,
    connect,
    disconnect,
    getCanvasData,
    getSessionData,
    ping,
  }
}

/**
 * Global Socket.IO event listening hook
 *
 * This hook will automatically receive all session and canvas updates,
 * components can filter by sessionId or canvasId
 */
export function useSocketEvents() {
  const [connected, setConnected] = useState(socketManager.isConnected())

  useEffect(() => {
    setConnected(socketManager.isConnected())

    const socket = socketManager.getSocket()
    if (socket) {
      const handleConnect = () => setConnected(true)
      const handleDisconnect = () => setConnected(false)

      socket.on('connect', handleConnect)
      socket.on('disconnect', handleDisconnect)

      return () => {
        socket.off('connect', handleConnect)
        socket.off('disconnect', handleDisconnect)
      }
    }
  }, [])

  return {
    connected,
    socketManager,
  }
}
