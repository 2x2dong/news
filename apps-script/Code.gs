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
  ensureSheets_();
  const action = event.parameter.action || "snapshot";
  if (action === "snapshot") return jsonResponse_(readSnapshot_());
  return jsonResponse_({ ok: false, error: "unknown action" }, 400);
}

function doPost(event) {
  ensureSheets_();
  const body = parseBody_(event);
  const action = body.action || "";

  if (action === "bootstrapAdminToken") {
    return jsonResponse_(bootstrapAdminToken_(body.token));
  }

  const actor = getActor_(body);

  if (!actor.canWrite) {
    return jsonResponse_({ ok: false, error: "admin permission required" }, 403);
  }

  if (action === "snapshot") {
    writeSnapshot_(body.payload || {});
    return jsonResponse_({ ok: true, action, writtenAt: new Date().toISOString() });
  }

  if (action === "importPlan") {
    return jsonResponse_(importPlan_(body));
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

function setupSheets() {
  ensureSheets_();
  return readSnapshot_();
}

function setAdminToken(token) {
  if (!token) throw new Error("token is required");
  PropertiesService.getScriptProperties().setProperty("ADMIN_TOKEN", String(token));
  return { ok: true, updatedAt: new Date().toISOString() };
}

function bootstrapAdminToken_(token) {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty("ADMIN_TOKEN")) {
    return { ok: false, error: "admin token already exists" };
  }
  if (!token || String(token).length < 24) {
    return { ok: false, error: "token must be at least 24 characters" };
  }
  properties.setProperty("ADMIN_TOKEN", String(token));
  return { ok: true, action: "bootstrapAdminToken", updatedAt: new Date().toISOString() };
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

function importPlan_(body) {
  const year = String(body.year || new Date().getFullYear());
  const title = String(body.title || "사업계획서");
  const sourceUrl = String(body.sourceUrl || "");
  const rawText = readPlanText_(sourceUrl, body.rawText || "");
  const importedAt = new Date().toISOString();

  if (!rawText) {
    return { ok: false, error: "사업계획서 본문을 읽지 못했습니다. 문서 접근 권한 또는 본문 입력을 확인해주세요." };
  }

  upsertRows_(
    "plans",
    [
      {
        year,
        title,
        source_url: sourceUrl,
        imported_at: importedAt,
        raw_text_file: "",
        raw_text_length: rawText.length
      }
    ],
    "year"
  );

  const existingKeywords = readRows_("keywords");
  const existingKeywordKeys = {};
  const existingKeywordIds = {};
  existingKeywords.forEach((row) => {
    existingKeywordKeys[normalizeKey_(row.keyword)] = true;
    existingKeywordIds[row.keyword_id] = true;
  });

  const extractedTerms = extractKeywordCandidates_(rawText);
  const keywordRows = extractedTerms.map((keyword) => ({
    keyword_id: `kw-${year}-${hashString_(keyword)}`,
    keyword,
    type: isOrganizationKeyword_(keyword) ? "조직명" : "캠페인명",
    source: `${year} 사업계획서`,
    active: true,
    notes: "사업계획서 자동 추출"
  }));
  const newKeywordRows = [];
  keywordRows.forEach((row) => {
    const key = normalizeKey_(row.keyword);
    if (existingKeywordKeys[key]) return;
    existingKeywordKeys[key] = true;
    newKeywordRows.push(row);
  });

  if (newKeywordRows.length) {
    upsertRows_("keywords", newKeywordRows, "keyword_id");
  }
  const newKeywordIds = {};
  newKeywordRows.forEach((row) => {
    newKeywordIds[row.keyword_id] = true;
  });

  const searchTerms = unique_([
    "서울환경연합",
    "서울환경운동연합",
    ...keywordRows.filter((row) => row.type === "캠페인명").map((row) => row.keyword)
  ]).slice(0, 24);
  const existingItems = readRows_("items");
  const existingItemIds = {};
  existingItems.forEach((row) => {
    existingItemIds[row.item_id] = true;
  });

  const newsItems = collectNewsCandidates_(searchTerms, "2026-01-01", 5, 90);
  const newItems = newsItems.filter((item) => !existingItemIds[item.item_id]);
  if (newItems.length) {
    upsertRows_("items", newItems, "item_id");
  }

  upsertRows_(
    "fetch_runs",
    [
      {
        run_id: `import-${year}-${hashString_(importedAt)}`,
        started_at: importedAt,
        finished_at: new Date().toISOString(),
        trigger: "plan-import",
        query_count: searchTerms.length,
        item_count: newItems.length,
        status: "ready",
        notes: `${title} 업로드 후 Google News 후보 수집`
      }
    ],
    "run_id"
  );

  const snapshot = readSnapshot_();
  const actualKeywordAdded = (snapshot.sheets.keywords || []).filter(
    (row) => newKeywordIds[row.keyword_id] && !existingKeywordIds[row.keyword_id]
  ).length;
  return {
    ok: true,
    action: "importPlan",
    year,
    rawTextLength: rawText.length,
    keywordsExtracted: extractedTerms.length,
    keywordsAdded: actualKeywordAdded,
    itemsFound: newsItems.length,
    itemsAdded: newItems.length,
    sheets: snapshot.sheets
  };
}

function readPlanText_(sourceUrl, rawText) {
  const providedText = String(rawText || "").trim();
  if (providedText) return providedText;

  const docId = extractGoogleDocId_(sourceUrl);
  if (!docId) return "";

  try {
    const text = DocumentApp.openById(docId).getBody().getText();
    if (String(text || "").trim()) return text;
  } catch (error) {
  }

  try {
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    const response = UrlFetchApp.fetch(exportUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) return response.getContentText();
  } catch (error) {
  }

  return "";
}

function extractGoogleDocId_(url) {
  const match = String(url || "").match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : "";
}

function extractKeywordCandidates_(text) {
  const candidates = {};
  const knownNames = [
    "서울환경연합",
    "서울환경운동연합",
    "플라스틱방앗간",
    "시티트리클럽",
    "씨앗의숲",
    "지구를 구하장",
    "도시의 풍경 Reboot",
    "라이드어스",
    "불편클럽",
    "참새클럽"
  ];

  knownNames.forEach((name) => {
    if (text.indexOf(name) !== -1) candidates[normalizeKey_(name)] = name;
  });

  String(text || "")
    .split(/\n+/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.indexOf(":") !== -1 || trimmed.indexOf("：") !== -1) {
        if (!isPotentialCampaignTitleLine_(trimmed)) return;
        trimmed
          .split(/[:：]/)
          .slice(1)
          .join(" ")
          .split(/[,\n/·|]+/)
          .map(cleanCandidate_)
          .forEach((candidate) => {
            if (isKeywordCandidate_(candidate)) candidates[normalizeKey_(candidate)] = candidate;
          });
      }
    });

  const quotePattern = /[「『'“"]([^「」『』'“”"]{2,28})[」』'”"]/g;
  let quoteMatch = quotePattern.exec(text);
  while (quoteMatch) {
    const candidate = cleanCandidate_(quoteMatch[1]);
    if (isKeywordCandidate_(candidate)) candidates[normalizeKey_(candidate)] = candidate;
    quoteMatch = quotePattern.exec(text);
  }

  const suffixPattern = /[가-힣A-Za-z0-9]{2,}(클럽|방앗간|의숲|구하장)|[가-힣A-Za-z0-9 ]{2,24}Reboot/g;
  let suffixMatch = suffixPattern.exec(text);
  while (suffixMatch) {
    const candidate = cleanCandidate_(suffixMatch[0]);
    if (isKeywordCandidate_(candidate)) candidates[normalizeKey_(candidate)] = candidate;
    suffixMatch = suffixPattern.exec(text);
  }

  return Object.values(candidates).slice(0, 20);
}

