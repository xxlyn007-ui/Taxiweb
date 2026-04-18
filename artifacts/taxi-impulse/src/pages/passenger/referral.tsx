import { useAuth, useAuthHeaders } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Share2, Copy, Users, Gift, Percent, ChevronLeft, Wallet } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function formatMoney(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function PassengerReferralPage() {
  const { user } = useAuth();
  const authHeaders = useAuthHeaders();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: referralData, isLoading } = useQuery({
    queryKey: ["/api/referral/my", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/referral/my`, { headers: authHeaders.headers });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 60_000,
  });

  const referralLink = referralData?.referralCode
    ? `https://taxiimpulse.ru/register?ref=${referralData.referralCode}`
    : "";

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: label });
    } catch {
      toast({ title: "Скопировано!" });
    }
  };

  const handleShare = async () => {
    if (navigator.share && referralLink) {
      try {
        await navigator.share({
          title: "Taxi Impulse",
          text: "Регистрируйся по моей ссылке и получай бонусы на поездки!",
          url: referralLink,
        });
      } catch {}
    } else {
      handleCopy(referralLink, "Ссылка скопирована!");
    }
  };

  return (
    <div className="min-h-screen bg-[#07070f] pb-24">
      <div className="sticky top-0 z-10 bg-[#07070f]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/passenger")}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.08] transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-white/70" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white">Рефералы и бонусы</h1>
            <p className="text-xs text-white/40">Приглашайте друзей — получайте бонусы на поездки</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 py-5 space-y-4">

          <div className="bg-violet-900/40 border border-violet-500/20 rounded-2xl p-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-white/50" />
              <p className="text-sm text-white/60">Ваш бонусный баланс</p>
            </div>
            <p className="text-5xl font-bold text-white mb-1">{formatMoney(referralData?.bonusBalance ?? 0)} ₽</p>
            <p className="text-xs text-white/40">Используйте до 50% стоимости поездки</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4 text-center">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center mx-auto mb-2">
                <Users className="w-4 h-4 text-violet-400" />
              </div>
              <p className="text-xl font-bold text-white">{referralData?.invitedCount ?? 0}</p>
              <p className="text-xs text-white/40 mt-0.5">Приглашено</p>
            </div>
            <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4 text-center">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center mx-auto mb-2">
                <Gift className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xl font-bold text-white">{formatMoney(referralData?.bonusPerReferral ?? 100)} ₽</p>
              <p className="text-xs text-white/40 mt-0.5">За друга</p>
            </div>
            <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4 text-center">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center mx-auto mb-2">
                <Percent className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-bold text-white">{referralData?.cashbackPercent ?? 3}%</p>
              <p className="text-xs text-white/40 mt-0.5">Кешбэк</p>
            </div>
          </div>

          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-white">Ваша реферальная ссылка</span>
            </div>

            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5">
              <span className="flex-1 text-sm text-white/60 truncate">
                {referralLink || "Загрузка..."}
              </span>
              {referralLink && (
                <button
                  onClick={() => handleCopy(referralLink, "Ссылка скопирована!")}
                  className="flex-shrink-0 text-violet-400 hover:text-violet-300 transition-all"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleCopy(referralLink, "Ссылка скопирована!")}
                disabled={!referralLink}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold transition-all"
              >
                <Copy className="w-4 h-4" />
                Копировать
              </button>
              <button
                onClick={handleShare}
                disabled={!referralLink}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] disabled:opacity-40 text-white text-sm font-semibold transition-all"
              >
                <Share2 className="w-4 h-4" />
                Поделиться
              </button>
            </div>

            {referralData?.referralCode && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-amber-400 mb-0.5">
                  Ваш код: {referralData.referralCode}
                </p>
                <p className="text-xs text-amber-400/70 leading-relaxed">
                  Друг вводит этот код при регистрации — вам сразу начисляется бонус
                </p>
              </div>
            )}
          </div>

          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-4">Как это работает</h3>
            <div className="space-y-4">
              {[
                "После каждой поездки вам автоматически начисляется кешбэк бонусами",
                "Приглашайте друзей — за каждого начисляется дополнительный бонус",
                "При оформлении заказа отметьте «Использовать бонусы»",
                "Бонусы списываются до 50% от стоимости поездки",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-violet-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-violet-400">{i + 1}</span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
