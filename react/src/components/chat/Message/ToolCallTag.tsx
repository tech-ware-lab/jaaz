import { Button } from '@/components/ui/button'
import { TOOL_CALL_NAME_MAPPING } from '@/constants'
import { cn } from '@/lib/utils'
import { ToolCall } from '@/types/types'
import { ChevronUpIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Markdown from 'react-markdown'
import MultiChoicePrompt from '../MultiChoicePrompt'
import SingleChoicePrompt from '../SingleChoicePrompt'

type ToolCallTagProps = {
  toolCall: ToolCall
  isExpanded: boolean
  onToggleExpand: () => void
}

const ToolCallTag: React.FC<ToolCallTagProps> = ({
  toolCall,
  isExpanded,
  onToggleExpand,
}) => {
  const { name, arguments: inputs } = toolCall.function
  let parsedArgs: Record<string, unknown> | null = null
  try {
    parsedArgs = JSON.parse(inputs)
  } catch (error) {
    /* empty */
  }

  if (name == 'prompt_user_multi_choice') {
    return <MultiChoicePrompt />
  }
  if (name == 'prompt_user_single_choice') {
    return <SingleChoicePrompt />
  }

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-[rgb(240,253,244)] dark:bg-[rgb(37,61,22)]">
      <Button
        variant={'secondary'}
        onClick={onToggleExpand}
        className={cn(
          'w-full justify-start text-left bg-[rgb(220,252,231)] hover:bg-[rgb(240,253,244)] dark:bg-[rgb(57,94,34)] dark:hover:bg-[rgb(37,61,22)]',
          isExpanded && 'rounded-t-md rounded-b-none'
        )}
      >
        <ChevronUpIcon
          className={cn(
            isExpanded && 'rotate-180',
            'transition-transform duration-300'
          )}
        />
        <span className="truncate max-w-[80%] inline-block">
          <span className="font-semibold text-muted-foreground">
            {TOOL_CALL_NAME_MAPPING[name]}
          </span>
        </span>
      </Button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0.8, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="p-2 break-all">
              <Markdown>{inputs}</Markdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ToolCallTag
