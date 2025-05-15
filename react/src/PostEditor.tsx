import { useEffect, useState } from "react";
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
import { Card } from "./components/ui/card";
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
import { useTheme } from "next-themes";

export default function PostEditor({
  editorTitle,
  editorContent,
  setEditorTitle,
  setEditorContent,
}: {
  editorTitle: string;
  editorContent: string;
  setEditorTitle: (title: string) => void;
  setEditorContent: (content: string) => void;
}) {
  const { theme } = useTheme();
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [isRichText, setIsRichText] = useState(false);

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
      <div className="flex justify-between py-2">
        <Button size={"sm"} variant={"secondary"}>
          <ImageIcon />
          Add Image
        </Button>

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
      <Input
        placeholder="Title"
        className="text-lg my-3"
        value={editorTitle}
        onChange={(e) => setEditorTitle(e.target.value)}
      />
      {isRichText ? (
        <Textarea
          placeholder="Post content"
          className="text-sm flex-1 h-[calc(100vh-200px)]"
          value={editorContent}
          onChange={(e) => setEditorContent(e.target.value)}
        />
      ) : (
        <MDXEditor
          className={`dark-theme dark-editor overflow-y-auto h-[500]`}
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
                      <ListsToggle />
                      <Separator orientation="vertical" />
                      <CreateLink />
                    </div>
                  )}
                </>
              ),
            }),
          ]}
          onChange={(t) => {
            setEditorContent(t);
          }}
          placeholder={`Write your post here...`}
          markdown={editorContent}
        />
      )}
    </div>
  );
}
