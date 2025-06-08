import { Message, MessageContent } from '@/types/types'
import { Markdown } from '../Markdown'
import MessageImage from './Image'

type MessageRegularProps = {
  message: Message
  content: MessageContent | string
}

const MessageRegular: React.FC<MessageRegularProps> = ({
  message,
  content,
}) => {
  const isStrContent = typeof content === 'string'
  const isText = isStrContent || (!isStrContent && content.type == 'text')

  return isText ? (
    <div
      className={`${
        message.role === 'user'
          ? 'bg-primary text-primary-foreground rounded-xl rounded-br-md px-4 py-3 text-left ml-auto'
          : 'text-gray-800 dark:text-gray-200 text-left items-start'
      } space-y-3 flex flex-col w-fit`}
    >
      <Markdown>{isStrContent ? content : content.text}</Markdown>
    </div>
  ) : (
    <MessageImage content={content} />
  )
}

export default MessageRegular
