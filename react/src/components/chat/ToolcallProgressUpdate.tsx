import { eventBus } from '@/lib/event'

import { TEvents } from '@/lib/event'
import { useEffect } from 'react'

import { useState } from 'react'
import Spinner from '@/components/ui/Spinner'

export default function ToolcallProgressUpdate({
  sessionId,
}: {
  sessionId: string
}) {
  const [progress, setProgress] = useState('')

  useEffect(() => {
    const handleToolCallProgress = (
      data: TEvents['Socket::ToolCallProgress']
    ) => {
      if (data.session_id === sessionId) {
        setProgress(data.update)
      }
    }

    eventBus.on('Socket::ToolCallProgress', handleToolCallProgress)
    return () => {
      eventBus.off('Socket::ToolCallProgress', handleToolCallProgress)
    }
  }, [])
  if (!progress) return null
  return (
    <div className="flex items-center gap-2 bg-purple-200 dark:bg-purple-500 rounded-full p-2">
      <Spinner size={4} />
      {progress}
    </div>
  )
}
