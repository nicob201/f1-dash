CREATE TABLE `circuits` (
	`id` text PRIMARY KEY NOT NULL,
	`length` integer NOT NULL,
	`altitude` integer NOT NULL,
	`opened` integer NOT NULL,
	`first_gp` integer NOT NULL,
	`path` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `races` ADD `circuit_id` text DEFAULT '' NOT NULL;