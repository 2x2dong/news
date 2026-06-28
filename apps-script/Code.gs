const SHEET_SCHEMA = {
  users: ["email", "role", "name", "active"],
  plans: ["year", "title", "source_url", "imported_at", "raw_text_file", "raw_text_length"],
  programs: ["program_id", "year", "name", "category", "goal", "change_goal", "indicators", "owners", "partners", "active"],
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
    "representative",
    "program_id",
    "program_name",
    "program_category",
    "quality",
    "quality_basis"
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

  if (action === "authCheck") {
    return jsonResponse_(authCheck_(body));
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

  if (action === "fetchNews") {
    return jsonResponse_(fetchNews_(body));
  }

  if (action === "setAdminPassword") {
    return jsonResponse_(setAdminPassword_(body.password));
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

function setAdminPassword(password) {
  return setAdminPassword_(password);
}

function setAdminPassword_(password) {
  const value = String(password || "").trim();
  if (value.length < 4) {
    return { ok: false, error: "password must be at least 4 characters" };
  }
  PropertiesService.getScriptProperties().setProperty("ADMIN_PASSWORD", value);
  return { ok: true, action: "setAdminPassword", updatedAt: new Date().toISOString() };
}

function authCheck_(body) {
  const actor = getActor_(body);
  return { ok: actor.canWrite, role: actor.role || "", checkedAt: new Date().toISOString() };
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
    result[sheetName] = sanitizeRowsForSheet_(sheetName, readRows_(sheetName));
  });
  return { ok: true, sheets: result, readAt: new Date().toISOString() };
}

function writeSnapshot_(payload) {
  ensureSheets_();
  Object.keys(SHEET_SCHEMA).forEach((sheetName) => {
    const rows = payload[sheetName];
    if (Array.isArray(rows)) replaceRows_(sheetName, sanitizeRowsForSheet_(sheetName, rows));
  });
}

function importPlan_(body) {
  const year = String(body.year || new Date().getFullYear());
  const title = String(body.title || "사업계획서");
  const sourceUrl = String(body.sourceUrl || "");
  const rawText = readPlanText_(sourceUrl, body.rawText || "", body.file || null);
  const importedAt = new Date().toISOString();

  if (!rawText) {
    return { ok: false, error: "사업계획서 본문을 읽지 못했습니다. Google Docs 권한 또는 PDF/DOCX 파일을 확인해주세요." };
  }

  upsertRows_(
    "plans",
    [
      {
        year,
        title,
        source_url: sourceUrl,
        imported_at: importedAt,
        raw_text_file: body.file && body.file.name ? body.file.name : "",
        raw_text_length: rawText.length
      }
    ],
    "year"
  );

  const programRows = normalizeProgramRows_(uniquePrograms_([
    ...extractPrograms_(rawText, year),
    ...buildDefaultPrograms_(year)
  ]));
  if (programRows.length) {
    upsertRows_("programs", programRows, "program_id");
  }

  const existingKeywords = normalizeKeywordRows_(readRows_("keywords"));
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
  const collection = collectAndStoreNews_(searchTerms, year, "plan-import");
  const newsItems = collection.newsItems;
  const newItems = collection.newItems;

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
    programsExtracted: programRows.filter((row) => row.partners !== "기본 분류").length,
    itemsFound: newsItems.length,
    itemsAdded: newItems.length,
    itemsUpdated: collection.refreshItems.length,
    sheets: snapshot.sheets
  };
}

function fetchNews_(body) {
  const year = String(body.year || new Date().getFullYear());
  const activeKeywords = normalizeKeywordRows_(readRows_("keywords"))
    .filter((row) => String(row.active).toLowerCase() !== "false")
    .map((row) => row.keyword);
  const searchTerms = unique_(["서울환경연합", "서울환경운동연합", ...activeKeywords]).slice(0, 32);
  const collection = collectAndStoreNews_(searchTerms, year, "manual-fetch");
  const snapshot = readSnapshot_();
  return {
    ok: true,
    action: "fetchNews",
    year,
    queryCount: searchTerms.length,
    itemsFound: collection.newsItems.length,
    itemsAdded: collection.newItems.length,
    itemsUpdated: collection.refreshItems.length,
    sheets: snapshot.sheets
  };
}

