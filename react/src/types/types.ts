export type ToolCall = {
  id: string;
  type: "function";
  name: string;
  inputs: string;
};
export type MessageContent =
  | { text: string; type: "text" }
  | { image_url: string; type: "image_url" }
  | ToolCall
  | {
      type: "tool_result";
      tool_use_id: string;
      text: string;
    }
  | {
      type: "function_call_output";
      call_id: string;
      output: string;
    };
export type Message = {
  role: "user" | "assistant";
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
