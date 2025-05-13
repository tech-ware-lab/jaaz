import { useState, useEffect } from "react";
import { Input } from "./components/ui/input";
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectItem,
  SelectGroup,
  SelectContent,
} from "./components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Label } from "./components/ui/label";
import { ArrowLeftIcon, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

type LLMConfig = {
  models: string[];
  url: string;
  api_key: string;
  max_tokens: number;
};

const PROVIDER_NAME_MAPPING: { [key: string]: string } = {
  anthropic: "Claude",
  openai: "OpenAI",
  ollama: "Ollama",
};
const DEFAULT_CONFIG: { [key: string]: LLMConfig } = {
  anthropic: {
    models: ["claude-3-7-sonnet-latest"],
    url: "https://api.anthropic.com/v1/",
    api_key: "",
    max_tokens: 8192,
  },
  openai: {
    models: ["gpt-4o", "gpt-4o-mini"],
    url: "https://api.openai.com/v1/",
    api_key: "",
    max_tokens: 8192,
  },
  ollama: {
    models: [],
    url: "http://localhost:11434",
    api_key: "",
    max_tokens: 8192,
  },
};

export default function Settings() {
  const [provider, setProvider] = useState("anthropic");
  const [config, setConfig] = useState<{
    [key: string]: LLMConfig;
  }>(DEFAULT_CONFIG);
  const [isApiKeyDirty, setIsApiKeyDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/config");
        const config: { [key: string]: LLMConfig } = await response.json();
        setConfig((curConfig) => {
          const res: { [key: string]: LLMConfig } = {};
          for (const provider in DEFAULT_CONFIG) {
            if (config[provider] && typeof config[provider] === "object") {
              res[provider] = {
                ...DEFAULT_CONFIG[provider],
                ...config[provider],
              };
            } else {
              res[provider] = DEFAULT_CONFIG[provider];
            }
          }
          return res;
        });
      } catch (error) {
        console.error("Error loading configuration:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      setErrorMessage("");

      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      const result = await response.json();
      if (result.status === "success") {
        navigate("/");
      } else {
        throw new Error(result.message || "Failed to save configuration");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setErrorMessage("Failed to save settings");
      // You might want to show an error message to the user here
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <Button
        onClick={() => navigate("/")}
        className="fixed top-4 left-4"
        size={"icon"}
      >
        <ArrowLeftIcon />
      </Button>
      <Card className="w-full max-w-[800px] shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-500"></div>
            </div>
          )}
          {Object.keys(config).map((key, index) => (
            <>
              <div className="space-y-2">
                <p className="font-bold bg-purple-500 text-white p-1 rounded-md w-fit">
                  {PROVIDER_NAME_MAPPING[key]}
                </p>

                <Input
                  placeholder="Enter your API URL"
                  value={config[key]?.url ?? ""}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      [key]: {
                        ...config[key],
                        url: e.target.value,
                      },
                    });
                  }}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={config[key]?.api_key ?? ""}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      [key]: { ...config[key], api_key: e.target.value },
                    });
                    setIsApiKeyDirty(true);
                  }}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Your API key will be stored securely
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  placeholder="Enter your max tokens"
                  value={config[key]?.max_tokens ?? 8192}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      [key]: {
                        ...config[key],
                        max_tokens: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  The maximum number of tokens in the response
                </p>
              </div>
              {index !== Object.keys(config).length - 1 && (
                <div className="my-6 border-t bg-border" />
              )}
            </>
          ))}

          <Button onClick={handleSave} className="w-full">
            <Save className="mr-2 h-4 w-4" /> Save Settings
          </Button>

          {successMessage && (
            <div className="text-green-500 text-center mb-4">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="text-red-500 text-center mb-4">{errorMessage}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
