import { Router, type IRouter } from "express";
import { eq, sql, and, desc, inArray, or } from "drizzle-orm";
import { db, ordersTable, usersTable, driversTable, tariffsTable, cityTariffOverridesTable, tariffOptionsTable, settingsTable } from "@workspace/db";

import { sendPushToUser, sendPushToDriversInCity } from "../push";
import { checkDriverSubscription } from "./subscriptions";
import {
  GetOrdersResponse,
  GetOrdersQueryParams,
  CreateOrderBody,
  EstimatePriceBody,
  EstimatePriceResponse,
  GetOrderByIdParams,
  GetOrderByIdResponse,
  UpdateOrderParams,
  UpdateOrderBody,
  UpdateOrderResponse,
} from "@workspace/api-zod";
import { CITY_COORDS, geocodeAddress, haversineKm } from "../geocoder";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

function toDate(val: any): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  return new Date(val);
}


// Реальные дорожные расстояния в км между городами Красноярского края
const ROAD_DISTANCES: Record<string, number> = {
  // Красноярск
  "Красноярск→Ачинск": 185,    "Красноярск→Канск": 247,
  "Красноярск→Минусинск": 388, "Красноярск→Железногорск": 60,
  "Красноярск→Зеленогорск": 168, "Красноярск→Сосновоборск": 22,
  "Красноярск→Дивногорск": 27, "Красноярск→Шарыпово": 305,
  "Красноярск→Назарово": 244,  "Красноярск→Лесосибирск": 268,
  "Красноярск→Енисейск": 325,  "Красноярск→Бородино": 292,
  "Красноярск→Заозёрный": 215, "Красноярск→Уяр": 215,
  "Красноярск→Иланский": 266,  "Красноярск→Кодинск": 730,
  "Красноярск→Козулька": 201,  "Красноярск→Норильск": 1873,
  "Красноярск→Игарка": 1503,   "Красноярск→Ужур": 280,
  "Красноярск→Абакан": 402,    "Красноярск→Балахта": 118,
  "Красноярск→Боготол": 210,   "Красноярск→Большая Мурта": 80,
  "Красноярск→Березовка": 35,  "Красноярск→Емельяново": 38,
  "Красноярск→Сухобузимо": 68, "Красноярск→Тюхтет": 320,
  // Ачинск
  "Ачинск→Назарово": 87,    "Ачинск→Шарыпово": 164,
  "Ачинск→Козулька": 18,    "Ачинск→Канск": 432,
  "Ачинск→Минусинск": 517,  "Ачинск→Зеленогорск": 282,
  "Ачинск→Железногорск": 245, "Ачинск→Бородино": 450,
  "Ачинск→Заозёрный": 365,  "Ачинск→Лесосибирск": 390,
  "Ачинск→Дивногорск": 212, "Ачинск→Сосновоборск": 205,
  "Ачинск→Ужур": 97,        "Ачинск→Абакан": 530,
  "Ачинск→Боготол": 26,     "Ачинск→Балахта": 100,
  "Ачинск→Тюхтет": 135,
  // Ужур (часто запрашиваемые)
  "Ужур→Назарово": 55,      "Ужур→Шарыпово": 95,
  "Ужур→Минусинск": 225,    "Ужур→Абакан": 238,
  "Ужур→Балахта": 175,      "Ужур→Боготол": 118,
  "Ужур→Тюхтет": 222,
  // Канск
  "Канск→Иланский": 22,    "Канск→Бородино": 50,
  "Канск→Уяр": 50,         "Канск→Зеленогорск": 84,
  "Канск→Заозёрный": 52,   "Канск→Минусинск": 588,
  // Железногорск / окрестности
  "Железногорск→Зеленогорск": 110, "Железногорск→Сосновоборск": 38,
  "Железногорск→Дивногорск": 85,
  "Дивногорск→Сосновоборск": 46,   "Дивногорск→Зеленогорск": 150,
  "Зеленогорск→Сосновоборск": 59,  "Зеленогорск→Заозёрный": 62,
  // Назарово / Шарыпово / Минусинск
  "Назарово→Шарыпово": 124, "Назарово→Козулька": 68,
  "Назарово→Минусинск": 248,
  "Минусинск→Шарыпово": 164, "Минусинск→Назарово": 248,
  "Минусинск→Абакан": 14,   "Минусинск→Усть-Абакан": 26,
  "Абакан→Усть-Абакан": 8,
  // Восточная группа
  "Бородино→Уяр": 8,        "Бородино→Иланский": 42,
  "Уяр→Иланский": 52,       "Уяр→Заозёрный": 56,
  // Север
  "Лесосибирск→Енисейск": 71,
  "Кодинск→Енисейск": 572,
};

