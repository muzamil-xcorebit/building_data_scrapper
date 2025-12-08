const fs = require("fs");
const got = require("got");
const cheerio = require("cheerio");
const { CookieJar } = require("tough-cookie");
const { URL, URLSearchParams } = require("url");

const START_URL = "https://wnc.planning-register.co.uk/Disclaimer?returnUrl=%2FBuildingControl%2FDisplay%2FFP%2F2025%2F0159";
const OUTPUT_FILE = "output-wnc.json";

const SKIP_LABEL = 'Copy notices are not available from the Local Authority for Fensa, Competent Persons or Approved Inspectors Applications - Please see specific notes below.';

// Default headers to mimic a real browser and avoid bot detection
const DEFAULT_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-GB,en;q=0.9"
};

function normalizeKey(k) {
  return k.replace(/[:\n\r\t]+/g, "").trim();
}

function createClient() {
  // Keep cookies between requests so the session state is preserved
  const cookieJar = new CookieJar();
  return got.extend({
    cookieJar,
    headers: DEFAULT_HEADERS,
    followRedirect: true,
    timeout: 30000
  });
}

function parseTableRowsAsArray($, table) {
  // Convert table rows into an array of cell text arrays
  const rows = [];
  $(table).find("tr").each((i, tr) => {
    const cells = $(tr).find("th,td").map((ii, td) => $(td).text().trim()).get();
    if (cells.length) rows.push(cells);
  });
  return rows;
}

function parseTableToObjects($, table) {
  const rows = parseTableRowsAsArray($, table);
  if (!rows.length) return [];

  const headerHints = /Application number|Received Date|Validated Date|Application Type|Plot Number|Plot Address|Plot Status/i;
  let headerIndex = rows.findIndex(r => headerHints.test(r.join(" ")));
  if (headerIndex < 0) headerIndex = rows.findIndex(r => r.length > 1);
  if (headerIndex < 0) headerIndex = 0;

  const header = rows[headerIndex];
  return rows.slice(headerIndex + 1).map(row =>
    header.reduce((acc, h, ci) => {
      acc[h] = (row[ci] || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
      return acc;
    }, {})
  );
}

async function clickAgree(client, html) {
  const $ = cheerio.load(html);

  const submit = $("input[type=submit][value*='Agree']").first();
  if (submit.length) {
    const form = submit.closest("form");
    const action = new URL(form.attr("action") || START_URL, START_URL).toString();
    const res = await client.post(action, { body: "" });
    return res.body;
  }
  return html;
}

function extractMainDetails($) {
  const main = {};
  const table = $("#Main-Details").find("table").first();
  if (!table || !table.length) return main;

  table.find("td").each((i, td) => {
    const tdHtml = $(td).html() || "";
    const parts = tdHtml.split(/<br\s*\/?>/i);
    const label = parts[0] ? normalizeKey(cheerio.load(parts[0]).text()) : "";
    const value = parts.length > 1 ? cheerio.load(parts.slice(1).join("")).text().trim() : "";
    if (!label || label === SKIP_LABEL) return;
    main[label] = value;
  });

  return main;
}

async function extractPlots(client, $) {
  const table = $("#Plots").find("table").first();
  if (!table || !table.length) return [];
  return parseTableToObjects($, table);
}

async function extractSiteHistory(client, $) {
  const table = $("#Site-history").find("table").first();
  if (!table || !table.length) return [];
  return parseTableToObjects($, table);
}

async function Main() {
  try {
    const client = createClient();
    const start = await client.get(START_URL);
    const pageHtml = await clickAgree(client, start.body); // Click the 'Agree' button on the disclaimer page
    const $ = cheerio.load(pageHtml);

    const result = {
      url: START_URL,
      main: {},
      plots: [],
      siteHistory: []
    };

    result.main = extractMainDetails($);
    result.plots = await extractPlots(client, $);
    result.siteHistory = await extractSiteHistory(client, $);

    await fs.promises.writeFile(OUTPUT_FILE, JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

Main();
