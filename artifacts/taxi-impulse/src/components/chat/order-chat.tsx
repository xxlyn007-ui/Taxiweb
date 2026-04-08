import { useState, useRef, useEffect } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import { useChatMessages, useSendMessageMutation } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface OrderChatProps {
  orderId: number;
  onClose: () => void;
}

export function OrderChat({ orderId, onClose }: OrderChatProps) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useChatMessages(orderId);
  const sendMsg = useSendMessageMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    try {
      await sendMsg.mutateAsync({
        orderId,
        data: {
          senderId: user.id,
          senderRole: user.role as "passenger" | "driver",
          message: text.trim(),
        }
      });
      setText("");
    } catch {}
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0d0d1a] border border-white/10 rounded-t-3xl md:rounded-3xl overflow-hidden flex flex-col"
        style={{ height: "80vh", maxHeight: "600px" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-violet-400" />
            <span className="font-semibold text-white">Чат с водителем</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!messages || messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center mb-3">
                <MessageCircle className="w-6 h-6 text-violet-400" />
              </div>
              <p className="text-white/40 text-sm">Нет сообщений. Напишите первым!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5",
                    isMe
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-white/[0.06] text-white/90 rounded-tl-sm"
                  )}>
                    {!isMe && (
                      <div className="text-xs text-white/40 mb-1">{msg.senderName}</div>
                    )}
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                    <div className={cn("text-xs mt-1", isMe ? "text-violet-200/60" : "text-white/30")}>
                      {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 bg-white/[0.04] rounded-2xl px-4 py-2 border border-white/[0.06]">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Написать сообщение..."
              className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sendMsg.isPending}
              className="w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-30 flex items-center justify-center transition-all flex-shrink-0"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
