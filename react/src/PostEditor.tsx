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
            <DropdownMenuItem className="text-base font-semibold">
              <Checkbox checked className="mr-3" />
              <img
                src="https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png"
                alt="Reddit"
                className="w-4 h-4"
              />
              Reddit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-base font-semibold">
              <Checkbox checked className="mr-3" />
              <img
                src="https://www.tiktok.com/favicon.ico"
                alt="Tiktok"
                className="w-4 h-4"
              />
              Tiktok
            </DropdownMenuItem>
            <DropdownMenuItem className="text-base font-semibold">
              <Checkbox checked className="mr-3" />
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/2048px-LinkedIn_icon.svg.png"
                alt="LinkedIn"
                className="w-4 h-4"
              />
              LinkedIn
            </DropdownMenuItem>
            <DropdownMenuItem className="text-base font-semibold">
              <Checkbox checked className="mr-3" />
              <img
                src="https://abs.twimg.com/icons/apple-touch-icon-192x192.png"
                alt="Twitter"
                className="w-4 h-4"
              />
              Twitter
            </DropdownMenuItem>
            <DropdownMenuItem className="text-base font-semibold">
              <Checkbox checked className="mr-3" />
              <img
                src="https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png"
                alt="Instagram"
                className="w-4 h-4"
              />
              Instagram
            </DropdownMenuItem>
            <DropdownMenuItem className="text-base font-semibold">
              <Checkbox checked className="mr-3" />
              <img
                src="https://miro.medium.com/v2/resize:fit:1400/0*zPzAcHbkOUmfNnuB.jpeg"
                alt="Medium"
                className="w-4 h-4"
              />
              Medium
            </DropdownMenuItem>
            <DropdownMenuItem className="text-base font-semibold">
              <Checkbox checked className="mr-3" />
              <img
                src="https://d2fltix0v2e0sb.cloudfront.net/dev-badge.svg"
                alt="DEV.to"
                className="w-4 h-4"
              />
              DEV.to
            </DropdownMenuItem>
            <DropdownMenuItem className="text-base font-semibold">
              <Checkbox checked className="mr-3" />
              <img
                src="https://www.facebook.com/images/fb_icon_325x325.png"
                alt="Facebook"
                className="w-4 h-4 mr-2"
              />
              Facebook
            </DropdownMenuItem>
            <DropdownMenuItem className="text-base font-semibold">
              <Checkbox checked className="mr-3" />
              <img
                src="https://cdn.iconscout.com/icon/free/png-256/free-producthunt-logo-icon-download-in-svg-png-gif-file-formats--70-flat-social-icons-color-pack-logos-432534.png?f=webp"
                alt="Product Hunt"
                className="w-4 h-4 mr-2"
              />
              Product Hunt
            </DropdownMenuItem>
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
