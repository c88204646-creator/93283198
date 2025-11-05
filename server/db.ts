// Reference: javascript_database blueprint integration
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized pool configuration to reduce NeonDB costs
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Limit max connections (instead of default 20)
  idleTimeoutMillis: 10000, // Close idle connections after 10s
  connectionTimeoutMillis: 10000, // Connection timeout
});

// Configure Neon for optimal performance
neonConfig.fetchConnectionCache = true; // Enable connection caching
neonConfig.pipelineConnect = 'password'; // Faster authentication

export const db = drizzle({ client: pool, schema });

// Graceful shutdown to close all connections
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
