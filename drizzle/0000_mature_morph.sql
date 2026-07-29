CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`file_key` text,
	`reference_key` text,
	`category` text DEFAULT '其他' NOT NULL,
	`source` text DEFAULT '人工评测' NOT NULL,
	`status` text DEFAULT 'complete' NOT NULL,
	`passed` integer DEFAULT false NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`scores_json` text DEFAULT '{}' NOT NULL,
	`notes_json` text DEFAULT '{}' NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`issues_json` text DEFAULT '[]' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pk_comparisons` (
	`id` text PRIMARY KEY NOT NULL,
	`model_a_id` text NOT NULL,
	`model_b_id` text NOT NULL,
	`winner` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
