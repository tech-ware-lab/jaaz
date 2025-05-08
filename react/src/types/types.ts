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
  | { image_url: string; type: "image_url" }
  | ToolCall;
export type Message = {
  role: string;
  content: MessageContent[];
  // base64_image?: string;
  // tool_calls?: ToolCall[];
  // name?: string;
  // tool_call_id?: string;
};

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