function getInterCityRoadKm(city1: string, city2: string): number | null {
  return ROAD_DISTANCES[`${city1}→${city2}`] ?? ROAD_DISTANCES[`${city2}→${city1}`] ?? null;
}

function sanitizeText(s: string, maxLen = 500): string {
  return s.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

function estimateDistanceFallback(fromAddr: string, toAddr: string, fromCity?: string, toCity?: string): number {
  if (toCity && fromCity && toCity !== fromCity) {
    const roadKm = getInterCityRoadKm(fromCity, toCity);
    if (roadKm !== null) return roadKm;
    // Если пара городов не в таблице — используем haversine с поправкой 1.3
    const c1 = CITY_COORDS[fromCity];
    const c2 = CITY_COORDS[toCity];
    if (c1 && c2) {
      const straight = haversineKm(c1[0], c1[1], c2[0], c2[1]);
      return Math.round(straight * 1.3 * 10) / 10;
    }
    return 200;
  }

  const from = fromAddr.toLowerCase().trim();
  const to = toAddr.toLowerCase().trim();

  const streetRe = /(?:ул(?:ица)?\.?\s*|пр(?:осп(?:ект)?)?\.?\s*|пер(?:еулок)?\.?\s*|бул(?:ьвар)?\.?\s*|пл(?:ощадь)?\.?\s*|ш(?:оссе)?\.?\s*|пр-[тд]\.?\s*)([а-яёa-z0-9\-\s]+?)(?:\s*,|\s*д\.|\s*\d|\s*$)/i;
  const numRe = /(?:д(?:ом)?\.?\s*)?(\d+)/;

  const fromStreet = from.match(streetRe)?.[1]?.trim() ?? '';
  const toStreet = to.match(streetRe)?.[1]?.trim() ?? '';
  const fromNum = parseInt(from.match(numRe)?.[1] ?? '0');
  const toNum = parseInt(to.match(numRe)?.[1] ?? '0');

  let km: number;

  if (fromStreet && toStreet && fromStreet === toStreet && fromNum && toNum) {
    const diff = Math.abs(fromNum - toNum);
    km = Math.max(0.5, Math.min(5, diff * 0.07 + 0.5));
  } else if (fromStreet && toStreet) {
    const streetSimilarity = fromStreet.slice(0, 4) === toStreet.slice(0, 4) ? 0.3 : 1;
    km = 2.5 + streetSimilarity * 2.5;
    if (fromNum && toNum) {
      const numDiff = Math.abs(fromNum - toNum);
      km += Math.min(numDiff * 0.03, 2);
    }
  } else {
    km = 4.5;
  }

  return Math.round(km * 10) / 10;
}

async function osrmRoute(fromLon: number, fromLat: number, toLon: number, toLat: number): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const meters: number = data?.routes?.[0]?.distance;
    if (!meters || meters <= 0) return null;
    return Math.round((meters / 1000) * 10) / 10;
  } catch {
    return null;
  }
}

