/**
 * Drizzle Kit Configuration for Speclens Database Migrations
 *
 * Generates SQL migrations from the Drizzle schema defined in database/schema.ts
 * Run: npx drizzle-kit generate
 * Run: npx drizzle-kit push
 */
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  out: "./database/migrations",
  schema: "./database/schema.ts",
  driver: "neon-serverless",
  dialect: "postgresql",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
  // Skip generation if no DATABASE_URL is set (useful for CI)
  // verbose: true, // Uncomment to see generated SQL statements
})