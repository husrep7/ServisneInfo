import cron from 'node-cron';
import { config } from '../config';
import { SCRAPERS, type ScraperResult } from '../scrapers/index';

let running: Promise<PromiseSettledResult<ScraperResult>[]> | null = null;

// Jedno pokretanje u isto vrijeme — cron, inicijalni prolaz i /scrape-now dijele isti run
export function runAllScrapers(): Promise<PromiseSettledResult<ScraperResult>[]> {
  running ??= Promise.allSettled(SCRAPERS.map(s => s.run())).finally(() => { running = null; });
  return running;
}

export function startScraperJobs() {
  const interval = config.scraperIntervalMinutes;

  cron.schedule(`*/${interval} * * * *`, async () => {
    if (running) {
      console.log('Previous scraper run still in progress — skipping');
      return;
    }
    console.log(`[${new Date().toISOString()}] Running all scrapers...`);
    const results = await runAllScrapers();
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
    await runAllScrapers();
  }, 5000);
}