async function estimateDistance(fromAddr: string, toAddr: string, city: string, toCity?: string): Promise<number> {
  const destCity = (toCity && toCity !== city) ? toCity : city;
  const isIntercity = !!(toCity && toCity !== city);
  const yandexKey = process.env.YANDEX_API_KEY;
  const twogisKey = process.env.TWOGIS_API_KEY;

  if (isIntercity) {
    // 1. Пробуем геокодировать оба адреса и получить маршрут через OSRM
    try {
      const [fromCoords, toCoords] = await Promise.all([
        geocodeAddress(fromAddr, city, yandexKey, twogisKey),
        geocodeAddress(toAddr, destCity, yandexKey, twogisKey),
      ]);
      if (fromCoords && toCoords) {
        const [fromLat, fromLon] = fromCoords;
        const [toLat, toLon] = toCoords;
        const osrmKm = await osrmRoute(fromLon, fromLat, toLon, toLat);
        if (osrmKm !== null && osrmKm > 1) return osrmKm;
        // OSRM недоступен — haversine между геокодированными точками
        const straight = haversineKm(fromLat, fromLon, toLat, toLon);
        if (straight > 1) return Math.round(straight * 1.25 * 10) / 10;
      }
    } catch { /* продолжаем к запасному варианту */ }

    // 2. Запасной вариант: статическая таблица (центр→центр)
    const roadKm = getInterCityRoadKm(city, destCity);
    if (roadKm !== null) return roadKm;

    // 3. Haversine между центрами городов
    const c1 = CITY_COORDS[city];
    const c2 = CITY_COORDS[destCity];
    if (c1 && c2) return Math.round(haversineKm(c1[0], c1[1], c2[0], c2[1]) * 1.3 * 10) / 10;
    return 200;
  }

  // Внутригород: геокодируем оба адреса параллельно
  try {
    const [fromCoords, toCoords] = await Promise.all([
      geocodeAddress(fromAddr, city, yandexKey, twogisKey),
      geocodeAddress(toAddr, city, yandexKey, twogisKey),
    ]);

    if (fromCoords && toCoords) {
      const [fromLat, fromLon] = fromCoords;
      const [toLat, toLon] = toCoords;

      // OSRM (таймаут 3с)
      const osrmKm = await osrmRoute(fromLon, fromLat, toLon, toLat);
      if (osrmKm !== null) return osrmKm;

      // Haversine с коэффициентом
      const straight = haversineKm(fromLat, fromLon, toLat, toLon);
      return Math.max(0.5, Math.round(straight * 1.4 * 10) / 10);
    }
  } catch { /* fall through to address fallback */ }

  // Эвристика по адресу
  return estimateDistanceFallback(fromAddr, toAddr, city, toCity);
}

async function getCityTariff(tariff: typeof tariffsTable.$inferSelect, city: string): Promise<typeof tariffsTable.$inferSelect> {
  const [override] = await db.select().from(cityTariffOverridesTable)
    .where(and(eq(cityTariffOverridesTable.tariffId, tariff.id), eq(cityTariffOverridesTable.city, city)));
  if (!override) return tariff;
  return {
    ...tariff,
    basePrice: override.basePrice ?? tariff.basePrice,
    pricePerKm: override.pricePerKm ?? tariff.pricePerKm,
    minPrice: override.minPrice ?? tariff.minPrice,
  };
}

async function cleanupPassengerHistory(passengerId: number): Promise<void> {
  const HISTORY_LIMIT = 15;
  const completed = await db.select({ id: ordersTable.id })
    .from(ordersTable)
    .where(and(
      eq(ordersTable.passengerId, passengerId),
      inArray(ordersTable.status, ['completed', 'cancelled'])
    ))
    .orderBy(desc(ordersTable.id));
  if (completed.length > HISTORY_LIMIT) {
    const toDelete = completed.slice(HISTORY_LIMIT).map(o => o.id);
    await db.delete(ordersTable).where(inArray(ordersTable.id, toDelete));
  }
}

function calculateTieredPrice(distance: number, tariff: typeof tariffsTable.$inferSelect): number {
  const t1max = tariff.tier1MaxKm ?? 5;
  const t1price = tariff.tier1PricePerKm ?? tariff.pricePerKm;
  const t2max = tariff.tier2MaxKm ?? 10;
  const t2price = tariff.tier2PricePerKm ?? tariff.pricePerKm;
  const t3max = tariff.tier3MaxKm ?? 15;
  const t3price = tariff.tier3PricePerKm ?? tariff.pricePerKm;

  let total = tariff.basePrice;
  let rem = distance;

  const seg1 = Math.min(rem, t1max);
  total += seg1 * t1price;
  rem -= seg1;
  if (rem <= 0) return Math.max(tariff.minPrice, Math.round(total));

  const seg2 = Math.min(rem, t2max - t1max);
  total += seg2 * t2price;
  rem -= seg2;
  if (rem <= 0) return Math.max(tariff.minPrice, Math.round(total));

  const seg3 = Math.min(rem, t3max - t2max);
  total += seg3 * t3price;
  rem -= seg3;
  if (rem <= 0) return Math.max(tariff.minPrice, Math.round(total));

  total += rem * tariff.pricePerKm;
  return Math.max(tariff.minPrice, Math.round(total));
}

