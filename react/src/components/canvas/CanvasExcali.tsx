import { saveCanvas } from '@/api/canvas'
import { useCanvas } from '@/contexts/canvas'
import useDebounce from '@/hooks/use-debounce'
import { useTheme } from '@/hooks/use-theme'
import { eventBus } from '@/lib/event'
import * as ISocket from '@/types/socket'
import { CanvasData } from '@/types/types'
import { Excalidraw } from '@excalidraw/excalidraw'
import {
  ExcalidrawImageElement,
  OrderedExcalidrawElement,
  Theme,
} from '@excalidraw/excalidraw/element/types'
import '@excalidraw/excalidraw/index.css'
import {
  AppState,
  BinaryFileData,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import '@/assets/style/canvas.css'

type VideoElement = {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  playing: boolean
}

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
  const [videos, setVideos] = useState<VideoElement[]>([])

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

      // 更新视频位置
      setVideos(v => v.map(video => {
        const el = elements.find(e => e.id === video.id)
        return el ? { ...video, x: el.x, y: el.y } : video
      }))

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

      // 处理视频文件
      if (file.mimeType?.startsWith('video/')) {
        setVideos(v => [...v, {
          id: imageElement.id,
          src: file.dataURL,
          x: imageElement.x,
          y: imageElement.y,
          width: imageElement.width,
          height: imageElement.height,
          playing: false
        }])
        return
      }

      // 原有图片处理逻辑
      excalidrawAPI.addFiles([file])

      const currentElements = excalidrawAPI.getSceneElements()
      console.log('👇 adding to currentElements', currentElements)
      excalidrawAPI.updateScene({
        elements: [...(currentElements || []), imageElement],
      })

      localStorage.setItem(
        'excalidraw-last-image-position',
        JSON.stringify(lastImagePosition.current)
      )
    },
    [excalidrawAPI]
  )

  const handleImageGenerated = useCallback(
    (imageData: ISocket.SessionImageGeneratedEvent) => {
      console.log('👇image_generated', imageData)
      if (imageData.canvas_id !== canvasId) {
        return
      }

      addImageToExcalidraw(imageData.element, imageData.file)
    },
    [addImageToExcalidraw]
  )

  useEffect(() => {
    eventBus.on('Socket::Session::ImageGenerated', handleImageGenerated)
    return () =>
      eventBus.off('Socket::Session::ImageGenerated', handleImageGenerated)
  }, [handleImageGenerated])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
      />
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%'
      }}>
        {videos.map(video => (
          <video
            key={video.id}
            src={video.src}
            style={{
              position: 'absolute',
              left: video.x,
              top: video.y,
              width: video.width,
              height: video.height,
              pointerEvents: 'auto'
            }}
            autoPlay={video.playing}
            muted
            onMouseEnter={() => setVideos(v => v.map(v =>
              v.id === video.id ? { ...v, playing: true } : { ...v, playing: false }
            ))}
            onClick={() => setVideos(v => v.map(v =>
              v.id === video.id ? { ...v, playing: !v.playing } : v
            ))}
            onMouseLeave={() => setVideos(v => v.map(v =>
              v.id === video.id ? { ...v, playing: false } : v
            ))}
            onPause={(e) => {
              if (!video.playing) e.currentTarget.currentTime = 0
            }}
          />
        ))}
      </div>
    </div>
  )
}
export default CanvasExcali
