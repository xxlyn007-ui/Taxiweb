import { db, usersTable, driversTable, tariffsTable, ordersTable } from "@workspace/db";

function hashPassword(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) + password.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(16);
}

async function seed() {
  console.log("Seeding database...");

  const existingUsers = await db.select().from(usersTable);
  if (existingUsers.length > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  const [admin] = await db.insert(usersTable).values({
    name: "Администратор",
    phone: "89237720974",
    password: hashPassword("TaxiImpuls26"),
    role: "admin",
    city: "Красноярск",
    rating: 5.0,
    totalRides: 0,
  }).returning();

  const [driverUser2] = await db.insert(usersTable).values({
    name: "Алексей Сидоров",
    phone: "79997654321",
    password: hashPassword("driver456"),
    role: "driver",
    city: "Ачинск",
    rating: 4.6,
    totalRides: 89,
  }).returning();

  const [passenger2] = await db.insert(usersTable).values({
    name: "Дмитрий Козлов",
    phone: "79998765432",
    password: hashPassword("pass456"),
    role: "passenger",
    city: "Канск",
    rating: 4.7,
    totalRides: 18,
  }).returning();

  const [tariff1] = await db.insert(tariffsTable).values({
    name: "Эконом",
    description: "Доступный тариф для повседневных поездок",
    basePrice: 80,
    pricePerKm: 20,
    minPrice: 120,
    isActive: true,
  }).returning();

  const [tariff2] = await db.insert(tariffsTable).values({
    name: "Стандарт",
    description: "Комфортная поездка по разумной цене",
    basePrice: 120,
    pricePerKm: 28,
    minPrice: 180,
    isActive: true,
  }).returning();

  const [tariff3] = await db.insert(tariffsTable).values({
    name: "Комфорт",
    description: "Премиальный автомобиль и высокий уровень сервиса",
    basePrice: 200,
    pricePerKm: 40,
    minPrice: 300,
    isActive: true,
  }).returning();

  const [driver2] = await db.insert(driversTable).values({
    userId: driverUser2.id,
    carModel: "Kia Rio",
    carColor: "Серый",
    carNumber: "В456ГД124",
    city: "Ачинск",
    status: "offline",
    rating: 4.6,
    totalRides: 89,
    balance: 7200,
    tariffId: tariff1.id,
    isApproved: true,
  }).returning();

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  await db.insert(ordersTable).values([
    {
      passengerId: passenger2.id,
      driverId: driver2.id,
      city: "Ачинск",
      fromAddress: "ул. Советская, 12",
      toAddress: "Вокзал Ачинск-1",
      status: "cancelled",
      price: 220,
      tariffName: "Эконом",
      createdAt: yesterday,
    },
  ]);

  console.log("Seed complete!");
  console.log("Администратор: 89237720974");
}

seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
