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

  const programRows = uniquePrograms_([
    ...extractPrograms_(rawText, year),
    ...buildDefaultPrograms_(year)
  ]);
  if (programRows.length) {
    upsertRows_("programs", programRows, "program_id");
  }

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
    sheets: snapshot.sheets
  };
}

function fetchNews_(body) {
  const year = String(body.year || new Date().getFullYear());
  const activeKeywords = readRows_("keywords")
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
    sheets: snapshot.sheets
  };
}

function collectAndStoreNews_(searchTerms, year, trigger) {
  const existingItems = readRows_("items");
  const existingItemIds = {};
  existingItems.forEach((row) => {
    existingItemIds[row.item_id] = true;
  });

  const programs = readRows_("programs");
  const newsItems = collectNewsCandidates_(searchTerms, "2026-01-01", 5, 90, programs);
  const newItems = newsItems.filter((item) => !existingItemIds[item.item_id]);
  if (newItems.length) {
    upsertRows_("items", newItems, "item_id");
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
        item_count: newItems.length,
        status: "ready",
        notes: `${trigger} 후보 수집`
      }
    ],
    "run_id"
  );

  return { newsItems, newItems };
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

  lines.slice(0, 80).forEach((line) => {
    const name = cleanCandidate_(line.replace(/\s+\d+$/, ""));
    if (isProgramName_(name)) programs.push(makeProgramRow_(year, name, "목차"));
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
  return ["생태도시", "기후행동", "자원순환", "시민참여", "모금", "기타"].map((category) => ({
    program_id: `program-${year}-category-${hashString_(category)}`,
    year,
    name: `${category} 정책 대응`,
    category,
    goal: "사업계획서에 없는 돌발 현장 대응 기사 분류",
    change_goal: "",
    indicators: "",
    owners: "",
    partners: "기본 분류",
    active: true
  }));
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
        ai_basis: `Google News RSS 후보: ${term}`,
        review_status: "needs-review",
        include_in_press_count: false,
        representative: false,
        program_id: programMatch.program_id,
        program_name: programMatch.name,
        program_category: programMatch.category,
        quality: quality.quality,
        quality_basis: quality.basis
      });
    });
  });

  return results;
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
  const text = normalizeKey_([item.title, item.description].join(" "));
  if (/(포토|사진|화보|캡션|tf사진관|현장사진)/i.test([item.title, item.description].join(" "))) {
    return { quality: "하", basis: "사진·캡션 중심 기사로 추정" };
  }
  if (text.indexOf(normalizeKey_("서울환경연합")) !== -1 && /(발행|성명|논평|기자회견|촉구|주장|밝혔다|제안)/.test(item.title)) {
    return { quality: "하", basis: "보도자료 단순 전재 가능성이 높음" };
  }
  if (/(인터뷰|말했다|설명했다|덧붙였다|관계자는|활동가)/.test([item.title, item.description].join(" "))) {
    return { quality: "중", basis: "보도자료 외 인터뷰나 추가 설명 가능성" };
  }
  if (/(단독|취재|현장|논란|추적|분석|왜|어떻게|확인)/.test([item.title, item.description].join(" "))) {
    return { quality: "상", basis: "별도 취재 또는 분석 기사 가능성" };
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
