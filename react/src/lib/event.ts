import { Message, ToolCallFunctionName } from '@/types/types'
import { ExcalidrawImageElement } from '@excalidraw/excalidraw/element/types'
import { BinaryFileData } from '@excalidraw/excalidraw/types'
import mitt from 'mitt'

export type TEvents = {
  // ********** Socket events - Start **********
  'Socket::Error': {
    type: 'error'
    error: string
  }
  'Socket::Done': {
    type: 'done'
    session_id: string
  }
  'Socket::Info': {
    type: 'info'
    info: string
  }
  'Socket::ImageGenerated': {
    element: ExcalidrawImageElement
    file: BinaryFileData
    canvas_id: string
    session_id: string
    image_url: string
  }
  'Socket::Delta': {
    type: 'delta'
    text: string
    session_id: string
  }
  'Socket::ToolCall': {
    type: 'tool_call'
    id: string
    name: ToolCallFunctionName
    session_id: string
  }
  'Socket::ToolCallArguments': {
    type: 'tool_call_arguments'
    id: string
    text: string
    session_id: string
  }
  'Socket::ToolCallResult': {
    type: 'tool_call_result'
    id: string
    content: {
      text: string
    }[]
    session_id: string
  }
  'Socket::AllMessages': {
    type: 'all_messages'
    messages: Message[]
    session_id: string
  }
  'Socket::ToolCallProgress': {
    type: 'tool_call_progress'
    tool_call_id: string
    session_id: string
    update: string
  }
  // ********** Socket events - End **********
}

export const eventBus = mitt<TEvents>()
