import { z } from "zod";
const roomStatusSchema = z
    .enum(["Livre", "Ocupado", "Manutenção", "Manutencao", "Disponível", "Disponivel"])
    .transform((value) => {
    if (value === "Manutencao") {
        return "Manutenção";
    }
    if (value === "Disponivel") {
        return "Disponível";
    }
    return value;
});
export const createRoomSchema = z.object({
    roomNumber: z.coerce.number().int().positive(),
    categoryId: z.string().uuid(),
    capacity: z.coerce.number().int().positive(),
    status: roomStatusSchema
});
export const updateRoomSchema = createRoomSchema.partial();
export const roomIdSchema = z.object({
    id: z.string().uuid()
});
