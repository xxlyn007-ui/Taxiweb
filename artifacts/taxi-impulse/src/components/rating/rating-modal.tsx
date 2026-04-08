import { useState } from "react";
import { Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingModalProps {
  driverName: string;
  onRate: (rating: number) => void;
  onSkip: () => void;
  isPending?: boolean;
}

export function RatingModal({ driverName, onRate, onSkip, isPending }: RatingModalProps) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  const labels = ["", "Плохо", "Не очень", "Нормально", "Хорошо", "Отлично!"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-3xl p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-violet-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Оцените поездку</h3>
          <p className="text-white/50 text-sm mt-1">Как вам водитель {driverName.split(' ')[0]}?</p>
        </div>

        <div className="flex justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setSelected(star)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                className={cn(
                  "w-10 h-10 transition-colors",
                  (hovered || selected) >= star
                    ? "text-amber-400 fill-amber-400"
                    : "text-white/20"
                )}
              />
            </button>
          ))}
        </div>

        <div className="h-6 text-center mb-6">
          <span className={cn(
            "text-sm font-medium transition-all",
            selected ? "text-amber-400" : "text-white/30"
          )}>
            {labels[selected || hovered] || "Выберите оценку"}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] text-white/50 text-sm transition-all"
          >
            Пропустить
          </button>
          <button
            onClick={() => selected && onRate(selected)}
            disabled={!selected || isPending}
            className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white font-semibold text-sm transition-all"
          >
            {isPending ? "..." : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}
