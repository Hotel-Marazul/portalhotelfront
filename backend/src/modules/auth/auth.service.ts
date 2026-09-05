import bcrypt from "bcryptjs";
import { query } from "../../db/client.js";
import { HttpError } from "../../utils/http-error.js";
import { signAccessToken } from "../../utils/jwt.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: "admin" | "manager";
}

export async function login(email: string, password: string) {
  const users = await query<UserRow>(
    `
      SELECT id, email, password_hash, role
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email]
  );

  const user = users[0];
  if (!user) {
    throw new HttpError(401, "Credenciais inválidas.");
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw new HttpError(401, "Credenciais inválidas.");
  }

  const token = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  return {
    flag: true,
    message: "Login realizado com sucesso.",
    token
  };
}
