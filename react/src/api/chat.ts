import { Message, Model } from '@/types/types'

export const getChatSession = async (sessionId: string) => {
  const response = await fetch(`/api/chat_session/${sessionId}`)
  const data = await response.json()
  return data as Message[]
}

export const sendMessages = async (payload: {
  sessionId: string
  newMessages: Message[]
  textModel: Model
  imageModel: Model
}) => {
  const response = await fetch(`/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: payload.newMessages,
      session_id: payload.sessionId,
      text_model: payload.textModel,
      image_model: payload.imageModel,
    }),
  })
  const data = await response.json()
  return data as Message[]
}
