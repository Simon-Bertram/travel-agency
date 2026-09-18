ALTER TABLE `user` ADD `role` text DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `two_factor_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
CREATE TABLE `twoFactor` (
	`backup_codes` text NOT NULL,
	`failed_verification_count` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`locked_until` integer,
	`secret` text NOT NULL,
	`user_id` text NOT NULL,
	`verified` integer DEFAULT true,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `twoFactor_secret_idx` ON `twoFactor` (`secret`);--> statement-breakpoint
CREATE INDEX `twoFactor_userId_idx` ON `twoFactor` (`user_id`);
