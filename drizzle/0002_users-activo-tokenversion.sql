ALTER TABLE `users` ADD `activo` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `token_version` integer DEFAULT 0 NOT NULL;