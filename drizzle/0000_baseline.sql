CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`telefono` text NOT NULL,
	`documento` text,
	`user_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_telefono_unique` ON `clients` (`telefono`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`client_id` text NOT NULL,
	`fecha_inicio` text NOT NULL,
	`activo` integer DEFAULT 1 NOT NULL,
	`saldo_inicial` integer DEFAULT 0 NOT NULL,
	`omitir_domingos` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ledger_days` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`dia_seq` integer NOT NULL,
	`fecha` text NOT NULL,
	`cuota_dia` integer NOT NULL,
	`exento` integer DEFAULT 0 NOT NULL,
	`motivo` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_day_contract_seq` ON `ledger_days` (`contract_id`,`dia_seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_day_contract_fecha` ON `ledger_days` (`contract_id`,`fecha`);--> statement-breakpoint
CREATE TABLE `omisiones` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`fecha` text NOT NULL,
	`motivo` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_omision_contract_fecha` ON `omisiones` (`contract_id`,`fecha`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`fecha` text NOT NULL,
	`monto` integer NOT NULL,
	`metodo` text DEFAULT 'efectivo' NOT NULL,
	`nota` text,
	`created_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`telefono` text,
	`password_hash` text NOT NULL,
	`rol` text DEFAULT 'viewer' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_telefono_unique` ON `users` (`telefono`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`placa` text NOT NULL,
	`alias` text,
	`cuota_base` integer NOT NULL,
	`activa` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_placa_unique` ON `vehicles` (`placa`);