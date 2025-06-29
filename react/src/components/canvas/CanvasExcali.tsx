import { saveCanvas } from '@/api/canvas'
import { useCanvas } from '@/contexts/canvas'
import useDebounce from '@/hooks/use-debounce'
import { useTheme } from '@/hooks/use-theme'
import { eventBus } from '@/lib/event'
import * as ISocket from '@/types/socket'
import { CanvasData } from '@/types/types'
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw'
import {
  ExcalidrawImageElement,
  ExcalidrawEmbeddableElement,
  OrderedExcalidrawElement,
  Theme,
  NonDeleted,
} from '@excalidraw/excalidraw/element/types'
import '@excalidraw/excalidraw/index.css'
import {
  AppState,
  BinaryFileData,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import VideoPlayer from './VideoPlayer'

import '@/assets/style/canvas.css'

type LastImagePosition = {
  x: number
  y: number
  width: number
  height: number
  col: number // col index
}

type CanvasExcaliProps = {
  canvasId: string
  initialData?: ExcalidrawInitialDataState
}

const CanvasExcali: React.FC<CanvasExcaliProps> = ({
  canvasId,
  initialData,
}) => {
  const { excalidrawAPI, setExcalidrawAPI } = useCanvas()

  const { i18n } = useTranslation()

  const handleChange = useDebounce(
    (
      elements: Readonly<OrderedExcalidrawElement[]>,
      appState: AppState,
      files: BinaryFiles
    ) => {
      if (elements.length === 0 || !appState) {
        return
      }

      const data: CanvasData = {
        elements,
        appState: {
          ...appState,
          collaborators: undefined!,
        },
        files,
      }

      let thumbnail = ''
      const latestImage = elements
        .filter((element) => element.type === 'image')
        .sort((a, b) => b.updated - a.updated)[0]
      if (latestImage) {
        const file = files[latestImage.fileId!]
        if (file) {
          thumbnail = file.dataURL
        }
      }

      saveCanvas(canvasId, { data, thumbnail })
    },
    1000
  )

  const lastImagePosition = useRef<LastImagePosition | null>(
    localStorage.getItem('excalidraw-last-image-position')
      ? JSON.parse(localStorage.getItem('excalidraw-last-image-position')!)
      : null
  )
  const { theme } = useTheme()

  const addImageToExcalidraw = useCallback(
    async (imageElement: ExcalidrawImageElement, file: BinaryFileData) => {
      if (!excalidrawAPI) return

      // Check if element already exists to prevent duplicates
      const currentElements = excalidrawAPI.getSceneElements()
      const existingElement = currentElements.find(el => el.id === imageElement.id)

      if (existingElement) {
        console.log('👇 Image element already exists, skipping duplicate:', imageElement.id)
        return
      }

      excalidrawAPI.addFiles([file])

      console.log('👇 Adding new image element to canvas:', imageElement.id)
      console.log('👇 Image element properties:', {
        id: imageElement.id,
        type: imageElement.type,
        locked: imageElement.locked,
        groupIds: imageElement.groupIds,
        isDeleted: imageElement.isDeleted,
        x: imageElement.x,
        y: imageElement.y,
        width: imageElement.width,
        height: imageElement.height
      })

      // Ensure image is not locked and can be manipulated
      const unlockedImageElement = {
        ...imageElement,
        locked: false,
        groupIds: [],
        isDeleted: false
      }

      excalidrawAPI.updateScene({
        elements: [...(currentElements || []), unlockedImageElement],
      })

      localStorage.setItem(
        'excalidraw-last-image-position',
        JSON.stringify(lastImagePosition.current)
      )
    },
    [excalidrawAPI]
  )

  const createVideoEmbedElement = useCallback(
    (videoSrc: string, x: number = 100, y: number = 100, width: number = 320, height: number = 180) => {
      if (!excalidrawAPI) return

      const videoElements = convertToExcalidrawElements([
        {
          type: "embeddable",
          x,
          y,
          width,
          height,
          link: videoSrc,
          validated: true,
        }
      ])

      const currentElements = excalidrawAPI.getSceneElements()
      excalidrawAPI.updateScene({
        elements: [...currentElements, ...videoElements],
      })

      console.log('👇 Added video embed element:', videoSrc)
    },
    [excalidrawAPI]
  )

  const renderEmbeddable = useCallback(
    (element: NonDeleted<ExcalidrawEmbeddableElement>, appState: AppState) => {
      const { link } = element
      
      // Check if this is a video URL
      if (link && (link.includes('.mp4') || link.includes('.webm') || link.includes('.ogg') || link.startsWith('blob:') || link.includes('video'))) {
        // Return the VideoPlayer component
        return (
          <VideoPlayer 
            src={link}
            width="100%"
            height="100%"
          />
        )
      }
      
      // Return null for non-video embeds to use default rendering
      return null
    },
    []
  )

  const handleImageGenerated = useCallback(
    (imageData: ISocket.SessionImageGeneratedEvent) => {
      console.log('👇 CanvasExcali received image_generated:', imageData)

      // Only handle if it's for this canvas
      if (imageData.canvas_id !== canvasId) {
        console.log('👇 Image not for this canvas, ignoring')
        return
      }

      // Check if this is actually a video generation event that got mislabeled
      if (imageData.file?.mimeType?.startsWith('video/')) {
        console.log('👇 This appears to be a video, not an image. Ignoring in image handler.')
        return
      }

      addImageToExcalidraw(imageData.element, imageData.file)
    },
    [addImageToExcalidraw, canvasId]
  )

  const handleVideoGenerated = useCallback(
    (videoData: ISocket.SessionVideoGeneratedEvent) => {
      console.log('👇 CanvasExcali received video_generated:', videoData)

      // Only handle if it's for this canvas
      if (videoData.canvas_id !== canvasId) {
        console.log('👇 Video not for this canvas, ignoring')
        return
      }

      // Create video embed element using the video URL
      if (videoData.video_url) {
        createVideoEmbedElement(
          videoData.video_url,
          100, // default x position
          100, // default y position
          320, // default width
          180  // default height
        )
      }
    },
    [createVideoEmbedElement, canvasId]
  )

  useEffect(() => {
    eventBus.on('Socket::Session::ImageGenerated', handleImageGenerated)
    eventBus.on('Socket::Session::VideoGenerated', handleVideoGenerated)
    return () => {
      eventBus.off('Socket::Session::ImageGenerated', handleImageGenerated)
      eventBus.off('Socket::Session::VideoGenerated', handleVideoGenerated)
    }
  }, [handleImageGenerated, handleVideoGenerated])

  return (
    <Excalidraw
      theme={theme as Theme}
      langCode={i18n.language}
      excalidrawAPI={(api) => {
        setExcalidrawAPI(api)
      }}
      onChange={handleChange}
      initialData={() => {
        const data = initialData
        console.log('👇initialData', data)
        if (data?.appState) {
          data.appState = {
            ...data.appState,
            collaborators: undefined!,
          }
        }
        return data || null
      }}
      renderEmbeddable={renderEmbeddable}
      // Allow all URLs for embeddable content
      validateEmbeddable={(url: string) => {
        console.log('👇 Validating embeddable URL:', url)
        // Allow all URLs - return true for everything
        return true
      }}
      // Ensure interactive mode is enabled
      viewModeEnabled={false}
      zenModeEnabled={false}
      // Allow element manipulation  
      onPointerUpdate={(payload) => {
        // Minimal logging - only log significant pointer events
        if (payload.button === 'down' && Math.random() < 0.05) {
          console.log('👇 Pointer down on:', payload.pointer.x, payload.pointer.y)
        }
      }}
    />
  )
}

export { CanvasExcali }
export default CanvasExcali