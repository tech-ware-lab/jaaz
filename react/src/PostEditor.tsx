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
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
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
    <div>
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
            {/* Dropdown items */}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Input
        placeholder="Title"
        className="text-lg my-3"
        value={editorTitle}
        onChange={(e) => setEditorTitle(e.target.value)}
      />

      <Textarea
        placeholder="Post content"
        className="text-sm flex-1 h-[calc(100vh-200px)]"
        value={editorContent}
        onChange={(e) => setEditorContent(e.target.value)}
      />
      {/* <MDXEditor
        className="dark-theme dark-editor custom-mdx-editor"
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
        markdown={`
# AI Marketing Agent Copilot 👋
Indie hacker launching a new product but don’t have time to do marketing yourself? Want to 10X your user growth? Want to improve SEO and win more internet exposure for your product? We've got you covered.
\n\n

Supercharge your product marketing with AI Copilot — your always-on growth partner.
From writing launch tweets and blog posts to crafting SEO-optimized landing pages and email campaigns, our AI does the heavy lifting so you can stay focused on building.
\n\n
## Features
\n\n
✅ Auto-generate engaging content tailored to your audience
✅ Rank higher on Google with smart, keyword-rich articles
✅ Launch on Product Hunt, Reddit, Hacker News with confidence
✅ Track performance and iterate faster

\n\n
**Analytics Dashboard to track your content performance**

<img width="700px" src="https://raw.githubusercontent.com/11cafe/local-manus/1f95eb6054f4d791b0ea8078a95e9fed5b3c8f76/assets/Screenshot%202025-05-11%20at%201.11.06%20AM.png" alt="Analytics Dashboard" />


Whether you’re pre-launch or post-revenue, AI Copilot helps you grow like a pro — without hiring a team.

Launch smarter. Grow faster. Market with AI. 🚀

          `}
      /> */}
    </div>
  );
}
