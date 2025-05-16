import {
  FileIcon,
  FolderIcon,
  MessageCircleIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { useEffect, useState } from "react";
import { ChatSession } from "./types/types";

type FileNode = {
  name: string;
  path: string;
  is_dir: boolean;
};

const EXAMPLE_FILES: FileNode[] = [
  {
    name: "AI marketing copilot agent that helps you get users and grow - free runs local",
    path: "example.mdx",
    is_dir: false,
  },
  {
    name: "微调千问复现Manus - 手把手教学",
    path: "example.mdx",
    is_dir: false,
  },
  {
    name: "类Manus通用类AI agent技术分析",
    path: "example.mdx",
    is_dir: false,
  },
  {
    name: "会议纪要",
    path: "example.mdx",
    is_dir: true,
  },
];

const EXAMPLE_CHILD_FILES: FileNode[] = [
  {
    name: "2025-05-16 会议纪要",
    path: "example.mdx",
    is_dir: false,
  },
  {
    name: "2025-05-15 会议纪要",
    path: "example.mdx",
    is_dir: false,
  },
];
export default function LeftSidebar({
  sessionId,
  setSessionId,
}: {
  sessionId: string;
  setSessionId: (sessionId: string) => void;
}) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [type, setType] = useState<"chat" | "space">("space");
  const [files, setFiles] = useState<FileNode[]>([]);
  useEffect(() => {
    const fetchChatSessions = async () => {
      const sessions = await fetch("/api/list_chat_sessions", {
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await sessions.json();
      setChatSessions(data);
    };
    fetchChatSessions();
  }, []);
  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-col gap-4 p-3 sticky top-0">
        <Button
          size={"sm"}
          variant={"outline"}
          className="w-full"
          onClick={() => {
            alert(
              "AI content writing Copilot is coming soon! We're working on it as fast as we can!"
            );
          }}
        >
          <PencilIcon className="w-4 h-4 text-xs size-4" /> Write
        </Button>
      </div>
      <div className="flex px-3 mb-4">
        <Button
          size={"sm"}
          className="flex-1"
          variant={type == "chat" ? "default" : "ghost"}
          onClick={() => setType("chat")}
        >
          <MessageCircleIcon className="w-4 h-4" /> Chat
        </Button>
        <Button
          size={"sm"}
          className="flex-1"
          variant={type == "space" ? "default" : "ghost"}
          onClick={() => setType("space")}
        >
          <FolderIcon className="w-4 h-4" /> Space
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex flex-col text-left justify-start">
          {type == "chat" &&
            chatSessions.map((session) => (
              <Button
                key={session.id}
                variant={session.id === sessionId ? "default" : "ghost"}
                className="justify-start text-left px-2 w-full"
                onClick={() => {
                  setSessionId(session.id);
                }}
              >
                <span className="truncate">
                  {!!session.title ? session.title : "Untitled"}
                </span>
              </Button>
            ))}
          {type == "space" && <FileList files={files} />}
        </div>
      </div>
    </div>
  );
}

function FileList({ files }: { files: FileNode[] }) {
  return (
    <div className="flex flex-col text-left justify-start">
      {EXAMPLE_FILES.map((file, index) => (
        <div className="flex flex-col gap-2">
          <Button
            key={file.path}
            variant={index === 0 ? "secondary" : "ghost"}
            className="justify-start text-left px-2 w-full"
          >
            {file.is_dir && <FolderIcon />}

            <span className="truncate">
              {!!file.name ? file.name : "Untitled"}
            </span>
          </Button>
          {file.is_dir && (
            <div className="flex flex-col gap-2">
              {EXAMPLE_CHILD_FILES.map((child) => (
                <Button
                  size={"sm"}
                  variant={"ghost"}
                  key={child.path}
                  className="justify-start text-left pl-8"
                >
                  {child.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FolderIconYellow() {
  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M460,128H272l-64-64H52c-26.5,0-48,21.5-48,48v288c0,26.5,21.5,48,48,48h408c26.5,0,48-21.5,48-48V176
C508,149.5,486.5,128,460,128z"
        fill="#FFD43B"
        stroke="#E6BC35"
        stroke-width="8"
      />

      <path
        d="M460,128H272l-64-64H52c-26.5,0-48,21.5-48,48v48h456V176C460,149.5,460,128,460,128z"
        fill="#FFEA94"
        stroke="#E6BC35"
        stroke-width="8"
      />

      <path
        d="M460,400H52c0,26.5,21.5,48,48,48h360c26.5,0,48-21.5,48-48V352C508,378.5,486.5,400,460,400z"
        fill="#E6BC35"
        opacity="0.3"
      />
    </svg>
  );
}
