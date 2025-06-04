import { getCanvas } from '@/api/canvas'
import CanvasExcali from '@/components/canvas/CanvasExcali'
import ChatInterface from '@/components/chat/Chat'
import LeftSidebar from '@/components/sidebar/LeftSidebar'
import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { Loader2, MessageCircleIcon } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/canvas/$id')({
  component: Canvas,
})

function Canvas() {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [curFile, setCurFile] = useState('')

  const { id } = useParams({ from: '/canvas/$id' })

  const { data: canvas, isLoading } = useQuery({
    queryKey: ['canvas', id],
    queryFn: () => getCanvas(id),
  })

  useEffect(() => {
    if (canvas) {
      setSessionId(canvas.sessions[0].id)
    }
  }, [canvas])

  return (
    <div className="flex w-screen h-screen">
      <ResizablePanelGroup direction="horizontal" className="w-screen h-screen">
        <ResizablePanel defaultSize={80}>
          <div className="w-full h-full">
            {isLoading ? (
              <div className="flex-1 flex-grow px-4 bg-accent w-[24%] absolute right-0">
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            ) : (
              <CanvasExcali canvasId={id} initialData={canvas?.data} />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={20} maxSize={35} minSize={15}>
          <div className="flex-1 flex-grow px-4 bg-accent w-full">
            <ChatInterface
              sessionId={sessionId}
              onClickNewChat={() => {
                setSessionId(nanoid())
              }}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      {isLeftSidebarOpen && (
        <div className="fixed left-0 top-0 w-[20%] bg-sidebar h-screen">
          <LeftSidebar
            sessionId={sessionId}
            setSessionId={setSessionId}
            curFile={curFile}
            setCurFile={setCurFile}
            onClose={() => setIsLeftSidebarOpen(false)}
          />
        </div>
      )}
      {!isLeftSidebarOpen && (
        <div className="fixed left-[60px] top-[16px]">
          <Button
            onClick={() => setIsLeftSidebarOpen(true)}
            variant={'secondary'}
          >
            <MessageCircleIcon />
          </Button>
        </div>
      )}
    </div>
  )
}
