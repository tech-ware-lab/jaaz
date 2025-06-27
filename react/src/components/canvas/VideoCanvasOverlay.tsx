import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { CanvasVideoElement } from './VideoElement'
import { useCanvas } from '@/contexts/canvas'
import { cn } from '@/lib/utils'
import { eventBus } from '@/lib/event'
import * as ISocket from '@/types/socket'

interface VideoElement {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  duration?: number
  canvasId: string
}

interface VideoCanvasOverlayProps {
  canvasId: string
  className?: string
}

export interface VideoCanvasOverlayRef {
  addVideo: (videoData: ISocket.SessionVideoGeneratedEvent) => void
}

export const VideoCanvasOverlay = forwardRef<VideoCanvasOverlayRef, VideoCanvasOverlayProps>(({
  canvasId,
  className
}, ref) => {
  const [videoElements, setVideoElements] = useState<VideoElement[]>([])
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const { excalidrawAPI } = useCanvas()

  // Get canvas transform for positioning videos correctly
  const getCanvasTransform = useCallback(() => {
    if (!excalidrawAPI) return { zoom: 1, scrollX: 0, scrollY: 0 }
    
    const appState = excalidrawAPI.getAppState()
    return {
      zoom: appState.zoom?.value || 1,
      scrollX: appState.scrollX || 0,
      scrollY: appState.scrollY || 0
    }
  }, [excalidrawAPI])

  // Add a new video element
  const addVideoElement = useCallback((videoData: ISocket.SessionVideoGeneratedEvent) => {
    console.log('👇 Adding video to canvas:', videoData)
    
    const newVideo: VideoElement = {
      id: videoData.element.id || `video_${Date.now()}`,
      src: videoData.video_url || videoData.file.dataURL,
      x: videoData.element.x || 100,
      y: videoData.element.y || 100,
      width: videoData.element.width || 320,
      height: videoData.element.height || 180,
      duration: videoData.file.duration,
      canvasId
    }

    setVideoElements(prev => [...prev, newVideo])
  }, [canvasId])

  // Handle video generated event
  const handleVideoGenerated = useCallback(
    (videoData: ISocket.SessionVideoGeneratedEvent) => {
      console.log('👇 video_generated', videoData)
      if (videoData.canvas_id !== canvasId) {
        return
      }
      addVideoElement(videoData)
    },
    [addVideoElement, canvasId]
  )

  // Expose addVideo method via ref
  useImperativeHandle(ref, () => ({
    addVideo: addVideoElement
  }), [addVideoElement])

  // Listen for video generated events
  useEffect(() => {
    eventBus.on('Socket::Session::VideoGenerated', handleVideoGenerated)
    return () =>
      eventBus.off('Socket::Session::VideoGenerated', handleVideoGenerated)
  }, [handleVideoGenerated])

  // Remove video element
  const removeVideoElement = useCallback((videoId: string) => {
    setVideoElements(prev => prev.filter(video => video.id !== videoId))
    if (selectedVideoId === videoId) {
      setSelectedVideoId(null)
    }
  }, [selectedVideoId])

  // Handle video selection
  const handleVideoSelect = useCallback((videoId: string) => {
    setSelectedVideoId(videoId)
  }, [])

  // Handle video deselection when clicking outside
  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    // Only deselect if clicking on the overlay itself, not on a video
    if (event.target === event.currentTarget) {
      setSelectedVideoId(null)
    }
  }, [])

  // Transform video positions based on canvas zoom and scroll
  const transformedVideos = videoElements.map(video => {
    const { zoom, scrollX, scrollY } = getCanvasTransform()
    return {
      ...video,
      transformedX: (video.x + scrollX) * zoom,
      transformedY: (video.y + scrollY) * zoom,
      transformedWidth: video.width * zoom,
      transformedHeight: video.height * zoom
    }
  })

  return (
    <div 
      className={cn(
        'absolute inset-0 pointer-events-none',
        className
      )}
      onClick={handleCanvasClick}
    >
      {transformedVideos.map(video => (
        <div
          key={video.id}
          className="absolute pointer-events-auto"
          style={{
            left: video.transformedX,
            top: video.transformedY,
            width: video.transformedWidth,
            height: video.transformedHeight,
            zIndex: selectedVideoId === video.id ? 1000 : 999
          }}
        >
          <CanvasVideoElement
            elementId={video.id}
            src={video.src}
            x={0}
            y={0}
            width={video.transformedWidth}
            height={video.transformedHeight}
            duration={video.duration}
            isSelected={selectedVideoId === video.id}
            onSelect={() => handleVideoSelect(video.id)}
          />
          
          {/* Delete button when selected */}
          {selectedVideoId === video.id && (
            <button
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                removeVideoElement(video.id)
              }}
              title="Delete video"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
})

VideoCanvasOverlay.displayName = 'VideoCanvasOverlay'

export default VideoCanvasOverlay

// Export types for use in parent components
export type { VideoElement, VideoCanvasOverlayRef }