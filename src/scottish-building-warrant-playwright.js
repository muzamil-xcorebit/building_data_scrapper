const fs = require("fs");
const { chromium } = require("playwright");

const PROXY_HOST = process.env.PROXY_HOST || "";
const PROXY_PORT = process.env.PROXY_PORT || "";
const PROXY_USER = process.env.PROXY_USER || "";
const PROXY_PASS = process.env.PROXY_PASS || "";

const TARGET_URL = "https://citydev-portal.edinburgh.gov.uk/idoxpa-web/scottishBuildingWarrantDetails.do?keyVal=T1A67ZEWK0T00&activeTab=summary";

async function run() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const contextOptions = {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 }
    };

    if (PROXY_HOST && PROXY_PORT) {
      contextOptions.proxy = {
        server: `http://${PROXY_HOST}:${PROXY_PORT}`,
        username: PROXY_USER || undefined,
        password: PROXY_PASS || undefined
      };
      console.log(`Using proxy ${PROXY_HOST}:${PROXY_PORT} (username ${PROXY_USER ? "set" : "not set"})`);
    } else {
      console.log("No proxy configured via environment variables; running direct connection");
    }

    const context = await browser.newContext(contextOptions);

    const page = await context.newPage();
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);
    const extractVisibleFields = async () => {
      return await page.evaluate(() => {
        const isVisible = (el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== "hidden";
        };
        const result = {};
        const tables = Array.from(document.querySelectorAll("table"));
        tables.forEach((table) => {
          if (!isVisible(table)) return;
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
            } else if (tr.children.length === 2) {
              const key = tr.children[0].innerText.trim();
              const val = tr.children[1].innerText.trim();
              if (key) result[key] = val;
            }
          });
        });
        const dls = Array.from(document.querySelectorAll("dl"));
        dls.forEach((dl) => {
          if (!isVisible(dl)) return;
          const dts = dl.querySelectorAll("dt");
          const dds = dl.querySelectorAll("dd");
          for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
            const key = dts[i].innerText.trim();
            const val = dds[i].innerText.trim();
            if (key) result[key] = val;
          }
        });
        return result;
      });
    };

    const data = { url: await page.url(), title: await page.title(), summary: {}, furtherInformation: {} };
    const summary = await extractVisibleFields();
    data.summary = summary;

    try {
      await page.click("text=Further Information");
      await page.waitForTimeout(700);
      const further = await extractVisibleFields();
      data.furtherInformation = further;
    } catch (e) {
      data.furtherInformation = {};
    }

    const scripts = await page.evaluate(() => Array.from(document.querySelectorAll("script")).map(s => s.innerText).join("\\n"));
    const coordMatch = scripts.match(/(-?\\d+\\.\\d+)[,\\s]+(-?\\d+\\.\\d+)/);
    if (coordMatch) {
      data.geometry = { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[2]) };
    }

    await fs.promises.writeFile("output.json", JSON.stringify(data, null, 2));
    console.log("Data written to output.json");

    await browser.close();
    process.exit(0);
  } catch (err) {
    if (browser) await browser.close();
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

run();