function buildOrderShape(
  order: typeof ordersTable.$inferSelect,
  passenger: typeof usersTable.$inferSelect | undefined,
  driver: typeof driversTable.$inferSelect | null | undefined,
  driverUser: typeof usersTable.$inferSelect | null | undefined,
) {
  return {
    id: order.id,
    passengerId: order.passengerId,
    passengerName: passenger?.name || "Неизвестно",
    passengerPhone: passenger?.phone || "",
    driverId: order.driverId,
    driverName: driverUser?.name || null,
    driverPhone: driverUser?.phone || null,
    driverCar: driver?.carModel || null,
    driverCarNumber: driver?.carNumber || null,
    driverLat: driver && ['accepted', 'in_progress'].includes(order.status) ? driver.driverLat ?? null : null,
    driverLon: driver && ['accepted', 'in_progress'].includes(order.status) ? driver.driverLon ?? null : null,
    city: order.city,
    toCity: order.toCity || null,
    fromAddress: order.fromAddress,
    toAddress: order.toAddress,
    status: order.status,
    price: order.price,
    distance: order.distance,
    tariffId: order.tariffId || null,
    tariffName: order.tariffName,
    orderType: order.orderType || "taxi",
    comment: order.comment,
    packageDescription: order.packageDescription || null,
    rating: order.rating,
    bonusUsed: order.bonusUsed ?? 0,
    createdAt: toDate(order.createdAt),
    acceptedAt: toDate(order.acceptedAt),
    completedAt: toDate(order.completedAt),
  };
}

async function batchEnrichOrders(orders: (typeof ordersTable.$inferSelect)[]) {
  if (orders.length === 0) return [];

  const passengerIds = [...new Set(orders.map(o => o.passengerId))];
  const driverIds = [...new Set(orders.filter(o => o.driverId != null).map(o => o.driverId!))];

  const [passengers, driverRows] = await Promise.all([
    db.select().from(usersTable).where(inArray(usersTable.id, passengerIds)),
    driverIds.length > 0 ? db.select().from(driversTable).where(inArray(driversTable.id, driverIds)) : Promise.resolve([]),
  ]);

  const driverUserIds = [...new Set(driverRows.map(d => d.userId))];
  const driverUsers = driverUserIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, driverUserIds))
    : [];

  const passengerMap = new Map(passengers.map(u => [u.id, u]));
  const driverMap = new Map(driverRows.map(d => [d.id, d]));
  const driverUserMap = new Map(driverUsers.map(u => [u.id, u]));

  return orders.map(order => {
    const passenger = passengerMap.get(order.passengerId);
    const driver = order.driverId != null ? driverMap.get(order.driverId) : null;
    const driverUser = driver ? driverUserMap.get(driver.userId) : null;
    return buildOrderShape(order, passenger, driver, driverUser);
  });
}

async function enrichOrder(order: typeof ordersTable.$inferSelect) {
  const [results] = await Promise.all([batchEnrichOrders([order])]);
  return results[0];
}

router.get("/orders", async (req, res): Promise<void> => {
  const queryParams = GetOrdersQueryParams.safeParse(req.query);

  // Определяем городского администратора по сессии
  const sessionUser = await getUserFromRequest(req);
  const adminCity: string | null = sessionUser?.role === "city_admin"
    ? ((sessionUser as any).managed_city ?? (sessionUser as any).managedCity ?? null)
    : null;

  const conditions = [];
  let hasUserFilter = false;
  if (queryParams.success) {
    if (queryParams.data.status) conditions.push(eq(ordersTable.status, queryParams.data.status));
    if (queryParams.data.driverId) { conditions.push(eq(ordersTable.driverId, queryParams.data.driverId)); hasUserFilter = true; }
    if (queryParams.data.passengerId) { conditions.push(eq(ordersTable.passengerId, queryParams.data.passengerId)); hasUserFilter = true; }
  }

  // city_admin: принудительно фильтруем по городу из сессии и только сегодня
  if (adminCity) {
    conditions.push(eq(ordersTable.city, adminCity));
    const t = new Date(); t.setHours(0, 0, 0, 0);
    conditions.push(sql`${ordersTable.createdAt} >= ${t}`);
  } else {
    const cityParam = typeof req.query.city === "string" ? req.query.city : null;
    if (cityParam) conditions.push(eq(ordersTable.city, cityParam));
    const todayParam = req.query.today === "1";
    if (todayParam) {
      const t = new Date(); t.setHours(0, 0, 0, 0);
      conditions.push(sql`${ordersTable.createdAt} >= ${t}`);
    }
  }

  // Ограничиваем выборку: для пассажира/водителя — 50 последних,
  // для admin-запросов (без фильтра по юзеру) — 200.
  const rowLimit = hasUserFilter ? 50 : 200;

  const orders = await db.select().from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(rowLimit);

  const enriched = await batchEnrichOrders(orders);
  res.json(GetOrdersResponse.parse(enriched));
});

