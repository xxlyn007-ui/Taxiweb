import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#07070f] flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <button
          onClick={() => window.history.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Условия использования</span>
        </div>
      </div>

      <div className="flex-1 max-w-2xl w-full mx-auto px-5 py-6">
        <div className="space-y-5 text-sm leading-relaxed text-white/70">

          <div className="bg-violet-600/10 border border-violet-600/20 rounded-2xl px-5 py-4">
            <h2 className="text-base font-semibold text-violet-300 mb-1">
              Условия использования службы такси «TAXI IMPULSE»
            </h2>
            <p className="text-white/50 text-xs">Политика конфиденциальности и пользовательское соглашение</p>
          </div>

          <p className="text-white/60">
            Уважаемые пассажиры! Мы рады приветствовать вас в нашей службе такси и благодарим за выбор наших услуг.
            Просим внимательно ознакомиться с настоящими условиями использования, поскольку они определяют наши
            обязательства друг перед другом и защищают ваши права.
          </p>

          <section>
            <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
              <span className="text-violet-400">《</span> Информационные услуги <span className="text-violet-400">》</span>
            </h3>
            <p className="text-white/60 mb-2">
              Наше мобильное приложение и сайт предоставляют информационные услуги, помогающие организовывать поездки,
              бронировать автомобили и получать сведения о доступности транспорта. Мы предоставляем информацию о наличии
              свободных автомобилей, ориентировочной стоимости поездки и приблизительном времени подачи транспортного средства.
            </p>
            <p className="text-white/60">
              Однако мы не несём прямой ответственности за действия водителей и исполнителей перевозок. Водители несут
              самостоятельную ответственность за оказание качественных услуг, обеспечение безопасности движения и
              сохранность имущества пассажиров.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
              <span className="text-violet-400">《</span> Оплата услуг <span className="text-violet-400">》</span>
            </h3>
            <p className="text-white/60">
              Оплата за выполненную поездку осуществляется напрямую водителю наличными средствами или безналичным способом
              через наше приложение. Цена поездки определяется тарифами, установленными службой такси, и может зависеть
              от дальности поездки, времени суток и загруженности дорог.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
              <span className="text-violet-400">《</span> Ваше согласие <span className="text-violet-400">》</span>
            </h3>
            <p className="text-white/60">
              Вы подтверждаете своё ознакомление и согласие с настоящими условиями, пользуясь нашим мобильным приложением
              или сайтом. Вы понимаете, что наша служба оказывает исключительно информационные услуги и не принимает
              непосредственного участия в организации перевозок, выполнении рейсов и получении прибыли от них.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold text-base mb-2">
              — Ограничение ответственности
            </h3>
            <p className="text-white/60">
              Мы стремимся обеспечить высокое качество обслуживания, но просим понимать, что транспортные средства
              принадлежат частным предпринимателям или юридическим лицам, и мы не можем нести прямую ответственность
              за возможные происшествия, повреждения имущества или задержки, вызванные действиями третьих лиц.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
              <span className="text-violet-400">《</span> Ваша безопасность <span className="text-violet-400">》</span>
            </h3>
            <p className="text-white/60">
              Наша главная цель — обеспечить вашу безопасность и комфорт во время поездки. Мы рекомендуем пристёгиваться
              ремнями безопасности, воздерживаться от употребления алкоголя и наркотических веществ перед поездкой и
              избегать разговоров с незнакомыми людьми.
            </p>
          </section>

          <div className="border-t border-white/[0.08] pt-5">
            <p className="text-white/60 italic mb-3">
              Спасибо за доверие и понимание! Приятных путешествий вместе с нами!
            </p>
            <p className="text-white/40 text-xs">Администратор:</p>
            <p className="text-white/60 mt-1">
              Telegram:{" "}
              <a
                href="https://t.me/Work24m"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 transition-colors"
              >
                @Work24m
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