function isKeywordCandidate_(value) {
  const candidate = cleanCandidate_(value);
  if (candidate.length < 2 || candidate.length > 24) return false;
  if (/^\d+$/.test(candidate)) return false;

  const knownNames = [
    "서울환경연합",
    "서울환경운동연합",
    "플라스틱방앗간",
    "시티트리클럽",
    "씨앗의숲",
    "지구를 구하장",
    "도시의 풍경 Reboot",
    "라이드어스",
    "불편클럽",
    "참새클럽"
  ];
  if (knownNames.indexOf(candidate) !== -1) return true;

  const stopwords = [
    "사업명",
    "핵심목표",
    "활동내용",
    "담당자",
    "변화목표",
    "관찰지표",
    "산출지표",
    "협력기관",
    "서울환경연합 주요사업계획서",
    "주요사업계획서",
    "보도자료 발송",
    "플랫폼 구축",
    "탐험단 운영",
    "서비스 홍보",
    "내부 담당",
    "연대/협력",
    "조달 계획"
  ];
  if (stopwords.indexOf(candidate) !== -1) return false;
  if (candidate.indexOf("사업") !== -1 && candidate.length < 5) return false;
  if (/[0-9,]+명|[0-9,]+건|[0-9]+회|[0-9]+원/.test(candidate)) return false;

  const genericWords = [
    "담당",
    "협력",
    "연대",
    "예산",
    "조달",
    "계획",
    "정책",
    "대응",
    "운영",
    "구축",
    "발송",
    "개선",
    "확대",
    "제안",
    "정리",
    "자료",
    "제작",
    "개발",
    "전략",
    "모니터링",
    "후원",
    "모금",
    "활동",
    "교육",
    "홍보",
    "브랜딩",
    "콘텐츠",
    "온라인",
    "오프라인",
    "방문자",
    "참여자"
  ];
  if (genericWords.some((word) => candidate.indexOf(word) !== -1)) return false;

  const looksBranded =
    /(클럽|방앗간|구하장|의숲)$/.test(candidate) ||
    /Reboot$/i.test(candidate);
  if (!looksBranded) return false;

  return /[가-힣A-Za-z]/.test(candidate);
}

