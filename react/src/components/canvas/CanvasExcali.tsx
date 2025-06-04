import { saveCanvas } from '@/api/canvas'
import { useTheme } from '@/hooks/use-theme'
import { Excalidraw } from '@excalidraw/excalidraw'
import { IMAGE_MIME_TYPES } from '@excalidraw/excalidraw/constants'
import {
  ExcalidrawImageElement,
  FileId,
  Theme,
} from '@excalidraw/excalidraw/element/types'
import '@excalidraw/excalidraw/index.css'
import { DataURL, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { ValueOf } from '@excalidraw/excalidraw/utility-types'
import { useMutation } from '@tanstack/react-query'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useRef } from 'react'

type LastImagePosition = {
  x: number
  y: number
  width: number
  height: number
  col: number // col index
}

type CanvasExcaliProps = {
  canvasId: string
  initialData: any
}

const CanvasExcali: React.FC<CanvasExcaliProps> = ({
  canvasId,
  initialData,
}) => {
  const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null)

  const { mutate: saveCanvasMutation } = useMutation({
    mutationFn: (data: any) => saveCanvas(canvasId, data),
  })
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSaveRef = useRef<{
    elements: any
    appState: any
    files: any
  } | null>(null)

  const handleChange = useCallback(
    (elements: any, appState: any, files: any) => {
      if (
        lastSaveRef.current &&
        JSON.stringify(lastSaveRef.current.elements) ===
          JSON.stringify(elements) &&
        JSON.stringify(lastSaveRef.current.appState) ===
          JSON.stringify(appState) &&
        JSON.stringify(lastSaveRef.current.files) === JSON.stringify(files)
      ) {
        return
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        const data = {
          elements,
          appState: {
            ...appState,
            collaborators: undefined,
          },
          files,
        }
        lastSaveRef.current = { elements, appState, files }
        saveCanvasMutation(data)
      }, 1000)
    },
    [saveCanvasMutation]
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

  const addImageToExcalidraw = async (imageData: {
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

    // @ts-ignore
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
  }

  const handleImageGenerated = (e: Event) => {
    const event = e as CustomEvent
    console.log('👇image_generated', event.detail)
    addImageToExcalidraw(event.detail.image_data)
  }

  useEffect(() => {
    window.addEventListener('image_generated', handleImageGenerated)
    return () =>
      window.removeEventListener('image_generated', handleImageGenerated)
  }, [])

  return (
    <Excalidraw
      theme={theme as Theme}
      excalidrawAPI={(api) => (excalidrawAPI.current = api)}
      onChange={handleChange}
      initialData={() => {
        const saved = localStorage.getItem('excalidraw-scene')
        console.log('👇initialData', saved, initialData)
        return initialData
      }}
    />
  )
}
export default CanvasExcali
