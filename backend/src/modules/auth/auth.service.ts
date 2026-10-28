import bcrypt from "bcryptjs";
import { query } from "../../db/client.js";
import { HttpError } from "../../utils/http-error.js";
import { signAccessToken } from "../../utils/jwt.js";

// Hash de uma senha aleatória descartada. Com e-mail inexistente o login compara
// contra ele, para o tempo de resposta não revelar quais e-mails existem.
const DUMMY_PASSWORD_HASH = "$2a$12$Z0pkdpCi.t.ZZdG.fpztm.Gt3ZRepUxJ6qZLAtkYLQ8i6oSfws07C";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: "admin" | "receptionist";
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
  const validPassword = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !validPassword) {
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
