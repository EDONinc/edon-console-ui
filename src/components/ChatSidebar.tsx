import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, GripVertical, ImagePlus, Send, Plus } from "lucide-react";
import { edonApi, isMockMode, getToken } from "@/lib/api";
import {
  fetchDashboardContext,
  getDashboardAwareReply,
  dashboardContextToPromptText,
  type DashboardContext,
} from "@/lib/dashboardContext";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatThread = {
  id: string;
  title: string;
  messages: Message[];
};

const WIDTH_KEY = "edon_chat_sidebar_width";

export function ChatSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (next: boolean) => void }) {
  const [width, setWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([
    { id: "chat-1", title: "New chat", messages: [] },
  ]);
  const [activeThreadId, setActiveThreadId] = useState("chat-1");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const startX = useRef(0);
  const startWidth = useRef(420);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(WIDTH_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (!Number.isNaN(parsed)) setWidth(parsed);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(WIDTH_KEY, String(width));
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (event: MouseEvent) => {
      const delta = startX.current - event.clientX;
      const next = Math.min(720, Math.max(320, startWidth.current + delta));
      setWidth(next);
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isResizing]);

  const handleResizeStart = (event: React.MouseEvent) => {
    startX.current = event.clientX;
    startWidth.current = width;
    setIsResizing(true);
  };

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || threads[0],
    [threads, activeThreadId]
  );

  const appendMessages = useCallback((threadId: string, items: Message[]) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, title: thread.title || "Chat", messages: [...thread.messages, ...items] } : thread
      )
    );
  }, []);

  const updateMessage = useCallback((threadId: string, messageId: string, content: string) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId
          ? { ...thread, messages: thread.messages.map((msg) => (msg.id === messageId ? { ...msg, content } : msg)) }
          : thread
      )
    );
  }, []);

  const sendMessage = useCallback(async (content: string, source: "user" | "quickstart") => {
    const threadId = activeThreadId;
    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now() + 1}`;
    appendMessages(threadId, [
      { id: userId, role: "user", content },
      { id: assistantId, role: "assistant", content: "Loading dashboard data..." },
    ]);

    let dashboardContext: DashboardContext;
    try {
      dashboardContext = await fetchDashboardContext();
    } catch {
      dashboardContext = {
        fetched_at: new Date().toISOString(),
        metrics: {},
        health: null,
        recent_decisions: [],
        recent_audit: [],
        block_reasons: [],
        policy_packs: [],
      };
    }

    updateMessage(threadId, assistantId, "Processing with safety checks...");

    if (isMockMode() || !getToken()) {
      const reply = getDashboardAwareReply(content, dashboardContext);
      updateMessage(threadId, assistantId, reply);
      return;
    }

    try {
      const toolName = localStorage.getItem("edon_chat_tool") || "chat";
      const toolAction = localStorage.getItem("edon_chat_action") || "json";
      const credentialId = (localStorage.getItem("edon_chat_credential_id") || "").trim();
      const response = await edonApi.invokeClawdbot({
        tool: toolName,
        action: toolAction,
        args: {
          prompt: content,
          dashboard_context: dashboardContext,
          dashboard_context_text: dashboardContextToPromptText(dashboardContext),
        },
        credential_id: credentialId || undefined,
      });
      if (response.ok) {
        const rawResult = response.result;
        let resultText = "OK";
        if (typeof rawResult === "string") {
          resultText = rawResult;
        } else if (rawResult && typeof rawResult === "object") {
          const resultObj = rawResult as Record<string, unknown>;
          const textValue = resultObj.text;
          const contentValue = resultObj.content;
          if (typeof textValue === "string") {
            resultText = textValue;
          } else if (typeof contentValue === "string") {
            resultText = contentValue;
          } else {
            resultText = JSON.stringify(rawResult, null, 2);
          }
        }
        updateMessage(threadId, assistantId, resultText);
      } else {
        const fallback = getDashboardAwareReply(content, dashboardContext);
        updateMessage(
          threadId,
          assistantId,
          `${response.error || "Gateway returned an error."}\n\n— From your dashboard: ${fallback}`
        );
      }
    } catch (error: unknown) {
      const fallback = getDashboardAwareReply(content, dashboardContext);
      const message = error instanceof Error ? error.message : "Request failed.";
      updateMessage(threadId, assistantId, `${message}\n\n— From your dashboard: ${fallback}`);
    }
  }, [activeThreadId, appendMessages, updateMessage]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    sendMessage(trimmed, "user");
  };

  const handleNewChat = () => {
    const id = `chat-${Date.now()}`;
    const nextThread = { id, title: "Untitled chat", messages: [] };
    setThreads((prev) => [nextThread, ...prev]);
    setActiveThreadId(id);
  };

  const handleCloseChat = (id: string) => {
    setThreads((prev) => {
      const next = prev.filter((thread) => thread.id !== id);
      if (next.length === 0) {
        const fallback = { id: `chat-${Date.now()}`, title: "New chat", messages: [] };
        setActiveThreadId(fallback.id);
        return [fallback];
      }
      if (activeThreadId === id) {
        setActiveThreadId(next[0].id);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      const command = detail?.message?.trim();
      if (!command) return;
      sendMessage(command, "quickstart");
    };
    window.addEventListener("edon-chat-command", handleCommand as EventListener);
    return () => window.removeEventListener("edon-chat-command", handleCommand as EventListener);
  }, [sendMessage]);

  const selectedFiles = useMemo(() => files.map((file) => file.name), [files]);

  return (
    <aside
      className={`fixed right-0 top-0 z-50 h-screen transition-transform duration-200 ${
        open ? "translate-x-0" : "translate-x-full pointer-events-none"
      }`}
      style={{ width }}
    >
      <div className="h-full border-l border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col relative">
        <div
          className="absolute left-0 top-0 h-full w-3 cursor-col-resize"
          onMouseDown={handleResizeStart}
          role="presentation"
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex h-10 w-3 items-center justify-center text-muted-foreground/70">
            <GripVertical className="h-4 w-4" />
          </div>
        </div>

        <div className="border-b border-white/10 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Chats</p>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleNewChat}>
                <Plus className="h-3 w-3 mr-1" />
                New
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setActiveThreadId(thread.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition flex items-center gap-2 ${
                  activeThreadId === thread.id
                    ? "border-primary/30 bg-primary/10 text-foreground"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="max-w-[140px] truncate">{thread.title || "Untitled chat"}</span>
                <span
                  role="button"
                  className="text-[10px] leading-none opacity-60 hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCloseChat(thread.id);
                  }}
                >
                  ×
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Badge variant="outline" className="border-white/10 text-muted-foreground">Governed</Badge>
            <Badge variant="outline" className="border-white/10 text-muted-foreground">Safety enforced</Badge>
            <Badge variant="outline" className="border-white/10 text-muted-foreground">Audit logged</Badge>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-4">
            {(activeThread?.messages.length || 0) === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
                Start a conversation to route tasks through safety checks. You can upload images anytime.
              </div>
            ) : (
              activeThread?.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg px-4 py-3 text-xs ${
                    msg.role === "user"
                      ? "bg-primary/15 text-foreground border border-primary/20"
                      : "bg-white/5 text-muted-foreground border border-white/10"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    {msg.role === "user" ? "You" : "EDON"}
                  </p>
                  {msg.content}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-white/10 px-4 py-3 space-y-3">
          {selectedFiles.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              Attached: {selectedFiles.join(", ")}
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              <ImagePlus className="h-3.5 w-3.5" />
              Upload images
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask away..."
              className="bg-secondary/50 text-xs h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button size="icon" className="h-9 w-9" onClick={handleSend}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
