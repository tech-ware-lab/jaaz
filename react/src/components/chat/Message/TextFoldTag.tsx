import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronUpIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type TextFoldTagProps = {
  children: ReactNode
  isExpanded: boolean
  onToggleExpand: () => void
  buttonText?: string
}

const TextFoldTag: React.FC<TextFoldTagProps> = ({
  children,
  isExpanded,
  onToggleExpand,
  buttonText,
}) => {
  const { t } = useTranslation()
  return (
    <div className="w-full min-w-0 border rounded-lg overflow-hidden mb-4 bg-[rgb(254,252,232)] dark:bg-[rgb(50,40,16)]">
      <Button
        variant={'secondary'}
        onClick={onToggleExpand}
        className={cn(
          'w-full justify-start text-left bg-[rgb(254,249,195)] hover:bg-[rgb(254,252,232)] dark:bg-[rgb(81,66,27)] dark:hover:bg-[rgb(50,40,16)]',
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
            {buttonText || t('chat:thinking.title')}
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
            <div className="p-3 break-all">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default TextFoldTag