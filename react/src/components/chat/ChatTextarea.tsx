import { listModels } from '@/api/model'
import { uploadImage } from '@/api/upload'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUp, Loader2, PlusIcon, XIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Textarea, { TextAreaRef } from 'rc-textarea'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

type Model = {
  provider: string
  model: string
  url: string
}

type Message = {
  role: 'user' | 'assistant'
  content: string
}

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
  const textareaRef = useRef<TextAreaRef>(null)
  const [imageIds, setImageIds] = useState<string[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const [textModel, setTextModel] = useState<Model>()
  const [imageModel, setImageModel] = useState<Model>()

  const imageInputRef = useRef<HTMLInputElement>(null)

  const { mutate: uploadImageMutation } = useMutation({
    mutationFn: (file: File) => uploadImage(file, ''),
    onSuccess: (data) => {
      setImageIds((prev) => [...prev, data.file_id])
    },
  })

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadImageMutation(file)
    }
  }

  const { data: modelList } = useQuery({
    queryKey: ['modelList'],
    queryFn: listModels,
  })

  useEffect(() => {
    if (modelList && modelList.length > 0) {
      const textModel = localStorage.getItem('text_model')
      if (
        textModel &&
        modelList.find((m) => m.provider + ':' + m.model == textModel)
      ) {
        setTextModel(
          modelList.find((m) => m.provider + ':' + m.model == textModel)
        )
      } else {
        setTextModel(modelList.find((m) => m.type == 'text'))
      }
      const imageModel = localStorage.getItem('image_model')
      if (
        imageModel &&
        modelList.find((m) => m.provider + ':' + m.model == imageModel)
      ) {
        setImageModel(
          modelList.find((m) => m.provider + ':' + m.model == imageModel)
        )
      } else {
        setImageModel(modelList.find((m) => m.type == 'image'))
      }
    }
  }, [modelList])

  const textModels = modelList?.filter((m) => m.type == 'text') ?? []
  const imageModels = modelList?.filter((m) => m.type == 'image') ?? []

  const handleSendPrompt = () => {
    if (pending) return
    if (!textModel) {
      toast.error('Please select a text model')
      return
    }
    if (!imageModel) {
      toast.error('Please select an image model')
      return
    }
    if (value.length === 0 || value.trim() === '') {
      toast.error('Please enter a prompt')
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

    onSendMessages(newMessage, {
      textModel: textModel,
      imageModel: imageModel,
    })
  }

  // TODO: Add Drag and Drop for images

  return (
    <motion.div
      className={cn(
        'w-full flex flex-col items-center border border-primary/20 rounded-2xl p-3 hover:border-primary/40 transition-all duration-300 cursor-text gap-5',
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
      transition={{ duration: 0.2, ease: 'linear' }}
      onClick={() => textareaRef.current?.focus()}
    >
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
        placeholder="Enter your design requirements"
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
        <div className="flex items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            hidden
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => imageInputRef.current?.click()}
          >
            <PlusIcon className="size-4" />
          </Button>

          <Select
            value={textModel?.provider + ':' + textModel?.model}
            onValueChange={(value) => {
              localStorage.setItem('text_model', value)
              setTextModel(
                modelList?.find((m) => m.provider + ':' + m.model == value)
              )
            }}
          >
            <SelectTrigger className="w-fit">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              {textModels.map((model) => (
                <SelectItem
                  key={model.provider + ':' + model.model}
                  value={model.provider + ':' + model.model}
                >
                  {model.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={imageModel?.provider + ':' + imageModel?.model}
            onValueChange={(value) => {
              localStorage.setItem('image_model', value)
              setImageModel(
                modelList?.find((m) => m.provider + ':' + m.model == value)
              )
            }}
          >
            <SelectTrigger className="w-fit">
              <span>🎨</span>
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              {imageModels.map((model) => (
                <SelectItem
                  key={model.provider + ':' + model.model}
                  value={model.provider + ':' + model.model}
                >
                  {model.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
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
