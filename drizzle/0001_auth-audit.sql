CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` text NOT NULL,
	`user_id` text,
	`accion` text NOT NULL,
	`entidad` text NOT NULL,
	`entidad_id` text,
	`antes` text,
	`despues` text
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`identificador` text PRIMARY KEY NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`bloqueado_hasta` text,
	`actualizado_en` text NOT NULL
);
