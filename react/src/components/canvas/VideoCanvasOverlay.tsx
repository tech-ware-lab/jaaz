import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react'
import { CanvasVideoElement } from '@/components/canvas/VideoElement'
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
    initialVideos?: VideoElement[]
}

export interface VideoCanvasOverlayRef {
    addVideo: (videoData: ISocket.SessionVideoGeneratedEvent) => void
}

export const VideoCanvasOverlay = forwardRef<VideoCanvasOverlayRef, VideoCanvasOverlayProps>(({
    canvasId,
    className,
    initialVideos = []
}, ref) => {
    const [videoElements, setVideoElements] = useState<VideoElement[]>(initialVideos)
    const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
    const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; initialX: number; initialY: number } | null>(null)
    const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null)
    const [userInteracting, setUserInteracting] = useState(false)
    const { excalidrawAPI } = useCanvas()
    const [canvasTransform, setCanvasTransform] = useState({ zoom: 1, scrollX: 0, scrollY: 0 })

    // Debug video state changes
    const prevVideoCount = useRef(0)
    useEffect(() => {
        if (videoElements.length !== prevVideoCount.current) {
            console.log(`🎬 Video count changed: ${prevVideoCount.current} -> ${videoElements.length}`)
            if (videoElements.length < prevVideoCount.current) {
                console.warn('⚠️ Videos were removed! Previous:', prevVideoCount.current, 'Current:', videoElements.length)
            }
            prevVideoCount.current = videoElements.length
        }
    }, [videoElements.length])

    // Get canvas transform for positioning videos correctly
    const getCanvasTransform = useCallback(() => {
        if (!excalidrawAPI) {
            return canvasTransform
        }

        const appState = excalidrawAPI.getAppState()
        const transform = {
            zoom: appState.zoom?.value || 1,
            scrollX: appState.scrollX || 0,
            scrollY: appState.scrollY || 0
        }
        return transform
    }, [excalidrawAPI, canvasTransform])

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

        // Save video data separately - don't add to Excalidraw elements
        // Videos are managed by the overlay system, not Excalidraw
        console.log('👇 Video added to overlay system (not Excalidraw canvas)')

        // Trigger a canvas save to include video data in metadata
        if (excalidrawAPI) {
            try {
                // Save current Excalidraw state to trigger canvas save with video metadata
                const currentElements = excalidrawAPI.getSceneElements()
                const appState = excalidrawAPI.getAppState() as any

                // Add video metadata to app state for persistence
                // Ensure we don't overwrite existing videos
                const existingVideos = appState.videoElements || []
                const updatedAppState = {
                    ...appState,
                    videoElements: [...existingVideos.filter((v: VideoElement) => v.id !== newVideo.id), newVideo]
                }

                excalidrawAPI.updateScene({
                    elements: currentElements,
                    appState: updatedAppState
                })
            } catch (error) {
                console.error('Failed to save video metadata:', error)
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

    // Videos are now loaded via props, so the old loader is removed.
    // This useEffect will sync the state if the initialVideos prop changes.
    useEffect(() => {
        setVideoElements(initialVideos)
    }, [initialVideos])

    // Listen for video generated events
    useEffect(() => {
        eventBus.on('Socket::Session::VideoGenerated', handleVideoGenerated)
        return () =>
            eventBus.off('Socket::Session::VideoGenerated', handleVideoGenerated)
    }, [handleVideoGenerated])

    // Listen for canvas transform changes
    useEffect(() => {
        if (!excalidrawAPI) return

        let animationFrameId: number;

        const updateTransform = () => {
            const appState = excalidrawAPI.getAppState()
            setCanvasTransform({
                zoom: appState.zoom.value,
                scrollX: appState.scrollX,
                scrollY: appState.scrollY,
            })
            animationFrameId = requestAnimationFrame(updateTransform)
        }

        animationFrameId = requestAnimationFrame(updateTransform)

        return () => {
            cancelAnimationFrame(animationFrameId)
        }
    }, [excalidrawAPI])

    // Remove video element
    const removeVideoElement = useCallback((videoId: string) => {
        setVideoElements(prev => {
            const updatedVideos = prev.filter(video => video.id !== videoId)

            // Update app state to persist removal
            if (excalidrawAPI) {
                try {
                    const currentElements = excalidrawAPI.getSceneElements()
                    const appState = excalidrawAPI.getAppState() as any

                    const updatedAppState = {
                        ...appState,
                        videoElements: updatedVideos
                    }

                    excalidrawAPI.updateScene({
                        elements: currentElements,
                        appState: updatedAppState
                    })
                } catch (error) {
                    console.error('Failed to update video metadata on removal:', error)
                }
            }

            return updatedVideos
        })

        if (selectedVideoId === videoId) {
            setSelectedVideoId(null)
        }
    }, [selectedVideoId, excalidrawAPI])

    // Handle video selection
    const handleVideoSelect = useCallback((videoId: string, event?: React.MouseEvent) => {
        if (event) {
            event.preventDefault()
            event.stopPropagation()
        }
        console.log('🎯 Video selected:', videoId)
        setSelectedVideoId(videoId)
        setUserInteracting(true)

        // Clear interaction state after a delay
        setTimeout(() => setUserInteracting(false), 1000)
    }, [])

    // Handle drag start
    const handleDragStart = useCallback((videoId: string, event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()

        console.log('🚀 Drag start for video:', videoId)
        setUserInteracting(true)

        const video = videoElements.find(v => v.id === videoId)
        if (!video) return

        setDragging({
            id: videoId,
            startX: event.clientX,
            startY: event.clientY,
            initialX: video.x,
            initialY: video.y,
        })
        setSelectedVideoId(videoId)
    }, [videoElements])

    // Handle drag end
    const handleDragEnd = useCallback(() => {
        if (dragging && excalidrawAPI) {
            const video = videoElements.find(v => v.id === dragging.id)
            if (video) {
                const currentElements = excalidrawAPI.getSceneElements()
                const appState = excalidrawAPI.getAppState() as any
                const updatedAppState = {
                    ...appState,
                    videoElements: videoElements.map(v => v.id === video.id ? video : v)
                }
                excalidrawAPI.updateScene({
                    elements: currentElements,
                    appState: updatedAppState
                })
            }
        }
        setDragging(null)
        setTimeout(() => setUserInteracting(false), 500)
    }, [dragging, videoElements, excalidrawAPI])

    // Handle resize start
    const handleResizeStart = useCallback((videoId: string, event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()

        console.log('📏 Resize start for video:', videoId)
        setUserInteracting(true)

        const video = videoElements.find(v => v.id === videoId)
        if (!video) return

        setResizing({
            id: videoId,
            startX: event.clientX,
            startY: event.clientY,
            startWidth: video.width,
            startHeight: video.height
        })
        setSelectedVideoId(videoId)
    }, [videoElements])

    // Handle resize move
    const handleResizeMove = useCallback((event: MouseEvent) => {
        if (!resizing) return

        const { zoom } = canvasTransform
        const safeZoom = isNaN(zoom) || zoom <= 0 ? 1 : Math.max(0.1, Math.min(5, zoom))

        // Convert screen space resize to canvas space resize
        const deltaX = (event.clientX - resizing.startX) / safeZoom
        const deltaY = (event.clientY - resizing.startY) / safeZoom

        // Calculate new dimensions maintaining minimum size in canvas space
        const minWidth = 100  // Minimum canvas width
        const minHeight = 56  // Minimum canvas height (16:9)
        const newWidth = Math.max(minWidth, resizing.startWidth + deltaX)
        const newHeight = Math.max(minHeight, resizing.startHeight + deltaY)

        setVideoElements(prev => {
            const updatedVideos = prev.map(video =>
                video.id === resizing.id
                    ? { ...video, width: newWidth, height: newHeight }
                    : video
            )

            // Update app state with new dimensions
            if (excalidrawAPI) {
                try {
                    const currentElements = excalidrawAPI.getSceneElements()
                    const appState = excalidrawAPI.getAppState() as any

                    const updatedAppState = {
                        ...appState,
                        videoElements: updatedVideos
                    }

                    excalidrawAPI.updateScene({
                        elements: currentElements,
                        appState: updatedAppState
                    })
                } catch (error) {
                    console.error('Failed to update video dimensions:', error)
                }
            }

            return updatedVideos
        })
    }, [resizing, excalidrawAPI, canvasTransform])

    // Handle resize end
    const handleResizeEnd = useCallback(() => {
        setResizing(null)
        // Clear interaction state after resize ends
        setTimeout(() => setUserInteracting(false), 500)
    }, [])

    // Add drag event listeners
    useEffect(() => {
        if (!dragging) return

        const handleMouseMove = (event: MouseEvent) => {
            const { zoom } = canvasTransform
            const safeZoom = isNaN(zoom) || zoom <= 0 ? 1 : Math.max(0.1, Math.min(5, zoom))
            // Convert screen space movement to canvas space movement
            const deltaX = (event.clientX - dragging.startX) / safeZoom
            const deltaY = (event.clientY - dragging.startY) / safeZoom

            setVideoElements(prev =>
                prev.map(video =>
                    video.id === dragging.id
                        ? { ...video, x: dragging.initialX + deltaX, y: dragging.initialY + deltaY }
                        : video
                )
            )
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleDragEnd)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleDragEnd)
        }
    }, [dragging, canvasTransform, handleDragEnd])

    // Add resize event listeners
    useEffect(() => {
        if (resizing) {
            document.addEventListener('mousemove', handleResizeMove)
            document.addEventListener('mouseup', handleResizeEnd)
            return () => {
                document.removeEventListener('mousemove', handleResizeMove)
                document.removeEventListener('mouseup', handleResizeEnd)
            }
        }
    }, [resizing, handleResizeMove, handleResizeEnd])

    // Monitor excalidrawAPI changes and restore videos if lost
    useEffect(() => {
        if (excalidrawAPI && videoElements.length > 0 && !dragging && !resizing && !selectedVideoId && !userInteracting) {
            const checkAndRestoreVideos = () => {
                try {
                    const appState = excalidrawAPI.getAppState() as any
                    const savedVideos = appState.videoElements || []

                    // If app state has fewer videos than our component state, restore them
                    // But only if we're not currently dragging or interacting with videos
                    if (savedVideos.length < videoElements.length) {
                        console.log('🔄 Restoring videos to app state (user not interacting)')
                        const updatedAppState = {
                            ...appState,
                            videoElements: videoElements
                        }

                        excalidrawAPI.updateScene({
                            elements: excalidrawAPI.getSceneElements(),
                            appState: updatedAppState
                        })
                    }
                } catch (error) {
                    console.error('Failed to restore videos:', error)
                }
            }

            // Much longer delay and only when not interacting with videos
            const timer = setTimeout(checkAndRestoreVideos, 3000)
            return () => clearTimeout(timer)
        }
    }, [excalidrawAPI, videoElements, dragging, resizing, selectedVideoId, userInteracting])

    // Handle video deselection when clicking outside
    const handleCanvasClick = useCallback((event: React.MouseEvent) => {
        // Only deselect if clicking on the overlay itself, not on a video
        if (event.target === event.currentTarget) {
            setSelectedVideoId(null)
        }
    }, [])

    // Transform video positions based on canvas zoom and scroll
    const transformedVideos = videoElements.map(video => {
        const { zoom, scrollX, scrollY } = canvasTransform

        // Use simpler, more reliable positioning
        const safeZoom = isNaN(zoom) || zoom <= 0 ? 1 : Math.max(0.1, Math.min(5, zoom))
        const safeScrollX = isNaN(scrollX) ? 0 : scrollX
        const safeScrollY = isNaN(scrollY) ? 0 : scrollY
        const safeX = isNaN(video.x) ? 100 : video.x
        const safeY = isNaN(video.y) ? 100 : video.y
        const safeWidth = isNaN(video.width) || video.width <= 0 ? 320 : video.width
        const safeHeight = isNaN(video.height) || video.height <= 0 ? 180 : video.height

        // Fixed transform calculation to match Excalidraw's coordinate system
        // Based on pop-bar component: screenPosition = (scroll + canvasPosition) * zoom
        // This matches Excalidraw's actual coordinate transformation
        let transformedX = (safeScrollX + safeX) * safeZoom
        let transformedY = (safeScrollY + safeY) * safeZoom
        let transformedWidth = safeWidth * safeZoom
        let transformedHeight = safeHeight * safeZoom


        // Apply minimum size only when video is very small to maintain visibility
        // But don't override normal scaling behavior
        const minScreenWidth = 50   // Minimum screen pixels
        const minScreenHeight = 28  // Minimum screen pixels (16:9)
        const finalWidth = Math.max(minScreenWidth, transformedWidth)
        const finalHeight = Math.max(minScreenHeight, transformedHeight)

        const transformed = {
            ...video,
            transformedX,
            transformedY,
            transformedWidth: finalWidth,
            transformedHeight: finalHeight
        }

        // Only log transform details occasionally to prevent console spam
        if (Math.random() < 0.1) {
            console.log('👇 Video transform:', {
                original: { x: safeX, y: safeY, w: safeWidth, h: safeHeight },
                canvas: { zoom: safeZoom, scrollX: safeScrollX, scrollY: safeScrollY },
                transformed: { x: transformed.transformedX, y: transformed.transformedY, w: transformed.transformedWidth, h: transformed.transformedHeight }
            })
        }

        return transformed
    })

    // Debug log when rendering - reduced frequency
    if (videoElements.length !== transformedVideos.length || videoElements.length === 0) {
        console.log('🎬 VideoCanvasOverlay RENDER:', {
            canvasId,
            videoElementsCount: videoElements.length,
            transformedVideosCount: transformedVideos.length,
            hasExcalidrawAPI: !!excalidrawAPI
        })
    }

    // Log when videos disappear unexpectedly
    if (videoElements.length === 0 && transformedVideos.length === 0) {
        console.warn('⚠️ No videos found in VideoCanvasOverlay - checking for data loss')
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
                zIndex: 10,
                // Allow clicks to pass through to canvas when not on videos
                pointerEvents: 'none'
            }}
        >

            {transformedVideos.map(video => (
                <div
                    key={video.id}
                    className="absolute cursor-move"
                    style={{
                        left: `${video.transformedX}px`,
                        top: `${video.transformedY}px`,
                        width: `${video.transformedWidth}px`,
                        height: `${video.transformedHeight}px`,
                        zIndex: selectedVideoId === video.id ? 12 : 11,
                        border: selectedVideoId === video.id ? '3px solid #007bff' : '2px solid rgba(0, 255, 0, 0.7)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        background: 'rgba(0, 0, 0, 0.05)',
                        position: 'absolute',
                        overflow: 'hidden',
                        // Enable pointer events only on video containers
                        pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => {
                        console.log('📱 Mouse down on video container:', video.id)
                        handleDragStart(video.id, e)
                    }}
                    onClick={(e) => {
                        console.log('🖱️ Click on video container:', video.id)
                        e.preventDefault()
                        e.stopPropagation()
                        handleVideoSelect(video.id, e)
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
                        onSelect={(e?: React.MouseEvent) => {
                            console.log('🎬 CanvasVideoElement clicked:', video.id)
                            if (e) {
                                e.preventDefault()
                                e.stopPropagation()
                            }
                            handleVideoSelect(video.id)
                        }}
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
                                    handleResizeStart(video.id, e)
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
export type { VideoElement }
