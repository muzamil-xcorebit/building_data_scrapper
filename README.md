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

How it works

- Launches headless Chromium via Playwright.
- If proxy env vars are present it will use them for the browser context.
- Navigates to the Edinburgh building warrant page, clicks the Summary and Further Information tabs, and extracts visible fields.
- Saves structured JSON to `output.json` (includes `summary` and `furtherInformation`).
- Error handling ensures the browser closes on failure.

