import { useState, useRef, useEffect } from "react";
import { X, Send, Headphones, Loader2 } from "lucide-react";
import { useSupportMessages, useSendSupportMessageMutation } from "@/hooks/use-support";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface SupportChatProps {
  onClose: () => void;
}

export function SupportChat({ onClose }: SupportChatProps) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useSupportMessages(user?.id ?? null);
  const sendMsg = useSendSupportMessageMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    try {
      await sendMsg.mutateAsync({
        data: {
          userId: user.id,
          userRole: user.role,
          message: text.trim(),
          isFromSupport: false,
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#0f0f1e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-violet-600/20 flex items-center justify-center">
              <Headphones className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">Техподдержка</div>
              <div className="text-xs text-emerald-400 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Онлайн
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center pt-8">
              <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
            </div>
          ) : (
            <>
              <div className="flex justify-start">
                <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
                  <div className="text-xs text-violet-400 mb-1">Поддержка TAXI IMPULSE</div>
                  <p className="text-sm text-white/90">Привет! Чем можем помочь? Опишите вашу проблему и мы ответим в ближайшее время.</p>
                </div>
              </div>

              {messages?.map((msg) => {
                const isMe = !msg.isFromSupport;
                return (
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5",
                      isMe
                        ? "bg-violet-600 text-white rounded-tr-sm"
                        : "bg-white/[0.06] text-white/90 rounded-tl-sm"
                    )}>
                      {!isMe && (
                        <div className="text-xs text-violet-400 mb-1">Поддержка</div>
                      )}
                      <p className="text-sm leading-relaxed">{msg.message}</p>
                      <div className={cn("text-xs mt-1", isMe ? "text-violet-200/60" : "text-white/30")}>
                        {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 bg-white/[0.04] rounded-2xl px-4 py-2 border border-white/[0.06]">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Напишите сообщение..."
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
