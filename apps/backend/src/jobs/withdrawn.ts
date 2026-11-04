// Planiran prekid je povučen (otkazan ili pomjeren) kad ga izvor više ne objavljuje:
// zadnje pokretanje njegovog scrapera je uspjelo i počelo je nakon što je prekid zadnji put viđen.
// Ako zadnje pokretanje nije uspjelo, ne znamo ništa, pa se prekid ne dira (KTD4).
export function withdrawnSql(alias: string): string {
  return `(
    ${alias}.source IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM (
        SELECT sr.error, sr.ran_at FROM scraper_runs sr
         WHERE sr.source = ${alias}.source
         ORDER BY sr.ran_at DESC LIMIT 1
      ) last_run
      WHERE last_run.error IS NULL AND last_run.ran_at > ${alias}.last_seen_at
    )
  )`;
}
