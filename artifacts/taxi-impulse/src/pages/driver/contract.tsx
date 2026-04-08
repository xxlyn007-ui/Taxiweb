import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { ArrowLeft, FileText, ChevronRight } from "lucide-react";

function ContractContent() {
  return (
    <div className="prose prose-invert max-w-none text-sm leading-relaxed text-white/70 space-y-5">

      <div className="bg-violet-600/10 border border-violet-600/20 rounded-2xl px-5 py-4">
        <h2 className="text-base font-semibold text-violet-300 mb-1">
          Договор на оказание информационных услуг
        </h2>
        <p className="text-white/50 text-xs">
          для водителей приложения «TAXI IMPULSE» — Соглашение об оказании информационных услуг для водителей такси
        </p>
      </div>

      <p className="text-white/60">
        Настоящий договор регулирует отношения между <span className="text-white font-medium">TAXI IMPULSE</span> (далее «Исполнитель»)
        и физическим лицом, зарегистрировавшимся в качестве водителя такси (далее «Пользователь»),
        относительно оказания информационных услуг.
      </p>

      <section>
        <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
          <span className="text-violet-400">《</span> Предмет договора <span className="text-violet-400">》</span>
        </h3>
        <ol className="space-y-2 list-decimal list-inside text-white/60">
          <li>
            Исполнитель обязуется оказывать Пользователю информационные услуги посредством специального мобильного
            приложения или сайта, включая доступ к информации о заказах на перевозки пассажиров и грузов.
          </li>
          <li>
            Оказываемые услуги носят исключительно информационный характер и не предполагают выполнение
            конкретных перевозок самим Исполнителем.
          </li>
        </ol>
      </section>

      <section>
        <h3 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
          <span className="text-violet-400">《</span> Права и обязанности сторон <span className="text-violet-400">》</span>
        </h3>

        <div className="mb-3">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="text-violet-400">》</span> Обязанности Исполнителя:
          </p>
          <ol className="space-y-1.5 list-decimal list-inside text-white/60">
            <li>Предоставлять Пользователю информацию о заказах на перевозку пассажиров и грузов в режиме реального времени.</li>
            <li>Информировать Пользователя о новых возможностях, обновлениях и изменениях условий использования приложения.</li>
          </ol>
        </div>

        <div>
          <p className="text-white/50 text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="text-violet-400">》</span> Обязанности Пользователя:
          </p>
          <ol className="space-y-1.5 list-decimal list-inside text-white/60">
            <li>Своевременно вносить плату за пользование услугами в порядке, предусмотренном настоящим договором.</li>
            <li>Использовать предоставляемую информацию исключительно для целей осуществления своей профессиональной деятельности.</li>
            <li>Не передавать третьим лицам доступ к своему аккаунту и персональным данным.</li>
          </ol>
        </div>
      </section>

      <section>
        <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
          <span className="text-violet-400">《</span> Порядок расчётов <span className="text-violet-400">》</span>
        </h3>
        <ol className="space-y-2 list-decimal list-inside text-white/60">
          <li>Информация предоставляется на условиях ежемесячного платежа размером от <span className="text-white font-medium">500 рублей</span>.</li>
          <li>В течение первого месяца пользования услуга предоставляется <span className="text-emerald-400 font-medium">бесплатно</span>.</li>
          <li>Отсутствие оплаты ведёт к временному приостановлению поступления заказов до момента погашения задолженности.</li>
        </ol>
      </section>

      <section>
        <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
          <span className="text-violet-400">《</span> Ответственность сторон <span className="text-violet-400">》</span>
        </h3>
        <ol className="space-y-2 list-decimal list-inside text-white/60">
          <li>Исполнитель не несёт ответственности за убытки, возникшие вследствие технических сбоев или иных обстоятельств вне контроля Исполнителя.</li>
          <li>Пользователь самостоятельно несёт ответственность за последствия решений, принятых на основании полученной информации.</li>
          <li>Администрация имеет право временно ограничить доступ к услугам Пользователю в случае систематического нарушения настоящего договора или многочисленных обоснованных жалоб со стороны пассажиров.</li>
        </ol>
      </section>

      <section>
        <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
          <span className="text-violet-400">《</span> Конфиденциальность и персональные данные <span className="text-violet-400">》</span>
        </h3>
        <ol className="space-y-2 list-decimal list-inside text-white/60">
          <li>Персональные данные Пользователя обрабатываются Исполнителем в строгом соответствии с действующими законами и правилами конфиденциальности.</li>
          <li>Исполнитель гарантирует защиту конфиденциальной информации и обязуется не раскрывать её третьим лицам без согласия Пользователя, кроме случаев, предусмотренных законом.</li>
        </ol>
      </section>

      <section>
        <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
          <span className="text-violet-400">》</span> Срок действия и расторжение договора <span className="text-violet-400">《</span>
        </h3>
        <ol className="space-y-2 list-decimal list-inside text-white/60">
          <li>Настоящий договор вступает в силу с момента регистрации Пользователя в информационной системе и действует бессрочно, пока Пользователь активно пользуется услугами.</li>
          <li>Договор может быть расторгнут любой стороной путём письменного уведомления за 30 календарных дней до предполагаемой даты прекращения сотрудничества.</li>
        </ol>
      </section>

      <section>
        <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
          <span className="text-violet-400">《</span> Форс-мажорные обстоятельства <span className="text-violet-400">》</span>
        </h3>
        <p className="text-white/60">
          Стороны освобождаются от ответственности за ненадлежащее исполнение обязательств по договору,
          если причиной этому стали форс-мажорные обстоятельства, признанные таковыми в установленном порядке.
        </p>
      </section>

      <section>
        <h3 className="text-white font-semibold text-base mb-2 flex items-center gap-2">
          <span className="text-violet-400">《</span> Заключительные положения <span className="text-violet-400">》</span>
        </h3>
        <ol className="space-y-2 list-decimal list-inside text-white/60">
          <li>Все споры и разногласия, возникающие в связи с исполнением настоящего договора, разрешаются путём переговоров. В случае невозможности — передаются на рассмотрение суда по месту нахождения Исполнителя.</li>
          <li>Изменения и дополнения к настоящему договору действительны только в письменной форме и вступают в силу с момента подписания обеими сторонами.</li>
        </ol>
      </section>

      <div className="border-t border-white/[0.08] pt-4">
        <p className="text-white/40 text-xs">Исполнитель:</p>
        <p className="text-white/60 mt-1">
          <span className="text-white font-medium">Никита</span> — Telegram:{" "}
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
  );
}

export default function DriverContract() {
  const { user } = useAuth();

  if (user) {
    return (
      <MainLayout allowedRoles={['driver']}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/driver">
              <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/50 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Договор-оферта</h1>
              <p className="text-xs text-white/40">Договор на оказание информационных услуг</p>
            </div>
          </div>
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl p-6">
            <ContractContent />
          </div>
        </div>
      </MainLayout>
    );
  }

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
          <FileText className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Договор-оферта</span>
        </div>
      </div>
      <div className="flex-1 max-w-2xl w-full mx-auto px-5 py-6">
        <ContractContent />
      </div>
    </div>
  );
}
