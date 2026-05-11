import { z } from "zod";

const ROOM_STATUS_AVAILABLE = "Dispon\u00edvel";
const ROOM_STATUS_MAINTENANCE = "Manuten\u00e7\u00e3o";

const roomStatusSchema = z
  .enum([
    "Livre",
    "Ocupado",
    "Disponivel",
    ROOM_STATUS_AVAILABLE,
    "Manutencao",
    ROOM_STATUS_MAINTENANCE
  ])
  .transform((value) => {
    if (value === "Manutencao") return ROOM_STATUS_MAINTENANCE;

    if (value === "Livre" || value === "Ocupado" || value === "Disponivel") {
      return ROOM_STATUS_AVAILABLE;
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
