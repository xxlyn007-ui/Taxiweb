import { MainLayout } from "@/components/layout/main-layout";
import { SupportChat } from "@/components/support/support-chat";
import { useState } from "react";

export default function SupportPage() {
  const [open, setOpen] = useState(true);

  return (
    <MainLayout allowedRoles={['passenger', 'driver', 'admin']}>
      <div className="max-w-lg mx-auto">
        {open && <SupportChat onClose={() => setOpen(false)} />}
        {!open && (
          <div className="text-center py-20">
            <button
              onClick={() => setOpen(true)}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-medium transition-all"
            >
              Открыть чат поддержки
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
