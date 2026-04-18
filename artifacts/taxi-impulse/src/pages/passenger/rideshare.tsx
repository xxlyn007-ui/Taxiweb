import { useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuth } from "@/hooks/use-auth";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useCitiesQuery } from "@/hooks/use-admin";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Car, MapPin, Users, Calendar, Phone, Search, X, MessageSquare, Send, ArrowLeft } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function useRideshares(fromCity?: string, toCity?: string) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/rideshares", "list", fromCity, toCity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromCity) params.set("fromCity", fromCity);
      if (toCity) params.set("toCity", toCity);
      const r = await fetch(`${BASE}/api/rideshares?${params}`, { headers: authHeaders.headers });
      if (!r.ok) throw new Error("Ошибка");
      return r.json();
    },
    refetchInterval: 20000,
  });
}

function useMyChats(userId?: number) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/rideshares/my-chats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/rideshares/my-chats?userId=${userId}`, { headers: authHeaders.headers });
      if (!r.ok) throw new Error("Ошибка");
      return r.json();
    },
    refetchInterval: 15000,
  });
}

function useRideshareMessages(rideshareId?: number) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/rideshares/messages", rideshareId],
    enabled: !!rideshareId,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/rideshares/${rideshareId}/messages`, { headers: authHeaders.headers });
      if (!r.ok) throw new Error("Ошибка");
      return r.json();
    },
    refetchInterval: 3000,
  });
}

