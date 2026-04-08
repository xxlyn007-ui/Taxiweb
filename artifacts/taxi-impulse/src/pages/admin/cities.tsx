import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAllCitiesQuery, useCreateCityMutation, useUpdateCityMutation, useDeleteCityMutation } from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, MapPin, Check, X, Power } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminCities() {
  const { data: cities, isLoading } = useAllCitiesQuery();
  const createCity = useCreateCityMutation();
  const updateCity = useUpdateCityMutation();
  const deleteCity = useDeleteCityMutation();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("Красноярский край");
  const [editName, setEditName] = useState("");
  const [editRegion, setEditRegion] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createCity.mutateAsync({ name: name.trim(), region: region.trim() || "Красноярский край" });
      toast({ title: `Город «${name.trim()}» добавлен` });
      setName("");
      setRegion("Красноярский край");
      setShowForm(false);
    } catch (err: any) {
      toast({ title: err.message || "Ошибка", variant: "destructive" });
    }
  };

  const startEdit = (city: any) => {
    setEditId(city.id);
    setEditName(city.name);
    setEditRegion(city.region);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditRegion("");
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await updateCity.mutateAsync({ id, name: editName.trim(), region: editRegion.trim() || "Красноярский край" });
      toast({ title: "Город обновлён" });
      cancelEdit();
    } catch (err: any) {
      toast({ title: err.message || "Ошибка", variant: "destructive" });
    }
  };

  const handleToggle = async (city: any) => {
    try {
      await updateCity.mutateAsync({ id: city.id, isActive: !city.isActive });
      toast({ title: city.isActive ? "Город деактивирован" : "Город активирован" });
    } catch (err: any) {
      toast({ title: err.message || "Ошибка", variant: "destructive" });
    }
  };

  const handleDelete = async (city: any) => {
    if (!confirm(`Удалить город «${city.name}»?`)) return;
    try {
      await deleteCity.mutateAsync(city.id);
      toast({ title: `Город «${city.name}» удалён` });
    } catch (err: any) {
      toast({ title: err.message || "Ошибка", variant: "destructive" });
    }
  };

  const activeCities = Array.isArray(cities) ? cities.filter((c: any) => c.isActive) : [];
  const inactiveCities = Array.isArray(cities) ? cities.filter((c: any) => !c.isActive) : [];

  const fieldCls = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30";

  return (
    <MainLayout allowedRoles={['admin']}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Управление городами</h1>
            <p className="text-sm text-white/40 mt-1">
              Города доступны пассажирам, водителям и в настройках тарифов
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditId(null); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Добавить город
          </button>
        </div>

        {showForm && (
          <div className="bg-[#0d0d1f] border border-violet-500/20 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-violet-300">Новый город</h3>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Название города *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Например: Красноярск"
                className={fieldCls}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Регион</label>
              <input
                value={region}
                onChange={e => setRegion(e.target.value)}
                placeholder="Красноярский край"
                className={fieldCls}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreate}
                disabled={!name.trim() || createCity.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                <Check className="w-4 h-4" /> Добавить
              </button>
              <button
                onClick={() => { setShowForm(false); setName(""); setRegion("Красноярский край"); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/60 text-sm transition-colors"
              >
                <X className="w-4 h-4" /> Отмена
              </button>
            </div>
          </div>
        )}

        <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-white">Активные города</span>
            <span className="ml-auto text-xs text-white/30">{activeCities.length}</span>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-white/30 text-sm">Загрузка...</div>
          ) : activeCities.length === 0 ? (
            <div className="py-8 text-center text-white/30 text-sm">Нет активных городов</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {activeCities.map((city: any) => (
                <div key={city.id} className="px-5 py-3.5 flex items-center gap-3">
                  {editId === city.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="flex-1 bg-black/40 border border-violet-500/30 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                        autoFocus
                      />
                      <input
                        value={editRegion}
                        onChange={e => setEditRegion(e.target.value)}
                        className="w-40 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                        placeholder="Регион"
                      />
                      <button onClick={() => handleUpdate(city.id)} disabled={updateCity.isPending} className="w-8 h-8 flex items-center justify-center rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-white/40 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{city.name}</div>
                        <div className="text-xs text-white/30">{city.region}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => startEdit(city)}
                          title="Редактировать"
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-violet-600/20 hover:text-violet-400 text-white/30 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggle(city)}
                          title="Деактивировать"
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-amber-500/20 hover:text-amber-400 text-white/30 transition-all"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(city)}
                          title="Удалить"
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/20 hover:text-red-400 text-white/30 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {inactiveCities.length > 0 && (
          <div className="bg-[#0d0d1f] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-white/30" />
              <span className="text-sm font-medium text-white/50">Деактивированные</span>
              <span className="ml-auto text-xs text-white/30">{inactiveCities.length}</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {inactiveCities.map((city: any) => (
                <div key={city.id} className="px-5 py-3.5 flex items-center gap-3 opacity-50">
                  <div className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/60">{city.name}</div>
                    <div className="text-xs text-white/20">{city.region}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggle(city)}
                      title="Активировать"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-emerald-500/20 hover:text-emerald-400 text-white/30 transition-all"
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(city)}
                      title="Удалить"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/20 hover:text-red-400 text-white/30 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
