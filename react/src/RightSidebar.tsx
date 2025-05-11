import {
  CheckCheckIcon,
  CheckIcon,
  CircleCheckIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { Button } from "./components/ui/button";
import Spinner from "./components/ui/Spinner";
import { IconCircleCheckFilled } from "@tabler/icons-react";

export default function RightSidebar() {
  return (
    <div className="flex flex-col gap-4 p-3">
      <Button size={"sm"} variant={"outline"} className="w-full">
        <PlusIcon /> New Chat
      </Button>
      <Button size={"sm"} variant={"outline"} className="w-full">
        <PencilIcon className="w-4 h-4 text-xs size-4" /> Write Post
      </Button>
      <p className="text-sm font-bold">AI Marketing Agent Copilot 👋 </p>
      <div className="flex flex-col text-left justify-start">
        <Button variant={"ghost"} className="justify-start text-left">
          <Spinner />
          <img
            src="https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png"
            alt="Reddit"
            className="w-4 h-4"
          />
          Posting to Reddit
        </Button>
        <Button variant={"secondary"} className="justify-start text-left">
          <Spinner />
          <img
            src="https://miro.medium.com/v2/resize:fit:1400/0*zPzAcHbkOUmfNnuB.jpeg"
            alt="Medium"
            className="w-4 h-4"
          />
          Posting to Medium
        </Button>
        <Button variant={"ghost"} className="justify-start text-left">
          <Spinner />
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/2048px-LinkedIn_icon.svg.png"
            alt="LinkedIn"
            className="w-4 h-4"
          />
          Posting to LinkedIn
        </Button>
        <Button variant={"ghost"} className="justify-start text-left">
          <Spinner />
          <img
            src="https://abs.twimg.com/icons/apple-touch-icon-192x192.png"
            alt="Twitter"
            className="w-4 h-4"
          />
          Posting to Twitter
        </Button>
        <Button variant={"ghost"} className="justify-start text-left">
          <Spinner />
          <img
            src="https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png"
            alt="Instagram"
            className="w-4 h-4"
          />
          Posting to Instagram
        </Button>
      </div>

      <p className="text-sm font-bold">SQL Basics 101 tutorial </p>
      <div className="flex flex-col text-left justify-start">
        <Button variant={"ghost"} className="justify-start text-left">
          <CheckCheckIcon className="w-4 h-4" />
          <img
            src="https://www.tiktok.com/favicon.ico"
            alt="TikTok"
            className="w-4 h-4"
          />
          Posting to TikTok
        </Button>
        <Button variant={"ghost"} className="justify-start text-left">
          <CheckCheckIcon className="w-4 h-4" />
          <img
            src="https://www.youtube.com/favicon.ico"
            alt="Youtube"
            className="w-4 h-4"
          />
          Posting to Youtube
        </Button>
        <Button variant={"ghost"} className="justify-start text-left">
          <CheckCheckIcon className="w-4 h-4" />
          <img
            src="https://abs.twimg.com/icons/apple-touch-icon-192x192.png"
            alt="Twitter"
            className="w-4 h-4"
          />
          Posting to Twitter
        </Button>
        <Button variant={"ghost"} className="justify-start text-left">
          <CheckCheckIcon className="w-4 h-4" />
          <img
            src="https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png"
            alt="Instagram"
            className="w-4 h-4"
          />
          Posting to Instagram
        </Button>
      </div>
    </div>
  );
}
