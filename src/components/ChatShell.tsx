import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatTrigger } from "@/components/ChatTrigger";

/**
 * Renders the global chat sidebar and trigger (button + bottom bar).
 * Listens for "edon-chat-open" to open the panel from anywhere (e.g. Quickstart).
 */
export function ChatShell() {
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setChatOpen(true);
    window.addEventListener("edon-chat-open", handleOpen);
    return () => window.removeEventListener("edon-chat-open", handleOpen);
  }, []);

  const showTrigger =
    location.pathname !== "/settings" && location.pathname !== "/quickstart";

  return (
    <>
      <ChatSidebar open={chatOpen} onOpenChange={setChatOpen} />
      <ChatTrigger onOpen={() => setChatOpen(true)} visible={showTrigger} />
    </>
  );
}
