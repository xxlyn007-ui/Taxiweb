import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import {
  useTariffsQuery, useCreateTariffMutation, useUpdateTariffMutation, useDeleteTariffMutation,
  useTariffOptionsQuery, useCreateTariffOptionMutation, useUpdateTariffOptionMutation, useDeleteTariffOptionMutation,
  useCityTariffOverridesQuery, useSaveCityTariffOverrideMutation, useDeleteCityTariffOverrideMutation,
  useCitiesQuery,
} from "@/hooks/use-admin";
import { formatMoney } from "@/lib/utils";
import { Plus, Edit2, Trash2, Loader2, X, BadgeRussianRuble, Tag, MapPin, ChevronDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const tariffSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().default("taxi"),
  basePrice: z.coerce.number().min(0),
  pricePerKm: z.coerce.number().min(0),
  minPrice: z.coerce.number().min(0),
  tier1MaxKm: z.coerce.number().min(0).optional(),
  tier1PricePerKm: z.coerce.number().min(0).optional(),
  tier2MaxKm: z.coerce.number().min(0).optional(),
  tier2PricePerKm: z.coerce.number().min(0).optional(),
  tier3MaxKm: z.coerce.number().min(0).optional(),
  tier3PricePerKm: z.coerce.number().min(0).optional(),
  isActive: z.boolean().default(true)
});

const optionSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  city: z.string().optional(),
  isActive: z.boolean().default(true),
});

type TariffForm = z.infer<typeof tariffSchema>;
type OptionForm = z.infer<typeof optionSchema>;

type Tab = 'tariffs' | 'options';

const fieldCls = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-violet-500/30";

