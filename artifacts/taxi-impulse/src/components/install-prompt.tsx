import { useState, useEffect } from "react";
import { Download, X, Share, Plus, MoreVertical, Smartphone, Zap, Shield, Star } from "lucide-react";

const STORAGE_KEY = "pwa_install_dismissed_v5";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isMobile(): boolean {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function detectBrowser(): "ios-safari" | "samsung" | "firefox" | "chrome" | "other" {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios-safari";
  if (/samsungbrowser/.test(ua)) return "samsung";
  if (/firefox/.test(ua)) return "firefox";
  if (/chrome|crios/.test(ua)) return "chrome";
  return "other";
}

interface Props {
  children: React.ReactNode;
}

export function InstallPrompt({ children }: Props) {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try { if (localStorage.getItem(STORAGE_KEY)) return; } catch {}

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setTimeout(() => {
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
        setShow(false);
      }, 2500);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    if (isMobile()) {
      const timer = setTimeout(() => {
        try { if (localStorage.getItem(STORAGE_KEY)) return; } catch {}
        setShow(true);
      }, 1200);
      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("appinstalled", handleInstalled);
        clearTimeout(timer);
      };
    }

    const desktopTimer = setTimeout(() => {
      setDeferredPrompt((prev: any) => {
        if (prev) setShow(true);
        return prev;
      });
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      clearTimeout(desktopTimer);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setShow(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (outcome === "accepted") {
          setInstalled(true);
          setTimeout(() => {
            try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
            setShow(false);
          }, 2500);
        }
        return;
      } catch {}
    }
    setShowGuide(true);
  };

  if (!show) return <>{children}</>;

  const browser = detectBrowser();

  const guideSteps: Record<string, { icon: any; text: string }[]> = {
    "ios-safari": [
      { icon: Share, text: 'Нажмите «Поделиться» в нижней панели Safari' },
      { icon: Plus, text: 'Выберите «На экран "Домой"»' },
      { icon: Download, text: 'Нажмите «Добавить»' },
    ],
    "samsung": [
      { icon: MoreVertical, text: 'Нажмите «⋮» в Samsung Internet' },
      { icon: Plus, text: '«Добавить страницу» → «На главный экран»' },
      { icon: Download, text: 'Нажмите «Добавить»' },
    ],
    "firefox": [
      { icon: MoreVertical, text: 'Нажмите «⋮» в Firefox' },
      { icon: Plus, text: 'Выберите «Установить»' },
      { icon: Download, text: 'Нажмите «Добавить»' },
    ],
    "other": [
      { icon: MoreVertical, text: 'Откройте меню браузера (⋮ или ···)' },
      { icon: Plus, text: '«Добавить на главный экран» или «Установить»' },
      { icon: Download, text: 'Подтвердите добавление' },
    ],
  };

  const steps = guideSteps[browser] ?? guideSteps["other"];

  const features = [
    { icon: Zap, label: "Быстрый запуск", sub: "Без браузера и загрузки" },
    { icon: Shield, label: "Работает офлайн", sub: "Даже без интернета" },
    { icon: Star, label: "Как родное приложение", sub: "Полноэкранный режим" },
  ];

  return (
    <>
      {children}

      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "#07070f",
          display: "flex", flexDirection: "column",
          animation: "fadeIn 0.35s ease",
          overflowY: "auto",
        }}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.97); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.08); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
        `}</style>

        {/* Background glow blobs */}
        <div style={{
          position: "absolute", width: 400, height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)",
          top: -100, left: -100, pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: 300, height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
          bottom: 50, right: -80, pointerEvents: "none",
        }} />

        {/* Close button */}
        {!installed && (
          <button
            onClick={dismiss}
            style={{
              position: "absolute", top: 20, right: 20,
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.4)",
              zIndex: 10,
            }}
          >
            <X size={16} />
          </button>
        )}

        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "60px 28px 40px",
          maxWidth: 420, margin: "0 auto", width: "100%",
        }}>

          {installed ? (
            /* ── Success state ── */
            <div style={{ textAlign: "center", animation: "fadeIn 0.4s ease" }}>
              <div style={{
                width: 100, height: 100, borderRadius: 28,
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 28px",
                boxShadow: "0 0 60px rgba(16,185,129,0.4)",
                fontSize: 44,
              }}>✓</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 12 }}>
                Готово!
              </div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                TAXI IMPULSE добавлен на главный экран.<br />
                Открывайте его как обычное приложение.
              </div>
            </div>

          ) : showGuide ? (
            /* ── Step-by-step guide ── */
            <div style={{ width: "100%" }}>
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <img
                  src="/logo.png"
                  alt="TAXI IMPULSE"
                  style={{
                    width: 72, height: 72, borderRadius: 20,
                    objectFit: "contain", margin: "0 auto 16px", display: "block",
                  }}
                />
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
                  Как добавить на телефон
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>
                  Выполните 3 простых шага
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
                {steps.map(({ icon: Icon, text }, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "center", gap: 16,
                      padding: "16px 18px", borderRadius: 20,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: 14,
                      background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(139,92,246,0.15))",
                      border: "1px solid rgba(124,58,237,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <Icon size={18} color="#a78bfa" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Шаг {i + 1}
                      </div>
                      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                        {text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={dismiss}
                style={{
                  width: "100%", padding: "15px", borderRadius: 18,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.5)", fontSize: 15,
                }}
              >
                Понятно
              </button>
            </div>

          ) : (
            /* ── Main screen ── */
            <>
              {/* Logo */}
              <div style={{ animation: "float 3s ease-in-out infinite", marginBottom: 28 }}>
                <div style={{
                  width: 110, height: 110, borderRadius: 30,
                  background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 0 1px rgba(124,58,237,0.3), 0 20px 60px rgba(124,58,237,0.5)",
                  position: "relative",
                }}>
                  <img
                    src="/logo.png"
                    alt="TAXI IMPULSE"
                    style={{ width: 80, height: 80, objectFit: "contain" }}
                  />
                  <div style={{
                    position: "absolute", inset: -8, borderRadius: 38,
                    border: "1px solid rgba(124,58,237,0.25)",
                    animation: "pulse 2.5s ease-in-out infinite",
                  }} />
                </div>
              </div>

              {/* Title */}
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px", marginBottom: 8 }}>
                  TAXI IMPULSE
                </div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                  Добавьте на главный экран —<br />
                  работает как обычное приложение
                </div>
              </div>

              {/* Features */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10, marginBottom: 36, width: "100%",
              }}>
                {features.map(({ icon: Icon, label, sub }) => (
                  <div
                    key={label}
                    style={{
                      padding: "14px 10px", borderRadius: 18, textAlign: "center",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: "rgba(124,58,237,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 8px",
                    }}>
                      <Icon size={16} color="#a78bfa" />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 3, lineHeight: 1.2 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.3 }}>
                      {sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={handleInstall}
                  style={{
                    width: "100%", padding: "17px", borderRadius: 20,
                    background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                    border: "none", cursor: "pointer",
                    color: "#fff", fontSize: 16, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    boxShadow: "0 8px 30px rgba(124,58,237,0.5)",
                    letterSpacing: "0.01em",
                  }}
                >
                  <Smartphone size={20} />
                  Добавить на главный экран
                </button>

                <button
                  onClick={dismiss}
                  style={{
                    width: "100%", padding: "15px", borderRadius: 20,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.3)", fontSize: 15,
                  }}
                >
                  Не сейчас
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
