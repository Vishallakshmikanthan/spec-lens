/**
 * Speclens Database Client
 * Server-side only - never import into browser components.
 * Reuses database connections via drizzle-orm's connection pooling.
 */

import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import * as schema from "../../database/schema"

let db: ReturnType<typeof drizzle> | null = null

function initDb() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is not defined. " +
        "See .env.example for required variables."
    )
  }

  const sql = neon(databaseUrl)
  db = drizzle(sql, { schema })
}

export const getDb = (): ReturnType<typeof drizzle> => {
  if (!db) initDb()
  return db
}

export const database = schema

export {
  schema,
}