function collectAndStoreNews_(searchTerms, year, trigger) {
  const existingItems = normalizeItemRows_(readRows_("items"));
  const existingById = {};
  const existingByDedupeKey = {};
  existingItems.forEach((row) => {
    existingById[row.item_id] = row;
    const dedupeKey = getItemDedupeKey_(row);
    if (dedupeKey) existingByDedupeKey[dedupeKey] = row.item_id;
  });

  const programs = normalizeProgramRows_(readRows_("programs"));
  const newsItems = collectNewsCandidates_(searchTerms, "2026-01-01", 18, 300, programs);
  const newItems = newsItems.filter((item) => {
    const dedupeKey = getItemDedupeKey_(item);
    return !existingById[item.item_id] && (!dedupeKey || !existingByDedupeKey[dedupeKey]);
  });
  const refreshItems = newsItems
    .map((item) => {
      const dedupeKey = getItemDedupeKey_(item);
      const existingId = existingById[item.item_id] ? item.item_id : existingByDedupeKey[dedupeKey];
      const existing = existingId ? existingById[existingId] : null;
      if (!existing || !shouldRefreshAutoItem_(existing)) return null;
      return Object.assign({}, existing, item, { item_id: existing.item_id });
    })
    .filter(Boolean);
  const rowsToWrite = [...newItems, ...refreshItems];
  if (rowsToWrite.length) {
    upsertRows_("items", rowsToWrite, "item_id");
  }

  upsertRows_(
    "fetch_runs",
    [
      {
        run_id: `${trigger}-${year}-${hashString_(new Date().toISOString())}`,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        trigger,
        query_count: searchTerms.length,
        item_count: rowsToWrite.length,
        status: "ready",
        notes: `${trigger} 후보 수집`
      }
    ],
    "run_id"
  );

  return { newsItems, newItems, refreshItems };
}

function shouldRefreshAutoItem_(row) {
  const basis = String(row.ai_basis || "");
  const quality = String(row.quality || "");
  const status = String(row.review_status || "");
  return !quality || !status || basis.indexOf("Google News RSS 후보") !== -1 || basis.indexOf("AI 자동판정") !== -1;
}

function getItemDedupeKey_(row) {
  const url = normalizeArticleUrl_(row && (row.canonical_url || row.url));
  if (url) return `url:${url}`;

  const source = normalizeKey_(row && (row.source_name || row.source));
  const title = normalizeKey_(row && row.title);
  if (!source || !title) return "";
  return `title:${source}:${title}`;
}

function normalizeArticleUrl_(url) {
  const value = String(url || "").replace(/&amp;/g, "&").trim();
  if (!value) return "";
  const parts = value.split("?");
  const base = parts[0].replace(/\/$/, "");
  if (parts.length === 1) return base;

  const keptParams = parts
    .slice(1)
    .join("?")
    .split("&")
    .filter((param) => {
      const key = param.split("=")[0].toLowerCase();
      return key &&
        key.indexOf("utm_") !== 0 &&
        ["fbclid", "gclid", "cmpt_cd", "outurl", "input", "pt", "sc"].indexOf(key) === -1;
    });

  return keptParams.length ? `${base}?${keptParams.join("&")}` : base;
}

