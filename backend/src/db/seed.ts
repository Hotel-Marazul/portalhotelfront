import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import { PricingRule, ReservationGuest } from "../domain/models.js";
import { calculateReservationPricing } from "../utils/reservation.js";
import { pool } from "./client.js";
import { initializeDatabase } from "./init.js";

interface CategorySeed {
  id: string;
  name: string;
  price: number;
  singlePrice: number | null;
  couplePrice: number;
}

interface RoomSeed {
  id: string;
  number: number;
  type: string;
  capacity: number;
  dailyPrice: number;
  status: "Dispon\u00edvel" | "Manuten\u00e7\u00e3o";
  categoryId: string;
}

interface ClientSeed {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  fone: string;
  automovel: string;
  placa: string;
}

interface GuestSeed {
  name: string;
  age: number;
  pricingRuleId: string | null;
}

interface ReservationSeed {
  roomId: string;
  clientId: string;
  checkInDate: string;
  checkOutDate: string;
  status: "Pendente" | "Confirmada" | "EmAndamento" | "Conclu\u00edda" | "Cancelada";
  guests: GuestSeed[];
}

function addDays(base: Date, days: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

async function seed() {
  if (
    !env.BOOTSTRAP_ADMIN_EMAIL ||
    !env.BOOTSTRAP_ADMIN_PASSWORD ||
    !env.SEED_MANAGER_EMAIL ||
    !env.SEED_MANAGER_PASSWORD
  ) {
    throw new Error(
      "Configure BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, SEED_MANAGER_EMAIL e SEED_MANAGER_PASSWORD antes de executar a seed."
    );
  }

  await initializeDatabase();

  const client = await pool.connect();

  const [adminPasswordHash, managerPasswordHash] = await Promise.all([
    bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, 12),
    bcrypt.hash(env.SEED_MANAGER_PASSWORD, 12)
  ]);

  const standardCategoryId = randomUUID();
  const deluxeCategoryId = randomUUID();
  const masterCategoryId = randomUUID();

  const categories: CategorySeed[] = [
    { id: standardCategoryId, name: "Standard", price: 180, singlePrice: null, couplePrice: 180 },
    { id: deluxeCategoryId, name: "Deluxe", price: 320, singlePrice: null, couplePrice: 320 },
    { id: masterCategoryId, name: "Master", price: 520, singlePrice: null, couplePrice: 520 }
  ];

  const rooms: RoomSeed[] = [
    {
      id: randomUUID(),
      number: 101,
      type: "Standard",
      capacity: 2,
      dailyPrice: 180,
      status: "Dispon\u00edvel",
      categoryId: standardCategoryId
    },
    {
      id: randomUUID(),
      number: 102,
      type: "Standard",
      capacity: 2,
      dailyPrice: 180,
      status: "Dispon\u00edvel",
      categoryId: standardCategoryId
    },
    {
      id: randomUUID(),
      number: 201,
      type: "Deluxe",
      capacity: 3,
      dailyPrice: 320,
      status: "Dispon\u00edvel",
      categoryId: deluxeCategoryId
    },
    {
      id: randomUUID(),
      number: 202,
      type: "Deluxe",
      capacity: 3,
      dailyPrice: 320,
      status: "Dispon\u00edvel",
      categoryId: deluxeCategoryId
    },
    {
      id: randomUUID(),
      number: 301,
      type: "Master",
      capacity: 4,
      dailyPrice: 520,
      status: "Dispon\u00edvel",
      categoryId: masterCategoryId
    },
    {
      id: randomUUID(),
      number: 302,
      type: "Master",
      capacity: 4,
      dailyPrice: 520,
      status: "Manuten\u00e7\u00e3o",
      categoryId: masterCategoryId
    }
  ];

  const pricingRules: PricingRule[] = [
    {
      id: randomUUID(),
      name: "Crianca",
      description: "Criancas de 0 a 11 anos",
      minAge: 0,
      maxAge: 11,
      price: 45
    },
    {
      id: randomUUID(),
      name: "Adolescente",
      description: "Adolescentes de 12 a 17 anos",
      minAge: 12,
      maxAge: 17,
      price: 60
    },
    {
      id: randomUUID(),
      name: "Adulto",
      description: "Adultos de 18 a 120 anos",
      minAge: 18,
      maxAge: 120,
      price: 95
    }
  ];

  const clients: ClientSeed[] = [
    {
      id: randomUUID(),
      fullName: "Ana Souza",
      cpf: "52998224725",
      email: "ana.souza@demo.com",
      fone: "11999990001",
      automovel: "Onix",
      placa: "ABC1A11"
    },
    {
      id: randomUUID(),
      fullName: "Bruno Lima",
      cpf: "24681357928",
      email: "bruno.lima@demo.com",
      fone: "11999990002",
      automovel: "HB20",
      placa: "DEF2B22"
    },
    {
      id: randomUUID(),
      fullName: "Carla Mendes",
      cpf: "13579246828",
      email: "carla.mendes@demo.com",
      fone: "11999990003",
      automovel: "Corolla",
      placa: "GHI3C33"
    },
    {
      id: randomUUID(),
      fullName: "Diego Alves",
      cpf: "31415926590",
      email: "diego.alves@demo.com",
      fone: "11999990004",
      automovel: "Compass",
      placa: "JKL4D44"
    },
    {
      id: randomUUID(),
      fullName: "Elisa Rocha",
      cpf: "86420975310",
      email: "elisa.rocha@demo.com",
      fone: "11999990005",
      automovel: "Creta",
      placa: "MNO5E55"
    }
  ];

  const now = new Date();
  const reservations: ReservationSeed[] = [
    {
      roomId: rooms[0].id,
      clientId: clients[0].id,
      checkInDate: addDays(now, -1),
      checkOutDate: addDays(now, 2),
      status: "EmAndamento",
      guests: [
        { name: "Ana Souza", age: 32, pricingRuleId: pricingRules[2].id },
        { name: "Bia Souza", age: 8, pricingRuleId: pricingRules[0].id }
      ]
    },
    {
      roomId: rooms[1].id,
      clientId: clients[1].id,
      checkInDate: addDays(now, 1),
      checkOutDate: addDays(now, 4),
      status: "Confirmada",
      guests: [{ name: "Bruno Lima", age: 40, pricingRuleId: pricingRules[2].id }]
    },
    {
      roomId: rooms[2].id,
      clientId: clients[2].id,
      checkInDate: addDays(now, 3),
      checkOutDate: addDays(now, 5),
      status: "Pendente",
      guests: [
        { name: "Carla Mendes", age: 27, pricingRuleId: pricingRules[2].id },
        { name: "Joao Mendes", age: 15, pricingRuleId: pricingRules[1].id }
      ]
    },
    {
      roomId: rooms[3].id,
      clientId: clients[3].id,
      checkInDate: addDays(now, -8),
      checkOutDate: addDays(now, -6),
      status: "Conclu\u00edda",
      guests: [{ name: "Diego Alves", age: 35, pricingRuleId: pricingRules[2].id }]
    },
    {
      roomId: rooms[4].id,
      clientId: clients[4].id,
      checkInDate: addDays(now, 7),
      checkOutDate: addDays(now, 10),
      status: "Cancelada",
      guests: [{ name: "Elisa Rocha", age: 29, pricingRuleId: pricingRules[2].id }]
    }
  ];

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
      `,
      [
        randomUUID(),
        env.BOOTSTRAP_ADMIN_NAME,
        env.BOOTSTRAP_ADMIN_EMAIL,
        adminPasswordHash,
        "admin"
      ]
    );

    await client.query(
      `
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
      `,
      [randomUUID(), "Gerente", env.SEED_MANAGER_EMAIL, managerPasswordHash, "manager"]
    );

    await client.query("ALTER TABLE reservation_events DISABLE TRIGGER reservation_events_append_only");
    await client.query("DELETE FROM reservation_events");
    await client.query("DELETE FROM reservation_payments");
    await client.query("DELETE FROM reservation_guests");
    await client.query("ALTER TABLE reservation_events ENABLE TRIGGER reservation_events_append_only");
    await client.query("DELETE FROM reservations");
    await client.query("DELETE FROM clients");
    await client.query("DELETE FROM rooms");
    await client.query("DELETE FROM categories");
    await client.query("DELETE FROM pricing_rules");

    for (const category of categories) {
      await client.query(
        `
          INSERT INTO categories (id, name, price, single_price, couple_price)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [category.id, category.name, category.price, category.singlePrice, category.couplePrice]
      );
    }

    for (const room of rooms) {
      await client.query(
        `
          INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [room.id, room.number, room.type, room.capacity, room.dailyPrice, room.status, room.categoryId]
      );
    }

    for (const rule of pricingRules) {
      await client.query(
        `
          INSERT INTO pricing_rules (id, name, description, min_age, max_age, price)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [rule.id, rule.name, rule.description, rule.minAge, rule.maxAge, rule.price]
      );
    }

    for (const sampleClient of clients) {
      await client.query(
        `
          INSERT INTO clients (id, full_name, cpf, email, fone, automovel, placa)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          sampleClient.id,
          sampleClient.fullName,
          sampleClient.cpf,
          sampleClient.email,
          sampleClient.fone,
          sampleClient.automovel,
          sampleClient.placa
        ]
      );
    }

    for (const reservation of reservations) {
      const room = rooms.find((item) => item.id === reservation.roomId);
      if (!room) {
        throw new Error(`Room ${reservation.roomId} not found while seeding.`);
      }

      const reservationId = randomUUID();
      const guests: ReservationGuest[] = reservation.guests.map((guest) => ({
        id: randomUUID(),
        reservationId,
        name: guest.name,
        age: guest.age,
        pricingRuleId: guest.pricingRuleId
      }));

      const category = categories.find((item) => item.id === room.categoryId);
      if (!category) {
        throw new Error(`Category ${room.categoryId} not found while seeding.`);
      }
      const pricing = calculateReservationPricing({
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        guests,
        pricingRules,
        singlePrice: category.singlePrice,
        couplePrice: category.couplePrice,
        legacyDailyPrice: room.dailyPrice
      });

      await client.query(
        `
          INSERT INTO reservations (
            id, room_id, client_id, check_in_date, check_out_date, status,
            total_price, rate_type, base_daily_rate, night_count,
            additional_daily_total, subtotal_price, price_source, discount_amount
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `,
        [
          reservationId,
          reservation.roomId,
          reservation.clientId,
          reservation.checkInDate,
          reservation.checkOutDate,
          reservation.status,
          pricing.totalPrice,
          pricing.rateType,
          pricing.dailyRate,
          pricing.nights,
          pricing.additionalDailyTotal,
          pricing.subtotal,
          pricing.priceSource,
          pricing.discountAmount
        ]
      );

      for (const guest of guests) {
        await client.query(
          `
            INSERT INTO reservation_guests (id, reservation_id, name, age, pricing_rule_id)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [guest.id, reservationId, guest.name, guest.age, guest.pricingRuleId]
        );
      }
    }

    await client.query(`
      UPDATE rooms
      SET status = CASE
        WHEN status = 'Manuten\u00e7\u00e3o' THEN 'Manuten\u00e7\u00e3o'
        ELSE 'Dispon\u00edvel'
      END
    `);

    await client.query("COMMIT");
    console.log("Seed finalizada com sucesso.");
    console.log(`Usuário admin configurado: ${env.BOOTSTRAP_ADMIN_EMAIL}`);
    console.log(`Usuário manager configurado: ${env.SEED_MANAGER_EMAIL}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Falha ao executar seed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(async (error) => {
  console.error("Erro inesperado na seed:", error);
  await pool.end();
  process.exit(1);
});
