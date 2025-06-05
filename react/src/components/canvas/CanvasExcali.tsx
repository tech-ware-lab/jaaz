import { saveCanvas } from '@/api/canvas'
import useDebounce from '@/hooks/use-debounce'
import { useTheme } from '@/hooks/use-theme'
import { CanvasData } from '@/types/types'
import { Excalidraw } from '@excalidraw/excalidraw'
import { IMAGE_MIME_TYPES } from '@excalidraw/excalidraw/constants'
import {
  ExcalidrawImageElement,
  FileId,
  OrderedExcalidrawElement,
  Theme,
} from '@excalidraw/excalidraw/element/types'
import '@excalidraw/excalidraw/index.css'
import {
  AppState,
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types'
import { ValueOf } from '@excalidraw/excalidraw/utility-types'
import { nanoid } from 'nanoid'
import { memo, useCallback, useEffect, useRef } from 'react'

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
  const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSaveRef = useRef<{
    elements: Readonly<OrderedExcalidrawElement[]>
    appState: AppState
    files: BinaryFiles
  } | null>(null)

  const handleChange = useDebounce(
    (
      elements: Readonly<OrderedExcalidrawElement[]>,
      appState: AppState,
      files: BinaryFiles
    ) => {
      const data: CanvasData = {
        elements,
        appState: {
          ...appState,
          collaborators: undefined!,
        },
        files,
      }
      lastSaveRef.current = { elements, appState, files }
      saveCanvas(canvasId, data)
    },
    1000
  )

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const lastImagePosition = useRef<LastImagePosition | null>(
    localStorage.getItem('excalidraw-last-image-position')
      ? JSON.parse(localStorage.getItem('excalidraw-last-image-position')!)
      : null
  )
  const { theme } = useTheme()

  // TODO: Move to Backend
  const addImageToExcalidraw = useCallback(
    async (imageData: {
      url: string
      mime_type: ValueOf<typeof IMAGE_MIME_TYPES>
      width: number
      height: number
    }) => {
      if (!excalidrawAPI) return

      const imageDataUrl = imageData.url

      if (!excalidrawAPI) return

      // Convert base64 data URL to File
      const fileid = nanoid() as FileId

      // Add file to Excalidraw
      excalidrawAPI.current?.addFiles([
        {
          mimeType: imageData.mime_type,
          id: fileid,
          dataURL: imageDataUrl as DataURL,
          created: Date.now(),
        },
      ])

      // Position image next to the previous one, 4 items per row
      let newX = 0
      let newY = 0
      let newCol = 0
      // Check if we need to start a new row
      if (!lastImagePosition.current) {
        // first image in canvas
      } else if (lastImagePosition.current.col >= 3) {
        // 0-based index, so 3 means 4th item
        const { x, y, width, height, col } = lastImagePosition.current
        newX = 0 // Reset X position
        newY = y + height + 20 // Move to the next row
        newCol = 0 // Reset column index
      } else {
        const { x, y, width, height, col } = lastImagePosition.current
        newX = x + width + 20 // adjust spacing to 20px
        newY = y
        newCol = col + 1 // Increment column index
      }

      const imageElement: ExcalidrawImageElement = {
        type: 'image',
        id: fileid,
        x: newX,
        y: newY,
        width: imageData.width,
        height: imageData.height,
        angle: 0,
        fileId: fileid,
        strokeColor: '#000000',
        fillStyle: 'solid',
        strokeStyle: 'solid',
        boundElements: null,
        roundness: null,
        frameId: null,
        backgroundColor: 'transparent',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        index: null,
        updated: 0,
        link: null,
        locked: false,
        status: 'saved',
        scale: [1, 1],
        crop: null,
      }
      const currentElements = excalidrawAPI.current?.getSceneElements()
      console.log('👇 adding to currentElements', currentElements)
      excalidrawAPI.current?.updateScene({
        elements: [...(currentElements || []), imageElement],
      })

      // Update position for the next image
      lastImagePosition.current = {
        x: newX,
        y: newY,
        width: imageData.width,
        height: imageData.height,
        col: newCol,
      }
      console.log('👇lastImagePosition', lastImagePosition.current)
      localStorage.setItem(
        'excalidraw-last-image-position',
        JSON.stringify(lastImagePosition.current)
      )
    },
    [excalidrawAPI]
  )

  const handleImageGenerated = useCallback(
    (e: Event) => {
      const event = e as CustomEvent
      console.log('👇image_generated', event.detail)
      addImageToExcalidraw(event.detail.image_data)
    },
    [addImageToExcalidraw]
  )

  useEffect(() => {
    window.addEventListener('image_generated', handleImageGenerated)
    return () =>
      window.removeEventListener('image_generated', handleImageGenerated)
  }, [handleImageGenerated])

  return (
    <Excalidraw
      theme={theme as Theme}
      excalidrawAPI={(api) => (excalidrawAPI.current = api)}
      onChange={handleChange}
      initialData={() => {
        const data = initialData
        if (data?.appState) {
          data.appState = {
            ...data.appState,
            collaborators: undefined!,
          }
        }
        return data || null
      }}
    />
  )
}
export default memo(CanvasExcali)
