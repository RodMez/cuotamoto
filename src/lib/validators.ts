import { z } from "zod";

export const rolSchema = z.enum(["admin", "cobrador", "conductor", "viewer"]);

export const telefonoSchema = z
  .string()
  .trim()
  .regex(/^[0-9+ ]{7,15}$/, "teléfono inválido");

export const emailSchema = z.string().trim().toLowerCase().email("email inválido").nullish();

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().max(120).nullish(),
  telefono: telefonoSchema,
  email: emailSchema,
  password: z.string().min(8, "mínimo 8 caracteres").max(128),
  rol: rolSchema,
  clientId: z.string().trim().min(1).nullish(),
});

export const crearClienteSchema = z.object({
  nombre: z.string().trim().min(1, "nombre requerido").max(120),
  telefono: telefonoSchema,
  documento: z.string().trim().max(40).nullish(),
});

export const editarUsuarioSchema = z.object({
  userId: z.string().trim().min(1, "userId requerido"),
  nombre: z.string().trim().max(120).nullish(),
  telefono: telefonoSchema.nullish(),
  email: emailSchema.nullable().optional(),
  newPassword: z.string().min(8, "mínimo 8 caracteres").max(128).nullish(),
  rol: rolSchema.nullish(),
  activo: z.union([z.literal(0), z.literal(1)]).nullish(),
  clientId: z.string().trim().min(1).nullable().optional(),
});
