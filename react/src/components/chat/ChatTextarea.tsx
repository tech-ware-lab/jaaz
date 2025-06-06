import { uploadImage } from '@/api/upload'
import { Button } from '@/components/ui/button'
import { useConfigs } from '@/contexts/configs'
import { cn } from '@/lib/utils'
import { Message, Model } from '@/types/types'
import { useMutation } from '@tanstack/react-query'
import { useDrop } from 'ahooks'
import { ArrowUp, Loader2, PlusIcon, XIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Textarea, { TextAreaRef } from 'rc-textarea'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ModelSelector from './ModelSelector'

type ChatTextareaProps = {
  value: string
  pending: boolean
  className?: string
  messages: Message[]
  onChange: (value: string) => void
  onSendMessages: (
    data: Message[],
    configs: {
      textModel: Model
      imageModel: Model
    }
  ) => void
}

const ChatTextarea: React.FC<ChatTextareaProps> = ({
  value,
  pending,
  className,
  messages,
  onChange,
  onSendMessages,
}) => {
  const { t } = useTranslation()
  const { configsStore } = useConfigs()
  const { textModel, imageModel, imageModels, setShowInstallDialog } =
    configsStore.getState()

  const textareaRef = useRef<TextAreaRef>(null)
  const [imageIds, setImageIds] = useState<string[]>([])
  const [isFocused, setIsFocused] = useState(false)

  const imageInputRef = useRef<HTMLInputElement>(null)

  const { mutate: uploadImageMutation } = useMutation({
    mutationFn: (file: File) => uploadImage(file, ''),
    onSuccess: (data) => {
      setImageIds((prev) => [...prev, data.file_id])
    },
  })

  const handleImagesUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files) {
        for (const file of files) {
          uploadImageMutation(file)
        }
      }
    },
    [uploadImageMutation]
  )

  const handleSendPrompt = useCallback(() => {
    if (pending) return
    if (!textModel) {
      toast.error(t('chat:textarea.selectModel'))
      return
    }
    // Check if there are image models, if not, prompt to install ComfyUI
    if (!imageModel || imageModels.length === 0) {
      setShowInstallDialog(true)
      return
    }
    if (value.length === 0 || value.trim() === '') {
      toast.error(t('chat:textarea.enterPrompt'))
      return
    }

    if (imageIds.length > 0) {
      imageIds.forEach((imageId) => {
        value += `\n\n ![Attached image filename: ${imageId}](/api/file/${imageId})`
      })
    }

    const newMessage = messages.concat([
      {
        role: 'user',
        content: value,
      },
    ])
    setImageIds([])

    onSendMessages(newMessage, {
      textModel: textModel,
      imageModel: imageModel,
    })
  }, [pending, textModel, imageModel, imageModels, value, onSendMessages])

  // Drop Area
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFilesDrop = useCallback(
    (files: File[]) => {
      for (const file of files) {
        uploadImageMutation(file)
      }
    },
    [uploadImageMutation]
  )

  useDrop(dropAreaRef, {
    onDragOver() {
      setIsDragOver(true)
    },
    onDragLeave() {
      setIsDragOver(false)
    },
    onDrop() {
      setIsDragOver(false)
    },
    onFiles: handleFilesDrop,
  })

  return (
    <motion.div
      ref={dropAreaRef}
      className={cn(
        'w-full flex flex-col items-center border border-primary/20 rounded-2xl p-3 hover:border-primary/40 transition-all duration-300 cursor-text gap-5 bg-background/80 backdrop-blur-xl relative',
        isFocused && 'border-primary/40',
        className
      )}
      style={{
        boxShadow: isFocused
          ? '0 0 0 4px color-mix(in oklab, var(--primary) 10%, transparent)'
          : 'none',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'linear' }}
      onClick={() => textareaRef.current?.focus()}
    >
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            className="absolute top-0 left-0 right-0 bottom-0 bg-background/50 backdrop-blur-xl rounded-2xl z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">
                Drop images here to upload
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {imageIds.length > 0 && (
          <motion.div
            className="flex items-center gap-2 w-full"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {imageIds.map((imageId) => (
              <motion.div
                key={imageId}
                className="relative size-10"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <img
                  key={imageId}
                  src={`/api/file/${imageId}`}
                  alt="Uploaded image"
                  className="w-full h-full object-cover rounded-md"
                  draggable={false}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute -top-1 -right-1 size-4"
                  onClick={() =>
                    setImageIds((prev) => prev.filter((id) => id !== imageId))
                  }
                >
                  <XIcon className="size-3" />
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Textarea
        ref={textareaRef}
        className="w-full h-full border-none outline-none resize-none"
        placeholder={t('chat:textarea.placeholder')}
        value={value}
        autoSize
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendPrompt()
          }
        }}
      />

      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 max-w-[calc(100%-50px)]">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagesUpload}
            hidden
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => imageInputRef.current?.click()}
          >
            <PlusIcon className="size-4" />
          </Button>

          <ModelSelector />
        </div>

        <Button
          className="shrink-0"
          variant="default"
          size="icon"
          onClick={handleSendPrompt}
          disabled={!textModel || !imageModel || value.length === 0 || pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </Button>
      </div>
    </motion.div>
  )
}

export default ChatTextarea
