import { Message, MessageContent } from '@/types/types'
import { PhotoView } from 'react-photo-view'
import { Markdown } from '../Markdown'

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
    <div>
      <PhotoView src={content.image_url.url}>
        <img
          className="hover:scale-105 transition-transform duration-300"
          src={content.image_url.url}
          alt="Image"
        />
      </PhotoView>
    </div>
  )
}

export default MessageRegular