function useSendMessage(rideshareId?: number) {
  const authHeaders = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ senderId, message }: { senderId: number; message: string }) => {
      const r = await fetch(`${BASE}/api/rideshares/${rideshareId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders.headers },
        body: JSON.stringify({ senderId, message }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Ошибка"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rideshares/messages", rideshareId] });
      qc.invalidateQueries({ queryKey: ["/api/rideshares/my-chats"] });
    },
  });
}

function RideChat({ ride, userId, onClose }: { ride: any; userId: number; onClose: () => void }) {
  const [text, setText] = useState("");
  const { data: messages = [], isLoading } = useRideshareMessages(ride.id);
  const sendMessage = useSendMessage(ride.id);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sendMessage.isPending) return;
    setText("");
    try {
      await sendMessage.mutateAsync({ senderId: userId, message: trimmed });
    } catch (e: any) {
      setText(trimmed);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#07070f]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08] bg-[#0d0d1f]">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/10 transition-all shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-white/60" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {ride.fromCity} → {ride.toCity}
          </div>
          <div className="text-xs text-white/40 truncate">
            Водитель: {ride.driverName || "—"}
            {ride.driverRating ? ` · ★ ${ride.driverRating}` : ""}
          </div>
        </div>
        {ride.driverPhone && (
          <a
            href={`tel:${ride.driverPhone}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-sm font-medium transition-all shrink-0"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">Позвонить</span>
          </a>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center pt-8">
            <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (messages as any[]).length === 0 ? (
          <div className="text-center text-white/30 text-sm pt-12">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
            Напишите сообщение водителю
          </div>
        ) : (
          (messages as any[]).map((msg: any) => {
            const isMe = msg.senderId === userId;
            return (
              <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2.5",
                  isMe
                    ? "bg-violet-600 text-white rounded-br-sm"
                    : "bg-white/[0.07] text-white/90 rounded-bl-sm"
                )}>
                  {!isMe && (
                    <div className="text-xs font-semibold text-violet-300 mb-0.5">{msg.senderName}</div>
                  )}
                  <div className="text-sm leading-relaxed">{msg.message}</div>
                  <div className={cn("text-xs mt-1 text-right", isMe ? "text-white/50" : "text-white/30")}>
                    {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-white/[0.08] bg-[#0d0d1f]">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Сообщение водителю..."
            rows={1}
            className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none max-h-28 overflow-y-auto"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-all shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PassengerRidesharePage() {
  const { user } = useAuth();
  const { data: cities } = useCitiesQuery();
  const cityList = Array.isArray(cities) ? cities.map((c: any) => c.name).filter(Boolean) : [];

  const [tab, setTab] = useState<"search" | "chats">("search");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [openChat, setOpenChat] = useState<any>(null);

  const { data: rideshares, isLoading, refetch } = useRideshares(
    fromCity || undefined,
    toCity || undefined
  );
  const { data: myChats = [], isLoading: chatsLoading } = useMyChats(user?.id);

  // Исправленный фильтр: departureDate + departureTime (отдельные поля)
  const availableRides = Array.isArray(rideshares)
    ? rideshares.filter((r: any) => {
        if (fromCity && r.fromCity !== fromCity) return false;
        if (toCity && r.toCity !== toCity) return false;
        return true;
      })
    : [];

  if (openChat) {
    return <RideChat ride={openChat} userId={user!.id} onClose={() => setOpenChat(null)} />;
  }

  return (
    <MainLayout allowedRoles={["passenger"]}>
      <div className="max-w-2xl mx-auto space-y-4 pb-8">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Car className="w-5 h-5 text-violet-400" /> Попутки
          </h1>
          <p className="text-sm text-white/40 mt-0.5">Найдите попутчика для межгородской поездки</p>
        </div>

        <div className="flex gap-1 bg-white/[0.04] rounded-2xl p-1">
          <button
            onClick={() => setTab("search")}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-medium transition-all",
              tab === "search" ? "bg-violet-600 text-white" : "text-white/40 hover:text-white/70"
            )}
          >
            Найти попутку
          </button>
          <button
            onClick={() => setTab("chats")}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5",
              tab === "chats" ? "bg-violet-600 text-white" : "text-white/40 hover:text-white/70"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Мои чаты
            {(myChats as any[]).length > 0 && (
              <span className={cn(
                "w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold",
                tab === "chats" ? "bg-white/20 text-white" : "bg-violet-600 text-white"
              )}>
                {(myChats as any[]).length}
              </span>
            )}
          </button>
        </div>

        {tab === "search" && (
          <>
            <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Откуда</label>
                  <select
                    value={fromCity}
                    onChange={e => setFromCity(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  >
                    <option value="">Все города</option>
                    {cityList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Куда</label>
                  <select
                    value={toCity}
                    onChange={e => setToCity(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  >
                    <option value="">Все города</option>
                    {cityList.filter(c => c !== fromCity).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={() => refetch()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-sm font-medium transition-all"
              >
                <Search className="w-4 h-4" /> Найти попутки
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : availableRides.length === 0 ? (
              <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-3xl p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-violet-600/10 flex items-center justify-center mx-auto mb-4">
                  <Car className="w-7 h-7 text-violet-400/50" />
                </div>
                <p className="text-white/40 font-medium">Попуток не найдено</p>
                <p className="text-white/20 text-sm mt-1.5">Попробуйте изменить маршрут или зайти позже</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableRides.map((ride: any) => {
                  const dep = ride.departureDate && ride.departureTime
                    ? new Date(`${ride.departureDate}T${ride.departureTime}`)
                    : null;
                  return (
                    <div key={ride.id} className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4 hover:border-violet-500/20 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <MapPin className="w-3.5 h-3.5 text-violet-400" />
                          {ride.fromCity} → {ride.toCity}
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold text-violet-400">{formatMoney(ride.price)}</div>
                          <div className="text-xs text-white/30">за место</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                        <div>
                          <div className="text-xs text-white/30 mb-0.5">Откуда</div>
                          <div className="text-white/70 text-xs">{ride.fromAddress}</div>
                        </div>
                        <div>
                          <div className="text-xs text-white/30 mb-0.5">Куда</div>
                          <div className="text-white/70 text-xs">{ride.toAddress}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-white/50 mb-3">
                        {dep && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {dep.toLocaleDateString("ru-RU")} {dep.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                        {!dep && ride.departureDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {ride.departureDate} {ride.departureTime}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {ride.seatsTotal} мест
                        </div>
                        {ride.driverName && (
                          <div className="flex items-center gap-1 ml-auto">
                            <span className="text-white/60">{ride.driverName}</span>
                            {ride.driverRating && (
                              <span className="text-amber-400">★ {ride.driverRating}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {ride.description && (
                        <div className="mb-3 text-xs text-white/30 bg-white/[0.03] rounded-xl px-3 py-2">{ride.description}</div>
                      )}

                      <div className="flex gap-2">
                        {ride.driverPhone && (
                          <a
                            href={`tel:${ride.driverPhone}`}
                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm transition-all"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => { setOpenChat(ride); setTab("chats"); }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Написать водителю
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "chats" && (
          <>
            {chatsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (myChats as any[]).length === 0 ? (
              <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-3xl p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-violet-600/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-7 h-7 text-violet-400/50" />
                </div>
                <p className="text-white/40 font-medium">Нет чатов</p>
                <p className="text-white/20 text-sm mt-1.5">Напишите водителю попутки — разговор появится здесь</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(myChats as any[]).map((ride: any) => {
                  const dep = ride.departureDate && ride.departureTime
                    ? new Date(`${ride.departureDate}T${ride.departureTime}`)
                    : null;
                  return (
                    <button
                      key={ride.id}
                      onClick={() => setOpenChat(ride)}
                      className="w-full bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4 text-left hover:border-violet-500/20 transition-all"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <MapPin className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                          {ride.fromCity} → {ride.toCity}
                        </div>
                        <MessageSquare className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/40">
                        <span>{ride.driverName || "Водитель"}</span>
                        {dep && (
                          <span>· {dep.toLocaleDateString("ru-RU")} {dep.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                        <span className="ml-auto font-semibold text-violet-400">{formatMoney(ride.price)}/чел</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