router.post("/orders/estimate", async (req, res): Promise<void> => {
  const parsed = EstimatePriceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверные данные" });
    return;
  }

  const toCity: string | undefined = req.body?.toCity || undefined;

  let tariff: typeof tariffsTable.$inferSelect | null = null;
  let tariffName = "Стандарт";

  if (parsed.data.tariffId) {
    const [t] = await db.select().from(tariffsTable).where(eq(tariffsTable.id, parsed.data.tariffId));
    if (t) {
      tariff = await getCityTariff(t, parsed.data.city);
      tariffName = t.name;
    }
  }

  const estimatedDistance = await estimateDistance(parsed.data.fromAddress, parsed.data.toAddress, parsed.data.city, toCity);
  let estimatedPrice: number;

  if (tariff) {
    estimatedPrice = calculateTieredPrice(estimatedDistance, tariff);
  } else {
    estimatedPrice = Math.max(150, Math.round(100 + 25 * estimatedDistance));
  }

  const isIntercity = toCity && toCity !== parsed.data.city;
  const estimatedDuration = isIntercity
    ? Math.round(estimatedDistance / 90 * 60)
    : Math.round(estimatedDistance * 2.5 + 5);
  res.json(EstimatePriceResponse.parse({ estimatedPrice, estimatedDistance, estimatedDuration, tariffName }));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверные данные" });
    return;
  }

  let tariffName = "Стандарт", price = 150;
  let tariff: typeof tariffsTable.$inferSelect | null = null;

  if (parsed.data.tariffId) {
    const [t] = await db.select().from(tariffsTable).where(eq(tariffsTable.id, parsed.data.tariffId));
    if (t) {
      tariff = await getCityTariff(t, parsed.data.city);
      tariffName = t.name;
    }
  }

  // Читаем rawData из req.body напрямую — Zod strip() убирает неизвестные поля (bonusUsed, toCity, orderType, etc.)
  const rawData = req.body as any;

  const distance = await estimateDistance(parsed.data.fromAddress, parsed.data.toAddress, parsed.data.city, rawData.toCity);
  if (tariff) {
    price = calculateTieredPrice(distance, tariff);
  }

  const optionIdsRaw = rawData.optionIds;
  let optionIds: number[] = [];
  let optionsExtraPrice = 0;
  if (optionIdsRaw) {
    try { optionIds = JSON.parse(optionIdsRaw); } catch {}
    if (optionIds.length > 0) {
      const opts = await db.select().from(tariffOptionsTable).where(
        inArray(tariffOptionsTable.id, optionIds)
      );
      optionsExtraPrice = opts.reduce((s, o) => s + (o.price || 0), 0);
    }
  }
  const orderType: string = rawData.orderType === 'delivery' ? 'delivery' : 'taxi';
  const commentRaw: string | undefined = rawData.comment;
  const pkgDesc: string | undefined = rawData.packageDescription;
  const totalPrice = price + optionsExtraPrice;

  // Применяем бонусы пассажира (до 50% от стоимости) — в транзакции чтобы бонус не пропал при ошибке
  let bonusUsed = 0;
  const requestedBonus = parseFloat(rawData.bonusUsed ?? rawData.useBonus ?? 0) || 0;
  if (requestedBonus > 0 && parsed.data.passengerId) {
    const [passenger] = await db.select({ bonusBalance: usersTable.bonusBalance })
      .from(usersTable).where(eq(usersTable.id, parsed.data.passengerId));
    const available = passenger?.bonusBalance ?? 0;
    const maxBonus = Math.floor(totalPrice * 0.5);
    bonusUsed = Math.min(available, maxBonus, requestedBonus, totalPrice - 1);
    bonusUsed = Math.max(0, Math.floor(bonusUsed));
  }

  // Транзакция: списание бонуса + создание заказа атомарно
  const order = await db.transaction(async (tx) => {
    if (bonusUsed > 0 && parsed.data.passengerId) {
      await tx.execute(
        sql`UPDATE users SET bonus_balance = bonus_balance - ${bonusUsed} WHERE id = ${parsed.data.passengerId} AND bonus_balance >= ${bonusUsed}`
      );
    }
    const [created] = await tx.insert(ordersTable).values({
      passengerId: parsed.data.passengerId,
      city: sanitizeText(parsed.data.city, 100),
      toCity: rawData.toCity ? sanitizeText(rawData.toCity, 100) : null,
      fromAddress: sanitizeText(parsed.data.fromAddress, 300),
      toAddress: sanitizeText(parsed.data.toAddress, 300),
      tariffId: parsed.data.tariffId,
      tariffName: sanitizeText(tariffName, 100),
      price: totalPrice - bonusUsed,
      distance,
      orderType,
      comment: commentRaw ? sanitizeText(commentRaw, 500) : null,
      packageDescription: pkgDesc ? sanitizeText(pkgDesc, 500) : null,
      optionIds: optionIds.length > 0 ? JSON.stringify(optionIds) : null,
      bonusUsed,
      status: "pending",
    }).returning();
    return created;
  });

  cleanupPassengerHistory(parsed.data.passengerId).catch(() => {});

  const isDelivery = orderType === 'delivery';
  sendPushToDriversInCity(order.city, {
    title: isDelivery ? "📦 Новая доставка!" : "🚖 Новый заказ!",
    body: `${order.city} · ${order.fromAddress} → ${order.toAddress} · ${order.price ? Math.round(order.price) + '₽' : ''}`,
    tag: `order-${order.id}`,
    url: "/driver",
  }, orderType).catch(() => {});

  const enriched = await enrichOrder(order);
  res.status(201).json(enriched);
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderByIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Заказ не найден" });
    return;
  }
  const enriched = await enrichOrder(order);
  res.json(GetOrderByIdResponse.parse(enriched));
});

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }
  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверные данные" });
    return;
  }

  const updateData: any = { ...parsed.data };

  if (parsed.data.status === "accepted") {
    const driverIdForCheck = parsed.data.driverId;
    if (driverIdForCheck) {
      const allowed = await checkDriverSubscription(driverIdForCheck);
      if (!allowed) {
        res.status(403).json({ error: "subscription_required", message: "Для принятия заказов необходима активная подписка" });
        return;
      }
    }
    // Атомарный захват заказа: UPDATE только если status = 'pending'
    // Если другой водитель успел принять — rows вернётся пустым
    const acceptedNow = new Date();
    const [atomicResult] = await db.update(ordersTable)
      .set({ ...updateData, acceptedAt: acceptedNow })
      .where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.status, "pending")))
      .returning();
    if (!atomicResult) {
      res.status(409).json({ error: "Заказ уже принят другим водителем" });
      return;
    }
    if (parsed.data.driverId) {
      await db.update(driversTable).set({ status: "busy" }).where(eq(driversTable.id, parsed.data.driverId));
    }
    // Обогащаем и возвращаем результат
    const enriched = await enrichOrder(atomicResult);
    // Уведомление пассажиру
    const driverId = parsed.data.driverId || atomicResult.driverId;
    let driverName = "Водитель";
    if (driverId) {
      const [drv] = await db.select().from(driversTable).where(eq(driversTable.id, driverId));
      if (drv) {
        const [dUser] = await db.select().from(usersTable).where(eq(usersTable.id, drv.userId));
        driverName = dUser?.name || "Водитель";
      }
    }
    sendPushToUser(atomicResult.passengerId, {
      title: "🚖 Водитель принял заказ!",
      body: `${driverName} едет к вам · ${atomicResult.fromAddress}`,
      tag: `order-accepted-${atomicResult.id}`,
      url: "/passenger",
    }).catch(() => {});
    res.json(UpdateOrderResponse.parse(enriched));
    return;
  }
  if (parsed.data.status === "completed") {
    updateData.completedAt = new Date();
    const [existingOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
    const driverIdToUpdate = parsed.data.driverId || existingOrder?.driverId;
    if (driverIdToUpdate && existingOrder) {
      const bonusForDriver = existingOrder.bonusUsed ?? 0;
      const orderPrice = existingOrder.price || 0;
      // Кэшбэк водителю — настраиваемый % от суммы поездки
      const [drvCashbackSetting] = await db.select().from(settingsTable).where(eq(settingsTable.key, "driver_cashback_percent"));
      const drvCashbackPct = parseFloat(drvCashbackSetting?.value ?? "0");
      const driverCashback = drvCashbackPct > 0 ? Math.floor(orderPrice * drvCashbackPct / 100) : 0;
      // Атомарное обновление — используем SQL-арифметику, без race condition
      await db.update(driversTable).set({
        totalRides: sql`COALESCE(total_rides, 0) + 1`,
        status: "online",
        balance: sql`COALESCE(balance, 0) + ${orderPrice * 0.8}`,
        bonusBalance: sql`COALESCE(bonus_balance, 0) + ${bonusForDriver + driverCashback}`,
      }).where(eq(driversTable.id, driverIdToUpdate));
    }
    if (existingOrder) {
      // Кэшбэк пассажиру — процент от стоимости поездки
      const [cashbackSetting] = await db.select().from(settingsTable).where(eq(settingsTable.key, "cashback_percent"));
      const cashbackPct = parseFloat(cashbackSetting?.value ?? "3");
      const orderPrice = updateData.price || existingOrder?.price || 0;
      const cashback = cashbackPct > 0 ? Math.floor(orderPrice * cashbackPct / 100) : 0;

      await db.execute(
        sql`UPDATE users SET
          total_rides = COALESCE(total_rides, 0) + 1,
          bonus_balance = COALESCE(bonus_balance, 0) + ${cashback}
        WHERE id = ${existingOrder.passengerId}`
      );
    }
  }

  if (parsed.data.status === "cancelled") {
    const [existingOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
    const driverIdToFree = existingOrder?.driverId;
    if (driverIdToFree) {
      await db.update(driversTable).set({ status: "online" }).where(eq(driversTable.id, driverIdToFree));
    }
  }

  const [existingForPush] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));

  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, params.data.id)).returning();
  if (!order) {
    res.status(404).json({ error: "Заказ не найден" });
    return;
  }

  if (existingForPush) {
    if (parsed.data.status === "in_progress") {
      sendPushToUser(existingForPush.passengerId, {
        title: "🏁 Водитель прибыл!",
        body: "Ваш водитель ждёт вас. Поездка начинается.",
        tag: `order-started-${existingForPush.id}`,
        url: "/passenger",
      }).catch(() => {});
    }
    if (parsed.data.status === "completed") {
      sendPushToUser(existingForPush.passengerId, {
        title: "✅ Поездка завершена",
        body: `Спасибо за поездку! Оцените водителя.`,
        tag: `order-done-${existingForPush.id}`,
        url: "/passenger",
      }).catch(() => {});
    }
  }

  const enriched = await enrichOrder(order);
  res.json(UpdateOrderResponse.parse(enriched));
});

