import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Button } from "./components/ui/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ComputerIcon,
  MoonIcon,
  SettingsIcon,
  SidebarCloseIcon,
  SidebarIcon,
  SidebarOpenIcon,
  SunIcon,
} from "lucide-react";
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
import WorkspaceSidebar from "./WorkspaceSidebar";
import { Toaster } from "sonner";
import LeftSidebar from "./LeftSidebar";
import { nanoid } from "nanoid";

function Home() {
  const [agentState, setAgentState] = useState(EAgentState.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [maxSteps, setMaxSteps] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [sessionId, setSessionId] = useState<string>(nanoid());

  const { setTheme, theme } = useTheme();
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
      {isLeftSidebarOpen && (
        <div className="w-[16%] bg-sidebar h-screen">
          <LeftSidebar sessionId={sessionId} setSessionId={setSessionId} />
        </div>
      )}
      <div className="flex-1 flex-grow relative px-4">
        <ChatInterface sessionId={sessionId} />
        <div className="absolute top-5 left-8 flex gap-1">
          <Button
            size={"sm"}
            variant={"ghost"}
            onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
          >
            <SidebarIcon size={30} />
          </Button>
          <Link to="/settings">
            <Button size={"sm"} variant={"secondary"}>
              <SettingsIcon size={30} />
            </Button>
          </Link>
          <Button
            size={"sm"}
            variant={"ghost"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <SunIcon size={30} /> : <MoonIcon size={30} />}
          </Button>
        </div>
        <div className="absolute top-5 right-8 flex gap-1">
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
        </div>
      </div>
      {isRightSidebarOpen && (
        <div className="w-[40%] bg-sidebar h-screen">
          <WorkspaceSidebar />
        </div>
      )}
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
