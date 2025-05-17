import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "./components/ui/button";
import {
  ChevronDownIcon,
  DownloadIcon,
  FolderIcon,
  ImageIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  TriangleIcon,
  VideoIcon,
} from "lucide-react";
import "@mdxeditor/editor/style.css";
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  type MDXEditorProps,
  BoldItalicUnderlineToggles,
  UndoRedo,
  toolbarPlugin,
  InsertTable,
  InsertImage,
  Separator,
  CodeToggle,
  ListsToggle,
  CreateLink,
  BlockTypeSelect,
  linkPlugin,
  imagePlugin,
} from "@mdxeditor/editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { Checkbox } from "./components/ui/checkbox";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { PLATFORMS_CONFIG } from "./platformsConfig";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";

function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

export default function PostEditor({
  curPath,
  setCurPath,
}: {
  curPath: string;
  setCurPath: (path: string) => void;
}) {
  const HEADER_HEIGHT = 50;
  const { theme } = useTheme();
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [isPostMode, setIsPostMode] = useState(false);
  const mdxEditorRef = useRef<MDXEditorMethods>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/read_file", {
      method: "POST",
      body: JSON.stringify({ path: curPath }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.content == "string") {
          const { title, content } = getTitleAndContent(data.content);
          setEditorTitle(title);
          setEditorContent(content);
          mdxEditorRef.current?.setMarkdown(content);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [curPath]);

  const renameFile = useCallback(
    (title: string) => {
      const fullContent = `# ${title}\n${editorContent}`;
      fetch("/api/rename_file", {
        method: "POST",
        body: JSON.stringify({ old_path: curPath, new_title: title }),
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.path) {
            // successfully renamed, update to the new path
            await fetch("/api/update_file", {
              method: "POST",
              body: JSON.stringify({ path: data.path, content: fullContent }),
            });
            setCurPath(data.path);
            dispatchEvent(new CustomEvent("refresh_workspace"));
          } else {
            // failed to rename, update to the old path
            await fetch("/api/update_file", {
              method: "POST",
              body: JSON.stringify({ path: curPath, content: fullContent }),
            });
            toast.error(data.error);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [curPath, editorContent, setCurPath]
  );

  const updateFile = useCallback(
    (content: string) => {
      const fullContent = `# ${editorTitle}\n${content}`;
      fetch("/api/update_file", {
        method: "POST",
        body: JSON.stringify({ path: curPath, content: fullContent }),
      });
    },
    [curPath, editorTitle]
  );

  // Create debounced versions of the functions
  const debouncedRenameFile = useDebounce(renameFile, 500);
  const debouncedUpdateFile = useDebounce(updateFile, 500);

  const setEditorTitleWrapper = (title: string) => {
    setEditorTitle(title);
    debouncedRenameFile(title);
  };

  const setEditorContentWrapper = (content: string) => {
    setEditorContent(content);
    debouncedUpdateFile(content);
  };

  useEffect(() => {
    const toolbar = document.querySelector(".my-classname");
    if (toolbar) {
      (toolbar as HTMLElement).style.padding = "0px";
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // Ensure that there's a non-empty selection
        if (!range.collapsed) {
          const rect = range.getBoundingClientRect();
          setSelectionPosition({ top: rect.top - 50, left: rect.left });
          setIsTextSelected(true);
        } else {
          setIsTextSelected(false); // No selection or collapsed selection
        }
      } else {
        setIsTextSelected(false); // No selection
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);
  return (
    <div className="h-100vh">
      <div
        className="flex justify-between py-2 items-center"
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <div className="flex flex-row gap-2">
          <Button size={"sm"} variant={"secondary"}>
            <ImageIcon />
            Add Image
          </Button>
          <Button size={"sm"} variant={"secondary"}>
            <VideoIcon />
            Add Video
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto">
            <Button size={"sm"} className="bg-purple-600 text-white ml-auto">
              <SendIcon className="w-4 h-4" />
              Post
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="text-base px-3">
            {PLATFORMS_CONFIG.map((platform) => (
              <DropdownMenuItem
                key={platform.name}
                className="text-base font-semibold"
              >
                <Checkbox checked className="mr-3" />
                <img
                  src={platform.icon}
                  alt={platform.name}
                  className="w-4 h-4"
                />
                {platform.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="text-base font-semibold">
              <Button variant={"outline"} size={"sm"} className="w-full">
                <PlusIcon size={16} />
                Add new
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        style={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}
        className="overflow-y-auto"
      >
        <Textarea
          placeholder="Title"
          value={editorTitle}
          onChange={(e) => {
            if (!isPostMode && editorContent.length == 0) {
              const value = e.target.value.trim();
              const firstNewlineIndex = value.indexOf("\n");
              if (firstNewlineIndex !== -1 && value.startsWith("# ")) {
                const title = value.substring(2, firstNewlineIndex).trim(); // Extract title without '# '
                const content = value.substring(firstNewlineIndex + 1).trim(); // Extract content after the first newline
                console.log("content", content);
                setEditorTitleWrapper(title);
                mdxEditorRef.current?.setMarkdown(content);
                return;
              }
            }
            setEditorTitleWrapper(e.target.value);
          }}
          style={{
            fontSize: isPostMode ? "1rem" : "2rem",
            backgroundColor: isPostMode ? undefined : "transparent",
            outline: isPostMode ? undefined : "none", // Remove outline
            boxShadow: isPostMode ? undefined : "none", // Remove box shadow
            border: isPostMode ? undefined : "none", // Remove border
            resize: "none", // Disable resize
          }}
          className={`${!isPostMode ? "border-none text-xl font-bold" : ""}`}
        />
        {isPostMode ? (
          <Textarea
            placeholder="Post content"
            className="text-sm flex-1 h-[calc(100vh-200px)]"
            value={editorContent}
            onChange={(e) => setEditorContentWrapper(e.target.value)}
          />
        ) : (
          <MDXEditor
            ref={mdxEditorRef}
            className={theme == "dark" ? `dark-theme` : ""}
            plugins={[
              headingsPlugin(),
              linkPlugin(),
              // imagePlugin({
              //   imageUploadHandler: () => {
              //     return Promise.resolve("https://picsum.photos/200/300");
              //   },
              //   imageAutocompleteSuggestions: [
              //     "https://picsum.photos/200/300",
              //     "https://picsum.photos/200",
              //   ],
              // }),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              toolbarPlugin({
                toolbarClassName: "my-classname",
                toolbarPosition: "top",
                toolbarContents: () => (
                  <>
                    {isTextSelected && selectionPosition && (
                      <div
                        role="toolbar"
                        className="fixed flex bg-accent rounded-md"
                        style={{
                          top: `${selectionPosition.top}px`,
                          left: `${selectionPosition.left}px`,
                        }}
                      >
                        <BoldItalicUnderlineToggles />
                        <BlockTypeSelect />
                        <CodeToggle />
                        <Separator orientation="vertical" />
                        <CreateLink />
                      </div>
                    )}
                  </>
                ),
              }),
            ]}
            onChange={(t) => {
              setEditorContentWrapper(t);
            }}
            placeholder={`Write your post here...`}
            markdown={editorContent}
          />
        )}
      </div>
    </div>
  );
}

function getTitleAndContent(value: string) {
  const firstNewlineIndex = value.indexOf("\n");
  if (firstNewlineIndex !== -1 && value.startsWith("# ")) {
    const title = value.substring(2, firstNewlineIndex).trim(); // Extract title without '# '
    const content = value.substring(firstNewlineIndex + 1).trim(); // Extract content after the first newline
    console.log("content", content);
    return { title, content };
  }
  return { title: "", content: value };
}
