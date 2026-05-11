import { Pool } from "pg";
import { env } from "../config/env.js";
export const pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD
});
export async function query(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows;
}
