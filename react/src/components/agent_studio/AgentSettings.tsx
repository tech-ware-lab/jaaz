import { BotIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '../ui/dialog'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_SYSTEM_PROMPT } from '@/constants'

export default function AgentSettings() {
  const [systemPrompt, setSystemPrompt] = useState(
    localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT
  )

  const handleSave = () => {
    localStorage.setItem('system_prompt', systemPrompt)
    toast.success('System prompt saved')
  }
  return (
    <Dialog>
      <DialogTrigger>
        <Button size={'sm'} variant="ghost">
          <BotIcon size={30} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <h3 className="text-2xl font-bold">Agent Settings</h3>
        <p className="font-bold">System Prompt</p>
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Enter your system prompt here"
            className="h-[60vh]"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </div>
        <Button className="w-full" onClick={handleSave}>
          Save
        </Button>
      </DialogContent>
    </Dialog>
  )
}
