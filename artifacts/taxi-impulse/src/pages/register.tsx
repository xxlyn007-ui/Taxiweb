import { useState } from "react";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Loader2, Eye, EyeOff, User, Phone, Lock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Register() {
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !password) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    if (phone.length < 10) {
      toast({ title: "Введите корректный номер телефона", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Пароль должен содержать минимум 6 символов", variant: "destructive" });
      return;
    }
    if (!termsAccepted) {
      toast({ title: "Необходимо принять условия использования", description: "Прочтите условия и поставьте галочку для продолжения", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await registerMutation.mutateAsync({ data: { name, phone, password } });
      login(res.token, res.user);
      toast({ title: "Добро пожаловать!", description: "Аккаунт создан успешно" });
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Пользователь с таким номером уже существует";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all";

  return (
    <div className="min-h-screen bg-[#07070f] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/30 via-[#07070f] to-[#07070f]" />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-violet-600/8 rounded-full blur-[120px]" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center gap-2 mb-10">
          <img src="/logo.png" alt="TAXI IMPULSE" className="w-12 h-12 object-contain brightness-125 saturate-150" />
          <span className="text-white font-bold text-lg">TAXI IMPULSE</span>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Регистрация пассажира</h2>
        <p className="text-white/40 text-sm mb-8">Создайте аккаунт для заказа такси</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Ваше имя</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Иван Иванов"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Номер телефона</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="79990000000"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Пароль</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors mb-3 group"
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span className="underline underline-offset-2">Условия использования и политика конфиденциальности</span>
              <span className="text-white/20 text-xs group-hover:text-violet-400 transition-colors">↗</span>
            </a>

            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <div
                onClick={() => setTermsAccepted(v => !v)}
                className={cn(
                  "mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all",
                  termsAccepted
                    ? "bg-violet-600 border-violet-600"
                    : "border-white/20 bg-white/[0.03] group-hover:border-violet-500/50"
                )}
              >
                {termsAccepted && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
              <span
                onClick={() => setTermsAccepted(v => !v)}
                className="text-sm text-white/50 leading-relaxed group-hover:text-white/70 transition-colors"
              >
                Я прочитал(-а) и принимаю{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                >
                  условия использования
                </a>{" "}
                службы «TAXI IMPULSE» <span className="text-violet-400">*</span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all mt-2 flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать аккаунт"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/5 text-center space-y-3">
          <p className="text-sm text-white/30">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
              Войти
            </Link>
          </p>
          <p className="text-sm text-white/30">
            Хотите работать водителем?{" "}
            <Link href="/register-driver" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
              Подать заявку
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
