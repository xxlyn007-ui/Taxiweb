import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuth } from "@/hooks/use-auth";
import { useAuthHeaders } from "@/hooks/use-auth";
import { useDriversQuery } from "@/hooks/use-drivers";
import { useCitiesQuery } from "@/hooks/use-admin";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Plus, Car, MapPin, Users, Trash2, X, Calendar, AlertCircle, CheckCircle, CreditCard, MessageSquare, Send, ArrowLeft, Phone } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function useMyRideshares(driverId?: number) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/rideshares", "my", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/rideshares/my?driverId=${driverId}`, { headers: authHeaders.headers });
      if (!r.ok) throw new Error("Ошибка загрузки");
      return r.json();
    },
    refetchInterval: 10000,
  });
}

function useCreateRideshareMutation() {
  const authHeaders = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`${BASE}/api/rideshares`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders.headers },
        body: JSON.stringify(data),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Ошибка"); }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/rideshares"] }),
  });
}

function useDeleteRideshareMutation() {
  const authHeaders = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/rideshares/${id}`, {
        method: "DELETE",
        headers: authHeaders.headers,
      });
      if (!r.ok) throw new Error("Ошибка");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/rideshares"] }),
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
    },
  });
}

function useRideshareMessagesCount(driverId?: number) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/rideshares/messages-count", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/rideshares/messages-count?driverId=${driverId}`, { headers: authHeaders.headers });
      if (!r.ok) return {} as Record<number, number>;
      return r.json() as Promise<Record<number, number>>;
    },
    refetchInterval: 20000,
  });
}

