Setup and run

1. Install dependencies:

```bash
npm install
```

2. Install Playwright browsers:

```bash
npx playwright install
```

Run the scraper (pass proxy via env if needed):

```bash
npm run scrape:pw
```

Environment variables

Set these environment variables if you need to route traffic through a proxy:

- PROXY_HOST
- PROXY_PORT
- PROXY_USER
- PROXY_PASS

If you store variables in a `.env` file, load them into your current shell session before running the scrapers. For zsh/bash you can run:

```bash
set -a && source .env && set +a
npm run scrape:pw
```

This exports all variables from `.env` into the current terminal session so `process.env` is available to the scripts.

How it works

- Launches headless Chromium via Playwright.
- If proxy env vars are present it will use them for the browser context.
- Navigates to the Edinburgh building warrant page, clicks the Summary and Further Information tabs, and extracts visible fields.
- Saves structured JSON to `output.json` (includes `summary` and `furtherInformation`).
- Error handling ensures the browser closes on failure.

Notes

- This website is not available in our country; therefore the Playwright scraper is configured to use a proxy when needed.

WNC building control scraper

- Run the scraper:

```bash
npm run scrape:got
```

How it works

  - Uses `got` + `cheerio` to request pages and parse HTML.
  - Submits the disclaimer form (clicks "Agree") to reach the page content.
  - Extracts the main details from the `#Main-Details` table, the `#Plots` table and the `#Site-history` table.
  - Saves structured arrays for `plots` and `siteHistory` using table headers as object keys.
  - Saves structured JSON to `output-wnc.json` with `main`, `plots` and `siteHistory` sections.
