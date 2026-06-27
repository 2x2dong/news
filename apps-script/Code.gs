const SHEET_SCHEMA = {
  users: ["email", "role", "name", "active"],
  plans: ["year", "title", "source_url", "imported_at", "raw_text_file", "raw_text_length"],
  programs: ["program_id", "year", "name", "goal", "change_goal", "indicators", "owners", "partners", "active"],
  keywords: ["keyword_id", "keyword", "type", "source", "active", "notes"],
  items: [
    "item_id",
    "title",
    "url",
    "canonical_url",
    "source_name",
    "source_type",
    "published_at",
    "discovered_at",
    "matched_keyword",
    "snippet",
    "ai_summary",
    "ai_basis",
    "review_status",
    "include_in_press_count",
    "representative"
  ],
  matches: ["match_id", "item_id", "program_id", "match_type", "confidence", "basis", "reviewed_by", "reviewed_at"],
  fetch_runs: ["run_id", "started_at", "finished_at", "trigger", "query_count", "item_count", "status", "notes"]
};

function doGet(event) {
  const action = event.parameter.action || "snapshot";
  if (action === "snapshot") return jsonResponse_(readSnapshot_());
  return jsonResponse_({ ok: false, error: "unknown action" }, 400);
}

function doPost(event) {
  ensureSheets_();
  const body = parseBody_(event);
  const action = body.action || "";
  const actor = getActor_(body);

  if (!actor.canWrite) {
    return jsonResponse_({ ok: false, error: "admin permission required" }, 403);
  }

  if (action === "snapshot") {
    writeSnapshot_(body.payload || {});
    return jsonResponse_({ ok: true, action, writtenAt: new Date().toISOString() });
  }

  if (action === "reviewItem") {
    upsertRows_("items", [body.item], "item_id");
    return jsonResponse_({ ok: true, action, item_id: body.item && body.item.item_id });
  }

  if (action === "upsertKeyword") {
    upsertRows_("keywords", [body.keyword], "keyword_id");
    return jsonResponse_({ ok: true, action, keyword_id: body.keyword && body.keyword.keyword_id });
  }

  return jsonResponse_({ ok: false, error: "unknown action" }, 400);
}

function createDailyTriggers() {
  ScriptApp.newTrigger("scheduledFetchMorning").timeBased().everyDays(1).atHour(9).create();
  ScriptApp.newTrigger("scheduledFetchEvening").timeBased().everyDays(1).atHour(18).create();
}

function scheduledFetchMorning() {
  recordFetchRun_("morning");
}

function scheduledFetchEvening() {
  recordFetchRun_("evening");
}

function recordFetchRun_(trigger) {
  ensureSheets_();
  upsertRows_(
    "fetch_runs",
    [
      {
        run_id: Utilities.getUuid(),
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        trigger,
        query_count: "",
        item_count: "",
        status: "scheduled",
        notes: "수집 연결 지점"
      }
    ],
    "run_id"
  );
}

function readSnapshot_() {
  ensureSheets_();
  const result = {};
  Object.keys(SHEET_SCHEMA).forEach((sheetName) => {
    result[sheetName] = readRows_(sheetName);
  });
  return { ok: true, sheets: result, readAt: new Date().toISOString() };
}

function writeSnapshot_(payload) {
  ensureSheets_();
  Object.keys(SHEET_SCHEMA).forEach((sheetName) => {
    const rows = payload[sheetName];
    if (Array.isArray(rows)) replaceRows_(sheetName, rows);
  });
}

function ensureSheets_() {
  const spreadsheet = SpreadsheetApp.getActive();
  Object.keys(SHEET_SCHEMA).forEach((sheetName) => {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
    const headers = SHEET_SCHEMA[sheetName];
    const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (currentHeaders.join("") === "") {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });
}

function readRows_(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const headers = SHEET_SCHEMA[sheetName];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    return item;
  });
}

function replaceRows_(sheetName, rows) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const headers = SHEET_SCHEMA[sheetName];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!rows.length) return;
  const values = rows.map((row) => headers.map((header) => normalizeCell_(row && row[header])));
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function upsertRows_(sheetName, rows, keyColumn) {
  const current = readRows_(sheetName);
  const byKey = {};
  current.forEach((row) => {
    byKey[row[keyColumn]] = row;
  });
  rows.filter(Boolean).forEach((row) => {
    byKey[row[keyColumn]] = Object.assign({}, byKey[row[keyColumn]], row);
  });
  replaceRows_(sheetName, Object.values(byKey));
}

function getActor_(body) {
  const scriptToken = PropertiesService.getScriptProperties().getProperty("ADMIN_TOKEN");
  if (scriptToken && body.token === scriptToken) return { email: "token-admin", role: "admin", canWrite: true };

  const email = Session.getActiveUser().getEmail();
  const user = readRows_("users").find((row) => row.email === email && String(row.active).toLowerCase() !== "false");
  const role = user ? user.role : "";
  return { email, role, canWrite: role === "admin" };
}

function parseBody_(event) {
  try {
    return JSON.parse((event.postData && event.postData.contents) || "{}");
  } catch (error) {
    return {};
  }
}

function normalizeCell_(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return value;
}

function jsonResponse_(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
