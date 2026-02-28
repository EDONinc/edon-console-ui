import { useEffect, useMemo, useRef, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Copy, KeyRound, Sparkles, ShieldCheck, Link2, Cpu, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const baseModels = [
  { name: "Claude Sonnet", provider: "Anthropic", price: "$", strengths: "Balanced safety + tools", note: "Strong default" },
  { name: "GPT-4o", provider: "OpenAI", price: "$$", strengths: "Multimodal speed", note: "Great for mixed media" },
  { name: "GPT-5.2", provider: "OpenAI", price: "$", strengths: "Fast reasoning + tools", note: "Lowest latency" },
  { name: "Gemini 1.5 Pro", provider: "Google", price: "$", strengths: "Long context", note: "Huge context window" },
  { name: "Mistral Large", provider: "Mistral", price: "$", strengths: "Efficient reasoning", note: "Great value" },
  { name: "Local / BYO Model", provider: "Custom", price: "$0 infra", strengths: "Privacy", note: "Bring your own endpoint" },
];

const governanceModes = [
  {
    key: "safe",
    title: "Safe Mode",
    can: "Can execute low-risk tasks with approval flows.",
    blocks: "Blocks high-impact actions without explicit user confirmation.",
    escalation: "Escalates on anomalies + policy violations.",
  },
  {
    key: "business",
    title: "Business Mode",
    can: "Can run business workflows and scheduled actions.",
    blocks: "Blocks high-risk financial and security actions.",
    escalation: "Escalates to your team and the audit log.",
  },
  {
    key: "autonomy",
    title: "Autonomy Mode (24/7)",
    can: "Can execute end-to-end workflows continuously.",
    blocks: "Blocks disallowed intent patterns and unsafe tools.",
    escalation: "Escalates only on critical violations.",
  },
  {
    key: "custom",
    title: "Custom / Advanced",
    can: "Define custom guardrails and tool allowlists.",
    blocks: "Blocks based on your custom policy packs.",
    escalation: "Custom escalation routing.",
  },
];

const channelOptions = [
  "Slack",
  "Email",
  "API",
  "Discord",
  "Telegram",
  "WhatsApp",
  "WebChat",
];

const exampleCommands = [
  "Manage your calendar",
  "Book meetings",
  "Research competitors",
  "Book a flight",
  "Research real estate opportunities",
  "Analyze reports & generate insights",
];

export default function Quickstart() {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState("Claude Sonnet");
  const [modelRows, setModelRows] = useState(baseModels);
  const [llmTokenType, setLlmTokenType] = useState<"oauth" | "apikey" | "local">("oauth");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [agentToken, setAgentToken] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");
  const [primaryChannel, setPrimaryChannel] = useState("Slack");
  const [channelToggles, setChannelToggles] = useState<Record<string, boolean>>({
    Slack: true,
    Email: false,
    API: true,
    Discord: false,
    Telegram: false,
    WhatsApp: false,
    WebChat: false,
  });
  const [mode, setMode] = useState("safe");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const selectedProvider = useMemo(() => {
    const model = modelRows.find((item) => item.name === selectedModel);
    return model?.provider || "Custom";
  }, [selectedModel, modelRows]);

  const providerLinks: Record<string, string> = {
    Anthropic: "https://console.anthropic.com/settings/keys",
    OpenAI: "https://platform.openai.com/api-keys",
    Google: "https://aistudio.google.com/app/apikey",
    Mistral: "https://console.mistral.ai/api-keys",
  };

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    if (typeof window === "undefined") return;
    const savedModel = localStorage.getItem("edon_llm_model");
    const savedKey = localStorage.getItem("edon_llm_api_key");
    const savedAgent = localStorage.getItem("edon_agent_token");
    const storedList = localStorage.getItem("edon_llm_list");
    if (storedList) {
      try {
        const parsed = JSON.parse(storedList) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped = parsed.map((name) => baseModels.find((row) => row.name === name) || {
            name,
            provider: "Custom",
            price: "$",
            strengths: "Custom model",
            note: "Managed list",
          });
          setModelRows(mapped);
          if (!parsed.includes(selectedModel)) {
            setSelectedModel(mapped[0].name);
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Failed to parse stored LLM list", error);
        }
      }
    }
    if (savedModel) setSelectedModel(savedModel);
    if (savedKey) setLlmApiKey(savedKey);
    if (savedAgent) setAgentToken(savedAgent);
    initRef.current = true;
  }, [selectedModel]);

  const copyValue = async (label: string, value: string) => {
    if (!value) {
      toast({ title: "Nothing to copy", description: `${label} is empty.` });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard permissions are blocked.", variant: "destructive" });
    }
  };

  const generateAgentToken = () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    setAgentToken(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("edon_agent_token", token);
    }
    toast({ title: "Agent key created", description: "Save and copy your key." });
  };

  const saveLlmKey = () => {
    if (llmTokenType === "apikey" && llmApiKey.trim().length < 12) {
      toast({ title: "Invalid API key", description: "Paste a valid provider API key.", variant: "destructive" });
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("edon_llm_model", selectedModel);
      localStorage.setItem("edon_llm_provider", selectedProvider);
      localStorage.setItem("edon_llm_api_key", llmApiKey.trim());
    }
    toast({ title: "LLM settings saved", description: "Your LLM provider details are saved." });
  };

  const connectedChannels = Object.entries(channelToggles)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);

  const sendToChat = (message: string) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("edon-chat-open"));
    window.dispatchEvent(new CustomEvent("edon-chat-command", { detail: { message } }));
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="container mx-auto px-6 py-10 space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">EDON Quickstart Flow</p>
          <h1 className="text-3xl font-semibold mt-2">Go live in five steps</h1>
          <p className="text-sm text-muted-foreground max-w-3xl mt-2">
            Configure your model, access keys, channels, and safety mode. Everything you choose is enforced the same way by EDON.
          </p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-foreground/80">
                1
              </span>
              Pick Your AI Model
            </CardTitle>
            <CardDescription>Select the model you want to run. Change later in Settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-5 gap-4 text-xs uppercase tracking-widest text-muted-foreground px-4">
              <div>Model</div>
              <div>Provider</div>
              <div>Pricing</div>
              <div className="col-span-2">Strengths</div>
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              {modelRows.map((item) => (
                <div
                  key={item.name}
                  className={`grid grid-cols-5 gap-4 px-4 py-3 text-sm border-b border-white/5 ${
                    selectedModel === item.name ? "bg-white/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{item.name}</span>
                  </div>
                  <div className="text-muted-foreground">{item.provider}</div>
                  <div className="text-muted-foreground">{item.price}</div>
                  <div className="col-span-2 flex items-center justify-between gap-4 text-muted-foreground">
                    <span>{item.strengths} · {item.note}</span>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedModel(item.name)}>
                      {selectedModel === item.name ? "Selected" : "Choose"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-foreground/80">
                2
              </span>
              Add Access Keys
            </CardTitle>
            <CardDescription>
              EDON needs secure credentials to operate your agent safely. Access keys are stored locally and only used according to your safety policies.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid lg:grid-cols-2 gap-6 text-sm">
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                    <div>
                      <p className="font-medium">LLM Access Key (Your AI Brain)</p>
                      <p className="text-xs text-muted-foreground">
                        Choose how EDON connects to your AI model. OAuth is easiest and safest.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-muted-foreground">
                    {llmTokenType === "oauth" ? "OAuth" : llmTokenType === "apikey" ? "API Key" : "Local"}
                  </Badge>
                </div>

                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={llmTokenType === "oauth" ? "default" : "outline"} onClick={() => setLlmTokenType("oauth")}>
                      OAuth (recommended)
                    </Button>
                    <Button size="sm" variant={llmTokenType === "apikey" ? "default" : "outline"} onClick={() => setLlmTokenType("apikey")}>
                      API Key
                    </Button>
                    <Button size="sm" variant={llmTokenType === "local" ? "default" : "outline"} onClick={() => setLlmTokenType("local")}>
                      Local Model
                    </Button>
                  </div>

                  {llmTokenType === "oauth" && (
                    <div className="grid gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                        <span>Sign in securely with your AI provider. No keys to paste, credits auto-applied.</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => toast({ title: "OAuth flow", description: "OAuth is configured in Settings." })}>
                          Connect via OAuth
                        </Button>
                        {providerLinks[selectedProvider] && (
                          <a href={providerLinks[selectedProvider]} target="_blank" rel="noreferrer">
                            <Button size="sm" className="bg-white/10 hover:bg-white/20 text-foreground border border-white/10">
                              Get provider credits
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {llmTokenType === "apikey" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Link2 className="h-3.5 w-3.5 text-cyan-300" />
                        <span>Paste your existing provider API key.</span>
                      </div>
                      <Input
                        value={llmApiKey}
                        onChange={(e) => setLlmApiKey(e.target.value)}
                        placeholder="Input key here"
                        className="bg-secondary/50"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={saveLlmKey}>Save LLM Key</Button>
                        <Button size="sm" variant="ghost" onClick={() => copyValue("LLM API key", llmApiKey)}>
                          <Copy className="h-3 w-3 mr-1" /> Copy
                        </Button>
                        {providerLinks[selectedProvider] && (
                          <a href={providerLinks[selectedProvider]} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost">Get API key</Button>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {llmTokenType === "local" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Cpu className="h-3.5 w-3.5 text-purple-300" />
                      <span>Use a model running on your machine for full privacy. Connect local endpoint in Settings.</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>This key lets EDON connect to your AI model to process commands. EDON cannot use it outside your policies.</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-emerald-300" />
                    <span className="font-medium">Agent Access Key (Required)</span>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-muted-foreground">Required</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  This key lets EDON control your agent safely and locally.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={generateAgentToken}>Generate Secure Key</Button>
                  <Button size="sm" variant="ghost" onClick={() => copyValue("Agent access key", agentToken)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
                <Input value={agentToken} readOnly placeholder="Generated key appears here" className="bg-secondary/50" />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Stored locally in your browser/session. Revocable anytime. Needed for EDON to execute tasks safely.</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <span className="font-medium">Optional Connection Key (Advanced)</span>
                  <ChevronDown className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Advanced integration for multi-agent environments. Leave empty if unsure.
                  </p>
                  <Input
                    value={gatewayToken}
                    onChange={(e) => setGatewayToken(e.target.value)}
                    placeholder="Paste connection key"
                    className="bg-secondary/50"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyValue("Connection key", gatewayToken)}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Only needed if you want EDON to connect to external agent frameworks or multi-agent pipelines.</span>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
                Access keys are stored locally for this browser session only.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-foreground/80">
                3
              </span>
              Connect a Channel
            </CardTitle>
            <CardDescription>All channels governed the same way. One brain. One policy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid md:grid-cols-[1fr_2fr] gap-6">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Primary channel</p>
                <Select value={primaryChannel} onValueChange={setPrimaryChannel}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channelOptions.map((channel) => (
                      <SelectItem key={channel} value={channel}>{channel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">You can enable multiple channels.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {channelOptions.map((channel) => (
                  <div key={channel} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <span>{channel}</span>
                    <Switch
                      checked={channelToggles[channel]}
                      onCheckedChange={(checked) =>
                        setChannelToggles((prev) => ({ ...prev, [channel]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Slack</p>
                <p className="text-sm text-muted-foreground">Connect your workspace and slash commands.</p>
                <Button size="sm" variant="outline" onClick={() => toast({ title: "Slack setup", description: "OAuth flow opens in Settings." })}>
                  Connect Slack
                </Button>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">API</p>
                <p className="text-sm text-muted-foreground">Use the agent access key for API calls.</p>
                <Button size="sm" variant="ghost" onClick={() => copyValue("Agent access key", agentToken)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy key
                </Button>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Email</p>
                <p className="text-sm text-muted-foreground">Forward commands to your agent inbox.</p>
                <Button size="sm" variant="outline" onClick={() => toast({ title: "Email setup", description: "Email channel configuration is in Settings." })}>
                  Configure Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-foreground/80">
                4
              </span>
              Choose Safety Mode
            </CardTitle>
            <CardDescription>Each mode defines what EDON can do, what it blocks, and how it escalates.</CardDescription>
          </CardHeader>
          <CardContent className="grid lg:grid-cols-2 gap-4 text-sm">
            {governanceModes.map((modeItem) => (
              <button
                type="button"
                key={modeItem.key}
                onClick={() => setMode(modeItem.key)}
                className={`text-left rounded-lg border p-4 transition ${
                  mode === modeItem.key ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{modeItem.title}</span>
                  {mode === modeItem.key && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Selected</Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-2"><span className="text-foreground/90">Can:</span> {modeItem.can}</p>
                <p className="text-muted-foreground mt-2"><span className="text-foreground/90">EDON blocks:</span> {modeItem.blocks}</p>
                <p className="text-muted-foreground mt-2"><span className="text-foreground/90">Escalation:</span> {modeItem.escalation}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-foreground/80">
                5
              </span>
              Send a Sample Command
            </CardTitle>
            <CardDescription>One-click send + example prompts to confirm end-to-end.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid md:grid-cols-2 gap-3">
              {exampleCommands.map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => sendToChat(command)}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-muted-foreground transition hover:text-foreground hover:border-white/20"
                >
                  {command}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Model, access keys, channels, and safety mode in one view.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Model</p>
              <p className="mt-2">{selectedModel} · {selectedProvider}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Access Keys</p>
              <p className="mt-2">LLM key: {llmTokenType === "apikey" && llmApiKey ? "Saved" : llmTokenType === "oauth" ? "OAuth" : "Local"}</p>
              <p className="text-muted-foreground">Agent key: {agentToken ? "Generated" : "Not set"}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Channels</p>
              <p className="mt-2">{connectedChannels.length ? connectedChannels.join(", ") : "None connected"}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Safety</p>
              <p className="mt-2">{governanceModes.find((item) => item.key === mode)?.title}</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
