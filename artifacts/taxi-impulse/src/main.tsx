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

createRoot(document.getElementById("root")!).render(<App />);
