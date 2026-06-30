#!/usr/bin/env node

import fs from "node:fs";

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "config.js",
  "vercel.json",
  "apps-script/Code.gs",
  "data/sheets-schema.json",
  "docs/technical-spec.md",
  "docs/vercel-google-sheets-product-plan.md",
  "README.md"
];

const requiredDomIds = [
  "includedCount",
  "representativeCount",
  "reviewCount",
  "duplicateCount",
  "sortDateButton",
  "collectionStatus",
  "adminPanel",
  "teamSelect",
  "planForm",
  "keywordForm",
  "keywordList",
  "articleTable"
];

const requiredAppTerms = [
  "NEWS_DASHBOARD_CONFIG",
  "Google Sheets",
  "sourceType",
  "admin",
  "viewer",
  "extractKeywordCandidates",
  "buildSheetsPayload",
  "syncSheets"
];

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing file: ${file}`);
}

const html = read("index.html");
const app = read("app.js");
const readme = read("README.md");
const schema = JSON.parse(read("data/sheets-schema.json"));

for (const id of requiredDomIds) {
  if (!html.includes(`id="${id}"`)) failures.push(`missing DOM id: ${id}`);
}

for (const term of requiredAppTerms) {
  if (!app.includes(term)) failures.push(`missing app term: ${term}`);
}

for (const tab of ["users", "plans", "programs", "keywords", "items", "matches", "fetch_runs"]) {
  if (!schema.tabs?.[tab]?.columns?.length) failures.push(`missing sheet tab schema: ${tab}`);
}

for (const phrase of ["Vercel", "Google Sheets", "명세", "관리자", "보기 전용"]) {
  if (!readme.includes(phrase)) failures.push(`README missing phrase: ${phrase}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedFiles: requiredFiles.length,
      checkedDomIds: requiredDomIds.length,
      sheetTabs: Object.keys(schema.tabs).length
    },
    null,
    2
  )
);

function read(file) {
  return fs.readFileSync(file, "utf8");
}
