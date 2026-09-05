import "dotenv/config";
import { z } from "zod";

const optionalEnvEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email().optional()
);

const optionalEnvPassword = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(12).optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("8h"),
  AUTH_COOKIE_NAME: z.string().default("auth_token"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default("portal_hotel"),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1).default("Administrador"),
  BOOTSTRAP_ADMIN_EMAIL: optionalEnvEmail,
  BOOTSTRAP_ADMIN_PASSWORD: optionalEnvPassword,
  SEED_MANAGER_EMAIL: optionalEnvEmail,
  SEED_MANAGER_PASSWORD: optionalEnvPassword
}).superRefine((values, context) => {
  if (Boolean(values.BOOTSTRAP_ADMIN_EMAIL) !== Boolean(values.BOOTSTRAP_ADMIN_PASSWORD)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["BOOTSTRAP_ADMIN_EMAIL"],
      message: "BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD devem ser informados juntos."
    });
  }

  if (Boolean(values.SEED_MANAGER_EMAIL) !== Boolean(values.SEED_MANAGER_PASSWORD)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SEED_MANAGER_EMAIL"],
      message: "SEED_MANAGER_EMAIL e SEED_MANAGER_PASSWORD devem ser informados juntos."
    });
  }
});

export const env = envSchema.parse(process.env);
