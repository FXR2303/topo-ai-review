import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const evaluations = sqliteTable("evaluations", {
  id: text("id").primaryKey(),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key"),
  referenceKey: text("reference_key"),
  category: text("category").notNull().default("其他"),
  source: text("source").notNull().default("人工评测"),
  status: text("status").notNull().default("complete"),
  passed: integer("passed", { mode: "boolean" }).notNull().default(false),
  score: integer("score").notNull().default(0),
  scoresJson: text("scores_json").notNull().default("{}"),
  notesJson: text("notes_json").notNull().default("{}"),
  metricsJson: text("metrics_json").notNull().default("{}"),
  issuesJson: text("issues_json").notNull().default("[]"),
  summary: text("summary").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const pkComparisons = sqliteTable("pk_comparisons", {
  id: text("id").primaryKey(),
  modelAId: text("model_a_id").notNull(),
  modelBId: text("model_b_id").notNull(),
  winner: text("winner").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
