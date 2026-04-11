import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

// DB will be null until Neon is connected
export function getDb() {
  if (!connectionString) return null;
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}
