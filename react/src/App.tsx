import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import Settings from "./Settings";
import { EAgentState, Message } from "./types/types";
import ChatInterface from "./Chat";
import { exampleMessages } from "./exampleMessages";
import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "@/components/theme-provider";
import { toast, Toaster } from "sonner";
import LeftSidebar from "./LeftSidebar";
import { nanoid } from "nanoid";
import PostEditor from "./PostEditor";
import Canvas from "./Canvas";
import CanvasExcali from "./CanvasExcali";

function Home() {
  const [agentState, setAgentState] = useState(EAgentState.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [maxSteps, setMaxSteps] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [sessionId, setSessionId] = useState<string>(nanoid());
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const { setTheme, theme } = useTheme();
  const [curPath, setCurPath] = useState("");
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/config/exists")
      .then((res) => res.json())
      .then((data) => {
        if (!data.exists) {
          navigate("/settings");
        }
      });
  }, []);

  return (
    <div className="flex">
      {/* {isLeftSidebarOpen && (
        <div className="w-[16%] bg-sidebar h-screen">
          <LeftSidebar
            sessionId={sessionId}
            setSessionId={setSessionId}
            curPath={curPath}
            setCurPath={setCurPath}
            onClose={() => setIsLeftSidebarOpen(false)}
            onClickWrite={() => {}}
          />
        </div>
      )} */}

      <div
        style={{
          position: "fixed",
          right: "20%",
          top: 0,
          bottom: 0,
          left: 0,
        }}
      >
        <CanvasExcali />
      </div>

      <div className="flex-1 flex-grow px-4 bg-accent w-[20%] absolute right-0">
        <ChatInterface
          sessionId={sessionId}
          editorTitle={editorTitle}
          editorContent={editorContent}
          onClickNewChat={() => {
            setSessionId(nanoid());
          }}
        />

        {/* <div className="absolute top-5 right-8 flex gap-1">
          <Button
            size={"sm"}
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          >
            {isRightSidebarOpen ? (
              <SidebarOpenIcon />
            ) : (
              <div className="flex">
                <ChevronLeftIcon />
                <ComputerIcon />
              </div>
            )}
          </Button>
        </div> */}
      </div>
    </div>
  );
}

function App() {
  const { theme } = useTheme();
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme={theme} storageKey="vite-ui-theme">
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
        <Toaster />
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
