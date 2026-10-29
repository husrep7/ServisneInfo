import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || "postgresql://komunalni:komunalni_pass@localhost:5434/komunalni_db",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || "",
  // Token za admin endpointe (/scrape-now, GET /reports); ako nije postavljen, endpointi su isključeni
  adminToken: process.env.ADMIN_TOKEN || "",
  scraperIntervalMinutes: Number(process.env.SCRAPER_INTERVAL_MINUTES) || 15,
};
