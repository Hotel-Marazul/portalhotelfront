export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "receptionist";
}
