import { Session } from '@/types/types'
import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
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
      staleTime: 1000, // 5分钟内数据被认为是新鲜的
      placeholderData: (previousData) => previousData, // 关键：显示旧数据同时获取新数据
      refetchOnWindowFocus: true, // 窗口获得焦点时重新获取
      refetchOnReconnect: true, // 网络重连时重新获取
      refetchOnMount: true, // 挂载时重新获取
    })
  return (
    <div className='flex items-center gap-2 w-full'>
      <Select
        value={session?.id}
        onValueChange={(value) => {
          const _session = sessionList?.find((s) => s.id === value)
          if (_session) {
            onSelectSession(_session)
          }
        }}
      >
        <SelectTrigger
          className='flex-1 min-w-0 bg-background truncate w-full'
          size={'sm'}
        >
          <SelectValue
            placeholder='New Chat'
            className='truncate max-w-full block'
          />
        </SelectTrigger>
        <SelectContent className='max-h-[80vh] overflow-y-auto'>
          {sessionList
            ?.filter((session) => session.id && session.id.trim() !== '') // Fix error of A ‹Select.Item /> must have a value prop that is not an empty string.
            ?.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                {session.title}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Button
        variant={'outline'}
        onClick={onClickNewChat}
        size={'sm'}
        className='shrink-0 gap-1'
      >
        <PlusIcon />
        <span className='text-sm'>{t('chat:newChat')}</span>
      </Button>
    </div>
  )
}

export default SessionSelector
