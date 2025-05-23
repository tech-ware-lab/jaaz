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
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./components/ui/context-menu";
import { ContextMenu } from "./components/ui/context-menu";
import { toast } from "sonner";

type FileNode = {
  name: string;
  is_dir: boolean;
  rel_path: string;
};

export default function LeftSidebar({
  sessionId,
  setSessionId,
  onClickWrite,
  curPath,
  setCurPath,
}: {
  sessionId: string;
  setSessionId: (sessionId: string) => void;
  onClickWrite: () => void;
  curPath: string;
  setCurPath: (path: string) => void;
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

    if (type == "chat") {
      fetchChatSessions();
    }
  }, [type]);
  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-col gap-4 p-3 sticky top-0">
        <Button
          size={"sm"}
          variant={"outline"}
          className="w-full"
          onClick={onClickWrite}
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
          {type == "space" && (
            <FileList
              path={""}
              curPath={curPath}
              setCurPath={setCurPath}
              onClickFile={(relPath) => {
                setCurPath(relPath);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FileList({
  path,
  onClickFile,
  curPath,
  setCurPath,
}: {
  path: string;
  onClickFile: (path: string) => void;
  curPath: string;
  setCurPath: (path: string) => void;
}) {
  const [files, setFiles] = useState<FileNode[]>([]);

  const handleRevealInExplorer = async (filePath: string) => {
    try {
      const response = await fetch("/api/reveal_in_explorer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Failed to reveal file in explorer");
    }
  };

  useEffect(() => {
    const fetchFiles = async () => {
      const files = await fetch(
        `/api/list_files_in_dir?rel_path=${encodeURIComponent(path)}`
      ).then((res) => res.json());
      if (Array.isArray(files)) {
        setFiles(files);
        if (curPath == "") {
          setCurPath(files[0].rel_path);
        }
      }
    };
    window.addEventListener("refresh_workspace", () => {
      fetchFiles();
    });
    fetchFiles();
  }, [path]);
  return (
    <div className="flex flex-col text-left justify-start">
      {files.map((file, index) => (
        <div className="flex flex-col gap-2" key={file.rel_path}>
          <ContextMenu>
            <ContextMenuTrigger>
              <Button
                key={file.name}
                onClick={() => {
                  onClickFile(file.rel_path);
                }}
                variant={file.rel_path == curPath ? "default" : "ghost"}
                className="justify-start text-left px-2 w-full"
              >
                {file.is_dir && <FolderIcon />}

                <span className="truncate">
                  {!!file.name ? file.name : "Untitled"}
                </span>
              </Button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => handleRevealInExplorer(file.rel_path)}
              >
                Reveal in File Explorer
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {file.is_dir && (
            <div className="flex flex-col gap-2">
              <FileList
                path={file.rel_path}
                onClickFile={onClickFile}
                curPath={curPath}
                setCurPath={setCurPath}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
