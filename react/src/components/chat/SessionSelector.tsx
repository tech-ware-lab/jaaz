import { Session } from '@/types/types'
import { PlusIcon, ChevronDownIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getCanvas } from '@/api/canvas'
import { useQuery } from '@tanstack/react-query'

type SessionSelectorProps = {
  session: { id: string; title: string } | null
  canvasId: string
  onSelectSession: (session: { id: string; title: string }) => void
  onClickNewChat: () => void
}

const SessionSelector: React.FC<SessionSelectorProps> = ({
  session,
  canvasId,
  onSelectSession,
  onClickNewChat,
}) => {
  const { t } = useTranslation()
  const { data: { sessions: sessionList } = {}, refetch: refreshSessionList } =
    useQuery({
      queryKey: ['list_chat_sessions'],
      queryFn: () => getCanvas(canvasId),
      staleTime: 1000, // 1s 内数据被认为是新鲜的
      placeholderData: (previousData) => previousData, // 关键：显示旧数据同时获取新数据
      refetchOnWindowFocus: true, // 窗口获得焦点时重新获取
      refetchOnReconnect: true, // 网络重连时重新获取
      refetchOnMount: true, // 挂载时重新获取
    })

  const handleDropdownOpen = () => {
    refreshSessionList()
  }

  return (
    <div className='flex items-center gap-2 w-full justify-between'>
      <DropdownMenu onOpenChange={(open) => open && handleDropdownOpen()}>
        <DropdownMenuTrigger asChild>
          <div className='flex items-center cursor-pointer border-border border rounded-md px-2 py-1 flex-1 min-w-0'>
            <span className='truncate block text-left w-full'>
              {session?.title || 'New Chat'}
            </span>
            <ChevronDownIcon className='h-4 w-4 shrink-0' />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-full min-w-[200px] max-w-[500px] max-h-[80vh] overflow-y-auto'>
          {sessionList
            ?.filter((session) => session.id && session.id.trim() !== '')
            ?.map((sessionItem) => (
              <DropdownMenuItem
                key={sessionItem.id}
                onClick={() => onSelectSession(sessionItem)}
                className='cursor-pointer'
              >
                <span className='truncate'>{sessionItem.title}</span>
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant={'outline'}
        onClick={onClickNewChat}
        size={'sm'}
        className='shrink-0 gap-1 w-20'
      >
        <PlusIcon />
        <span className='text-sm'>{t('chat:newChat')}</span>
      </Button>
    </div>
  )
}

export default SessionSelector
