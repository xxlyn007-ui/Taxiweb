import { useState } from "react";
import { useRegisterDriver } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Loader2, Car, Eye, EyeOff, CheckCircle2, ChevronRight, ChevronLeft, User, Phone, Lock, CreditCard, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCitiesQuery } from "@/hooks/use-admin";

const STEPS = [
  { label: "Личные данные", desc: "ФИО, телефон и пароль" },
  { label: "Автомобиль", desc: "Марка, номер и цвет" },
  { label: "Город работы", desc: "Выберите территорию" },
];

export default function RegisterDriver() {
  const { toast } = useToast();
  const registerMutation = useRegisterDriver();
  const { data: cities } = useCitiesQuery();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);

  const [form, setForm] = useState({
    name: "", phone: "", password: "",
    carModel: "", carColor: "", carNumber: "", licenseNumber: "",
    city: "Красноярск", workCity: "Красноярск",
  });

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!form.name.trim() || form.name.trim().split(' ').length < 2) {
        toast({ title: "Введите полное ФИО (Фамилия Имя)", variant: "destructive" }); return false;
      }
      if (form.phone.replace(/\D/g, '').length < 10) {
        toast({ title: "Введите корректный номер телефона", variant: "destructive" }); return false;
      }
      if (form.password.length < 6) {
        toast({ title: "Пароль минимум 6 символов", variant: "destructive" }); return false;
      }
    }
    if (step === 1) {
      if (!form.carModel.trim()) { toast({ title: "Укажите марку и модель автомобиля", variant: "destructive" }); return false; }
      if (!form.carNumber.trim()) { toast({ title: "Укажите гос. номер автомобиля", variant: "destructive" }); return false; }
      if (!form.licenseNumber.trim()) { toast({ title: "Укажите номер водительского удостоверения", variant: "destructive" }); return false; }
    }
    if (step === 2) {
      if (!contractAccepted) {
        toast({ title: "Необходимо принять договор-оферту", description: "Прочтите договор и поставьте галочку для продолжения", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) { setStep(s => s + 1); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await registerMutation.mutateAsync({
        data: {
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
          password: form.password,
          city: form.city,
          workCity: form.workCity,
          carModel: form.carModel.trim(),
          carColor: form.carColor.trim() || undefined,
          carNumber: form.carNumber.trim().toUpperCase(),
          licenseNumber: form.licenseNumber.trim(),
        }
      });
      setDone(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Ошибка регистрации. Возможно, этот номер уже зарегистрирован.";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-500/20">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Заявка отправлена!</h2>
          <p className="text-white/50 mb-2">Администратор рассмотрит вашу заявку.</p>
          <p className="text-white/30 text-sm mb-8">После одобрения вы получите доступ в личный кабинет водителя.</p>
          <Link href="/login">
            <button className="px-8 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all shadow-lg shadow-violet-600/25">
              Перейти ко входу
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const inputClass = "w-full bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3.5 text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all text-sm";

  return (
    <div className="min-h-screen bg-[#07070f] flex items-center justify-center p-6">
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-950/30 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-950/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/logo.png" alt="TAXI IMPULSE" className="w-14 h-14 object-contain brightness-125 saturate-150" />
          <span className="text-white font-bold text-lg tracking-wide">TAXI IMPULSE</span>
        </div>

        {/* Title + progress */}
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-white">Стать водителем</h2>
          <p className="text-white/40 text-sm mt-1">{STEPS[step].desc}</p>

          <div className="flex gap-1.5 mt-5">
            {STEPS.map((s, i) => (
              <div key={i} className="flex-1 relative">
                <div className={cn("h-1 rounded-full transition-all duration-500", i <= step ? "bg-violet-600" : "bg-white/10")} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((s, i) => (
              <div key={i} className={cn("text-xs transition-colors", i === step ? "text-violet-400" : i < step ? "text-white/30" : "text-white/15")}>
                {i + 1}. {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-3.5">
          {step === 0 && (
            <>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-white/40 mb-2 uppercase tracking-wider">
                  <User className="w-3 h-3" /> ФИО <span className="text-violet-400">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => update("name", e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className={inputClass}
                />
                <p className="text-xs text-white/20 mt-1.5 ml-1">Укажите фамилию, имя и отчество</p>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs text-white/40 mb-2 uppercase tracking-wider">
                  <Phone className="w-3 h-3" /> Номер телефона <span className="text-violet-400">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => update("phone", e.target.value)}
                  placeholder="79990000000"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs text-white/40 mb-2 uppercase tracking-wider">
                  <Lock className="w-3 h-3" /> Пароль <span className="text-violet-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={e => update("password", e.target.value)}
                    placeholder="Минимум 6 символов"
                    className={cn(inputClass, "pr-12")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-white/40 mb-2 uppercase tracking-wider">
                  <Car className="w-3 h-3" /> Марка и модель <span className="text-violet-400">*</span>
                </label>
                <input
                  value={form.carModel}
                  onChange={e => update("carModel", e.target.value)}
                  placeholder="Toyota Camry"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider">
                    Цвет <span className="text-white/20">(необяз.)</span>
                  </label>
                  <input
                    value={form.carColor}
                    onChange={e => update("carColor", e.target.value)}
                    placeholder="Белый"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider">
                    Гос. номер <span className="text-violet-400">*</span>
                  </label>
                  <input
                    value={form.carNumber}
                    onChange={e => update("carNumber", e.target.value)}
                    placeholder="А123АА124"
                    className={cn(inputClass, "uppercase")}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs text-white/40 mb-2 uppercase tracking-wider">
                  <CreditCard className="w-3 h-3" /> Номер водительского удостоверения <span className="text-violet-400">*</span>
                </label>
                <input
                  value={form.licenseNumber}
                  onChange={e => update("licenseNumber", e.target.value)}
                  placeholder="77АА123456"
                  className={cn(inputClass, "uppercase")}
                />
                <p className="text-xs text-white/20 mt-1.5 ml-1">Серия и номер водительского удостоверения</p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="p-4 bg-violet-600/10 border border-violet-600/20 rounded-2xl">
                <p className="text-violet-300 text-sm leading-relaxed">
                  Заказы будут приходить из выбранного города. Вы сможете изменить его в личном кабинете в любое время.
                </p>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider">
                  Город регистрации <span className="text-violet-400">*</span>
                </label>
                <select
                  value={form.city}
                  onChange={e => update("city", e.target.value)}
                  className={cn(inputClass, "appearance-none cursor-pointer")}
                >
                  {cities?.map(c => <option key={c.id} value={c.name} className="bg-[#1a1a2e]">{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider">
                  Город работы (откуда принимать заказы) <span className="text-violet-400">*</span>
                </label>
                <select
                  value={form.workCity}
                  onChange={e => update("workCity", e.target.value)}
                  className={cn(inputClass, "appearance-none cursor-pointer")}
                >
                  {cities?.map(c => <option key={c.id} value={c.name} className="bg-[#1a1a2e]">{c.name}</option>)}
                </select>
              </div>

              <div className="mt-2">
                <a
                  href="/driver/contract"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors mb-3 group"
                >
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="underline underline-offset-2">Договор на оказание информационных услуг</span>
                  <span className="text-white/20 text-xs group-hover:text-violet-400 transition-colors">↗</span>
                </a>
                <label className="flex items-start gap-3 cursor-pointer select-none group">
                  <div
                    onClick={() => setContractAccepted(v => !v)}
                    className={cn(
                      "mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all",
                      contractAccepted
                        ? "bg-violet-600 border-violet-600"
                        : "border-white/20 bg-white/[0.03] group-hover:border-violet-500/50"
                    )}
                  >
                    {contractAccepted && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </div>
                  <span
                    onClick={() => setContractAccepted(v => !v)}
                    className="text-sm text-white/50 leading-relaxed group-hover:text-white/70 transition-colors"
                  >
                    Я прочитал(-а) и принимаю условия{" "}
                    <a
                      href="/driver/contract"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                    >
                      договора-оферты
                    </a>{" "}
                    на оказание информационных услуг <span className="text-violet-400">*</span>
                  </span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] text-white/60 hover:text-white transition-all border border-white/[0.08]"
            >
              <ChevronLeft className="w-4 h-4" /> Назад
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={loading}
            className="flex-1 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : step < STEPS.length - 1 ? (
              <><span>Продолжить</span><ChevronRight className="w-4 h-4" /></>
            ) : (
              "Отправить заявку"
            )}
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-white/25">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