router.post("/orders/:id/notify-arrived", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Заказ не найден" }); return; }

  let driverName = "Водитель";
  if (order.driverId) {
    const [drv] = await db.select().from(driversTable).where(eq(driversTable.id, order.driverId));
    if (drv) {
      const [dUser] = await db.select().from(usersTable).where(eq(usersTable.id, drv.userId));
      driverName = dUser?.name || "Водитель";
    }
  }

  sendPushToUser(order.passengerId, {
    title: "🚗 Машина ожидает!",
    body: `${driverName} прибыл на место. Выходите!`,
    tag: `order-arrived-${id}`,
    url: "/passenger",
  }).catch(() => {});

  res.json({ ok: true });
});

router.post("/orders/:id/rate", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }

  const rating = parseInt(req.body.rating);
  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Оценка должна быть от 1 до 5" });
    return;
  }

  const [existingOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!existingOrder) { res.status(404).json({ error: "Заказ не найден" }); return; }
  if (existingOrder.rating) { res.status(400).json({ error: "Заказ уже оценён" }); return; }

  const [order] = await db.update(ordersTable).set({ rating }).where(eq(ordersTable.id, id)).returning();

  if (existingOrder.driverId) {
    const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, existingOrder.driverId));
    if (driver) {
      const totalRides = driver.totalRides || 1;
      const oldRating = driver.rating || 5;
      const ratedOrders = Math.min(totalRides, 100);
      const newRating = ((oldRating * (ratedOrders - 1)) + rating) / ratedOrders;
      await db.update(driversTable).set({ rating: Math.round(newRating * 10) / 10 }).where(eq(driversTable.id, existingOrder.driverId));
    }
  }

  const enriched = await enrichOrder(order);
  res.json(enriched);
});

export default router;
