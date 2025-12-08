const fs = require("fs");
const { chromium } = require("playwright");

const PROXY_HOST = process.env.PROXY_HOST || "";
const PROXY_PORT = process.env.PROXY_PORT || "";
const PROXY_USER = process.env.PROXY_USER || "";
const PROXY_PASS = process.env.PROXY_PASS || "";
const TARGET_URL = "https://citydev-portal.edinburgh.gov.uk/idoxpa-web/scottishBuildingWarrantDetails.do?keyVal=T1A67ZEWK0T00&activeTab=summary";

const DEFAULT_CONTEXT_OPTIONS = {
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 800 }
};

async function set_browser() {
  const browser = await chromium.launch({ headless: true });
  const contextOptions = set_proxy();
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  return page;
}

function set_proxy() {
  const opts = DEFAULT_CONTEXT_OPTIONS;
  if (PROXY_HOST && PROXY_PORT) {
    opts.proxy = {
      server: `http://${PROXY_HOST}:${PROXY_PORT}`,
      username: PROXY_USER || undefined,
      password: PROXY_PASS || undefined
    };
  }
  return opts;
}

async function extractVisibleFields(page) {
  return await page.evaluate(() => {
    const result = {};
    const tables = Array.from(document.querySelectorAll("table"));
    tables.forEach((table) => {
      Array.from(table.querySelectorAll("tr")).forEach((tr) => {
        const th = tr.querySelector("th");
        const tds = tr.querySelectorAll("td");
        if (th && tds.length) {
          const key = th.innerText.trim();
          const val = Array.from(tds)
            .map((td) => td.innerText.trim())
            .filter(Boolean)
            .join(" ");
          if (key) result[key] = val;
        }
      });
    });
    return result;
  });
}

async function summary_extraction(page) {
  return await extractVisibleFields(page);
}

async function further_information_extraction(page) {
  try {
    await page.click("text=Further Information");
    await page.waitForTimeout(700);
    return await extractVisibleFields(page);
  } catch (e) {
    return {};
  }
}

async function Main() {
  let page;
  try {
    page = await set_browser();
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);
    const url = page.url();
    const titlePromise = page.title();
    const summaryPromise = summary_extraction(page);
    const [title, summary] = await Promise.all([titlePromise, summaryPromise]);
    const data = { url, title, summary: {}, furtherInformation: {} };
    data.summary = summary;
    data.furtherInformation = await further_information_extraction(page);
    await Promise.all([
      fs.promises.writeFile("output.json", JSON.stringify(data, null, 2)),
      page.context().browser().close()
    ]);
    process.exit(0);
  } catch (err) {
    if (page) await page.context().browser().close();
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

Main();