function readPlanText_(sourceUrl, rawText, file) {
  const providedText = String(rawText || "").trim();
  if (providedText) return providedText;

  const fileText = readPlanFileText_(file);
  if (fileText) return fileText;

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

function readPlanFileText_(file) {
  if (!file || !file.base64) return "";
  const name = String(file.name || "plan");
  const mimeType = String(file.mimeType || "");
  const bytes = Utilities.base64Decode(String(file.base64 || ""));

  if (name.toLowerCase().endsWith(".docx") || mimeType.indexOf("wordprocessingml") !== -1) {
    return readDocxText_(bytes);
  }

  if (name.toLowerCase().endsWith(".pdf") || mimeType === "application/pdf") {
    return readPdfText_(bytes, name);
  }

  return "";
}

function readDocxText_(bytes) {
  try {
    const blobs = Utilities.unzip(Utilities.newBlob(bytes, "application/zip", "plan.docx"));
    const documentXml = blobs.find((blob) => blob.getName() === "word/document.xml");
    if (!documentXml) return "";
    return documentXml
      .getDataAsString()
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/\s+\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim();
  } catch (error) {
    return "";
  }
}

function readPdfText_(bytes, name) {
  try {
    if (typeof Drive === "undefined" || !Drive.Files || !Drive.Files.insert) return "";
    const blob = Utilities.newBlob(bytes, "application/pdf", name || "plan.pdf");
    const file = Drive.Files.insert(
      { title: `news-dashboard-plan-${Date.now()}` },
      blob,
      { convert: true, ocr: true, ocrLanguage: "ko" }
    );
    const text = DocumentApp.openById(file.id).getBody().getText();
    Drive.Files.remove(file.id);
    return String(text || "").trim();
  } catch (error) {
    return "";
  }
}

function extractGoogleDocId_(url) {
  const match = String(url || "").match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : "";
}

function extractPrograms_(text, year) {
  const lines = String(text || "")
    .split(/\r?\n+/)
    .map((line) => cleanCandidate_(line))
    .filter(Boolean);
  const programs = [];

  lines.forEach((line, index) => {
    if (line !== "사업명") return;
    const name = nextContentLine_(lines, index + 1);
    if (!isProgramName_(name)) return;
    programs.push(makeProgramRow_(year, name, "사업계획서"));
  });

  return uniquePrograms_(programs).slice(0, 80);
}

function nextContentLine_(lines, startIndex) {
  const sectionHeaders = [
    "핵심목표",
    "변화목표",
    "관찰지표",
    "활동명",
    "활동내용",
    "산출지표",
    "내부 담당",
    "연대/협력",
    "예산",
    "조달 계획"
  ];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanCandidate_(lines[index]);
    if (!line || sectionHeaders.indexOf(line) !== -1) continue;
    return line;
  }
  return "";
}

function isProgramName_(name) {
  const value = cleanCandidate_(name);
  if (value.length < 4 || value.length > 54) return false;
  if (/^\d+$/.test(value)) return false;
  if (["탭 1", "TF", "사업명", "핵심목표", "활동명"].indexOf(value) !== -1) return false;
  if (/[0-9,]+명|[0-9,]+건|[0-9]+회|[0-9]+원/.test(value)) return false;
  return /[가-힣A-Za-z]/.test(value);
}

function makeProgramRow_(year, name, source) {
  const category = inferProgramCategory_(name);
  return {
    program_id: `program-${year}-${hashString_(name)}`,
    year,
    name,
    category,
    goal: "",
    change_goal: "",
    indicators: "",
    owners: "",
    partners: source,
    active: true
  };
}

function buildDefaultPrograms_(year) {
  return [
    {
      program_id: `program-${year}-category-${hashString_("기타")}`,
      year,
      name: "기타 정책 대응",
      category: "기타",
      goal: "사업계획서에 없는 돌발 현장 대응 기사 분류",
      change_goal: "",
      indicators: "",
      owners: "",
      partners: "기본 분류",
      active: true
    }
  ];
}

function normalizeProgramRows_(rows) {
  return rows.filter((row) => !isExcludedProgram_(row));
}

function sanitizeRowsForSheet_(sheetName, rows) {
  if (sheetName === "programs") return normalizeProgramRows_(rows);
  if (sheetName === "keywords") return normalizeKeywordRows_(rows);
  if (sheetName === "items") return normalizeItemRows_(rows);
  return rows;
}

function isExcludedProgram_(row) {
  const name = cleanCandidate_(row && row.name);
  const partners = String((row && row.partners) || "");
  if (!name) return true;
  if (name === "시민참여 정책 대응") return true;
  if (partners === "기본 분류" && name.endsWith("정책 대응") && name !== "기타 정책 대응") return true;
  if (partners === "목차" && name !== "투명성 TF") return true;
  return false;
}

