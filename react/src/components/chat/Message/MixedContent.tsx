import { Message, MessageContent } from '@/types/types'
import { Markdown } from '../Markdown'
import MessageImage from './Image'

type MixedContentProps = {
  message: Message
  contents: MessageContent[]
}

const MixedContent: React.FC<MixedContentProps> = ({ message, contents }) => {
  // 分离图片和文本内容
  const images = contents.filter((content) => content.type === 'image_url')
  const textContents = contents.filter((content) => content.type === 'text')

  // 过滤掉文本中的图片引用，只保留纯文本
  const combinedText = textContents
    .map((content) => content.text)
    .join('\n')
    .replace(/!\[.*?\]\(.*?\)/g, '') // 移除markdown图片语法
    .replace(/!\[.*?\]\[.*?\]/g, '') // 移除引用式图片语法
    .replace(/^\s*$/gm, '') // 移除空行
    .trim()

  return (
    <div
      className={`${
        message.role === 'user'
          ? 'bg-primary text-primary-foreground rounded-xl rounded-br-md px-4 py-3 text-left ml-auto mb-4'
          : 'text-gray-800 dark:text-gray-200 text-left items-start mb-4'
      }`}
    >
      {/* 纵向布局：图片在上，文本在下 */}
      <div className="flex flex-col gap-3">
        {/* 图片区域 */}
        {images.length > 0 && (
          <div className="w-full">
            {images.length === 1 ? (
              // 单张图片：保持长宽比，最大宽度限制
              <div className="max-w-[300px]">
                <MessageImage content={images[0]} />
              </div>
            ) : (
              // 多张图片：网格布局，保持长宽比
              <div className="flex gap-2 max-w-[300px]">
                {images.map((image, index) => (
                  <div key={index} className="max-w-[300px]">
                    <MessageImage content={image} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 分隔线 */}
        {images.length > 0 && combinedText.trim() && (
          <div className="w-full h-px bg-border opacity-10" />
        )}

        {/* 文本区域 */}
        {combinedText && (
          <div className="w-full">
            <Markdown>{combinedText}</Markdown>
          </div>
        )}
      </div>
    </div>
  )
}

export default MixedContent
