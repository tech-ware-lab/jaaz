import { useEffect, useState } from "react";
import { Button } from "./components/ui/button";
import {
  ChevronDownIcon,
  DownloadIcon,
  FolderIcon,
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

type WorkspaceList = {
  name: string;
  is_dir: boolean;
  path: string;
}[];
export default function WorkspaceSidebar() {
  const [data, setData] = useState<WorkspaceList>([]);
  useEffect(() => {
    const intervalId = setInterval(() => {
      // fetch("/api/workspace_list")
      //   .then((res) => res.json())
      //   .then((data) => {
      //     setData(data);
      //   });
    }, 1000); // Refresh every 1 second

    return () => clearInterval(intervalId); // Cleanup on component unmount
  }, []);
  return (
    <div>
      <MDXEditor
        className="dark-theme dark-editor"
        plugins={[
          headingsPlugin(),
          linkPlugin(),
          imagePlugin({
            imageUploadHandler: () => {
              return Promise.resolve("https://picsum.photos/200/300");
            },
            imageAutocompleteSuggestions: [
              "https://picsum.photos/200/300",
              "https://picsum.photos/200",
            ],
          }),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarClassName: "my-classname",
            toolbarContents: () => (
              <>
                <Button size={"sm"} variant={"outline"}>
                  <FolderIcon size={16} />
                  <ChevronDownIcon size={20} />
                </Button>
                <UndoRedo />
                <Separator orientation="vertical" />
                <BoldItalicUnderlineToggles />
                <BlockTypeSelect />
                <CodeToggle />
                <Separator orientation="vertical" />
                <ListsToggle />
                <Separator orientation="vertical" />
                <CreateLink />
                <InsertImage />
                <Separator orientation="vertical" />
                <InsertTable />
                <DropdownMenu>
                  <DropdownMenuTrigger className="ml-auto">
                    <Button
                      size={"sm"}
                      className="bg-purple-600 text-white ml-auto"
                    >
                      <SendIcon className="w-4 h-4" />
                      Auto Post 🤖 (9)
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
                      <Button
                        variant={"outline"}
                        size={"sm"}
                        className="w-full"
                      >
                        <PlusIcon size={16} />
                        Add new
                      </Button>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
      />

      <div className="flex flex-col gap-2 text-left p-5">
        {data.map((workspace) => (
          <div key={workspace.name} className="flex gap-2">
            <span>
              {workspace.is_dir && "📁 "}
              {workspace.name}
            </span>
            {!workspace.is_dir && (
              <Button
                size={"xs"}
                variant={"ghost"}
                onClick={() => {
                  const downloadUrl = `/api/workspace_download?path=${encodeURIComponent(
                    workspace.path
                  )}`;
                  const link = document.createElement("a");
                  link.href = downloadUrl;
                  link.download = workspace.name; // Optional: specify a default filename
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <DownloadIcon size={16} />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
