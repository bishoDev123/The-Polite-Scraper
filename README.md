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