function DriverChat({ ride, userId, onClose }: { ride: any; userId: number; onClose: () => void }) {
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
    } catch {
      setText(trimmed);
    }
  };

  // Собираем уникальных пассажиров (не водитель) для кнопки "Позвонить"
  const passengers = (messages as any[]).reduce((acc: any[], msg: any) => {
    if (msg.senderId !== userId && !acc.find(p => p.senderId === msg.senderId)) {
      acc.push({ senderId: msg.senderId, name: msg.senderName });
    }
    return acc;
  }, []);

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
          <div className="text-xs text-white/40">
            Чат с пассажирами · {(messages as any[]).length} сообщ.
          </div>
        </div>
        {passengers.length > 0 && (
          <div className="flex items-center gap-1">
            {passengers.slice(0, 2).map((p: any) => (
              <div key={p.senderId} className="text-xs text-white/40 truncate max-w-[80px]">{p.name}</div>
            ))}
          </div>
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
            Сообщений пока нет
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
                    <div className="text-xs font-semibold text-emerald-400 mb-0.5">{msg.senderName}</div>
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

      <div className="px-4 py-3 border-t border-white/[0.08] bg-[#0d0d1f] space-y-2">
        {passengers.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {passengers.map((p: any) => (
              <div key={p.senderId} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <Phone className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-white/60">{p.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ответить пассажирам..."
            rows={1}
            className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none max-h-28"
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

function RideshareCardChat({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 text-violet-400 text-sm font-medium transition-all relative"
    >
      <MessageSquare className="w-4 h-4" />
      Чат
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

export default function DriverRidesharePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const authHeaders = useAuthHeaders();
  const qc = useQueryClient();
  const { data: drivers } = useDriversQuery();
  const { data: cities } = useCitiesQuery();
  const myProfile = drivers?.find(d => d.userId === user?.id);

  const { data: rideshares, isLoading } = useMyRideshares(myProfile?.id);
  const { data: msgCounts = {} } = useRideshareMessagesCount(myProfile?.id);
  const createRideshare = useCreateRideshareMutation();
  const deleteRideshare = useDeleteRideshareMutation();

  const [openChat, setOpenChat] = useState<any>(null);

  const didCheckPayment = useRef(false);
  const returnedFromPayment = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      returnedFromPayment.current = true;
      window.history.replaceState({}, "", window.location.pathname);
      qc.invalidateQueries({ queryKey: ["/api/rideshares"] });
    }
  }, []);

  useEffect(() => {
    if (!returnedFromPayment.current || didCheckPayment.current || !Array.isArray(rideshares)) return;
    const pending = (rideshares as any[]).filter(r => r.status === "pending");
    if (pending.length === 0) {
      didCheckPayment.current = true;
      toast({ title: "Попутка опубликована! Пассажиры её видят." });
      returnedFromPayment.current = false;
      return;
    }
    didCheckPayment.current = true;
    returnedFromPayment.current = false;
    (async () => {
      let activated = false;
      for (const rs of pending) {
        try {
          const r = await fetch(`${BASE}/api/rideshares/${rs.id}/check-payment`, { headers: authHeaders.headers });
          const data = await r.json();
          if (data.status === "active") activated = true;
        } catch {}
      }
      await qc.invalidateQueries({ queryKey: ["/api/rideshares"] });
      if (activated) toast({ title: "Попутка опубликована! Пассажиры её видят." });
    })();
  }, [rideshares]);

  const [payingRideshare, setPayingRideshare] = useState<number | null>(null);

  const handleRetryPayment = async (id: number) => {
    setPayingRideshare(id);
    try {
      const returnUrl = `${window.location.origin}${BASE}/driver/rideshare?paid=1`;
      const r = await fetch(`${BASE}/api/rideshares/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders.headers },
        body: JSON.stringify({ returnUrl }),
      });
      const data = await r.json();
      if (data.alreadyPaid) {
        qc.invalidateQueries({ queryKey: ["/api/rideshares"] });
        toast({ title: "Попутка уже оплачена и опубликована!" });
      } else if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
      } else {
        toast({ title: "Не удалось получить ссылку на оплату", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка при переходе к оплате", variant: "destructive" });
    } finally {
      setPayingRideshare(null);
    }
  };

  const [showForm, setShowForm] = useState(false);
  const [fromCity, setFromCity] = useState(myProfile?.workCity || "");
  const [toCity, setToCity] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [seats, setSeats] = useState("3");
  const [pricePerSeat, setPricePerSeat] = useState("");
  const [comment, setComment] = useState("");

  const handleCreate = async () => {
    if (!myProfile || !fromCity || !toCity || !fromAddress || !toAddress || !departureTime || !pricePerSeat) {
      toast({ title: "Заполните все обязательные поля", variant: "destructive" });
      return;
    }
    const departureDate = departureTime.slice(0, 10);
    const departureTimeOnly = departureTime.slice(11, 16) || "00:00";
    try {
      const result = await createRideshare.mutateAsync({
        driverId: myProfile.id,
        fromCity,
        toCity,
        fromAddress,
        toAddress,
        departureDate,
        departureTime: departureTimeOnly,
        seatsTotal: parseInt(seats),
        price: parseFloat(pricePerSeat),
        description: comment || null,
        returnUrl: `${window.location.origin}${BASE}/driver/rideshare?paid=1`,
      });
      if ((result as any).confirmationUrl) {
        toast({ title: "Переход к оплате...", description: "После оплаты попутка будет опубликована" });
        window.location.href = (result as any).confirmationUrl;
        return;
      }
      toast({ title: "Попутка создана!", description: "Маршрут опубликован" });
      setShowForm(false);
      setFromCity(myProfile?.workCity || "");
      setToCity("");
      setFromAddress("");
      setToAddress("");
      setDepartureTime("");
      setSeats("3");
      setPricePerSeat("");
      setComment("");
    } catch (e: any) {
      toast({ title: e.message || "Ошибка", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить попутку?")) return;
    try {
      await deleteRideshare.mutateAsync(id);
      toast({ title: "Попутка удалена" });
    } catch {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    }
  };

  const cityList = Array.isArray(cities) ? cities.map((c: any) => c.name).filter(Boolean) : [];

  if (openChat) {
    return <DriverChat ride={openChat} userId={user!.id} onClose={() => setOpenChat(null)} />;
  }

  return (
    <MainLayout allowedRoles={["driver"]}>
      <div className="max-w-2xl mx-auto space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-violet-400" /> Мои попутки
            </h1>
            <p className="text-sm text-white/40 mt-0.5">Создавайте маршруты и берите попутчиков</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" /> Создать
          </button>
        </div>

        {showForm && (
          <div className="bg-[#0d0d1f] border border-violet-500/20 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Новая попутка</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/10 transition-all">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Из города *</label>
                <select
                  value={fromCity}
                  onChange={e => setFromCity(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  <option value="">Выберите</option>
                  {cityList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">В город *</label>
                <select
                  value={toCity}
                  onChange={e => setToCity(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  <option value="">Выберите</option>
                  {cityList.filter(c => c !== fromCity).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Откуда (адрес) *</label>
              <input
                value={fromAddress}
                onChange={e => setFromAddress(e.target.value)}
                placeholder="ул. Ленина, 1"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Куда (адрес) *</label>
              <input
                value={toAddress}
                onChange={e => setToAddress(e.target.value)}
                placeholder="пр. Мира, 10"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Дата и время *</label>
                <input
                  type="datetime-local"
                  value={departureTime}
                  onChange={e => setDepartureTime(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Мест *</label>
                <select
                  value={seats}
                  onChange={e => setSeats(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Цена/место ₽ *</label>
                <input
                  type="number"
                  value={pricePerSeat}
                  onChange={e => setPricePerSeat(e.target.value)}
                  placeholder="500"
                  min="0"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider block mb-1.5">Комментарий</label>
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Берём багаж, отправление строго по времени..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={createRideshare.isPending}
              className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm transition-all"
            >
              {createRideshare.isPending ? "Создание..." : "Создать попутку"}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !rideshares?.length ? (
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-3xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-600/10 flex items-center justify-center mx-auto mb-4">
              <Car className="w-7 h-7 text-violet-400/50" />
            </div>
            <p className="text-white/40 font-medium">Нет активных попуток</p>
            <p className="text-white/20 text-sm mt-1.5">Нажмите «Создать», чтобы добавить маршрут</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(rideshares as any[]).map((ride) => {
              const isPending = ride.status === "pending";
              const isCancelled = ride.status === "cancelled";
              const dep = ride.departureDate && ride.departureTime
                ? new Date(`${ride.departureDate}T${ride.departureTime}`)
                : new Date();
              const isPast = !isPending && dep < new Date();
              return (
                <div key={ride.id} className={cn(
                  "bg-[#0d0d1f] border rounded-2xl p-4",
                  isPending ? "border-amber-500/30" :
                  isCancelled ? "border-red-500/20 opacity-60" :
                  isPast ? "border-white/[0.05] opacity-60" : "border-white/[0.08]"
                )}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        <MapPin className="w-3.5 h-3.5 text-violet-400" />
                        {ride.fromCity} → {ride.toCity}
                      </div>
                      {isPending && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400">
                          <AlertCircle className="w-3 h-3" /> Ожидает оплаты
                        </span>
                      )}
                      {ride.status === "active" && !isPast && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> Опубликовано
                        </span>
                      )}
                      {isPast && <span className="text-xs px-2 py-0.5 bg-white/[0.06] rounded-full text-white/30">прошла</span>}
                    </div>
                    <button
                      onClick={() => handleDelete(ride.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all ml-2 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                    <div>
                      <div className="text-xs text-white/30 mb-0.5">Откуда</div>
                      <div className="text-sm text-white/80">{ride.fromAddress}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/30 mb-0.5">Куда</div>
                      <div className="text-sm text-white/80">{ride.toAddress}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-white/50 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {dep.toLocaleDateString("ru-RU")} {dep.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {ride.seatsTotal} мест
                    </div>
                    <div className="ml-auto font-semibold text-violet-400">
                      {formatMoney(ride.price)}/чел
                    </div>
                  </div>

                  {ride.description && (
                    <div className="mb-3 text-xs text-white/30 bg-white/[0.03] rounded-xl px-3 py-2">{ride.description}</div>
                  )}

                  <div className="flex gap-2">
                    {!isPending && (
                      <RideshareCardChat count={(msgCounts as any)[ride.id] ?? 0} onClick={() => setOpenChat(ride)} />
                    )}
                    {isPending && (
                      <button
                        onClick={() => handleRetryPayment(ride.id)}
                        disabled={payingRideshare === ride.id}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-sm font-medium transition-all disabled:opacity-60"
                      >
                        <CreditCard className="w-4 h-4" />
                        {payingRideshare === ride.id ? "Переход к оплате..." : "Оплатить публикацию"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