function CityOverridesPanel({ tariff, cities }: { tariff: any; cities: any[] }) {
  const { data: overrides, isLoading } = useCityTariffOverridesQuery(tariff.id);
  const saveMutation = useSaveCityTariffOverrideMutation();
  const deleteMutation = useDeleteCityTariffOverrideMutation();
  const { toast } = useToast();

  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [form, setForm] = useState<{ basePrice: string; pricePerKm: string; minPrice: string }>({
    basePrice: "", pricePerKm: "", minPrice: "",
  });

  const getOverride = (city: string) =>
    Array.isArray(overrides) ? overrides.find((o: any) => o.city === city) : null;

  const openCity = (city: string) => {
    if (expandedCity === city) { setExpandedCity(null); return; }
    const existing = getOverride(city);
    setForm({
      basePrice: existing?.basePrice != null ? String(existing.basePrice) : "",
      pricePerKm: existing?.pricePerKm != null ? String(existing.pricePerKm) : "",
      minPrice: existing?.minPrice != null ? String(existing.minPrice) : "",
    });
    setExpandedCity(city);
  };

  const handleSave = async (city: string) => {
    try {
      await saveMutation.mutateAsync({
        city,
        tariffId: tariff.id,
        basePrice: form.basePrice ? Number(form.basePrice) : undefined,
        pricePerKm: form.pricePerKm ? Number(form.pricePerKm) : undefined,
        minPrice: form.minPrice ? Number(form.minPrice) : undefined,
      });
      toast({ title: `Цены для ${city} сохранены` });
      setExpandedCity(null);
    } catch {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    }
  };

  const handleDelete = async (city: string) => {
    const override = getOverride(city);
    if (!override) return;
    try {
      await deleteMutation.mutateAsync({ id: override.id, tariffId: tariff.id });
      toast({ title: `Переопределение для ${city} удалено` });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="py-2 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>;

  return (
    <div className="space-y-1">
      {cities.map(c => {
        const override = getOverride(c.name);
        const isExpanded = expandedCity === c.name;
        return (
          <div key={c.id} className={cn(
            "rounded-xl border transition-all",
            isExpanded ? "border-violet-600/30 bg-violet-600/5" : "border-white/[0.05] bg-white/[0.02]"
          )}>
            <button
              onClick={() => openCity(c.name)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs"
            >
              <span className={cn("font-medium", override ? "text-violet-300" : "text-white/50")}>{c.name}</span>
              <div className="flex items-center gap-2">
                {override && (
                  <span className="text-violet-400/70 text-[10px]">
                    {override.pricePerKm != null ? `${override.pricePerKm}₽/км` : ""}
                    {override.minPrice != null ? ` мин.${override.minPrice}₽` : ""}
                  </span>
                )}
                <ChevronDown className={cn("w-3.5 h-3.5 text-white/30 transition-transform", isExpanded && "rotate-180")} />
              </div>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-white/30">База (₽)</label>
                    <input
                      type="number" step="0.01" value={form.basePrice}
                      onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))}
                      placeholder={String(tariff.basePrice)}
                      className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30">За км (₽)</label>
                    <input
                      type="number" step="0.01" value={form.pricePerKm}
                      onChange={e => setForm(f => ({ ...f, pricePerKm: e.target.value }))}
                      placeholder={String(tariff.pricePerKm)}
                      className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30">Мин. (₽)</label>
                    <input
                      type="number" step="0.01" value={form.minPrice}
                      onChange={e => setForm(f => ({ ...f, minPrice: e.target.value }))}
                      placeholder={String(tariff.minPrice)}
                      className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(c.name)}
                    disabled={saveMutation.isPending}
                    className="flex-1 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors flex justify-center items-center"
                  >
                    {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Сохранить"}
                  </button>
                  {override && (
                    <button
                      onClick={() => handleDelete(c.name)}
                      className="px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs transition-colors"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminTariffs() {
  const [tab, setTab] = useState<Tab>('tariffs');

  const { data: tariffs, isLoading } = useTariffsQuery();
  const createMutation = useCreateTariffMutation();
  const updateMutation = useUpdateTariffMutation();
  const deleteMutation = useDeleteTariffMutation();

  const { data: options, isLoading: optLoading } = useTariffOptionsQuery();
  const createOptMutation = useCreateTariffOptionMutation();
  const updateOptMutation = useUpdateTariffOptionMutation();
  const deleteOptMutation = useDeleteTariffOptionMutation();

  const { data: cities } = useCitiesQuery();

  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isOptModalOpen, setIsOptModalOpen] = useState(false);
  const [editingOptId, setEditingOptId] = useState<number | null>(null);
  const [expandedOverrideTariffId, setExpandedOverrideTariffId] = useState<number | null>(null);

  const form = useForm<TariffForm>({
    resolver: zodResolver(tariffSchema),
    defaultValues: { isActive: true }
  });

  const optForm = useForm<OptionForm>({
    resolver: zodResolver(optionSchema),
    defaultValues: { isActive: true }
  });

  const openCreate = () => {
    setEditingId(null);
    form.reset({ name: "", description: "", category: "taxi", basePrice: 0, pricePerKm: 0, minPrice: 0, isActive: true });
    setIsModalOpen(true);
  };

  const openEdit = (tariff: any) => {
    setEditingId(tariff.id);
    form.reset({
      name: tariff.name,
      description: tariff.description ?? "",
      category: tariff.category ?? "taxi",
      basePrice: tariff.basePrice,
      pricePerKm: tariff.pricePerKm,
      minPrice: tariff.minPrice,
      tier1MaxKm: tariff.tier1MaxKm ?? 5,
      tier1PricePerKm: tariff.tier1PricePerKm ?? tariff.pricePerKm,
      tier2MaxKm: tariff.tier2MaxKm ?? 10,
      tier2PricePerKm: tariff.tier2PricePerKm ?? tariff.pricePerKm,
      tier3MaxKm: tariff.tier3MaxKm ?? 15,
      tier3PricePerKm: tariff.tier3PricePerKm ?? tariff.pricePerKm,
      isActive: tariff.isActive,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Точно удалить этот тариф?")) {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Удалено" });
    }
  };

  const onSubmit = async (data: TariffForm) => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data });
        toast({ title: "Тариф обновлен" });
      } else {
        await createMutation.mutateAsync({ data });
        toast({ title: "Тариф создан" });
      }
      setIsModalOpen(false);
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const openCreateOpt = () => {
    setEditingOptId(null);
    optForm.reset({ name: "", description: "", price: 0, city: "", isActive: true });
    setIsOptModalOpen(true);
  };

  const openEditOpt = (opt: any) => {
    setEditingOptId(opt.id);
    optForm.reset({ name: opt.name, description: opt.description ?? "", price: opt.price, city: opt.city ?? "", isActive: opt.isActive });
    setIsOptModalOpen(true);
  };

  const handleDeleteOpt = async (id: number) => {
    if (confirm("Удалить опцию?")) {
      await deleteOptMutation.mutateAsync({ id });
      toast({ title: "Удалено" });
    }
  };

  const onSubmitOpt = async (data: OptionForm) => {
    try {
      const payload = { ...data, city: data.city || null };
      if (editingOptId) {
        await updateOptMutation.mutateAsync({ id: editingOptId, data: payload as any });
        toast({ title: "Опция обновлена" });
      } else {
        await createOptMutation.mutateAsync({ data: payload as any });
        toast({ title: "Опция создана" });
      }
      setIsOptModalOpen(false);
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const cityList = Array.isArray(cities) ? cities : [];

  return (
    <MainLayout allowedRoles={['admin']}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-display font-bold">Тарифы и опции</h1>
          <button
            onClick={tab === 'tariffs' ? openCreate : openCreateOpt}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {tab === 'tariffs' ? "Добавить тариф" : "Добавить опцию"}
          </button>
        </div>

        <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl w-fit">
          {[
            { id: 'tariffs', label: 'Тарифы', icon: BadgeRussianRuble },
            { id: 'options', label: 'Опции', icon: Tag },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all",
                tab === t.id
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'tariffs' && (
          isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tariffs?.map(tariff => (
                <div key={tariff.id} className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold">{tariff.name}</h3>
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full mt-1 ${(tariff as any).category === 'delivery' ? 'bg-amber-500/15 text-amber-400' : 'bg-violet-500/15 text-violet-400'}`}>
                          {(tariff as any).category === 'delivery' ? '📦 Доставка' : '🚖 Такси'}
                        </span>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-md ${tariff.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive'}`}>
                        {tariff.isActive ? 'Активен' : 'Отключен'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 h-10 line-clamp-2">{tariff.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Базовая цена:</span>
                        <span className="font-medium">{formatMoney(tariff.basePrice)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Цена за км:</span>
                        <span className="font-medium">{formatMoney(tariff.pricePerKm)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Минималка:</span>
                        <span className="font-medium">{formatMoney(tariff.minPrice)}</span>
                      </div>
                    </div>

                    {(tariff as any).tier1PricePerKm && (
                      <div className="pt-3 border-t border-white/[0.06] space-y-1.5 mb-3">
                        <div className="text-xs text-white/30 uppercase tracking-wider mb-2">Ступенчатые тарифы</div>
                        {[1,2,3].map(n => {
                          const max = (tariff as any)[`tier${n}MaxKm`];
                          const price = (tariff as any)[`tier${n}PricePerKm`];
                          if (!max || !price) return null;
                          return (
                            <div key={n} className="flex justify-between text-xs text-white/50">
                              <span>Уровень {n} (до {max} км):</span>
                              <span>{formatMoney(price)}/км</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {cityList.length > 0 && (
                      <div className="pt-3 border-t border-white/[0.06]">
                        <button
                          onClick={() => setExpandedOverrideTariffId(expandedOverrideTariffId === tariff.id ? null : tariff.id)}
                          className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors mb-2"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Цены по городам
                          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expandedOverrideTariffId === tariff.id && "rotate-180")} />
                        </button>
                        {expandedOverrideTariffId === tariff.id && (
                          <CityOverridesPanel tariff={tariff} cities={cityList} />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 border-t border-white/5 pt-4 mt-4">
                    <button onClick={() => openEdit(tariff)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(tariff.id)} className="p-2 bg-destructive/10 hover:bg-destructive/20 rounded-lg text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'options' && (
          optLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(options as any[])?.map((opt: any) => (
                <div key={opt.id} className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{opt.name}</h3>
                      <span className={`px-2 py-1 text-xs rounded-md ${opt.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {opt.isActive ? 'Активна' : 'Отключена'}
                      </span>
                    </div>
                    {opt.description && <p className="text-sm text-white/40 mb-3">{opt.description}</p>}
                    <div className="text-xl font-bold text-violet-400">+{formatMoney(opt.price)}</div>
                    {opt.city && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-white/40">
                        <MapPin className="w-3 h-3" /> {opt.city}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 border-t border-white/5 pt-3 mt-3">
                    <button onClick={() => openEditOpt(opt)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteOpt(opt.id)} className="p-2 bg-destructive/10 hover:bg-destructive/20 rounded-lg text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(!options || (options as any[]).length === 0) && (
                <div className="col-span-3 text-center text-white/20 py-12 text-sm">Нет опций. Создайте первую.</div>
              )}
            </div>
          )
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-white"><X /></button>
              <h2 className="text-2xl font-bold mb-6">{editingId ? 'Редактировать тариф' : 'Новый тариф'}</h2>
              
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Категория</label>
                  <select {...form.register("category")} className={fieldCls}>
                    <option value="taxi">🚖 Такси</option>
                    <option value="delivery">📦 Доставка</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Название</label>
                  <input {...form.register("name")} className={fieldCls} />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Описание</label>
                  <textarea {...form.register("description")} className={fieldCls + " h-16 resize-none"} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-gray-400">База (₽)</label>
                    <input type="number" step="0.01" {...form.register("basePrice")} className={fieldCls} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">За км (₽)</label>
                    <input type="number" step="0.01" {...form.register("pricePerKm")} className={fieldCls} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Минимум (₽)</label>
                    <input type="number" step="0.01" {...form.register("minPrice")} className={fieldCls} />
                  </div>
                </div>

                <div className="pt-2">
                  <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                    <div className="w-4 h-px bg-white/20" />
                    Ступенчатые тарифы (опционально)
                    <div className="flex-1 h-px bg-white/20" />
                  </div>
                  {[1, 2, 3].map(n => (
                    <div key={n} className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-gray-500">Уровень {n}: до км</label>
                        <input type="number" step="0.1" {...form.register(`tier${n}MaxKm` as any)} placeholder={String(n * 5)} className={fieldCls} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Уровень {n}: ₽/км</label>
                        <input type="number" step="0.01" {...form.register(`tier${n}PricePerKm` as any)} className={fieldCls} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" {...form.register("isActive")} id="activeCheck" className="w-4 h-4 rounded accent-primary" />
                  <label htmlFor="activeCheck" className="text-sm text-white">Активен</label>
                </div>
                
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-full py-3 mt-2 rounded-xl bg-primary text-white font-semibold flex justify-center items-center"
                >
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="animate-spin" /> : "Сохранить"}
                </button>
              </form>
            </div>
          </div>
        )}

        {isOptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
              <button onClick={() => setIsOptModalOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-white"><X /></button>
              <h2 className="text-2xl font-bold mb-6">{editingOptId ? 'Редактировать опцию' : 'Новая опция'}</h2>
              
              <form onSubmit={optForm.handleSubmit(onSubmitOpt)} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Название</label>
                  <input {...optForm.register("name")} className={fieldCls} />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Описание</label>
                  <textarea {...optForm.register("description")} className={fieldCls + " h-16 resize-none"} />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Цена (₽)</label>
                  <input type="number" step="0.01" {...optForm.register("price")} className={fieldCls} />
                </div>
                <div>
                  <label className="text-sm text-gray-400">
                    Город <span className="text-white/30">(оставьте пустым — для всех городов)</span>
                  </label>
                  <select {...optForm.register("city")} className={fieldCls}>
                    <option value="">Все города</option>
                    {cityList.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" {...optForm.register("isActive")} id="optActiveCheck" className="w-4 h-4 rounded accent-primary" />
                  <label htmlFor="optActiveCheck" className="text-sm text-white">Активна</label>
                </div>
                <button
                  type="submit"
                  disabled={createOptMutation.isPending || updateOptMutation.isPending}
                  className="w-full py-3 mt-2 rounded-xl bg-primary text-white font-semibold flex justify-center items-center"
                >
                  {createOptMutation.isPending || updateOptMutation.isPending ? <Loader2 className="animate-spin" /> : "Сохранить"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
