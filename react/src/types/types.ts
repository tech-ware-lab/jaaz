export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};
export type MessageContent =
  | { text: string; type: "text" }
  | { image_url: { url: string }; type: "image_url" };
type ToolResultMessage = {
  role: "tool";
  tool_call_id: string;
  content: string;
};
type AssistantMessage = {
  role: "assistant";
  tool_calls?: ToolCall[];
  content?: MessageContent[] | string;
};
type UserMessage = {
  role: "user";
  content: MessageContent[] | string;
};
export type Message = UserMessage | AssistantMessage | ToolResultMessage;

export interface MessageGroup {
  id: number;
  role: string;
  messages: Message[];
}

export enum EAgentState {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  FINISHED = "FINISHED",
  ERROR = "ERROR",
}
