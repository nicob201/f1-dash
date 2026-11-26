CREATE TABLE `constructors` (
	`season` integer NOT NULL,
	`constructor_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	PRIMARY KEY(`season`, `constructor_id`)
);
--> statement-breakpoint
CREATE TABLE `drivers` (
	`season` integer NOT NULL,
	`driver_id` text NOT NULL,
	`code` text NOT NULL,
	`car_number` integer NOT NULL,
	`given_name` text NOT NULL,
	`family_name` text NOT NULL,
	`constructor_id` text NOT NULL,
	PRIMARY KEY(`season`, `driver_id`)
);
--> statement-breakpoint
CREATE TABLE `grids` (
	`season` integer NOT NULL,
	`round` integer NOT NULL,
	`kind` text NOT NULL,
	`car_number` integer NOT NULL,
	`position` integer NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`season`, `round`, `kind`, `car_number`)
);
--> statement-breakpoint
CREATE TABLE `pit_stops` (
	`season` integer NOT NULL,
	`round` integer NOT NULL,
	`driver_id` text NOT NULL,
	`stop` integer NOT NULL,
	`lap` integer NOT NULL,
	`duration` text,
	PRIMARY KEY(`season`, `round`, `driver_id`, `stop`)
);
--> statement-breakpoint
CREATE TABLE `races` (
	`season` integer NOT NULL,
	`round` integer NOT NULL,
	`name` text NOT NULL,
	`circuit` text NOT NULL,
	`locality` text NOT NULL,
	`country` text NOT NULL,
	PRIMARY KEY(`season`, `round`)
);
--> statement-breakpoint
CREATE TABLE `results` (
	`season` integer NOT NULL,
	`round` integer NOT NULL,
	`kind` text NOT NULL,
	`driver_id` text NOT NULL,
	`constructor_id` text NOT NULL,
	`car_number` integer NOT NULL,
	`position` integer,
	`position_text` text,
	`grid` integer,
	`points` real,
	`status` text,
	`time` text,
	`q1` text,
	`q2` text,
	`q3` text,
	`fastest_lap_rank` integer,
	`fastest_lap_time` text,
	PRIMARY KEY(`season`, `round`, `kind`, `driver_id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`season` integer NOT NULL,
	`round` integer NOT NULL,
	`kind` text NOT NULL,
	`starts_at` integer NOT NULL,
	`openf1_key` integer,
	PRIMARY KEY(`season`, `round`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `standings` (
	`season` integer NOT NULL,
	`round` integer NOT NULL,
	`kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`position` integer NOT NULL,
	`points` real NOT NULL,
	`wins` integer NOT NULL,
	PRIMARY KEY(`season`, `round`, `kind`, `entity_id`)
);