function normalizeKeywordType_(type, keyword) {
  const value = String(type || "");
  if (value === "조직명") return "조직명";
  const normalizedKeyword = normalizeKey_(keyword || "");
  if (normalizedKeyword.indexOf(normalizeKey_("서울환경연합")) !== -1) return "조직명";
  if (normalizedKeyword.indexOf(normalizeKey_("서울환경운동연합")) !== -1) return "조직명";
  return "캠페인명";
}

function normalizeKeywordRows_(rows) {
  return rows
    .filter((row) => row && row.keyword)
    .map((row) =>
      Object.assign({}, row, {
        type: normalizeKeywordType_(row.type, row.keyword)
      })
    )
    .filter((row) => row.type === "조직명" || isKeywordCandidate_(row.keyword));
}

function normalizeItemRows_(rows) {
  return rows.filter((row) => !isHardcodedManualItem_(row) && isMediaItem_(row) && !isExcludedNews_(row));
}

function isHardcodedManualItem_(row) {
  const id = String((row && row.item_id) || "");
  if (id.indexOf("sheet-") === 0) return true;
  const text = [row && row.ai_basis, row && row.snippet, row && row.matched_keyword].join(" ");
  return /수기\s*(시트|목록)/.test(text);
}

function isMediaItem_(row) {
  const sourceType = String((row && row.source_type) || "media");
  return sourceType === "media";
}

