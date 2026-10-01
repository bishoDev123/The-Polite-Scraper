# Scraper

## Target Classification:

- **Site**: https://books.toscrape.com
- **Why**: Books to Scrape is explicitly built by toscrape.com as a sandbox
  for practicing web scraping.
- **Scope**: the first 3 pages only.
- **Data collected**: book titles, prices, and star ratings from those pages.
- **robots.txt result**:GET https://books.toscrape.com/robots.txt returned 404
- **Why this is appropriate**: the site is a purpose-built practice sandbox,
  the scope is small and read-only, and no robots.txt rules are being
  overridden since none exist.

I will not reuse this code on another site without checking its rules and
terms first.

---------------------------

## Lane:

- Node.js
- npm

Clone the repository and install dependencies:

`git clone https://github.com/bishoDev123/The-Polite-Scraper.git` <br>
`cd The-Polite-Scraper` <br>
`npm install` <br>
`npm run dev`

output is stored in `src/output` and cache is in `src/cache`

--------------------------

## Record schema:

```json
{
  title: string,
  price: string,
  parsedPrice: number,
  availability: string,
  description: string | null,
  rating: string,
  product_url: string,
  source_page: string,
  fetched_at: string
}
```

Zod schema:

```javascript
const BookSchema = z.object({ title: z.string(), price: z.string(), parsedPrice: z.number(), availability: z.string(), description: z.string().nullable(), rating: z.string(), product_url: z.string().url(), source_page: z.string().url(), fetched_at: z.string().datetime({ offset: true }) });
```
-------------------------

## Politeness rules:

- User-Agent: identifies the scraper as FlyRankInternshipA9/1.0 and provides the project URL.
- Delay: waits 500 ms before making a request that is not served from the local cache.
- Timeout: requests have a 5-second timeout.
- Retries: timeout errors and HTTP 5xx responses are retried once after a short 1-second delay.
- No retry for 403/404: forbidden or nonexistent pages are not repeatedly requested.
- Caching: successfully fetched HTML is stored locally so subsequent runs do not need to request the same pages again.
- Deduplication: each product is identified by its absolute product_url.

-------------------------

## Limitation:

The scraper only processes the first three catalogue pages, so it does not attempt to build a complete dataset of every book on the website.

------------------------

## Run-report example:

```json
{
  "start_time": "2026-10-01T16:28:36.078Z",
  "duration_ms": 1409,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 1,
  "failed_pages": []
}
```

----------------------

## Why No Browser?

This assignment did not need a browser because the required data is already present in the HTML sent by the server, so using a browser would only add unnecessary cost and complexity.

## Ethics

Use an official API when one exists. Never bypass logins, paywalls, or access blocks. Collect only the data that is actually needed, and make requests at a reasonable rate.
