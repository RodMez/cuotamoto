import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

// Roles: admin todo, cobrador cobra, conductor solo lo suyo, viewer lectura global
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  telefono: text("telefono").unique(),
  passwordHash: text("password_hash").notNull(),
  rol: text("rol", { enum: ["admin", "cobrador", "conductor", "viewer"] })
    .notNull()
    .default("viewer"),
  createdAt: text("created_at").notNull(),
});

export const vehicles = sqliteTable("vehicles", {
  id: text("id").primaryKey(),
  placa: text("placa").notNull().unique(),
  alias: text("alias"),
  cuotaBase: integer("cuota_base").notNull(), // COP enteros, ej 17000
  activa: integer("activa").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono").notNull().unique(),
  documento: text("documento"),
  userId: text("user_id"), // link a users.id si el conductor entra a la app
  createdAt: text("created_at").notNull(),
});

export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  vehicleId: text("vehicle_id").notNull(),
  clientId: text("client_id").notNull(),
  fechaInicio: text("fecha_inicio").notNull(), // YYYY-MM-DD
  activo: integer("activo").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

// Un día de cuota. cuotaDia puede variar respecto a cuotaBase.
export const ledgerDays = sqliteTable(
  "ledger_days",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id").notNull(),
    diaSeq: integer("dia_seq").notNull(), // 1,2,3...89,90
    fecha: text("fecha").notNull(), // YYYY-MM-DD
    cuotaDia: integer("cuota_dia").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("uq_day_contract_seq").on(t.contractId, t.diaSeq),
    uniqueIndex("uq_day_contract_fecha").on(t.contractId, t.fecha),
  ],
);

// N pagos por día
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull(),
  fecha: text("fecha").notNull(), // YYYY-MM-DD (puede repetirse N veces)
  monto: integer("monto").notNull(), // COP enteros >0
  metodo: text("metodo").notNull().default("efectivo"),
  nota: text("nota"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
});

export type Role = "admin" | "cobrador" | "conductor" | "viewer";
