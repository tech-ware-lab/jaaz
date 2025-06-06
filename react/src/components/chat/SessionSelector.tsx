import { Session } from '@/types/types'
import { PlusIcon } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

type SessionSelectorProps = {
  session: Session | null
  sessionList: Session[]
  onSelectSession: (sessionId: string) => void
  onClickNewChat: () => void
}

const SessionSelector: React.FC<SessionSelectorProps> = ({
  session,
  sessionList,
  onSelectSession,
  onClickNewChat,
}) => {
  return (
    <div className="flex items-center gap-2 w-full">
      <Select
        value={session?.id}
        onValueChange={(value) => {
          onSelectSession(value)
        }}
      >
        <SelectTrigger className="w-full bg-background">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          {sessionList?.map((session) => (
            <SelectItem key={session.id} value={session.id}>
              {session.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant={'outline'} size={'icon'} onClick={onClickNewChat}>
        <PlusIcon />
      </Button>
    </div>
  )
}

export default SessionSelector
