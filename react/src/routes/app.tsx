import { getCanvas, renameCanvas } from '@/api/canvas'
import CanvasExcali from '@/components/canvas/CanvasExcali'
import CanvasHeader from '@/components/canvas/CanvasHeader'
import CanvasMenu from '@/components/canvas/menu'
import CanvasPopbarWrapper from '@/components/canvas/pop-bar'
// VideoCanvasOverlay removed - using native Excalidraw embeddable elements instead
import ChatInterface from '@/components/chat/Chat'
import HomeV2Header from '@/components/home_v2/HomeV2Header'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { CanvasProvider } from '@/contexts/canvas'
import { Session } from '@/types/types'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/app')({
  component: Home,
})

function Home() {
  const canvasId = '123'
  const [canvas, setCanvas] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [canvasName, setCanvasName] = useState('')
  const [sessionList, setSessionList] = useState<Session[]>([])
  // initialVideos removed - using native Excalidraw embeddable elements instead
  const [sessionId, setSessionId] = useState('')

  useEffect(() => {
    let mounted = true

    const fetchCanvas = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getCanvas(canvasId)
        if (mounted) {
          setCanvas(data)
          setCanvasName(data.name)
          setSessionList(data.sessions)
          // Video elements now handled by native Excalidraw embeddable elements
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to fetch canvas data')
          )
          console.error('Failed to fetch canvas data:', err)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchCanvas()

    return () => {
      mounted = false
    }
  }, [canvasId])

  const handleNameSave = async () => {
    await renameCanvas(canvasId, canvasName)
  }

  return (
    <CanvasProvider>
      <div className="flex flex-col w-screen h-screen">
        <HomeV2Header />
        <ResizablePanelGroup
          direction="horizontal"
          className="w-screen h-screen"
          autoSaveId="jaaz-chat-panel"
        >
          <ResizablePanel className="relative" defaultSize={80}>
            <div className="w-full h-full">gallery</div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={25} minSize={25}>
            <div className="flex-1 flex-grow bg-accent/50 w-full">
              <ChatInterface
                canvasId={canvasId}
                sessionList={sessionList}
                setSessionList={setSessionList}
                sessionId={sessionId}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </CanvasProvider>
  )
}
