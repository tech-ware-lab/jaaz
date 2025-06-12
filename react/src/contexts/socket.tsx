import { socketManager } from '@/lib/socket'
import React, { createContext, useContext, useEffect, useState } from 'react'

interface SocketContextType {
  connected: boolean
  socketId?: string
  connecting: boolean
  error?: string
}

const SocketContext = createContext<SocketContextType>({
  connected: false,
  connecting: false,
})

export const useSocketContext = () => useContext(SocketContext)

interface SocketProviderProps {
  children: React.ReactNode
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [connected, setConnected] = useState(false)
  const [socketId, setSocketId] = useState<string>()
  const [connecting, setConnecting] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let mounted = true

    const initializeSocket = async () => {
      try {
        setConnecting(true)
        setError(undefined)

        await socketManager.connect()

        if (mounted) {
          setConnected(true)
          setSocketId(socketManager.getSocketId())
          setConnecting(false)
          console.log('🚀 Socket.IO initialized successfully')

          const socket = socketManager.getSocket()
          if (socket) {
            const handleConnect = () => {
              if (mounted) {
                setConnected(true)
                setSocketId(socketManager.getSocketId())
                setConnecting(false)
                setError(undefined)
              }
            }

            const handleDisconnect = () => {
              if (mounted) {
                setConnected(false)
                setSocketId(undefined)
                setConnecting(false)
              }
            }

            const handleConnectError = (error: any) => {
              if (mounted) {
                setError(error.message || 'Connection error')
                setConnected(false)
                setConnecting(false)
              }
            }

            socket.on('connect', handleConnect)
            socket.on('disconnect', handleDisconnect)
            socket.on('connect_error', handleConnectError)

            return () => {
              socket.off('connect', handleConnect)
              socket.off('disconnect', handleDisconnect)
              socket.off('connect_error', handleConnectError)
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setConnected(false)
          setConnecting(false)
          console.error('❌ Failed to initialize Socket.IO:', err)
        }
      }
    }

    initializeSocket()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    console.log('📢 Notification manager initialized')
  }, [])

  const value: SocketContextType = {
    connected,
    socketId,
    connecting,
    error,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}

      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-3 py-2 rounded-md shadow-lg">
          Connection error: {error}
        </div>
      )}
    </SocketContext.Provider>
  )
}
