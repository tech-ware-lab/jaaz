import { Message, MessageContent } from '@/types/types'
import { useState } from 'react'
import { Markdown } from '../Markdown'
import MessageImage from './Image'
import TextFoldTag from './TextFoldTag'

type MessageRegularProps = {
  message: Message
  content: MessageContent | string
}

const MessageRegular: React.FC<MessageRegularProps> = ({
  message,
  content,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const isStrContent = typeof content === 'string'
  const isText = isStrContent || (!isStrContent && content.type == 'text')

  if (!isText) return <MessageImage content={content} />

  const markdownText = isStrContent ? content : content.text
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const images = markdownText.match(imageRegex) || []
  const textContent = markdownText.replace(imageRegex, '').trim()

  return (
    <div
      className={`${
        message.role === 'user'
          ? 'bg-primary text-primary-foreground rounded-xl rounded-br-md px-4 py-3 text-left ml-auto'
          : 'text-gray-800 dark:text-gray-200 text-left items-start'
      } space-y-3 flex flex-col`}
    >
      {images.map((img, index) => (
        <Markdown key={index}>{img}</Markdown>
      ))}
      
      {textContent && (
        message.role === 'assistant' ? (
          <TextFoldTag
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
          >
            <Markdown>{textContent}</Markdown>
          </TextFoldTag>
        ) : (
          <Markdown>{textContent}</Markdown>
        )
      )}
    </div>
  )
}

export default MessageRegular