function uniquePrograms_(programs) {
  const seen = {};
  return programs.filter((program) => {
    const key = normalizeKey_(program.name);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function inferProgramCategory_(text) {
  const value = normalizeKey_(text);
  const rules = [
    { category: "자원순환", words: ["플라스틱", "제로웨이스트", "수리", "자원순환", "쓰레기", "재활용", "다회용", "리필"] },
    { category: "기후행동", words: ["기후", "태양광", "에너지", "교통", "자전거", "산불", "탄소", "발전"] },
    { category: "생태도시", words: ["가로수", "나무", "숲", "공원", "한강", "생태", "난개발", "노들섬", "도시"] },
    { category: "시민참여", words: ["시민", "참여", "캠페인", "교육", "워크숍", "회원", "브랜딩", "온라인채널"] },
    { category: "모금", words: ["모금", "후원", "파트너십", "기금", "다이렉트", "리드", "tm", "기업"] }
  ];
  const match = rules.find((rule) => rule.words.some((word) => value.indexOf(normalizeKey_(word)) !== -1));
  return match ? match.category : "기타";
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

function collectNewsCandidates_(terms, startDate, perKeywordLimit, totalLimit, programs) {
  const results = [];
  const seen = {};
  const programRows = Array.isArray(programs) ? programs : [];

  terms.forEach((term) => {
    if (results.length >= totalLimit) return;
    let addedForTerm = 0;

    buildNewsQueries_(term, startDate).forEach((queryInfo) => {
      if (addedForTerm >= perKeywordLimit || results.length >= totalLimit) return;
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(queryInfo.query)}&hl=ko&gl=KR&ceid=KR:ko`;
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

      parseGoogleNewsItems_(xml).forEach((item) => {
        if (addedForTerm >= perKeywordLimit || results.length >= totalLimit) return;
        if (isExcludedNews_(item)) return;
        if (!matchesSearchTerm_(item, term)) return;

        const relevance = inferArticleRelevance_(item, term, programRows);
        if (relevance.score < 50) return;

        const id = `news-${hashString_([item.source, item.title, item.published_at, item.url].join("|"))}`;
        if (seen[id]) return;
        seen[id] = true;
        addedForTerm += 1;
        const programMatch = matchProgram_(item, term, programRows);
        const quality = inferArticleQuality_(item);

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
          ai_basis: `${relevance.basis} / 수집 경로: ${queryInfo.label}`,
          review_status: relevance.status,
          include_in_press_count: relevance.status === "related",
          representative: false,
          program_id: programMatch.program_id,
          program_name: programMatch.name,
          program_category: programMatch.category,
          quality: quality.quality,
          quality_basis: quality.basis
        });
      });
    });

    if (addedForTerm < perKeywordLimit && results.length < totalLimit) {
      fetchNaverNewsItems_(term, startDate).forEach((item) => {
        if (addedForTerm >= perKeywordLimit || results.length >= totalLimit) return;
        if (isExcludedNews_(item)) return;
        if (!matchesSearchTerm_(item, term)) return;

        const relevance = inferArticleRelevance_(item, term, programRows);
        if (relevance.score < 50) return;

        const id = `news-${hashString_([item.source, item.title, item.published_at, item.url].join("|"))}`;
        if (seen[id]) return;
        seen[id] = true;
        addedForTerm += 1;
        const programMatch = matchProgram_(item, term, programRows);
        const quality = inferArticleQuality_(item);

        results.push({
          item_id: id,
          title: item.title,
          url: item.url,
          canonical_url: item.url,
          source_name: item.source || sourceNameFromUrl_(item.url),
          source_type: "media",
          published_at: item.published_at,
          discovered_at: new Date().toISOString(),
          matched_keyword: term,
          snippet: item.description,
          ai_summary: "",
          ai_basis: `${relevance.basis} / 수집 경로: 네이버뉴스 직접 검색`,
          review_status: relevance.status,
          include_in_press_count: relevance.status === "related",
          representative: false,
          program_id: programMatch.program_id,
          program_name: programMatch.name,
          program_category: programMatch.category,
          quality: quality.quality,
          quality_basis: quality.basis
        });
      });
    }
  });

  return results;
}

function buildNewsQueries_(term, startDate) {
  const queries = [];
  const quoted = `"${term}"`;
  queries.push({ query: `${quoted} after:${startDate}`, label: "Google News" });
  queries.push({ query: `${quoted} site:n.news.naver.com after:${startDate}`, label: "네이버뉴스" });
  queries.push({ query: `${quoted} site:v.daum.net after:${startDate}`, label: "다음뉴스" });

  if (!isOrganizationKeyword_(term)) {
    queries.push({ query: `"서울환경연합" ${quoted} after:${startDate}`, label: "조직명+검색어" });
    queries.push({ query: `"서울환경운동연합" ${quoted} after:${startDate}`, label: "조직명+검색어" });
    queries.push({ query: `"서울환경연합" ${quoted} site:n.news.naver.com after:${startDate}`, label: "네이버뉴스 조직명+검색어" });
    queries.push({ query: `"서울환경연합" ${quoted} site:v.daum.net after:${startDate}`, label: "다음뉴스 조직명+검색어" });
  }

  return queries;
}

function fetchNaverNewsItems_(term, startDate) {
  const dateStart = String(startDate || "2026-01-01");
  const ds = dateStart.replace(/-/g, ".");
  const compactStart = dateStart.replace(/-/g, "");
  const endDate = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  const de = endDate.replace(/-/g, ".");
  const compactEnd = endDate.replace(/-/g, "");
  const starts = [1, 11];
  const queries = isOrganizationKeyword_(term)
    ? [term]
    : [`서울환경연합 ${term}`, `서울환경운동연합 ${term}`, term];
  const items = [];
  const seen = {};

  queries.forEach((query) => {
    starts.forEach((start) => {
      const url = [
        "https://search.naver.com/search.naver?where=news",
        `query=${encodeURIComponent(query)}`,
        "sm=tab_opt",
        "sort=1",
        "pd=3",
        `ds=${encodeURIComponent(ds)}`,
        `de=${encodeURIComponent(de)}`,
        `nso=${encodeURIComponent(`so:dd,p:from${compactStart}to${compactEnd},a:all`)}`,
        `start=${start}`
      ].join("&");

      try {
        const response = UrlFetchApp.fetch(url, {
          muteHttpExceptions: true,
          headers: { "User-Agent": "Mozilla/5.0 news-dashboard" }
        });
        if (response.getResponseCode() !== 200) return;
        parseNaverNewsItems_(response.getContentText()).forEach((item) => {
          const key = normalizeKey_([item.source, item.title, item.url].join("|"));
          if (!key || seen[key]) return;
          seen[key] = true;
          items.push(item);
        });
      } catch (error) {
        return;
      }
    });
  });

  return items;
}

function parseNaverNewsItems_(html) {
  const parts = String(html || "").split('"templateId":"newsItem"');
  const items = [];

  parts.forEach((part) => {
    const start = part.lastIndexOf('{"props":');
    if (start === -1) return;
    const section = part.slice(start);
    const titleMatches = [];
    const titlePattern = /"title":"((?:\\.|[^"\\])+)"\s*,\s*"titleHref":"(https?:\/\/[^"\\]+)"/g;
    let titleMatch = titlePattern.exec(section);
    while (titleMatch) {
      if (titleMatch[2].indexOf("media.naver.com/press") === -1) {
        titleMatches.push(titleMatch);
      }
      titleMatch = titlePattern.exec(section);
    }
    const article = titleMatches.length ? titleMatches[titleMatches.length - 1] : null;
    if (!article) return;

    const url = decodeNaverUrl_(article[2]);
    if (!isLikelyArticleUrl_(url)) return;

    const contentMatch = section.match(/"content":"((?:\\.|[^"\\])*)"\s*,\s*"contentHref":"(https?:\/\/[^"\\]+)"/);
    const sourceMatch = section.match(/"sourceProfile":\{[\s\S]*?"title":"((?:\\.|[^"\\])+)".*?"titleHref":"https:\/\/media\.naver\.com\/press\/[^"]+"/);
    const dateMatch = section.match(/"text":"([0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}\.|[0-9]+[분시간일]\s*전|[0-9]{1,2}\.[0-9]{1,2}\.)"/);
    const title = stripTags_(decodeNaverJsonText_(article[1]));
    const description = contentMatch ? stripTags_(decodeNaverJsonText_(contentMatch[1])) : "";
    const source = sourceMatch ? stripTags_(decodeNaverJsonText_(sourceMatch[1])) : sourceNameFromUrl_(url);

    if (!title || !url) return;
    items.push({
      title,
      url,
      source,
      published_at: formatNaverDate_(dateMatch ? dateMatch[1] : ""),
      description
    });
  });

  return items;
}

function decodeNaverJsonText_(value) {
  const text = String(value || "");
  try {
    return JSON.parse(`"${text.replace(/"/g, '\\"')}"`);
  } catch (error) {
    return text
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">")
      .replace(/\\\//g, "/")
      .replace(/\\n/g, " ");
  }
}

function decodeNaverUrl_(value) {
  return decodeNaverJsonText_(value).replace(/&amp;/g, "&").trim();
}

function isLikelyArticleUrl_(url) {
  const value = String(url || "");
  return /^https?:\/\//i.test(value) &&
    value.indexOf("search.naver.com") === -1 &&
    value.indexOf("keep.naver.com") === -1 &&
    value.indexOf("media.naver.com/press") === -1;
}

function sourceNameFromUrl_(url) {
  const match = String(url || "").match(/^https?:\/\/(?:www\.)?([^\/?#]+)/i);
  return match ? match[1] : "언론사";
}

function formatNaverDate_(value) {
  const text = String(value || "").trim();
  const full = text.match(/([0-9]{4})\.([0-9]{1,2})\.([0-9]{1,2})\./);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;

  const today = new Date();
  const dayRelative = text.match(/([0-9]+)일\s*전/);
  if (dayRelative) {
    today.setDate(today.getDate() - Number(dayRelative[1]));
    return Utilities.formatDate(today, "Asia/Seoul", "yyyy-MM-dd");
  }
  if (/[분시간]\s*전/.test(text)) {
    return Utilities.formatDate(today, "Asia/Seoul", "yyyy-MM-dd");
  }

  const short = text.match(/([0-9]{1,2})\.([0-9]{1,2})\./);
  if (short) {
    const year = Utilities.formatDate(today, "Asia/Seoul", "yyyy");
    return `${year}-${short[1].padStart(2, "0")}-${short[2].padStart(2, "0")}`;
  }

  return "";
}

function inferArticleRelevance_(item, term, programs) {
  const text = [item.title, item.description].join(" ");
  const haystack = normalizeKey_(text);
  const termKey = normalizeKey_(term);
  const hasSeoulOrg = haystack.indexOf(normalizeKey_("서울환경연합")) !== -1 ||
    haystack.indexOf(normalizeKey_("서울환경운동연합")) !== -1;
  let score = 0;
  const reasons = [];

  if (hasSeoulOrg) {
    score += 55;
    reasons.push("서울환경연합 조직명 직접 언급");
  }

  const hasCampaignTerm = !isOrganizationKeyword_(term) && haystack.indexOf(termKey) !== -1;
  if (hasCampaignTerm) {
    score += hasSeoulOrg ? 45 : isAmbiguousCampaignKeyword_(term) ? 60 : 80;
    reasons.push(hasSeoulOrg ? "조직명+캠페인명 직접 언급" : "캠페인명 직접 언급");
  }

  if (isOrganizationKeyword_(term) && hasSeoulOrg) {
    score += 25;
    reasons.push("조직명 검색 결과");
  }

  const programHit = programs.some((program) => {
    const name = normalizeKey_(program.name);
    return name && haystack.indexOf(name) !== -1;
  });
  if (programHit) {
    score += 20;
    reasons.push("사업명 직접 언급");
  }

  if (isOtherChapterNews_(text)) {
    score -= 70;
    reasons.push("다른 지역 환경연합 기사 가능성");
  }

  if (hasCampaignTerm && !hasSeoulOrg && isAmbiguousCampaignKeyword_(term) && score >= 80) {
    score = 75;
    reasons.push("조직명 미확인");
  }

  score = Math.max(0, Math.min(100, score));
  const status = score >= 80 ? "related" : "needs-review";
  const basis = `AI 자동판정 ${score}점: ${reasons.join(", ") || "검색어 기반 후보"}`;
  return { score, status, basis };
}

function matchProgram_(item, term, programs) {
  const haystack = normalizeKey_([item.title, item.description, term].join(" "));
  const activePrograms = programs.filter((program) => String(program.active).toLowerCase() !== "false");
  const direct = activePrograms.find((program) => haystack.indexOf(normalizeKey_(program.name)) !== -1);
  if (direct) return direct;

  const category = inferProgramCategory_(haystack);
  const fallback = activePrograms.find((program) => program.category === category) ||
    activePrograms.find((program) => program.category === "기타") ||
    { program_id: "", name: "기타 정책 대응", category: "기타" };
  return fallback;
}

function inferArticleQuality_(item) {
  const rawText = [item.title, item.description].join(" ");
  const text = normalizeKey_(rawText);
  const hasOrganizationOrCampaign = text.indexOf(normalizeKey_("서울환경연합")) !== -1 ||
    text.indexOf(normalizeKey_("서울환경운동연합")) !== -1 ||
    ["시티트리클럽", "플라스틱방앗간", "씨앗의숲", "지구를 구하장", "라이드어스"].some(
      (name) => text.indexOf(normalizeKey_(name)) !== -1
    );

  if (/(포토|사진|화보|캡션|tf사진관|현장사진)/i.test(rawText)) {
    return { quality: "하", basis: "사진·캡션 중심 기사로 추정" };
  }

  if (/(단독|르포|취재|현장|논란|추적|분석|톺아보기|왜|어떻게|확인)/.test(rawText)) {
    return { quality: "상", basis: "별도 취재 또는 분석 기사 가능성" };
  }

  if (/(인터뷰|말했다|설명했다|덧붙였다|관계자는|활동가|전했다|답했다)/.test(rawText)) {
    return { quality: "중", basis: "보도자료 외 인터뷰나 추가 설명 가능성" };
  }

  if (hasOrganizationOrCampaign && /(발행|성명|논평|기자회견|촉구|주장|밝혔다|제안|모집|개최|성료|론칭|공개|캠페인|협약|요구|기자회견문)/.test(rawText)) {
    return { quality: "하", basis: "보도자료·행사 안내성 기사 가능성이 높음" };
  }

  return { quality: "미분류", basis: "관리자 확인 필요" };
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
  const source = (item && (item.source || item.source_name)) || "";
  const description = (item && (item.description || item.snippet)) || "";
  const haystack = normalizeKey_([source, item && item.url].join(" "));
  if (isOtherChapterNews_([item && item.title, description].join(" "))) return true;
  return [
    "seoulkfem",
    "kfem.or.kr",
    "snpo",
    "korea.kr",
    "go.kr",
    "gov.kr",
    "seoul.go.kr",
    "blog.naver.com",
    "post.naver.com",
    "tistory.com",
    "brunch.co.kr",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "youtu.be",
    "x.com",
    "twitter.com",
    "threads.net",
    "서울환경연합",
    "환경운동연합",
    "서울시공익활동지원센터",
    "공익활동지원센터",
    "네이버블로그",
    "블로그"
  ].some(
    (keyword) => haystack.indexOf(normalizeKey_(keyword)) !== -1
  ) || ["홈페이지", "기관", "sns", "블로그"].some((keyword) => haystack.indexOf(normalizeKey_(keyword)) !== -1);
}

function matchesSearchTerm_(item, term) {
  const haystack = normalizeKey_([item.title, item.description].join(" "));
  if (isOrganizationKeyword_(term)) {
    return haystack.indexOf(normalizeKey_("서울환경연합")) !== -1 || haystack.indexOf(normalizeKey_("서울환경운동연합")) !== -1;
  }
  return haystack.indexOf(normalizeKey_(term)) !== -1;
}

function isAmbiguousCampaignKeyword_(term) {
  return ["플라스틱방앗간"].indexOf(String(term || "").trim()) !== -1;
}

function isOtherChapterNews_(text) {
  const value = normalizeKey_(text);
  if (value.indexOf(normalizeKey_("서울환경연합")) !== -1 || value.indexOf(normalizeKey_("서울환경운동연합")) !== -1) {
    return false;
  }
  return [
    "부산",
    "대구",
    "광주",
    "대전",
    "울산",
    "인천",
    "경기",
    "수원",
    "안산",
    "파주",
    "고양",
    "강원",
    "충북",
    "충남",
    "전북",
    "전남",
    "경북",
    "경남",
    "제주",
    "순천",
    "여수",
    "마산",
    "창원",
    "진주",
    "청주",
    "천안",
    "아산",
    "군산",
    "익산",
    "포항",
    "경주",
    "목포"
  ].some((region) => {
    const prefix = normalizeKey_(region);
    return value.indexOf(`${prefix}${normalizeKey_("환경연합")}`) !== -1 ||
      value.indexOf(`${prefix}${normalizeKey_("환경운동연합")}`) !== -1;
  });
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
    const width = Math.max(sheet.getLastColumn(), headers.length, 1);
    const currentHeaders = sheet.getRange(1, 1, 1, width).getValues()[0].filter(String);
    if (currentHeaders.join("") === "") {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return;
    }
    const missingHeaders = headers.filter((header) => currentHeaders.indexOf(header) === -1);
    if (missingHeaders.length) {
      sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
    sheet.setFrozenRows(1);
  });
}

function readRows_(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const headers = SHEET_SCHEMA[sheetName];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const width = Math.max(sheet.getLastColumn(), headers.length);
  const actualHeaders = sheet.getRange(1, 1, 1, width).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  return values.map((row) => {
    const item = {};
    headers.forEach((header) => {
      const index = actualHeaders.indexOf(header);
      item[header] = index === -1 ? "" : row[index];
    });
    return item;
  });
}

function replaceRows_(sheetName, rows) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const headers = SHEET_SCHEMA[sheetName];
  const normalizedRows = sanitizeRowsForSheet_(sheetName, rows);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!normalizedRows.length) return;
  const values = normalizedRows.map((row) => headers.map((header) => normalizeCell_(row && row[header])));
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function upsertRows_(sheetName, rows, keyColumn) {
  const current = sanitizeRowsForSheet_(sheetName, readRows_(sheetName));
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
  const scriptPassword = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (scriptPassword && body.password === scriptPassword) return { email: "password-admin", role: "admin", canWrite: true };

  const scriptToken = PropertiesService.getScriptProperties().getProperty("ADMIN_TOKEN");
  if (scriptToken && body.token === scriptToken) return { email: "token-admin", role: "admin", canWrite: true };

  const email = Session.getActiveUser().getEmail();
  if (!email) return { email: "", role: "", canWrite: false };

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
