import { useState } from "react";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useSearch } from "wouter";
import { Loader2, Eye, EyeOff, Shield, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-[#0f0f1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-white font-bold text-base">Условия использования</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-5 text-sm text-white/70 leading-relaxed">

          <section>
            <h3 className="text-violet-400 font-semibold text-base mb-2">Условия использования службы такси «TAXI IMPULSE»</h3>
            <p>Уважаемые пассажиры! Мы рады приветствовать вас в нашей службе такси и благодарим за выбор наших услуг. Просим внимательно ознакомиться с настоящими условиями использования, поскольку они определяют наши обязательства друг перед другом и защищают ваши права.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Информационные услуги》</h4>
            <p>Наше мобильное приложение и сайт предоставляют информационные услуги, помогающие организовывать поездки, бронировать автомобили и получать сведения о доступности транспорта. Мы предоставляем информацию о наличии свободных автомобилей, ориентировочной стоимости поездки и приблизительном времени подачи транспортного средства.</p>
            <p className="mt-2">Однако мы не несём прямой ответственности за действия водителей и исполнителей перевозок. Водители несут самостоятельную ответственность за оказание качественных услуг, обеспечение безопасности движения и сохранность имущества пассажиров.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Оплата услуг》</h4>
            <p>Оплата за выполненную поездку осуществляется напрямую водителю наличными средствами или безналичным способом через наше приложение. Цена поездки определяется тарифами, установленными службой такси, и может зависеть от дальности поездки, времени суток и загруженности дорог.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Ваше согласие》</h4>
            <p>Вы подтверждаете своё ознакомление и согласие с настоящими условиями, пользуясь нашим мобильным приложением или сайтом. Вы понимаете, что наша служба оказывает исключительно информационные услуги и не принимает непосредственного участия в организации перевозок, выполнении рейсов и получении прибыли от них.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">– Ограничение ответственности</h4>
            <p>Мы стремимся обеспечить высокое качество обслуживания, но просим понимать, что транспортные средства принадлежат частным предпринимателям или юридическим лицам, и мы не можем нести прямую ответственность за возможные происшествия, повреждения имущества или задержки, вызванные действиями третьих лиц.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Ваша безопасность》</h4>
            <p>Наша главная цель — обеспечить вашу безопасность и комфорт во время поездки. Мы рекомендуем пристёгиваться ремнями безопасности, воздерживаться от употребления алкоголя и наркотических веществ перед поездкой и избегать разговоров с незнакомыми людьми.</p>
          </section>

          <p className="text-white/50 italic">Спасибо за доверие и понимание! Приятных путешествий вместе с нами!<br/>Администратор: Телеграм <span className="text-violet-400">@Work24m</span></p>

          <hr className="border-white/10" />

          <section>
            <h3 className="text-violet-400 font-semibold text-base mb-2">Договор на оказание информационных услуг для водителей «TAXI IMPULSE»</h3>
            <p>Настоящий договор регулирует отношения между Исполнителем и физическим лицом, зарегистрировавшимся в качестве водителя такси (Пользователь), относительно оказания информационных услуг.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Предмет договора》</h4>
            <p>1. Исполнитель обязуется оказывать Пользователю информационные услуги посредством специального мобильного приложения или сайта, включая доступ к информации о заказах на перевозки пассажиров и грузов.</p>
            <p className="mt-1">2. Оказываемые услуги носят исключительно информационный характер и не предполагают выполнение конкретных перевозок самим исполнителем.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Права и обязанности сторон》</h4>
            <p className="font-medium text-white/80">Обязанности исполнителя:</p>
            <p>1. Предоставлять Пользователю информацию о заказах на перевозку пассажиров и грузов в режиме реального времени.</p>
            <p>2. Информировать Пользователя о новых возможностях, обновлениях и изменениях условий использования приложения.</p>
            <p className="font-medium text-white/80 mt-2">Обязанности пользователя:</p>
            <p>1. Своевременно вносить плату за пользование услугами в порядке, предусмотренном настоящим договором.</p>
            <p>2. Использовать предоставляемую информацию исключительно для целей осуществления своей профессиональной деятельности.</p>
            <p>3. Не передавать третьим лицам доступ к своему аккаунту и персональным данным.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Порядок расчётов》</h4>
            <p>1. Информация предоставляется на условиях ежемесячного платежа размером от 500 рублей.</p>
            <p>2. В течение первого месяца пользования информацией услуга предоставляется бесплатно.</p>
            <p>3. Отсутствие оплаты ведёт к временному приостановлению поступления заказов до момента погашения задолженности.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Ответственность сторон》</h4>
            <p>1. Исполнитель не несёт ответственности за убытки, возникшие вследствие технических сбоев или иных обстоятельств вне контроля Исполнителя.</p>
            <p>2. Пользователь самостоятельно несёт ответственность за последствия решений, принятых на основании полученной информации.</p>
            <p>3. Администрация имеет право временно ограничить доступ к услугам Пользователю в случае систематического нарушения настоящего договора или многочисленных обоснованных жалоб со стороны пассажиров.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Конфиденциальность и персональные данные》</h4>
            <p>Персональные данные Пользователя обрабатываются Исполнителем в строгом соответствии с действующими законами. Исполнитель гарантирует защиту конфиденциальной информации и обязуется не раскрывать её третьим лицам без согласия Пользователя, кроме случаев, предусмотренных законом.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Срок действия и расторжение》</h4>
            <p>1. Настоящий договор вступает в силу с момента регистрации Пользователя и действует бессрочно.</p>
            <p>2. Договор может быть расторгнут любой стороной путём письменного уведомления за 30 календарных дней.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Форс-мажорные обстоятельства》</h4>
            <p>Стороны освобождаются от ответственности за ненадлежащее исполнение обязательств, если причиной этому стали форс-мажорные обстоятельства, признанные таковыми в установленном порядке.</p>
          </section>

          <section>
            <h4 className="text-white/90 font-semibold mb-1">《Заключительные положения》</h4>
            <p>Все споры разрешаются сторонами путём переговоров. В случае невозможности урегулирования спора мирным путём, дело передаётся на рассмотрение суда по месту нахождения Исполнителя.</p>
          </section>

          <div className="pt-2 pb-1 text-white/40 text-xs border-t border-white/10">
            <p>Ф.И.О.: Дубровский Никита Владимирович</p>
            <p>ИНН: 245611900291</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const search = useSearch();
  const isAdminMode = search?.includes("admin=1");

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      toast({ title: "Введите телефон и пароль", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await loginMutation.mutateAsync({ data: { phone, password } });
      login(res.token, res.user);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Неверный телефон или пароль";
      toast({ title: "Ошибка входа", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      <div className="min-h-screen bg-[#07070f] flex flex-col md:flex-row">
        {/* Left hero */}
        <div className="hidden md:flex flex-1 flex-col items-center justify-center p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950/60 via-[#07070f] to-[#07070f]" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px]" />
          <div className="relative z-10 text-center max-w-sm">
            <div className="mx-auto mb-8">
              <img src="/logo.png" alt="TAXI IMPULSE" className="w-56 h-56 object-contain drop-shadow-2xl brightness-125 saturate-150" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">TAXI<br/>IMPULSE</h1>
            <p className="text-violet-300/70 text-lg">Сервис такси<br/>Красноярского края</p>
            <div className="mt-12 flex flex-col gap-3 text-sm text-left">
              {["Быстрая подача", "Проверенные водители", "Фиксированная цена"].map(f => (
                <div key={f} className="flex items-center gap-3 text-white/60">
                  <div className="w-1.5 h-1.5 bg-violet-500 rounded-full flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right form */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          {/* Admin secret link */}
          <Link href="/login?admin=1">
            <div className={cn(
              "absolute top-6 right-6 flex items-center gap-1.5 text-xs transition-all cursor-pointer",
              isAdminMode ? "text-violet-400" : "text-white/10 hover:text-white/30"
            )}>
              <Shield className="w-3.5 h-3.5" />
              {isAdminMode && <span>Режим администратора</span>}
            </div>
          </Link>

          <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
            <div className="md:hidden flex items-center gap-2 mb-8">
              <img src="/logo.png" alt="TAXI IMPULSE" className="w-12 h-12 object-contain brightness-125 saturate-150" />
              <span className="text-white font-bold text-lg">TAXI IMPULSE</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">
              {isAdminMode ? "Вход администратора" : "Вход в систему"}
            </h2>
            <p className="text-white/40 text-sm mb-8">
              {isAdminMode ? "Управление платформой" : "Пассажир или водитель"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Номер телефона</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="79990000000"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Пароль</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all mt-2 flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Войти"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-white/30">
              Нет аккаунта?{" "}
              <Link href="/register" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
                Зарегистрироваться
              </Link>
            </div>
          </div>

          {/* Terms link at bottom */}
          <div className="w-full max-w-sm pb-2 text-center">
            <button
              onClick={() => setShowTerms(true)}
              className="text-xs text-white/20 hover:text-white/40 transition-colors underline underline-offset-2"
            >
              Условия использования
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