function cleanCandidate_(value) {
  return String(value || "")
    .replace(/^[\s\-–—·•0-9.)]+/, "")
    .replace(/\s+\d+$/, "")
    .replace(/([가-힣A-Za-z])\d+$/, "$1")
    .replace(/[\s\-–—·•,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPotentialCampaignTitleLine_(line) {
  const prefix = line.split(/[:：]/)[0].trim();
  if (!prefix || prefix.length > 36) return false;
  return ![
    "담당",
    "구성",
    "일시",
    "장소",
    "취지",
    "내용",
    "지표",
    "목표",
    "예산",
    "조달",
    "연대",
    "협력",
    "활동명",
    "활동내용",
    "산출지표",
    "관찰지표",
    "변화목표",
    "핵심목표"
  ].some((word) => prefix.indexOf(word) !== -1);
}

function collectNewsCandidates_(terms, startDate, perKeywordLimit, totalLimit) {
  const results = [];
  const seen = {};

  terms.forEach((term) => {
    if (results.length >= totalLimit) return;
    const query = `"${term}" after:${startDate}`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    let xml = "";

    try {
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: { "User-Agent": "Mozilla/5.0 news-dashboard" }
      });
      if (response.getResponseCode() !== 200) return;
      xml = response.getContentText();
    } catch (error) {
      return;
    }

    const items = parseGoogleNewsItems_(xml);
    let addedForTerm = 0;
    items.forEach((item) => {
      if (addedForTerm >= perKeywordLimit || results.length >= totalLimit) return;
      if (isExcludedNews_(item)) return;
      if (!matchesSearchTerm_(item, term)) return;

      const id = `news-${hashString_([item.source, item.title, item.published_at, item.url].join("|"))}`;
      if (seen[id]) return;
      seen[id] = true;
      addedForTerm += 1;

      results.push({
        item_id: id,
        title: item.title,
        url: item.url,
        canonical_url: item.url,
        source_name: item.source || "Google News",
        source_type: "media",
        published_at: item.published_at,
        discovered_at: new Date().toISOString(),
        matched_keyword: term,
        snippet: item.description,
        ai_summary: "",
        ai_basis: `Google News RSS 후보: ${term}`,
        review_status: "needs-review",
        include_in_press_count: false,
        representative: false
      });
    });
  });

  return results;
}

function parseGoogleNewsItems_(xml) {
  try {
    const document = XmlService.parse(xml);
    const channel = document.getRootElement().getChild("channel");
    if (!channel) return [];
    return channel.getChildren("item").map((item) => {
      const source = item.getChild("source");
      return {
        title: stripTags_(item.getChildText("title") || ""),
        url: item.getChildText("link") || "",
        source: source ? source.getText() : "",
        published_at: formatRssDate_(item.getChildText("pubDate") || ""),
        description: stripTags_(item.getChildText("description") || "")
      };
    });
  } catch (error) {
    return [];
  }
}

function isExcludedNews_(item) {
  const haystack = normalizeKey_([item.source, item.url].join(" "));
  return ["seoulkfem", "kfem.or.kr", "snpo", "서울환경연합", "환경운동연합", "서울시공익활동지원센터"].some(
    (keyword) => haystack.indexOf(normalizeKey_(keyword)) !== -1
  );
}

function matchesSearchTerm_(item, term) {
  const haystack = normalizeKey_([item.title, item.description].join(" "));
  if (isOrganizationKeyword_(term)) {
    return haystack.indexOf(normalizeKey_("서울환경연합")) !== -1 || haystack.indexOf(normalizeKey_("서울환경운동연합")) !== -1;
  }
  return haystack.indexOf(normalizeKey_(term)) !== -1;
}

function stripTags_(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function formatRssDate_(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd");
}

function isOrganizationKeyword_(keyword) {
  return keyword === "서울환경연합" || keyword === "서울환경운동연합";
}

function normalizeKey_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function unique_(values) {
  const seen = {};
  return values.filter((value) => {
    const key = normalizeKey_(value);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function hashString_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ""));
  return digest
    .map((byte) => {
      const value = byte < 0 ? byte + 256 : byte;
      return value.toString(16).padStart(2, "0");
    })
    .join("")
    .slice(0, 16);
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
