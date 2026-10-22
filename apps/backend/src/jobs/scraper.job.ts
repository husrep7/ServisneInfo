import cron from 'node-cron';
import { config } from '../config';
import { SCRAPERS } from '../scrapers/index';

export function startScraperJobs() {
  const interval = config.scraperIntervalMinutes;

  cron.schedule(`*/${interval} * * * *`, async () => {
    console.log(`[${new Date().toISOString()}] Running all scrapers...`);
    const results = await Promise.allSettled(SCRAPERS.map(s => s.run()));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        console.log(`  ✅ ${SCRAPERS[i].name}: found=${r.value.found}, new=${r.value.newCount}`);
      } else {
        console.log(`  ❌ ${SCRAPERS[i].name}: ${r.reason}`);
      }
    });
  });

  console.log(`✅ ${SCRAPERS.length} scraper(s) scheduled every ${interval} minutes`);
  console.log(`   Sources: ${SCRAPERS.map(s => s.name).join(', ')}`);

  // Run on startup after 5s delay (gives DB time to be ready)
  setTimeout(async () => {
    console.log('Running initial scraper pass...');
    await Promise.allSettled(SCRAPERS.map(s => s.run()));
  }, 5000);
}
