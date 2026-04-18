import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {});
  });
}

window.addEventListener("error", (e) => {
  const msg = e.message ?? "";
  if (msg.includes("ResizeObserver") || msg.includes("Script error")) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);

// Фикс чёрного экрана при переключении вкладок в PWA
// Если страница становится видимой а root пуст — перезагружаем
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    const root = document.getElementById("root");
    if (root && !root.hasChildNodes()) {
      window.location.reload();
    }
  }
});

createRoot(document.getElementById("root")!).render(<App />);
