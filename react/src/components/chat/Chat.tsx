import { sendMessages } from '@/api/chat'
import Blur from '@/components/common/Blur'
import { ScrollArea } from '@/components/ui/scroll-area'
import Spinner from '@/components/ui/Spinner'
import { Message, Session } from '@/types/types'
import { motion } from 'motion/react'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PhotoProvider } from 'react-photo-view'
import { toast } from 'sonner'
import ShinyText from '../ui/shiny-text'
import ChatTextarea from './ChatTextarea'
import MessageRegular from './Message/Regular'
import ToolCallContent from './Message/ToolCallContent'
import ToolCallTag from './Message/ToolCallTag'
import SessionSelector from './SessionSelector'

import 'react-photo-view/dist/react-photo-view.css'

type ChatInterfaceProps = {
  session: Session | null
  sessionList: Session[]
  onClickNewChat: () => void
  onSessionChange: (sessionId: string) => void
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  session,
  sessionList,
  onClickNewChat,
  onSessionChange,
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [prompt, setPrompt] = useState('')
  const [pending, setPending] = useState(false)

  const sessionId = session?.id

  const webSocketRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string>(session?.id || nanoid())
  const [expandingToolCalls, setExpandingToolCalls] = useState<string[]>([])

  const initChat = useCallback(async () => {
    if (!sessionId) {
      return
    }

    sessionIdRef.current = sessionId

    if (webSocketRef.current) {
      webSocketRef.current.close()
    }

    const resp = await fetch('/api/chat_session/' + sessionId)
    const data = await resp.json()
    setMessages(data?.length ? data : [])

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.host
    const wsUrl = `${wsProtocol}//${wsHost}/ws?session_id=${sessionIdRef.current}`

    const socket = new WebSocket(wsUrl)
    webSocketRef.current = socket

    socket.onopen = () => {
      console.log('Connected to WebSocket server')
    }
    socket.onclose = () => {
      console.log('Disconnected from WebSocket server')
    }
    socket.onerror = (event) => {
      console.error('WebSocket error:', event)
    }
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type == 'log') {
          console.log(data)
        }
        if (data.type == 'error') {
          setPending(false)
          toast.error('Error: ' + data.error, {
            closeButton: true,
            duration: 3600 * 1000, // set super large duration to make it not auto dismiss
            style: {
              color: 'red',
            },
          })
        } else if (data.type == 'done') {
          setPending(false)
        } else if (data.type == 'info') {
          toast.info(data.info, {
            closeButton: true,
            duration: 10 * 1000,
          })
        } else if (data.type == 'image_generated') {
          console.log('⭐️dispatching image_generated', data)
          window.dispatchEvent(
            new CustomEvent('image_generated', {
              detail: {
                image_data: data.image_data,
              },
            })
          )
        } else {
          setMessages((prev) => {
            if (data.type == 'delta') {
              if (prev.at(-1)?.role == 'assistant') {
                const lastMessage = structuredClone(prev.at(-1))
                if (lastMessage) {
                  if (typeof lastMessage.content == 'string') {
                    lastMessage.content += data.text
                  } else if (
                    lastMessage.content &&
                    lastMessage.content.at(-1) &&
                    lastMessage.content.at(-1)!.type === 'text'
                  ) {
                    ;(lastMessage.content.at(-1) as { text: string }).text +=
                      data.text
                  }
                  // TODO: handle other response type
                }
                return [...prev.slice(0, -1), lastMessage]
              } else {
                return [
                  ...prev,
                  {
                    role: 'assistant',
                    content: data.text,
                  },
                ]
              }
            } else if (data.type == 'tool_call') {
              console.log('👇tool_call event get', data)
              setExpandingToolCalls((prev) => [...prev, data.id])
              return prev.concat({
                role: 'assistant',
                tool_calls: [
                  {
                    type: 'function',
                    function: {
                      name: data.name,
                      arguments: '',
                    },
                    id: data.id,
                  },
                ],
              })
            } else if (data.type == 'tool_call_arguments') {
              const lastMessage = structuredClone(prev.at(-1))

              if (
                lastMessage?.role === 'assistant' &&
                lastMessage.tool_calls &&
                lastMessage.tool_calls.at(-1) &&
                lastMessage.tool_calls.at(-1)!.id == data.id
              ) {
                lastMessage.tool_calls.at(-1)!.function.arguments += data.text
                return prev.slice(0, -1).concat(lastMessage)
              }
            } else if (data.type == 'tool_call_result') {
              const res: {
                id: string
                content: {
                  text: string
                }[]
              } = data
            } else if (data.type == 'all_messages') {
              console.log('👇all_messages', data.messages)
              return data.messages
            }
            return prev
          })
        }
      } catch (error) {
        console.error('Error parsing JSON:', error)
      }
    }
  }, [sessionId])

  useEffect(() => {
    initChat()
    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close()
      }
    }
  }, [sessionId, initChat])

  const onSelectSession = (sessionId: string) => {
    onSessionChange(sessionId)
  }

  return (
    <PhotoProvider>
      <div className="flex flex-col h-screen relative">
        {/* Chat messages */}

        <header className="flex px-2 py-2 absolute top-0 z-1 w-full">
          <SessionSelector
            session={session}
            sessionList={sessionList}
            onClickNewChat={onClickNewChat}
            onSelectSession={onSelectSession}
          />
          <Blur className="absolute top-0 left-0 right-0 h-full" />
        </header>

        <ScrollArea className="h-full">
          {messages.length > 0 ? (
            <div className="flex-1 px-4 space-y-6 pb-80 pt-15">
              {/* Messages */}
              {messages.map((message, idx) => (
                <div key={`${idx}`}>
                  {/* Regular message content */}
                  {typeof message.content == 'string' &&
                    (message.role !== 'tool' ? (
                      <MessageRegular
                        message={message}
                        content={message.content}
                      />
                    ) : (
                      <ToolCallContent
                        expandingToolCalls={expandingToolCalls}
                        message={message}
                      />
                    ))}

                  {Array.isArray(message.content) &&
                    message.content.map((content, i) => (
                      <MessageRegular
                        key={i}
                        message={message}
                        content={content}
                      />
                    ))}

                  {message.role === 'assistant' &&
                    message.tool_calls &&
                    message.tool_calls.at(-1)?.function.name != 'finish' &&
                    message.tool_calls.map((toolCall, i) => {
                      return (
                        <ToolCallTag
                          key={toolCall.id}
                          toolCall={toolCall}
                          isExpanded={expandingToolCalls.includes(toolCall.id)}
                          onToggleExpand={() => {
                            if (expandingToolCalls.includes(toolCall.id)) {
                              setExpandingToolCalls((prev) =>
                                prev.filter((id) => id !== toolCall.id)
                              )
                            } else {
                              setExpandingToolCalls((prev) => [
                                ...prev,
                                toolCall.id,
                              ])
                            }
                          }}
                        />
                      )
                    })}
                </div>
              ))}
              {pending && messages.at(-1)?.role == 'user' && (
                <div className="flex items-start text-left">{<Spinner />}</div>
              )}
            </div>
          ) : (
            <motion.div className="flex flex-col h-full p-4 items-start justify-start pt-16 select-none">
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-muted-foreground text-3xl"
              >
                <ShinyText text="Hello, Jaaz!" />
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-muted-foreground text-2xl"
              >
                <ShinyText text="How can I help you today?" />
              </motion.span>
            </motion.div>
          )}
        </ScrollArea>

        <div className="p-2 gap-2 sticky bottom-0">
          <ChatTextarea
            value={prompt}
            onChange={setPrompt}
            onSendMessages={(data, configs) => {
              setMessages(data)

              sendMessages({
                sessionId: sessionId!,
                newMessages: data,
                textModel: configs.textModel,
                imageModel: configs.imageModel,
              })
            }}
            pending={pending}
            messages={messages}
          />
        </div>
      </div>
    </PhotoProvider>
  )
}

export default ChatInterface
