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

const appRoot = createRoot(document.getElementById("root")!);
appRoot.render(<App />);

// Фикс чёрного экрана при переключении вкладок в PWA — только после первого рендера
let reactMounted = false;
setTimeout(() => { reactMounted = true; }, 2000);

document.addEventListener("visibilitychange", () => {
  if (!reactMounted) return;
  if (document.visibilityState === "visible") {
    const root = document.getElementById("root");
    if (root && !root.hasChildNodes()) {
      window.location.reload();
    }
  }
});
