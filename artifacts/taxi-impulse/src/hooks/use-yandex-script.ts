import { useState, useEffect } from "react";

declare global {
  interface Window {
    ymaps3: any;
  }
}

const YANDEX_KEY = "0cb34d82-1882-4add-9645-fedb77532f0c";

let ymapsReady = false;
let ymapsLoading = false;
const callbacks: Array<() => void> = [];

export function useYandexScript(): boolean {
  const [ready, setReady] = useState(ymapsReady);

  useEffect(() => {
    if (ymapsReady) {
      setReady(true);
      return;
    }

    callbacks.push(() => setReady(true));

    if (ymapsLoading) return;
    ymapsLoading = true;

    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/3.0/?apikey=${YANDEX_KEY}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      window.ymaps3.ready
        .then(() => {
          ymapsReady = true;
          ymapsLoading = false;
          callbacks.forEach((cb) => cb());
          callbacks.length = 0;
        })
        .catch(() => {
          ymapsLoading = false;
        });
    };
    script.onerror = () => {
      ymapsLoading = false;
      callbacks.length = 0;
    };
    document.head.appendChild(script);
  }, []);

  return ready;
}
