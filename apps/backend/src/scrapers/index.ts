// Scraper registry — add new scrapers here
import { runVodovodScraper }        from './vodovod';
import { runElektroScraper }        from './elektrodistribucija';
import { runSarajevoGasScraper }    from './sarajevogas';
import { runToplaneScraper }        from './toplane';
import { runBhTelekomScraper }      from './bhtelekom';

export interface ScraperResult {
  source:   string;
  found:    number;
  newCount: number;
  error?:   string;
}

export const SCRAPERS: Array<{ name: string; run: () => Promise<ScraperResult> }> = [
  { name: 'KJKP Vodovod',              run: runVodovodScraper       },
  { name: 'Elektrodistribucija EPBiH', run: runElektroScraper       },
  { name: 'Sarajevogas',               run: runSarajevoGasScraper   },
  { name: 'Toplane Sarajevo',          run: runToplaneScraper        },
  { name: 'BH Telecom',                 run: runBhTelekomScraper      },
];
