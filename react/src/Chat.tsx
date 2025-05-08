import React, { useEffect, useRef, useState } from "react";
import { EAgentState, Message, MessageGroup, ToolCall } from "./types/types";
import { Button } from "./components/ui/button";
import { SendIcon, SquareIcon, StopCircleIcon } from "lucide-react";
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
        if (data.type == "text") {
          setStream((prev) => {
            return prev + data.text;
          });
        } else if (data.type == "error") {
          toast.error(data.error);
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
        content: prompt,
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
  const ToolCallTag = ({ toolCall }: { toolCall: ToolCall }) => {
    const { name, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args);

    return (
      <div className="bg-gray-200 dark:bg-gray-800 rounded px-2 py-1 text-xs font-mono mt-2 inline-block">
        <span className="font-semibold">{name}</span>
        {Object.entries(parsedArgs).map(([key, value], i) => (
          <span key={i} className="ml-1">
            <span className="text-purple-600 dark:text-purple-400">{key}</span>=
            <span className="text-green-600 dark:text-green-400">
              {String(value)}
            </span>
          </span>
        ))}
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
        className="flex-1 p-4 overflow-y-auto"
        style={{ paddingBottom: FOOTER_HEIGHT }}
      >
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Messages */}
          {messages.map((message, idx) => (
            <div
              key={idx}
              className={`flex flex-col space-y-2 ${
                message.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`${
                  message.role === "user" ? "ml-10 items-end" : "items-start"
                } space-y-3 flex flex-col ${
                  message.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  key={`${idx}`}
                  className={`${
                    message.role === "user" ? "items-end" : "items-start"
                  } flex flex-col`}
                >
                  {/* Regular message content */}
                  {message.content && (
                    <div
                      className={`break-all ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-2xl p-3 text-left"
                          : "text-gray-800 dark:text-gray-200 text-left"
                      }`}
                    >
                      <Markdown>{message.content}</Markdown>
                    </div>
                  )}

                  {/* Tool calls */}
                  {message.tool_calls && message.tool_calls.length > 0 && (
                    <div className="flex flex-col items-start">
                      {message.tool_calls.map((toolCall, i) => (
                        <ToolCallTag key={i} toolCall={toolCall} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {stream && (
            <div
              className="text-gray-800 dark:text-gray-200 text-left"
              // style={{ whiteSpace: "pre-wrap" }}
            >
              <Markdown>{stream}</Markdown>
            </div>
          )}
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
