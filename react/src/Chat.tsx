import React, { useEffect, useRef, useState } from "react";
import {
  EAgentState,
  Message,
  MessageContent,
  MessageGroup,
  ToolCall,
} from "./types/types";
import { Button } from "./components/ui/button";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SendIcon,
  SquareIcon,
  StopCircleIcon,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Textarea } from "./components/ui/textarea";
import { nanoid } from "nanoid";
import { Markdown } from "./components/Markdown";
import { toast } from "sonner";

const FOOTER_HEIGHT = 170; // Adjust this value as needed

const ChatInterface = ({
  messages: initialMessages,
  currentStep,
  maxStep,
  totalTokens,
  agentState,
}: {
  messages: Message[];
  currentStep: number;
  maxStep: number;
  totalTokens: number;
  agentState: EAgentState;
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [disableStop, setDisableStop] = useState(false);
  const [stream, setStream] = useState<string>("");
  const webSocketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(nanoid());
  const [expandingToolCalls, setExpandingToolCalls] = useState<string[]>([]);

  useEffect(() => {
    const socket = new WebSocket(`/ws?session_id=${sessionIdRef.current}`);
    webSocketRef.current = socket;

    socket.addEventListener("open", (event) => {
      console.log("Connected to WebSocket server");
    });

    socket.addEventListener("message", (event) => {
      // const data = JSON.parse(event.data);
      console.log(event.data);
      try {
        const data = JSON.parse(event.data);

        if (data.type == "error") {
          toast.error("Error: " + data.error, {
            closeButton: true,
            duration: 3600 * 1000, // set super large duration to make it not auto dismiss
            style: {
              color: "red",
            },
          });
        } else if (data.type == "info") {
          toast.info(data.info, {
            closeButton: true,
            duration: 10 * 1000,
          });
        } else {
          setMessages((prev) => {
            const copy = structuredClone(prev);
            if (copy.at(-1)?.role == "user") {
              copy.push({
                role: "assistant",
                content: [],
              });
            }
            const lastMessage = copy.at(-1);
            const lastMessageContent = lastMessage?.content?.at(-1);
            if (data.type == "log") {
              console.log(data);
            }
            if (data.type == "delta") {
              if (lastMessageContent?.type == "text") {
                lastMessageContent.text += data.text;
              } else {
                lastMessage?.content?.push({
                  type: "text",
                  text: data.text,
                });
              }
            } else if (data.type == "tool_call") {
              setExpandingToolCalls([...expandingToolCalls, data.id]);
              lastMessage?.content?.push({
                id: data.id,
                type: "function",
                name: data.name,
                inputs: "",
              });
            } else if (data.type == "tool_call_arguments") {
              const lastMessageContent = lastMessage?.content.at(-1);
              if (
                lastMessageContent?.type == "function" &&
                lastMessageContent.id == data.id
              ) {
                lastMessageContent.inputs += data.text;
              }
            } else if (data.type == "tool_call_result") {
              const res: {
                id: string;
                content: {
                  text: string;
                }[];
              } = data;
              copy.push({
                role: "user",
                content: res.content.map((content) => ({
                  ...content,
                  type: "tool_result",
                  tool_use_id: res.id,
                })),
              });
            }

            return copy;
          });
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    });

    socket.addEventListener("close", (event) => {
      console.log("Disconnected from WebSocket server");
    });

    socket.addEventListener("error", (event) => {
      console.error("WebSocket error:", event);
    });

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);
  const onSendPrompt = () => {
    if (agentState == EAgentState.RUNNING) {
      return;
    }
    const newMessages = messages.concat([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ]);
    setMessages(newMessages);
    setPrompt("");
    fetch("/api/chat", {
      method: "Post",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: newMessages,
        session_id: sessionIdRef.current,
      }),
    }).then((resp) => resp.json());
  };
  // Component to render tool call tag
  const ToolCallTag = ({
    toolCall,
    isExpanded,
    onToggleExpand,
  }: {
    toolCall: ToolCall;
    isExpanded: boolean;
    onToggleExpand: () => void;
  }) => {
    const { name, inputs } = toolCall;
    let parsedArgs: Record<string, any> | null = null;
    try {
      parsedArgs = JSON.parse(inputs);
    } catch (error) {}

    return (
      <div className="w-full border rounded-md overflow-hidden">
        <Button
          variant={"outline"}
          onClick={onToggleExpand}
          className={"w-full"}
        >
          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          <span
            style={{
              maxWidth: "80%",
              display: "inline-block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span className="font-semibold">{name}</span>

            {parsedArgs &&
              Object.entries(parsedArgs).map(([key, value], i) => (
                <span key={i} className="ml-1">
                  <span className="text-purple-600 dark:text-purple-400">
                    {key}
                  </span>
                  =
                  <span className="text-green-600 dark:text-green-400">
                    {String(value).slice(0, 100)}
                  </span>
                </span>
              ))}
            {!parsedArgs && (
              <span className="text-red-600 dark:text-red-400">
                {String(inputs).slice(0, 100)}
              </span>
            )}
          </span>
        </Button>
        {isExpanded && (
          <div className="p-2">
            <Markdown>{inputs}</Markdown>
          </div>
        )}
      </div>
    );
  };

  // Function to truncate long content
  const truncateContent = (content: string, maxLength = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  return (
    <div className="flex flex-col h-screen relative">
      {/* Chat header */}
      {/* <header className="p-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100"></h1>
      </header> */}

      {/* Chat messages */}
      <div
        className="flex-1 p-4 overflow-y-auto text-left"
        style={{ paddingBottom: FOOTER_HEIGHT }}
      >
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Messages */}
          {messages.map((message, idx) => (
            <div key={`${idx}`}>
              {/* Regular message content */}
              {message.content.map((content, i) => {
                if (content.type == "text") {
                  return (
                    <div
                      key={i}
                      className={`break-all ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-2xl p-3 text-left"
                          : "text-gray-800 dark:text-gray-200 text-left"
                      } ${
                        message.role === "user" ? "items-end" : "items-start"
                      } ${
                        message.role === "user"
                          ? "ml-10 items-end"
                          : "items-start"
                      } space-y-3 flex flex-col ${
                        message.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <Markdown>{content.text}</Markdown>
                    </div>
                  );
                } else if (content.type == "function") {
                  return (
                    <ToolCallTag
                      key={i}
                      toolCall={content}
                      isExpanded={expandingToolCalls.includes(content.id)}
                      onToggleExpand={() => {
                        if (expandingToolCalls.includes(content.id)) {
                          setExpandingToolCalls(
                            expandingToolCalls.filter((id) => id !== content.id)
                          );
                        } else {
                          setExpandingToolCalls([
                            ...expandingToolCalls,
                            content.id,
                          ]);
                        }
                      }}
                    />
                  );
                } else if (
                  content.type == "tool_result" &&
                  expandingToolCalls.includes(content.tool_use_id)
                ) {
                  return <Markdown>{content.text}</Markdown>;
                }
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Chat input */}
      <div
        className="flex flex-col absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-950 p-4 gap-2"
        style={{ height: FOOTER_HEIGHT }}
      >
        {/* Agent Status */}
        {/* <div className="flex w-full max-w-3xl mx-auto gap-2">
          <Badge variant={"secondary"} style={{ fontSize: "0.9rem" }}>
            {agentState == EAgentState.RUNNING && (
              <div className="flex justify-center items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-zinc-500"></div>
              </div>
            )}

            {currentStep !== 0 && (
              <p>
                {agentState == EAgentState.RUNNING ? "Running" : "Finished"}{" "}
                Step: {currentStep}/{maxStep}
              </p>
            )}
          </Badge>
        </div> */}

        {/* Input area */}
        <div className="flex flex-grow w-full items-center space-x-2 max-w-3xl mx-auto">
          <Textarea
            className="flex flex-1 flex-grow h-full"
            placeholder="What do you want to do?"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
            }}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); // Prevents adding a new line
                onSendPrompt();
              }
            }}
          />
          <Button
            onClick={onSendPrompt}
            disabled={agentState == EAgentState.RUNNING}
          >
            <SendIcon />
          </Button>
          {agentState == EAgentState.RUNNING && (
            <Button
              disabled={disableStop}
              onClick={() => {
                fetch("/api/cancel");
                setDisableStop(true);
                setTimeout(() => {
                  setDisableStop(false);
                }, 6000);
              }}
            >
              <StopCircleIcon />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
