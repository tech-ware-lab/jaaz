import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react'
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
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)
  const { excalidrawAPI } = useCanvas()

  // Get canvas transform for positioning videos correctly
  const getCanvasTransform = useCallback(() => {
    if (!excalidrawAPI) {
      console.log('👇 No excalidrawAPI, using default transform')
      return { zoom: 1, scrollX: 0, scrollY: 0 }
    }
    
    const appState = excalidrawAPI.getAppState()
    const transform = {
      zoom: appState.zoom?.value || 1,
      scrollX: appState.scrollX || 0,
      scrollY: appState.scrollY || 0
    }
    console.log('👇 Canvas transform:', transform)
    return transform
  }, [excalidrawAPI])

  // Add a new video element
  const addVideoElement = useCallback((videoData: ISocket.SessionVideoGeneratedEvent) => {
    console.log('👇 Adding video to canvas:', videoData)
    
    const newVideo: VideoElement = {
      id: videoData.element.id || `video_${Date.now()}`,
      src: videoData.video_url || videoData.file.dataURL,
      x: videoData.element.x || 200,
      y: videoData.element.y || 200,
      width: videoData.element.width || 480,  // Larger default width
      height: videoData.element.height || 270, // Larger default height (16:9)
      duration: videoData.file.duration,
      canvasId
    }

    setVideoElements(prev => [...prev, newVideo])
    
    // Also add to Excalidraw canvas if we have API access
    if (excalidrawAPI && videoData.element) {
      console.log('👇 Adding video element to Excalidraw canvas')
      try {
        const currentElements = excalidrawAPI.getSceneElements()
        const videoElement = {
          ...videoData.element,
          type: 'video',
          src: newVideo.src,
          fileId: videoData.file?.id,
          videoUrl: videoData.video_url
        }
        
        excalidrawAPI.updateScene({
          elements: [...currentElements, videoElement]
        })
      } catch (error) {
        console.error('Failed to add video to Excalidraw:', error)
      }
    }
  }, [canvasId, excalidrawAPI])

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

  // Load existing videos from canvas data on mount
  useEffect(() => {
    const loadExistingVideos = async () => {
      try {
        const url = `/api/canvas/${canvasId}?t=${Date.now()}`
        console.log('👇 Fetching canvas data from:', url)
        const response = await fetch(url)
        if (response.ok) {
          const canvasData = await response.json()
          console.log('👇 Received canvas data:', canvasData)
          const elements = canvasData.data?.elements || []
          const files = canvasData.data?.files || {}
          
          console.log('👇 Canvas elements:', elements.length)
          console.log('👇 All elements:', elements.map(e => ({type: e.type, id: e.id})))
          
          // Find video elements
          const videoElements = elements.filter((e: { type: string }) => e.type === 'video')
          console.log('👇 Loading existing videos:', videoElements.length)
          console.log('👇 Video elements found:', videoElements)
          
          const videos = videoElements.map((element: any) => {
            const file = files[element.fileId]
            // Try multiple fallback approaches for video URL
            const videoSrc = element.src || 
                           element.videoUrl || 
                           file?.dataURL || 
                           `/api/file/${element.fileId}` ||
                           `/api/file/${element.fileId}.mp4`
            
            console.log('👇 Processing video element:', {
              elementId: element.id,
              fileId: element.fileId,
              hasFile: !!file,
              src: videoSrc,
              element
            })
            
            return {
              id: element.id,
              src: videoSrc,
              x: element.x || 200,
              y: element.y || 200,
              width: element.width || 480,
              height: element.height || 270,
              duration: element.duration || file?.duration,
              canvasId
            }
          })
          
          if (videos.length > 0) {
            console.log('👇 Setting existing videos:', videos)
            setVideoElements(videos)
          } else {
            console.log('👇 No videos found to load')
          }
        }
      } catch (error) {
        console.error('Failed to load existing videos:', error)
      }
    }
    
    loadExistingVideos()
  }, [canvasId])

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

  // Handle drag start
  const handleDragStart = useCallback((videoId: string, event: React.MouseEvent) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    
    setDragging({
      id: videoId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX,
      offsetY
    })
    setSelectedVideoId(videoId)
  }, [])

  // Handle drag move
  const handleDragMove = useCallback((event: MouseEvent) => {
    if (!dragging) return
    
    const deltaX = event.clientX - dragging.startX
    const deltaY = event.clientY - dragging.startY
    
    setVideoElements(prev => prev.map(video => 
      video.id === dragging.id
        ? { ...video, x: video.x + deltaX, y: video.y + deltaY }
        : video
    ))
    
    setDragging(prev => prev ? {
      ...prev,
      startX: event.clientX,
      startY: event.clientY
    } : null)
  }, [dragging])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDragging(null)
  }, [])

  // Add drag event listeners
  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
      return () => {
        document.removeEventListener('mousemove', handleDragMove)
        document.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [dragging, handleDragMove, handleDragEnd])

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
    
    // Use simpler, more reliable positioning
    const safeZoom = isNaN(zoom) || zoom <= 0 ? 1 : Math.max(0.1, Math.min(5, zoom))
    const safeScrollX = isNaN(scrollX) ? 0 : scrollX
    const safeScrollY = isNaN(scrollY) ? 0 : scrollY
    const safeX = isNaN(video.x) ? 100 : video.x
    const safeY = isNaN(video.y) ? 100 : video.y
    const safeWidth = isNaN(video.width) || video.width <= 0 ? 320 : video.width
    const safeHeight = isNaN(video.height) || video.height <= 0 ? 180 : video.height
    
    // Simpler transform calculation with fallback positioning
    let transformedX = safeX * safeZoom + safeScrollX
    let transformedY = safeY * safeZoom + safeScrollY
    let transformedWidth = safeWidth * safeZoom
    let transformedHeight = safeHeight * safeZoom
    
    // Fallback positioning if video would be outside visible area
    if (transformedX < 0 || transformedX > 2000 || transformedY < 0 || transformedY > 2000) {
      console.log('👇 Video outside visible area, using fallback positioning')
      transformedX = 200 + (videoElements.indexOf(video) * 60)
      transformedY = 200 + (videoElements.indexOf(video) * 60)
      transformedWidth = 480  // Larger default size
      transformedHeight = 270 // 16:9 aspect ratio
    }
    
    // Ensure minimum size for visibility - much larger minimum
    const minWidth = Math.max(400, transformedWidth)   // Increased from 200 to 400
    const minHeight = Math.max(225, transformedHeight) // Increased from 112 to 225 (16:9)
    
    const transformed = {
      ...video,
      transformedX: Math.max(50, transformedX),
      transformedY: Math.max(50, transformedY),
      transformedWidth: minWidth,
      transformedHeight: minHeight
    }
    
    console.log('👇 Video transform:', {
      original: { x: safeX, y: safeY, w: safeWidth, h: safeHeight },
      canvas: { zoom: safeZoom, scrollX: safeScrollX, scrollY: safeScrollY },
      transformed: { x: transformed.transformedX, y: transformed.transformedY, w: transformed.transformedWidth, h: transformed.transformedHeight }
    })
    
    return transformed
  })

  // Debug log when rendering
  console.log('🎬 VideoCanvasOverlay RENDER START:', {
    canvasId,
    videoElementsCount: videoElements.length,
    transformedVideosCount: transformedVideos.length
  })
  
  if (videoElements.length > 0) {
    console.log('🎬 VideoCanvasOverlay has videos:', {
      videoElements: videoElements.map(v => ({ id: v.id, src: v.src, x: v.x, y: v.y })),
      transformedVideos: transformedVideos.map(v => ({ 
        id: v.id, 
        transformedX: v.transformedX, 
        transformedY: v.transformedY,
        transformedWidth: v.transformedWidth,
        transformedHeight: v.transformedHeight
      }))
    })
  }

  return (
    <div 
      className={cn(
        'absolute inset-0 pointer-events-none',
        className
      )}
      onClick={handleCanvasClick}
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        zIndex: 1000
      }}
    >
      
      {transformedVideos.map(video => (
        <div
          key={video.id}
          className="absolute pointer-events-auto cursor-move"
          style={{
            left: `${Math.max(0, video.transformedX)}px`,
            top: `${Math.max(0, video.transformedY)}px`,
            width: `${video.transformedWidth}px`,
            height: `${video.transformedHeight}px`,
            zIndex: selectedVideoId === video.id ? 1200 : 1100,
            border: selectedVideoId === video.id ? '3px solid #007bff' : '2px solid rgba(0, 255, 0, 0.7)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            background: 'rgba(0, 0, 0, 0.05)',
            position: 'absolute',
            overflow: 'hidden'
          }}
          onMouseDown={(e) => handleDragStart(video.id, e)}
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
          
          {/* Controls when selected */}
          {selectedVideoId === video.id && (
            <>
              {/* Delete button */}
              <button
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  removeVideoElement(video.id)
                }}
                title="Delete video"
              >
                ×
              </button>
              
              {/* Resize handle */}
              <div
                className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded cursor-se-resize z-10"
                title="Resize video"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  // TODO: Implement resize functionality
                }}
              />
              
              {/* Drag handle */}
              <div
                className="absolute top-1 left-1 w-6 h-6 bg-blue-500 bg-opacity-50 rounded cursor-move z-10 flex items-center justify-center text-white text-xs"
                title="Drag video"
              >
                ⋮⋮
              </div>
            </>
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