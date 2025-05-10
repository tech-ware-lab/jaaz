import { Markdown } from "./components/Markdown";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Checkbox } from "./components/ui/checkbox";

export default function MultiChoicePrompt() {
  return (
    <div className="flex flex-col gap-2">
      <Card className="p-4">
        <div>
          <Markdown>
            {`Do you want to send below reply to this Reddit post? [Recommended AI Tools for Marketing?](https://www.reddit.com/r/digital_marketing/comments/1btayyg/best_under_the_radar_ai_tools_for_marketers/) \n
            Reply:
We're building a one-stop AI marketing tool **Runcafe** that helps you generate content, schedule posts, and analyze your marketing performance. It is a local tool that you can install on your computer. Give it a try at https://runcafe.com

            `}
          </Markdown>
        </div>
        <Button size={"sm"} variant={"secondary"}>
          Yes
        </Button>
        <Button size={"sm"} variant={"destructive"}>
          No
        </Button>
      </Card>
    </div>
  );
}
