const fs = require("fs");
const { chromium } = require("playwright");

const PROXY_HOST = "155.254.34.102";
const PROXY_PORT = "6082";
const PROXY_USER = "xcorebit";
const PROXY_PASS = "slbjuiiza19f";

const TARGET_URL = "https://citydev-portal.edinburgh.gov.uk/idoxpa-web/scottishBuildingWarrantDetails.do?keyVal=T1A67ZEWK0T00&activeTab=summary";

async function run() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      proxy: {
        server: `http://${PROXY_HOST}:${PROXY_PORT}`,
        username: PROXY_USER,
        password: PROXY_PASS
      },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);

    const data = await page.evaluate(() => {
      const result = { url: location.href, title: document.title, fields: {} };
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
            if (key) result.fields[key] = val;
          } else if (tr.children.length === 2) {
            const key = tr.children[0].innerText.trim();
            const val = tr.children[1].innerText.trim();
            if (key) result.fields[key] = val;
          }
        });
      });
      const dls = Array.from(document.querySelectorAll("dl"));
      dls.forEach((dl) => {
        const dts = dl.querySelectorAll("dt");
        const dds = dl.querySelectorAll("dd");
        for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
          const key = dts[i].innerText.trim();
          const val = dds[i].innerText.trim();
          if (key) result.fields[key] = val;
        }
      });
      const scripts = Array.from(document.querySelectorAll("script")).map((s) => s.innerText).join("\\n");
      const coordMatch = scripts.match(/(-?\\d+\\.\\d+)[,\\s]+(-?\\d+\\.\\d+)/);
      if (coordMatch) {
        result.geometry = { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[2]) };
      }
      return result;
    });

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

    try {
      await page.click("text=Further Information");
      await page.waitForTimeout(700);
      const further = await extractVisibleFields();
      data.furtherInformation = further;
    } catch (e) {
      data.furtherInformation = {};
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
