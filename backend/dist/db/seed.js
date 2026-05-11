import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { calculateReservationTotal } from "../utils/reservation.js";
import { pool } from "./client.js";
import { initializeDatabase } from "./init.js";
function addDays(base, days) {
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next.toISOString();
}
async function seed() {
    await initializeDatabase();
    const client = await pool.connect();
    const standardCategoryId = randomUUID();
    const deluxeCategoryId = randomUUID();
    const masterCategoryId = randomUUID();
    const categories = [
        { id: standardCategoryId, name: "Standard", price: 180 },
        { id: deluxeCategoryId, name: "Deluxe", price: 320 },
        { id: masterCategoryId, name: "Master", price: 520 }
    ];
    const rooms = [
        { id: randomUUID(), number: 101, type: "Standard", capacity: 2, dailyPrice: 180, status: "Livre", categoryId: standardCategoryId },
        { id: randomUUID(), number: 102, type: "Standard", capacity: 2, dailyPrice: 180, status: "Livre", categoryId: standardCategoryId },
        { id: randomUUID(), number: 201, type: "Deluxe", capacity: 3, dailyPrice: 320, status: "Livre", categoryId: deluxeCategoryId },
        { id: randomUUID(), number: 202, type: "Deluxe", capacity: 3, dailyPrice: 320, status: "Livre", categoryId: deluxeCategoryId },
        { id: randomUUID(), number: 301, type: "Master", capacity: 4, dailyPrice: 520, status: "Livre", categoryId: masterCategoryId },
        { id: randomUUID(), number: 302, type: "Master", capacity: 4, dailyPrice: 520, status: "Manutenção", categoryId: masterCategoryId }
    ];
    const pricingRules = [
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
    const clients = [
        {
            id: randomUUID(),
            fullName: "Ana Souza",
            cpf: "12345678901",
            email: "ana.souza@demo.com",
            fone: "11999990001",
            automovel: "Onix",
            placa: "ABC1A11"
        },
        {
            id: randomUUID(),
            fullName: "Bruno Lima",
            cpf: "12345678902",
            email: "bruno.lima@demo.com",
            fone: "11999990002",
            automovel: "HB20",
            placa: "DEF2B22"
        },
        {
            id: randomUUID(),
            fullName: "Carla Mendes",
            cpf: "12345678903",
            email: "carla.mendes@demo.com",
            fone: "11999990003",
            automovel: "Corolla",
            placa: "GHI3C33"
        },
        {
            id: randomUUID(),
            fullName: "Diego Alves",
            cpf: "12345678904",
            email: "diego.alves@demo.com",
            fone: "11999990004",
            automovel: "Compass",
            placa: "JKL4D44"
        },
        {
            id: randomUUID(),
            fullName: "Elisa Rocha",
            cpf: "12345678905",
            email: "elisa.rocha@demo.com",
            fone: "11999990005",
            automovel: "Creta",
            placa: "MNO5E55"
        }
    ];
    const now = new Date();
    const reservations = [
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
            guests: [
                { name: "Bruno Lima", age: 40, pricingRuleId: pricingRules[2].id }
            ]
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
            status: "Concluída",
            guests: [
                { name: "Diego Alves", age: 35, pricingRuleId: pricingRules[2].id }
            ]
        },
        {
            roomId: rooms[4].id,
            clientId: clients[4].id,
            checkInDate: addDays(now, 7),
            checkOutDate: addDays(now, 10),
            status: "Cancelada",
            guests: [
                { name: "Elisa Rocha", age: 29, pricingRuleId: pricingRules[2].id }
            ]
        }
    ];
    try {
        await client.query("BEGIN");
        await client.query(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
      `, [randomUUID(), "Administrador", "admin@hotel.com", bcrypt.hashSync("admin", 10), "admin"]);
        await client.query(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
      `, [randomUUID(), "Gerente", "manager@hotel.com", bcrypt.hashSync("admin", 10), "manager"]);
        await client.query("DELETE FROM reservation_guests");
        await client.query("DELETE FROM reservations");
        await client.query("DELETE FROM clients");
        await client.query("DELETE FROM rooms");
        await client.query("DELETE FROM categories");
        await client.query("DELETE FROM pricing_rules");
        for (const category of categories) {
            await client.query(`
          INSERT INTO categories (id, name, price)
          VALUES ($1, $2, $3)
        `, [category.id, category.name, category.price]);
        }
        for (const room of rooms) {
            await client.query(`
          INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [room.id, room.number, room.type, room.capacity, room.dailyPrice, room.status, room.categoryId]);
        }
        for (const rule of pricingRules) {
            await client.query(`
          INSERT INTO pricing_rules (id, name, description, min_age, max_age, price)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [rule.id, rule.name, rule.description, rule.minAge, rule.maxAge, rule.price]);
        }
        for (const sampleClient of clients) {
            await client.query(`
          INSERT INTO clients (id, full_name, cpf, email, fone, automovel, placa)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
                sampleClient.id,
                sampleClient.fullName,
                sampleClient.cpf,
                sampleClient.email,
                sampleClient.fone,
                sampleClient.automovel,
                sampleClient.placa
            ]);
        }
        for (const reservation of reservations) {
            const room = rooms.find((item) => item.id === reservation.roomId);
            if (!room) {
                throw new Error(`Room ${reservation.roomId} not found while seeding.`);
            }
            const reservationId = randomUUID();
            const guests = reservation.guests.map((guest) => ({
                id: randomUUID(),
                reservationId,
                name: guest.name,
                age: guest.age,
                pricingRuleId: guest.pricingRuleId
            }));
            const totalPrice = calculateReservationTotal(room.dailyPrice, reservation.checkInDate, reservation.checkOutDate, guests, pricingRules);
            await client.query(`
          INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
                reservationId,
                reservation.roomId,
                reservation.clientId,
                reservation.checkInDate,
                reservation.checkOutDate,
                reservation.status,
                totalPrice
            ]);
            for (const guest of guests) {
                await client.query(`
            INSERT INTO reservation_guests (id, reservation_id, name, age, pricing_rule_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [guest.id, reservationId, guest.name, guest.age, guest.pricingRuleId]);
            }
        }
        await client.query(`
      UPDATE rooms
      SET status = CASE
        WHEN status = 'Manutenção' THEN 'Manutenção'
        WHEN EXISTS (
          SELECT 1
          FROM reservations r
          WHERE r.room_id = rooms.id
            AND r.status NOT IN ('Cancelada', 'Concluída')
            AND r.check_in_date <= NOW()
            AND r.check_out_date > NOW()
        ) THEN 'Ocupado'
        ELSE 'Livre'
      END
    `);
        await client.query("COMMIT");
        console.log("Seed finalizada com sucesso.");
        console.log("Usuario admin: admin@hotel.com / admin");
        console.log("Usuario manager: manager@hotel.com / admin");
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Falha ao executar seed:", error);
        process.exitCode = 1;
    }
    finally {
        client.release();
        await pool.end();
    }
}
seed().catch(async (error) => {
    console.error("Erro inesperado na seed:", error);
    await pool.end();
    process.exit(1);
});
