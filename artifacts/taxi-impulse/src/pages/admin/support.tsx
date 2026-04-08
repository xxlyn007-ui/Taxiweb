import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Send, Headphones, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SupportMessage {
  id: number;
  userId: number;
  userRole: string;
  message: string;
  isFromSupport: boolean;
  createdAt: string;
}

function groupByUser(messages: SupportMessage[]) {
  const map = new Map<number, SupportMessage[]>();
  for (const m of messages) {
    if (!map.has(m.userId)) map.set(m.userId, []);
    map.get(m.userId)!.push(m);
  }
  return map;
}

export default function AdminSupport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  const { data: allMessages = [], isLoading } = useQuery<SupportMessage[]>({
    queryKey: ['admin-support-messages'],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/support/messages`, { headers });
      if (!r.ok) throw new Error('error');
      return r.json();
    },
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const r = await fetch(`${BASE}/api/support/messages`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, userRole: 'admin', message, isFromSupport: true }),
      });
      if (!r.ok) throw new Error('error');
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-support-messages'] });
      setReply("");
    },
    onError: () => toast({ title: "Ошибка отправки", variant: "destructive" }),
  });

  const userGroups = groupByUser(allMessages);

  const conversations = Array.from(userGroups.entries())
    .map(([userId, msgs]) => ({
      userId,
      role: msgs[0]?.userRole === 'admin' ? (msgs.find(m => !m.isFromSupport)?.userRole || 'user') : msgs[0]?.userRole,
      lastMessage: msgs[msgs.length - 1],
      unread: msgs.filter(m => !m.isFromSupport).length,
    }))
    .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());

  const selectedMessages = selectedUserId
    ? (userGroups.get(selectedUserId) || []).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedMessages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !selectedUserId) return;
    sendMutation.mutate(reply.trim());
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
  };

  const roleLabel = (role: string) => {
    if (role === 'passenger') return 'Пассажир';
    if (role === 'driver') return 'Водитель';
    return 'Пользователь';
  };

  return (
    <MainLayout allowedRoles={['admin']}>
      <div className="flex h-[calc(100vh-4rem)] -mt-6 -mx-4 overflow-hidden">

        {/* Conversations list */}
        <div className="w-72 border-r border-white/[0.06] flex flex-col bg-[#07070f] shrink-0">
          <div className="px-4 py-4 border-b border-white/[0.06]">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Headphones className="w-4 h-4 text-violet-400" /> Техподдержка
            </h2>
            <p className="text-xs text-white/30 mt-0.5">{conversations.length} диалогов</p>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {isLoading ? (
              <div className="p-4 text-center text-white/30 text-sm">Загрузка...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-white/20 text-sm">Нет обращений</div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.userId}
                  onClick={() => setSelectedUserId(conv.userId)}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-all border-b border-white/[0.04]",
                    selectedUserId === conv.userId
                      ? "bg-violet-600/15 border-l-2 border-l-violet-500"
                      : "hover:bg-white/[0.03]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                      conv.role === 'driver' ? "bg-amber-500/15" : "bg-violet-500/15"
                    )}>
                      <User className={cn("w-4 h-4", conv.role === 'driver' ? "text-amber-400" : "text-violet-400")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-semibold text-white/70">{roleLabel(conv.role)} #{conv.userId}</span>
                        <span className="text-[10px] text-white/30">{formatDate(conv.lastMessage.createdAt)}</span>
                      </div>
                      <p className="text-xs text-white/40 truncate">{conv.lastMessage.message}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-[#07070f]">
          {selectedUserId ? (
            <>
              {/* Chat header */}
              <div className="px-6 py-3 border-b border-white/[0.06] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {roleLabel(userGroups.get(selectedUserId)?.[0]?.userRole || '')} #{selectedUserId}
                  </div>
                  <div className="text-xs text-white/30">{selectedMessages.length} сообщений</div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {selectedMessages.map(msg => (
                  <div key={msg.id} className={cn("flex", msg.isFromSupport ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[75%] px-4 py-2.5 rounded-2xl",
                      msg.isFromSupport
                        ? "bg-violet-600 text-white rounded-br-sm"
                        : "bg-white/[0.07] text-white/80 rounded-bl-sm"
                    )}>
                      <p className="text-sm leading-relaxed">{msg.message}</p>
                      <p className={cn("text-[10px] mt-1", msg.isFromSupport ? "text-violet-200/60" : "text-white/30")}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Reply input */}
              <form onSubmit={handleSend} className="px-6 py-4 border-t border-white/[0.06]">
                <div className="flex gap-3">
                  <input
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Ответить пользователю..."
                    className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!reply.trim() || sendMutation.isPending}
                    className="w-12 h-12 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 flex items-center justify-center transition-all"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-violet-600/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-violet-400/50" />
              </div>
              <p className="text-white/30 text-sm">Выберите диалог слева</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
