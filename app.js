const LEGACY_ARTICLE_STORAGE_KEY = "news-dashboard:v4";
const ARTICLE_STORAGE_KEY = "news-dashboard:articles:v5";
const KEYWORD_STORAGE_KEY = "news-dashboard:keywords:v5";
const PLAN_STORAGE_KEY = "news-dashboard:plans:v5";
const PROGRAM_STORAGE_KEY = "news-dashboard:programs:v6";
const ROLE_STORAGE_KEY = "news-dashboard:role:v5";
const ADMIN_PASSWORD_STORAGE_KEY = "news-dashboard:admin-password:v6";
const COLLECTION_START = "2026-01-01";
const DEFAULT_YEAR = "2026";

const DEFAULT_CATEGORIES = ["생태도시", "기후행동", "자원순환", "시민참여", "모금", "기타"];

const APP_CONFIG = {
  googleSheetUrl: "",
  appsScriptEndpoint: "",
  collectionTimes: ["09:00", "18:00"],
  organizationNames: ["서울환경연합", "서울환경운동연합"],
  ...(window.NEWS_DASHBOARD_CONFIG || {})
};

const VIEWER_URL = `${window.location.origin}${window.location.pathname}?view=viewer`;

const SOURCE_TYPE_LABELS = {
  media: "언론사 기사",
  blog: "블로그",
  social: "SNS",
  institution: "기관 게시물",
  own: "단체 자체 게시물",
  other: "기타"
};

const DEFAULT_KEYWORDS = [
  {
    id: "kw-org-seoul-kfem-short",
    keyword: "서울환경연합",
    type: "조직명",
    source: "기본",
    active: true,
    notes: "서울 조직명"
  },
  {
    id: "kw-org-seoul-kfem-full",
    keyword: "서울환경운동연합",
    type: "조직명",
    source: "기본",
    active: true,
    notes: "서울 조직명"
  },
  {
    id: "kw-citytreeclub",
    keyword: "시티트리클럽",
    type: "캠페인명",
    source: "2026 사업계획서",
    active: true,
    notes: "나무의 권리 재인식 플랫폼"
  },
  {
    id: "kw-plastic-mill",
    keyword: "플라스틱방앗간",
    type: "캠페인명",
    source: "2026 사업계획서",
    active: true,
    notes: "고유 캠페인명"
  },
  {
    id: "kw-seed-forest",
    keyword: "씨앗의숲",
    type: "캠페인명",
    source: "2026 사업계획서",
    active: true,
    notes: "고유 캠페인명"
  },
  {
    id: "kw-street-tree",
    keyword: "가로수",
    type: "사업명",
    source: "시티트리클럽 검증",
    active: true,
    notes: "일반어라 사람이 최종 확인"
  },
  {
    id: "kw-tree-rights",
    keyword: "나무의 권리",
    type: "사업명",
    source: "시티트리클럽 검증",
    active: true,
    notes: "사업 메시지"
  }
];

const DEFAULT_PROGRAMS = [
  {
    id: "program-citytreeclub-2026",
    year: "2026",
    name: "나무의 권리 재인식 플랫폼: 시티트리클럽",
    category: "생태도시",
    goal: "도시 나무와 가로수의 권리를 시민이 기록하고 확산",
    changeGoal: "언론 보도와 사회적 확산 근거 확보",
    indicators: "언론보도 횟수, 대표 기사, 시민 참여와 외부 확산",
    active: true
  },
  ...DEFAULT_CATEGORIES.map((category) => ({
    id: `program-2026-category-${normalizeSeed(category)}`,
    year: "2026",
    name: `${category} 정책 대응`,
    category,
    goal: "사업계획서에 없는 돌발 현장 대응 기사 분류",
    changeGoal: "",
    indicators: "",
    active: true
  }))
];

const seedArticles = [
  {
    id: "sheet-31-khan-nate",
    sheetRow: "31",
    title: "나 몰래 베이고 뽑히는 우리 동네 가로수... 기록해서 지키는 '시티트리클럽'",
    source: "경향신문",
    sourceType: "media",
    publishedAt: "2026-03-03",
    url: "https://m.news.nate.com/view/20260303n37619",
    summary:
      "경향신문 기사의 네이트 모바일 게재 링크입니다. 같은 언론사의 직접 링크와 같은 보도로 보아 중복 의심으로 묶습니다.",
    matchedKeywords: ["가로수", "시티트리클럽", "나무의 권리"],
    reviewStatus: "related",
    relevanceBasis: "대체 게재 링크",
    representative: false,
    includeInCount: false,
    duplicateGroup: "khan-citytreeclub-20260303",
    matchedProgram: "program-citytreeclub-2026",
    note: "수기 시트 #31. 같은 경향신문 보도의 네이트 링크라 보도 횟수 집계에서는 제외했습니다."
  },
  {
    id: "sheet-32-khan-direct",
    sheetRow: "32",
    title: "나 몰래 베이고 뽑히는 우리 동네 가로수... 기록해서 지키는 '시티트리클럽'",
    source: "경향신문",
    sourceType: "media",
    publishedAt: "2026-03-03",
    url: "https://www.khan.co.kr/article/202603031628011",
    summary: "시티트리클럽 정식 오픈과 시민이 가로수를 기록해 지키는 활동을 다룬 경향신문 기사입니다.",
    matchedKeywords: ["가로수", "시티트리클럽", "나무의 권리"],
    reviewStatus: "related",
    relevanceBasis: "직접 보도",
    representative: true,
    includeInCount: true,
    duplicateGroup: "khan-citytreeclub-20260303",
    matchedProgram: "program-citytreeclub-2026",
    note: "수기 시트 #32. 경향신문 기준 대표 링크로 집계합니다."
  },
  {
    id: "sheet-33-btv",
    sheetRow: "33",
    title: "가로수에 이름 붙여보세요... 시민이 기록하는 '시티트리클럽' 공개",
    source: "Btv뉴스",
    sourceType: "media",
    publishedAt: "2026-03-03",
    url: "https://news.skbroadband.com/news/articleView.html?idxno=219394",
    summary: "시민이 가로수에 이름을 붙이고 기록하는 시티트리클럽 공개 소식을 다룬 방송사 지역 뉴스입니다.",
    matchedKeywords: ["가로수", "시티트리클럽", "나무의 권리"],
    reviewStatus: "related",
    relevanceBasis: "직접 보도",
    representative: true,
    includeInCount: true,
    duplicateGroup: "",
    matchedProgram: "program-citytreeclub-2026",
    note: "수기 시트 #33. 별도 언론사 보도이므로 집계 포함 후보입니다."
  },
  {
    id: "sheet-34-lifein",
    sheetRow: "34",
    title: "가로수 기록 커뮤니티맵 '시티트리클럽' 정식 오픈",
    source: "라이프인",
    sourceType: "media",
    publishedAt: "2026-03-03",
    url: "https://www.lifein.news/news/articleView.html?idxno=20056",
    summary: "시티트리클럽 정식 오픈을 다룬 라이프인 기사입니다. 다른 언론사 기사와 제목이 비슷해도 중복으로 보지 않습니다.",
    matchedKeywords: ["가로수", "시티트리클럽", "나무의 권리"],
    reviewStatus: "related",
    relevanceBasis: "직접 보도",
    representative: true,
    includeInCount: true,
    duplicateGroup: "",
    matchedProgram: "program-citytreeclub-2026",
    note: "수기 시트 #34. 별도 언론사 보도이므로 집계 포함 후보입니다."
  },
  {
    id: "sheet-35-lak",
    sheetRow: "35",
    title: "가로수 기록 커뮤니티맵 '시티트리클럽' 정식 오픈",
    source: "환경과조경",
    sourceType: "media",
    publishedAt: "2026-03-12",
    url: "https://www.lak.co.kr/news/boardview.php?id=22661",
    summary: "시티트리클럽 정식 오픈을 조경 분야 관점에서 다룬 기사입니다. 자동 요청은 차단될 수 있으나 수기 시트에 확인된 공개 링크입니다.",
    matchedKeywords: ["가로수", "시티트리클럽", "나무의 권리"],
    reviewStatus: "related",
    relevanceBasis: "직접 보도",
    representative: true,
    includeInCount: true,
    duplicateGroup: "",
    matchedProgram: "program-citytreeclub-2026",
    note: "수기 시트 #35. 다른 언론사 보도이므로 집계 포함 후보입니다."
  },
  {
    id: "sheet-36-ekorea",
    sheetRow: "36",
    title: "가로수는 도심 녹지 생태계의 일원",
    source: "이코리아",
    sourceType: "media",
    publishedAt: "2026-03-12",
    url: "https://www.ekoreanews.co.kr/news/articleView.html?idxno=84982",
    summary: "도심 가로수와 녹지 생태계 관점을 다룬 기사입니다. 시티트리클럽 직접 언급 여부와 평가 근거 사용 범위는 사람이 확인합니다.",
    matchedKeywords: ["가로수", "나무의 권리"],
    reviewStatus: "needs-review",
    relevanceBasis: "키워드 관련",
    representative: false,
    includeInCount: false,
    duplicateGroup: "",
    matchedProgram: "program-citytreeclub-2026",
    note: "수기 시트 #36. 키워드 관련성은 있으나 시티트리클럽 직접 보도인지 검토가 필요합니다."
  },
  {
    id: "sheet-44-socialimpact",
    sheetRow: "44",
    title: "서울환경연합, 가로수 기록 커뮤니티맵 '시티트리클럽' 론칭",
    source: "소셜임팩트뉴스",
    sourceType: "media",
    publishedAt: "2026-03-04",
    url: "https://www.socialimpactnews.net/news/articleView.html?idxno=5740",
    summary: "시티트리클럽 론칭과 시민 참여형 가로수 기록 흐름을 다룬 공개 기사입니다.",
    matchedKeywords: ["서울환경연합", "가로수", "시티트리클럽", "나무의 권리"],
    reviewStatus: "related",
    relevanceBasis: "직접 보도",
    representative: true,
    includeInCount: true,
    duplicateGroup: "",
    matchedProgram: "program-citytreeclub-2026",
    note: "수기 시트 #44. 언론 보도 횟수와 대표 기사 근거로 사용할 수 있습니다."
  }
];

let state = {
  articles: loadArticles(),
  keywords: loadCollection(KEYWORD_STORAGE_KEY, cloneDefaultKeywords),
  plans: loadCollection(PLAN_STORAGE_KEY, () => []),
  programs: loadCollection(PROGRAM_STORAGE_KEY, cloneDefaultPrograms),
  role: loadRole(),
  selectedId: null,
  filters: {
    search: "",
    status: "all",
    source: "all",
    program: "all",
    quality: "all"
  }
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  render();
  verifyStoredAdminPassword();
  if (APP_CONFIG.appsScriptEndpoint) loadSheetsSnapshot({ silent: true });
});

function bindElements() {
  [
    "includedCount",
    "representativeCount",
    "reviewCount",
    "duplicateCount",
    "keywordChips",
    "searchInput",
    "sourceSelect",
    "programSelect",
    "qualitySelect",
    "keywordBars",
    "articleTable",
    "resultCount",
    "detailPanel",
    "detailTitle",
    "detailMeta",
    "detailSummary",
    "detailActions",
    "toast",
    "adminLoginForm",
    "adminPasswordInput",
    "adminLoginButton",
    "adminLogoutButton",
    "copyViewerLinkButton",
    "resetDataButton",
    "exportJsonButton",
    "articleForm",
    "newTitle",
    "newSource",
    "newSourceType",
    "newDate",
    "newUrl",
    "newSummary",
    "syncStatus",
    "collectionSchedule",
    "sheetLink",
    "adminPanel",
    "loadSheetsButton",
    "fetchNewsButton",
    "syncSheetsButton",
    "exportSheetsButton",
    "planForm",
    "planYear",
    "planTitle",
    "planUrl",
    "planFile",
    "planImportResult",
    "keywordForm",
    "newKeyword",
    "newKeywordType",
    "newKeywordNotes",
    "keywordList",
    "programList"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim();
    renderArticles();
  });

  els.sourceSelect.addEventListener("change", (event) => {
    state.filters.source = event.target.value;
    renderArticles();
  });

  els.programSelect.addEventListener("change", (event) => {
    state.filters.program = event.target.value;
    renderArticles();
  });

  els.qualitySelect.addEventListener("change", (event) => {
    state.filters.quality = event.target.value;
    renderArticles();
  });

  document.querySelectorAll("[data-filter-status]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.status = button.dataset.filterStatus;
      document.querySelectorAll("[data-filter-status]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      renderArticles();
    });
  });

  els.resetDataButton.addEventListener("click", () => {
    state.articles = cloneSeedArticles();
    state.keywords = cloneDefaultKeywords();
    state.plans = [];
    state.programs = cloneDefaultPrograms();
    state.selectedId = null;
    saveArticles();
    saveKeywords();
    savePlans();
    savePrograms();
    render();
    showToast("샘플 데이터를 복원했습니다.");
  });

  els.adminLoginForm.addEventListener("submit", adminLogin);
  els.adminLogoutButton.addEventListener("click", adminLogout);
  els.copyViewerLinkButton.addEventListener("click", copyViewerLink);
  els.exportJsonButton.addEventListener("click", exportJson);
  els.exportSheetsButton.addEventListener("click", exportSheetsJson);
  els.loadSheetsButton.addEventListener("click", loadSheetsSnapshot);
  els.fetchNewsButton.addEventListener("click", fetchNews);
  els.syncSheetsButton.addEventListener("click", syncSheets);
  els.articleForm.addEventListener("submit", addArticle);
  els.planForm.addEventListener("submit", importPlan);
  els.keywordForm.addEventListener("submit", addKeyword);

  els.keywordList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-keyword-toggle]");
    if (!button) return;
    toggleKeyword(button.dataset.keywordToggle);
  });
}

function render() {
  renderRole();
  renderIntegrationStatus();
  renderKeywordChips();
  renderSourceOptions();
  renderProgramOptions();
  renderStats();
  renderKeywordBars();
  renderProgramManagement();
  renderKeywordManagement();
  renderPlanSummary();
  renderArticles();
}

function renderRole() {
  document.body.dataset.role = state.role;
  const isAdmin = state.role === "admin";
  const isViewer = state.role === "viewer";
  els.adminPasswordInput.value = isAdmin ? "••••••••" : "";
  els.adminPasswordInput.disabled = isAdmin || isViewer;
  els.adminLoginButton.hidden = isAdmin || isViewer;
  els.adminLogoutButton.hidden = !isAdmin;
}

function renderIntegrationStatus() {
  const hasEndpoint = Boolean(APP_CONFIG.appsScriptEndpoint);
  const hasSheet = Boolean(APP_CONFIG.googleSheetUrl);
  const schedule = (APP_CONFIG.collectionTimes || []).join(", ") || "09:00, 18:00";

  els.syncStatus.textContent = hasEndpoint ? "Google Sheets 연결 준비" : "로컬 검토 모드";
  els.collectionSchedule.textContent = schedule;
  els.sheetLink.innerHTML = hasSheet
    ? `<a href="${escapeAttr(APP_CONFIG.googleSheetUrl)}" target="_blank" rel="noreferrer">Google Sheets 열기</a>`
    : "미설정";
}

function renderKeywordChips() {
  els.keywordChips.innerHTML = getActiveKeywords()
    .map((keyword) => `<span class="chip">${escapeHtml(keyword.keyword)}</span>`)
    .join("");
}

function renderSourceOptions() {
  const sources = [...new Set(state.articles.map((article) => article.source))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
  els.sourceSelect.innerHTML = [
    '<option value="all">전체 출처</option>',
    ...sources.map((source) => `<option value="${escapeAttr(source)}">${escapeHtml(source)}</option>`)
  ].join("");
  if (!sources.includes(state.filters.source)) state.filters.source = "all";
  els.sourceSelect.value = state.filters.source;
}

function renderProgramOptions() {
  const programs = getActivePrograms();
  els.programSelect.innerHTML = [
    '<option value="all">전체 사업</option>',
    ...programs.map((program) => `<option value="${escapeAttr(program.id)}">${escapeHtml(program.name)}</option>`)
  ].join("");
  if (!programs.some((program) => program.id === state.filters.program)) state.filters.program = "all";
  els.programSelect.value = state.filters.program;
  els.qualitySelect.value = state.filters.quality;
}

function renderStats() {
  const included = state.articles.filter(isCountedArticle);
  const representatives = state.articles.filter((article) => article.representative);
  const reviewNeeded = state.articles.filter((article) => article.reviewStatus === "needs-review");
  const duplicateGroups = getDuplicateGroups(state.articles);

  els.includedCount.textContent = included.length.toString();
  els.representativeCount.textContent = representatives.length.toString();
  els.reviewCount.textContent = reviewNeeded.length.toString();
  els.duplicateCount.textContent = duplicateGroups.length.toString();
}

function renderProgramManagement() {
  const programs = getActivePrograms();
  els.programList.innerHTML = programs
    .map(
      (program) => `
        <div class="program-row">
          <div>
            <strong>${escapeHtml(program.name)}</strong>
            <small>${escapeHtml(program.category || "기타")} · ${escapeHtml(program.goal || "분류 기준")}</small>
          </div>
          <span class="chip neutral">${escapeHtml(program.year || DEFAULT_YEAR)}</span>
        </div>
      `
    )
    .join("");
}

function renderKeywordBars() {
  const activeKeywords = getActiveKeywords();
  const counts = activeKeywords.map((keyword) => ({
    keyword: keyword.keyword,
    count: state.articles.filter((article) => article.matchedKeywords.includes(keyword.keyword)).length
  }));
  const max = Math.max(...counts.map((item) => item.count), 1);

  els.keywordBars.innerHTML = counts
    .map((item) => {
      const width = Math.max((item.count / max) * 100, item.count ? 12 : 0);
      return `
        <div class="bar-row">
          <span>${escapeHtml(item.keyword)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <strong>${item.count}</strong>
        </div>
      `;
    })
    .join("");
}

function renderKeywordManagement() {
  const rows = [...state.keywords].sort((a, b) => Number(b.active) - Number(a.active) || a.keyword.localeCompare(b.keyword, "ko"));
  els.keywordList.innerHTML = rows
    .map(
      (keyword) => `
        <div class="keyword-row">
          <div>
            <strong>${escapeHtml(keyword.keyword)}</strong>
            <small>${escapeHtml(keyword.source)} · ${escapeHtml(keyword.notes || "메모 없음")}</small>
          </div>
          <span class="chip neutral">${escapeHtml(keyword.type)}</span>
          <button class="keyword-toggle ${keyword.active ? "" : "is-off"}" type="button" data-keyword-toggle="${escapeAttr(
            keyword.id
          )}">
            ${keyword.active ? "활성" : "비활성"}
          </button>
        </div>
      `
    )
    .join("");
}

function renderPlanSummary() {
  if (!state.plans.length) {
    els.planImportResult.textContent = "업로드된 사업계획서가 없습니다.";
    return;
  }

  const latest = [...state.plans].sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)))[0];
  els.planImportResult.innerHTML = `
    <span class="chip">최근 업로드</span>
    ${escapeHtml(latest.year)} · ${escapeHtml(latest.title)} · ${escapeHtml(String(latest.rawTextLength || 0))}자
  `;
}

function renderArticles() {
  const filtered = getFilteredArticles();
  els.resultCount.textContent = `${filtered.length}건 표시 중`;
  els.articleTable.innerHTML = filtered.map(renderArticleRow).join("");

  els.articleTable.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.select;
      renderArticles();
      renderDetail();
    });
  });

  els.articleTable.querySelectorAll("[data-status]").forEach((select) => {
    select.addEventListener("change", () => {
      updateArticle(select.dataset.status, { reviewStatus: select.value });
    });
  });

  els.articleTable.querySelectorAll("[data-article-program]").forEach((select) => {
    select.addEventListener("change", () => {
      const program = findProgram(select.value);
      updateArticle(select.dataset.articleProgram, {
        matchedProgram: program ? program.id : "",
        programName: program ? program.name : "기타 정책 대응",
        programCategory: program ? program.category : "기타"
      });
    });
  });

  els.articleTable.querySelectorAll("[data-article-quality]").forEach((select) => {
    select.addEventListener("change", () => {
      updateArticle(select.dataset.articleQuality, {
        quality: select.value,
        qualityBasis: "관리자 최종 선택"
      });
    });
  });

  els.articleTable.querySelectorAll("[data-count]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleArticleCount(button.dataset.count);
    });
  });

  renderDetail();
}

function renderArticleRow(article) {
  const selected = article.id === state.selectedId ? " selected" : "";
  const duplicate = isDuplicateWithinSource(article);
  const statusChip = getStatusChip(article.reviewStatus);
  const duplicateChip = duplicate ? '<span class="chip warn">중복 의심</span>' : "";
  const representativeChip = article.representative ? '<span class="chip">대표</span>' : "";
  const sheetChip = article.sheetRow ? `<span class="chip neutral">수기목록 #${escapeHtml(article.sheetRow)}</span>` : "";
  const sourceTypeChip = `<span class="chip neutral">${escapeHtml(getSourceTypeLabel(article.sourceType))}</span>`;
  const program = findProgram(article.matchedProgram) || {
    id: article.matchedProgram || "",
    name: article.programName || "기타 정책 대응",
    category: article.programCategory || "기타"
  };
  const programCell =
    state.role === "admin"
      ? `
        <select class="review-select compact-select" data-article-program="${escapeAttr(article.id)}" aria-label="사업 분류">
          ${getActivePrograms()
            .map(
              (item) =>
                `<option value="${escapeAttr(item.id)}" ${item.id === program.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
            )
            .join("")}
        </select>
        <select class="review-select compact-select" data-article-quality="${escapeAttr(article.id)}" aria-label="기사 품질">
          ${["상", "중", "하", "미분류"]
            .map((quality) => `<option value="${quality}" ${article.quality === quality ? "selected" : ""}>${quality}</option>`)
            .join("")}
        </select>
      `
      : `
        <div class="status-line">
          <span class="chip">${escapeHtml(program.name)}</span>
          <span class="chip neutral">${escapeHtml(article.quality || "미분류")}</span>
        </div>
      `;
  const countLabel = isCountedArticle(article) ? "집계 포함" : "집계 제외";
  const countCell =
    state.role === "admin"
      ? `<button class="count-toggle" type="button" data-count="${escapeAttr(article.id)}">${countLabel}</button>`
      : `<span class="chip neutral">${countLabel}</span>`;
  const reviewCell =
    state.role === "admin"
      ? `
        <select class="review-select" data-status="${escapeAttr(article.id)}" aria-label="검토 상태">
          <option value="related" ${article.reviewStatus === "related" ? "selected" : ""}>관련</option>
          <option value="needs-review" ${article.reviewStatus === "needs-review" ? "selected" : ""}>검토 필요</option>
          <option value="unrelated" ${article.reviewStatus === "unrelated" ? "selected" : ""}>무관</option>
        </select>
      `
      : statusChip;

  return `
    <tr class="${selected}">
      <td>
        <div class="article-title">
          <button type="button" data-select="${escapeAttr(article.id)}">${escapeHtml(article.title)}</button>
          <div class="keyword-cell">
            ${sheetChip}
            ${sourceTypeChip}
            ${article.matchedKeywords.map((keyword) => `<span class="chip neutral">${escapeHtml(keyword)}</span>`).join("")}
            ${duplicateChip}
            ${representativeChip}
          </div>
          <a href="${escapeAttr(article.url)}" target="_blank" rel="noreferrer">원문 열기</a>
        </div>
      </td>
      <td class="source-cell">
        <strong>${escapeHtml(article.source)}</strong><br />
        <span>${formatDate(article.publishedAt)}</span>
      </td>
      <td>
        <div class="status-line">
          ${statusChip}
          <span class="chip neutral">${escapeHtml(article.relevanceBasis || "근거 미정")}</span>
        </div>
        <p class="basis-note">${escapeHtml(getBasisNote(article))}</p>
      </td>
      <td>
        <div class="program-quality-cell">
          ${programCell}
          <p class="basis-note">${escapeHtml(article.qualityBasis || "품질 확인 필요")}</p>
        </div>
      </td>
      <td>${countCell}</td>
      <td>${reviewCell}</td>
    </tr>
  `;
}

function renderDetail() {
  const article = findArticle(state.selectedId);
  if (!article) {
    els.detailTitle.textContent = "기사를 선택하세요";
    els.detailMeta.textContent = "목록에서 행을 누르면 검토 메모가 열립니다.";
    els.detailSummary.textContent = "관련 여부, 같은 언론사 안의 중복 가능성, 대표 기사 여부를 확인해 평가 근거를 다듬을 수 있습니다.";
    els.detailActions.innerHTML = "";
    return;
  }

  els.detailTitle.textContent = article.title;
  els.detailMeta.textContent = `${article.source} · ${getSourceTypeLabel(article.sourceType)} · ${formatDate(article.publishedAt)} · ${
    article.relevanceBasis || "근거 미정"
  }`;
  els.detailSummary.textContent = `${article.summary} ${article.note ? `검토 메모: ${article.note}` : ""}`;

  if (state.role !== "admin") {
    els.detailActions.innerHTML = `<a class="button secondary" href="${escapeAttr(article.url)}" target="_blank" rel="noreferrer">원문 열기</a>`;
    return;
  }

  els.detailActions.innerHTML = `
    <button class="button ghost" type="button" data-detail-action="representative">
      ${article.representative ? "대표 해제" : "대표 기사"}
    </button>
    <button class="button ghost" type="button" data-detail-action="count">
      ${isCountedArticle(article) ? "집계 제외" : "집계 포함"}
    </button>
    <button class="button ghost" type="button" data-detail-action="related">관련으로 표시</button>
    <button class="button ghost" type="button" data-detail-action="review">검토 필요</button>
    <a class="button secondary" href="${escapeAttr(article.url)}" target="_blank" rel="noreferrer">원문 열기</a>
  `;

  els.detailActions.querySelectorAll("[data-detail-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.detailAction === "representative") {
        updateArticle(article.id, { representative: !article.representative });
      }
      if (button.dataset.detailAction === "count") {
        toggleArticleCount(article.id);
      }
      if (button.dataset.detailAction === "related") {
        updateArticle(article.id, { reviewStatus: "related" });
      }
      if (button.dataset.detailAction === "review") {
        updateArticle(article.id, { reviewStatus: "needs-review" });
      }
    });
  });
}

function getFilteredArticles() {
  const search = normalize(state.filters.search);
  return state.articles
    .filter((article) => {
      const haystack = normalize(
        [
          article.title,
          article.source,
          getSourceTypeLabel(article.sourceType),
          article.summary,
          article.url,
          article.sheetRow ? `수기목록 ${article.sheetRow}` : "",
          article.programName,
          article.programCategory,
          article.quality,
          article.matchedKeywords.join(" "),
          article.note
        ].join(" ")
      );
      if (search && !haystack.includes(search)) return false;
      if (state.filters.source !== "all" && article.source !== state.filters.source) return false;
      if (state.filters.program !== "all" && article.matchedProgram !== state.filters.program) return false;
      if (state.filters.quality !== "all" && article.quality !== state.filters.quality) return false;
      if (state.filters.status === "related") return article.reviewStatus === "related";
      if (state.filters.status === "needs-review") return article.reviewStatus === "needs-review";
      if (state.filters.status === "representative") return article.representative;
      if (state.filters.status === "duplicate") return isDuplicateWithinSource(article);
      return true;
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

function updateArticle(id, changes) {
  if (state.role !== "admin") {
    showToast("보기 전용에서는 수정할 수 없습니다.");
    return;
  }
  state.articles = state.articles.map((article) => (article.id === id ? { ...article, ...changes } : article));
  saveArticles();
  render();
  showToast("검토 상태를 반영했습니다.");
}

function toggleArticleCount(id) {
  const article = findArticle(id);
  if (!article) return;
  if (article.sourceType !== "media") {
    showToast("보도 횟수는 언론사 기사만 포함합니다.");
    return;
  }
  updateArticle(article.id, { includeInCount: !article.includeInCount });
}

function addArticle(event) {
  event.preventDefault();
  if (state.role !== "admin") return;

  const sourceType = els.newSourceType.value;
  const text = `${els.newTitle.value} ${els.newSummary.value}`;
  const program = inferProgramForText(text);
  const quality = inferArticleQuality(text);
  const article = {
    id: `manual-${Date.now()}`,
    title: els.newTitle.value.trim(),
    source: els.newSource.value.trim(),
    sourceType,
    publishedAt: els.newDate.value,
    url: els.newUrl.value.trim(),
    summary: els.newSummary.value.trim() || "사용자가 추가한 공개 항목입니다.",
    matchedKeywords: inferKeywords(text),
    reviewStatus: "needs-review",
    relevanceBasis: inferBasis(text),
    representative: false,
    includeInCount: false,
    duplicateGroup: "",
    matchedProgram: program.id,
    programName: program.name,
    programCategory: program.category,
    quality: quality.quality,
    qualityBasis: quality.basis,
    note: "새로 추가된 항목이라 사람이 관련성 및 집계 포함 여부를 확인해야 합니다."
  };
  state.articles = [article, ...state.articles];
  state.selectedId = article.id;
  saveArticles();
  els.articleForm.reset();
  render();
  showToast("검토 목록에 추가했습니다.");
}

async function importPlan(event) {
  event.preventDefault();
  if (state.role !== "admin") return;

  const year = String(els.planYear.value || "").trim();
  const title = els.planTitle.value.trim();
  const sourceUrl = els.planUrl.value.trim();
  const selectedFile = els.planFile.files && els.planFile.files[0];

  if (!year || !title || (!sourceUrl && !selectedFile)) {
    showToast("연도, 제목, 링크 또는 파일을 확인해주세요.");
    return;
  }

  if (APP_CONFIG.appsScriptEndpoint && getAdminPassword()) {
    try {
      showToast("사업계획서를 읽고 사업/기사 후보를 찾고 있습니다.");
      const file = selectedFile ? await fileToPayload(selectedFile) : null;
      const response = await fetch(APP_CONFIG.appsScriptEndpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "importPlan",
          password: getAdminPassword(),
          year,
          title,
          sourceUrl,
          file
        })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "사업계획서 업로드 실패");
      applySheetsSnapshot(result.sheets || {});
      els.planFile.value = "";
      els.planImportResult.innerHTML = `
        <span class="chip">업로드 완료</span>
        ${escapeHtml(year)} · ${escapeHtml(title)} · 추출 검색어 ${escapeHtml(
          result.keywordsExtracted
        )}개 · 발췌 사업 ${escapeHtml(result.programsExtracted || 0)}개 · 새 검색어 ${escapeHtml(
          result.keywordsAdded
        )}개 · 기사 후보 ${escapeHtml(result.itemsFound)}건 확인 / ${escapeHtml(result.itemsAdded)}건 추가
      `;
      showToast("사업계획서와 기사 후보를 저장했습니다.");
      return;
    } catch (error) {
      els.planImportResult.textContent = "사업계획서를 읽지 못했습니다. Google Docs 권한 또는 PDF/DOCX 파일을 확인해주세요.";
      showToast("사업계획서 업로드에 실패했습니다.");
      return;
    }
  }

  els.planImportResult.textContent = "사업계획서 업로드는 관리자 비밀번호와 Google Sheets 연결이 필요합니다.";
  showToast("관리자 로그인 후 다시 시도해주세요.");
}

function addKeyword(event) {
  event.preventDefault();
  if (state.role !== "admin") return;

  const keyword = els.newKeyword.value.trim();
  const type = els.newKeywordType.value;
  const notes = els.newKeywordNotes.value.trim();
  if (!keyword) return;

  if (state.keywords.some((item) => normalize(item.keyword) === normalize(keyword))) {
    showToast("이미 있는 검색어입니다.");
    return;
  }

  state.keywords = [
    {
      id: makeId("kw"),
      keyword,
      type,
      source: "관리자 입력",
      active: true,
      notes
    },
    ...state.keywords
  ];
  saveKeywords();
  els.keywordForm.reset();
  render();
  showToast("검색어를 추가했습니다.");
}

function toggleKeyword(id) {
  if (state.role !== "admin") return;
  state.keywords = state.keywords.map((keyword) =>
    keyword.id === id ? { ...keyword, active: !keyword.active } : keyword
  );
  saveKeywords();
  render();
  showToast("검색어 상태를 바꿨습니다.");
}

async function adminLogin(event) {
  event.preventDefault();
  const password = els.adminPasswordInput.value.trim();
  if (!password) {
    showToast("관리자 비밀번호를 입력해주세요.");
    return;
  }
  if (!APP_CONFIG.appsScriptEndpoint) {
    showToast("Google Sheets 연결 뒤 관리자 로그인을 사용할 수 있습니다.");
    return;
  }

  try {
    const response = await fetch(APP_CONFIG.appsScriptEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "authCheck", password })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "login failed");
    localStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, password);
    localStorage.setItem(ROLE_STORAGE_KEY, "admin");
    state.role = "admin";
    render();
    showToast("관리자 모드로 전환했습니다.");
  } catch (error) {
    localStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
    showToast("비밀번호가 맞지 않습니다.");
  }
}

function adminLogout() {
  localStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
  localStorage.removeItem(ROLE_STORAGE_KEY);
  state.role = isViewerRoute() ? "viewer" : "locked";
  render();
  showToast("관리자 모드에서 나왔습니다.");
}

async function verifyStoredAdminPassword() {
  if (state.role !== "admin" || !APP_CONFIG.appsScriptEndpoint || !getAdminPassword()) return;

  try {
    const response = await fetch(APP_CONFIG.appsScriptEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "authCheck", password: getAdminPassword() })
    });
    const result = await response.json();
    if (response.ok && result.ok) return;
  } catch (error) {
    // Treat network or auth errors as a stale local login.
  }

  localStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
  localStorage.removeItem(ROLE_STORAGE_KEY);
  state.role = "locked";
  render();
  showToast("관리자 비밀번호가 변경되어 다시 로그인해주세요.");
}

async function copyViewerLink() {
  try {
    await navigator.clipboard.writeText(VIEWER_URL);
    showToast("보기 전용 링크를 복사했습니다.");
  } catch (error) {
    showToast(VIEWER_URL);
  }
}

async function fetchNews() {
  if (state.role !== "admin") return;
  if (!APP_CONFIG.appsScriptEndpoint || !getAdminPassword()) {
    showToast("관리자 로그인 후 수동 수집할 수 있습니다.");
    return;
  }

  try {
    showToast("기사 후보를 수집하고 있습니다.");
    const response = await fetch(APP_CONFIG.appsScriptEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "fetchNews", password: getAdminPassword(), year: DEFAULT_YEAR })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "fetch failed");
    applySheetsSnapshot(result.sheets || {});
    showToast(`기사 후보 ${result.itemsFound}건 확인, ${result.itemsAdded}건 추가했습니다.`);
  } catch (error) {
    showToast("기사 수동 수집에 실패했습니다.");
  }
}

function exportJson() {
  downloadJson(buildDashboardPayload(), "news-dashboard-export.json");
  showToast("JSON 파일을 만들었습니다.");
}

function exportSheetsJson() {
  downloadJson(buildSheetsPayload(), "google-sheets-payload.json");
  showToast("시트용 JSON 파일을 만들었습니다.");
}

async function syncSheets() {
  const payload = buildSheetsPayload();
  if (!APP_CONFIG.appsScriptEndpoint) {
    downloadJson(payload, "google-sheets-payload.json");
    showToast("구글시트 연결 주소가 없어 JSON으로 만들었습니다.");
    return;
  }

  try {
    const response = await fetch(APP_CONFIG.appsScriptEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "snapshot", password: getAdminPassword(), payload })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Google Sheets sync failed");
    showToast("Google Sheets에 저장했습니다.");
  } catch (error) {
    downloadJson(payload, "google-sheets-payload.json");
    showToast("구글시트 저장 실패, JSON으로 저장했습니다.");
  }
}

async function loadSheetsSnapshot(options = {}) {
  if (!APP_CONFIG.appsScriptEndpoint) {
    if (!options.silent) showToast("구글시트 연결 주소가 없습니다.");
    return;
  }

  try {
    const url = new URL(APP_CONFIG.appsScriptEndpoint);
    url.searchParams.set("action", "snapshot");
    const response = await fetch(url.toString());
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Google Sheets load failed");
    applySheetsSnapshot(result.sheets || {});
    if (!options.silent) showToast("Google Sheets에서 불러왔습니다.");
  } catch (error) {
    if (!options.silent) showToast("구글시트 불러오기에 실패했습니다.");
  }
}

function buildDashboardPayload() {
  return {
    project: "뉴스 대시보드",
    activity: "서울환경연합 언론·사회적 확산 아카이브",
    collectionStart: COLLECTION_START,
    exportedAt: new Date().toISOString(),
    role: state.role,
    keywords: state.keywords,
    plans: state.plans,
    programs: state.programs,
    articles: state.articles
  };
}

function buildSheetsPayload() {
  const exportedAt = new Date().toISOString();
  return {
    users: [
      { email: "", role: "admin", name: "관리자", active: true },
      { email: "", role: "viewer", name: "보기 전용", active: true }
    ],
    plans: state.plans.map((plan) => ({
      year: plan.year,
      title: plan.title,
      source_url: plan.sourceUrl,
      imported_at: plan.importedAt,
      raw_text_file: "",
      raw_text_length: plan.rawTextLength
    })),
    programs: state.programs.map((program) => ({
      program_id: program.id,
      year: program.year,
      name: program.name,
      category: program.category || "기타",
      goal: program.goal || "",
      change_goal: program.changeGoal || "",
      indicators: program.indicators || "",
      owners: program.owners || "",
      partners: program.partners || "",
      active: program.active
    })),
    keywords: state.keywords.map((keyword) => ({
      keyword_id: keyword.id,
      keyword: keyword.keyword,
      type: keyword.type,
      source: keyword.source,
      active: keyword.active,
      notes: keyword.notes || ""
    })),
    items: state.articles.map((article) => ({
      item_id: article.id,
      title: article.title,
      url: article.url,
      canonical_url: canonicalize(article.url),
      source_name: article.source,
      source_type: article.sourceType || "media",
      published_at: article.publishedAt,
      discovered_at: exportedAt,
      matched_keyword: article.matchedKeywords.join(", "),
      snippet: article.summary,
      ai_summary: "",
      ai_basis: [article.relevanceBasis, article.note].filter(Boolean).join(" / "),
      review_status: article.reviewStatus,
      include_in_press_count: isCountedArticle(article),
      representative: article.representative,
      program_id: article.matchedProgram || "",
      program_name: article.programName || "",
      program_category: article.programCategory || "",
      quality: article.quality || "미분류",
      quality_basis: article.qualityBasis || ""
    })),
    matches: state.articles.map((article) => ({
      match_id: `match-${article.id}`,
      item_id: article.id,
      program_id: article.matchedProgram || "",
      match_type: article.relevanceBasis || "검토 필요",
      confidence: "",
      basis: article.note || "",
      reviewed_by: "",
      reviewed_at: ""
    })),
    fetch_runs: [
      {
        run_id: `local-${Date.now()}`,
        started_at: exportedAt,
        finished_at: exportedAt,
        trigger: "manual-export",
        query_count: state.keywords.filter((keyword) => keyword.active).length,
        item_count: state.articles.length,
        status: "ready",
        notes: "Vercel + Google Sheets MVP export"
      }
    ]
  };
}

function applySheetsSnapshot(sheets) {
  const items = Array.isArray(sheets.items) ? sheets.items : [];
  const keywords = Array.isArray(sheets.keywords) ? sheets.keywords : [];
  const plans = Array.isArray(sheets.plans) ? sheets.plans : [];
  const programs = Array.isArray(sheets.programs) ? sheets.programs : [];

  if (items.length) {
    state.articles = items.map((item) => ({
      id: item.item_id,
      title: item.title,
      source: item.source_name,
      sourceType: item.source_type || "media",
      publishedAt: normalizeDateValue(item.published_at),
      url: item.url,
      summary: item.snippet || item.ai_summary || "Google Sheets에서 불러온 항목입니다.",
      matchedKeywords: splitList(item.matched_keyword),
      reviewStatus: item.review_status || "needs-review",
      relevanceBasis: item.ai_basis || "검토 필요",
      representative: parseBoolean(item.representative),
      includeInCount: parseBoolean(item.include_in_press_count),
      duplicateGroup: "",
      matchedProgram: item.program_id || "",
      programName: item.program_name || "",
      programCategory: item.program_category || "기타",
      quality: item.quality || "미분류",
      qualityBasis: item.quality_basis || "",
      note: item.ai_basis || ""
    }));
  }

  if (keywords.length) {
    state.keywords = keywords.map((keyword) => ({
      id: keyword.keyword_id || makeId("kw"),
      keyword: keyword.keyword,
      type: keyword.type || "캠페인명",
      source: keyword.source || "Google Sheets",
      active: parseBoolean(keyword.active),
      notes: keyword.notes || ""
    }));
  }

  if (plans.length) {
    state.plans = plans.map((plan) => ({
      id: `plan-${plan.year}-${plan.imported_at || Date.now()}`,
      year: plan.year,
      title: plan.title,
      sourceUrl: plan.source_url,
      importedAt: plan.imported_at,
      rawTextLength: plan.raw_text_length,
      rawTextPreview: ""
    }));
  }

  if (programs.length) {
    state.programs = programs.map((program) => ({
      id: program.program_id || makeId("program"),
      year: program.year || DEFAULT_YEAR,
      name: program.name,
      category: program.category || "기타",
      goal: program.goal || "",
      changeGoal: program.change_goal || "",
      indicators: program.indicators || "",
      owners: program.owners || "",
      partners: program.partners || "",
      active: program.active === "" ? true : parseBoolean(program.active)
    }));
  }

  saveArticles();
  saveKeywords();
  savePlans();
  savePrograms();
  render();
}

function getAdminPassword() {
  return localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) || "";
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  return ["true", "TRUE", "1", "yes", "Y", "활성"].includes(String(value).trim());
}

function normalizeDateValue(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function inferKeywords(text) {
  const normalized = normalize(text);
  const matches = getActiveKeywords()
    .map((keyword) => keyword.keyword)
    .filter((keyword) => normalized.includes(normalize(keyword)));
  return matches.length ? matches : ["검토 필요"];
}

function inferBasis(text) {
  const normalized = normalize(text);
  if (normalized.includes("시티트리클럽") || normalized.includes("플라스틱방앗간") || normalized.includes("씨앗의숲")) {
    return "직접 보도 후보";
  }
  if (normalized.includes("서울환경연합") || normalized.includes("서울환경운동연합")) return "조직 언급";
  if (normalized.includes("가로수") || normalized.includes("나무의 권리")) return "키워드 관련";
  return "검토 필요";
}

function getBasisNote(article) {
  if (article.relevanceBasis === "직접 보도") return "기사 제목/내용에 사업이나 캠페인이 직접 나타남";
  if (article.relevanceBasis === "대체 게재 링크") return "같은 언론사의 다른 게재 링크와 묶어 확인";
  if (article.relevanceBasis === "조직 언급") return "조직명은 있으나 어떤 사업인지 사람이 확인";
  if (article.relevanceBasis === "키워드 관련") return "키워드는 맞지만 활동 직접 언급은 사람이 확인";
  if (article.relevanceBasis === "직접 보도 후보") return "새로 추가되어 사람이 최종 확인";
  return "판정 근거를 확인해야 함";
}

function getStatusChip(status) {
  if (status === "related") return '<span class="chip">관련</span>';
  if (status === "unrelated") return '<span class="chip danger">무관</span>';
  return '<span class="chip warn">검토 필요</span>';
}

function getDuplicateGroups(articles) {
  const groups = new Map();
  articles.forEach((article) => {
    const groupKey = getDuplicateKey(article);
    if (!groupKey) return;
    groups.set(groupKey, (groups.get(groupKey) || 0) + 1);
  });
  return [...groups.entries()].filter(([, count]) => count > 1);
}

function isDuplicateWithinSource(article) {
  const groupKey = getDuplicateKey(article);
  if (!groupKey) return false;
  return state.articles.filter((candidate) => getDuplicateKey(candidate) === groupKey).length > 1;
}

function getDuplicateKey(article) {
  if (article.duplicateGroup) return `${normalize(article.source)}:${normalize(article.duplicateGroup)}`;
  const normalizedTitle = normalize(article.title).replace(/[^\p{L}\p{N}]+/gu, "");
  if (!normalizedTitle) return "";
  return `${normalize(article.source)}:${normalizedTitle}`;
}

function isCountedArticle(article) {
  return article.sourceType === "media" && article.reviewStatus === "related" && Boolean(article.includeInCount);
}

function getSourceTypeLabel(type) {
  return SOURCE_TYPE_LABELS[type] || SOURCE_TYPE_LABELS.other;
}

function getActiveKeywords() {
  return state.keywords.filter((keyword) => keyword.active);
}

function extractKeywordCandidates(text) {
  if (!text) return [];
  const candidates = new Map();
  const knownNames = [
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
    if (text.includes(name)) candidates.set(normalize(name), name);
  });

  text.split(/\n+/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.includes(":") && !trimmed.includes("：")) return;
    if (!isPotentialCampaignTitleLine(trimmed)) return;
    const parts = trimmed
      .split(/[:：]/)
      .slice(1)
      .map((part) => cleanCandidate(part));
    parts.forEach((part) => {
      if (isCampaignCandidate(part)) candidates.set(normalize(part), part);
    });
  });

  for (const match of text.matchAll(/[「『'"]([^「」『』'"]{2,24})[」』'"]/g)) {
    const candidate = cleanCandidate(match[1]);
    if (isCampaignCandidate(candidate)) candidates.set(normalize(candidate), candidate);
  }

  return [...candidates.values()].slice(0, 30);
}

function addKeywordCandidates(candidates, year) {
  const added = [];
  const existing = new Set(state.keywords.map((keyword) => normalize(keyword.keyword)));

  candidates.forEach((candidate) => {
    const key = normalize(candidate);
    if (existing.has(key)) return;
    existing.add(key);
    added.push({
      id: makeId("kw"),
      keyword: candidate,
      type: "캠페인명",
      source: `${year} 사업계획서`,
      active: true,
      notes: "사업계획서 자동 추출 후보"
    });
  });

  state.keywords = [...added, ...state.keywords];
  return added;
}

function isCampaignCandidate(value) {
  const candidate = cleanCandidate(value);
  if (candidate.length < 2 || candidate.length > 18) return false;
  if (/^\d+$/.test(candidate)) return false;
  if (candidate.includes("서울환경연합") || candidate.includes("서울환경운동연합")) return false;
  const knownNames = [
    "플라스틱방앗간",
    "시티트리클럽",
    "씨앗의숲",
    "지구를 구하장",
    "도시의 풍경 Reboot",
    "라이드어스",
    "불편클럽",
    "참새클럽"
  ];
  if (knownNames.includes(candidate)) return true;

  const stopwords = [
    "사업명",
    "핵심목표",
    "활동내용",
    "담당자",
    "변화목표",
    "관찰지표",
    "산출지표",
    "협력기관",
    "보도자료 발송",
    "플랫폼 구축",
    "탐험단 운영",
    "서비스 홍보",
    "내부 담당",
    "연대/협력",
    "조달 계획"
  ];
  if (stopwords.includes(candidate)) return false;
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
  if (genericWords.some((word) => candidate.includes(word))) return false;

  const looksBranded =
    /(클럽|방앗간|구하장|의숲)$/.test(candidate) ||
    /Reboot$/i.test(candidate);
  if (!looksBranded) return false;

  return /[가-힣A-Za-z]/.test(candidate);
}

function cleanCandidate(value) {
  return String(value || "")
    .replace(/^[\s\-–—·•0-9.)]+/, "")
    .replace(/\s+\d+$/, "")
    .replace(/([가-힣A-Za-z])\d+$/, "$1")
    .replace(/[\s\-–—·•,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPotentialCampaignTitleLine(line) {
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
  ].some((word) => prefix.includes(word));
}

function findArticle(id) {
  return state.articles.find((article) => article.id === id);
}

function findProgram(id) {
  return state.programs.find((program) => program.id === id);
}

function getActivePrograms() {
  return state.programs.filter((program) => program.active !== false);
}

function inferProgramForText(text) {
  const normalized = normalize(text);
  const direct = getActivePrograms().find((program) => normalized.includes(normalize(program.name)));
  if (direct) return direct;
  const category = inferCategory(text);
  return (
    getActivePrograms().find((program) => program.category === category) ||
    getActivePrograms().find((program) => program.category === "기타") ||
    cloneDefaultPrograms().find((program) => program.category === "기타")
  );
}

function inferCategory(text) {
  const normalized = normalize(text);
  const rules = [
    { category: "자원순환", words: ["플라스틱", "제로웨이스트", "수리", "자원순환", "쓰레기", "재활용", "다회용"] },
    { category: "기후행동", words: ["기후", "태양광", "에너지", "교통", "자전거", "산불", "탄소"] },
    { category: "생태도시", words: ["가로수", "나무", "숲", "공원", "한강", "생태", "난개발", "노들섬", "도시"] },
    { category: "시민참여", words: ["시민", "참여", "캠페인", "교육", "워크숍", "회원"] },
    { category: "모금", words: ["모금", "후원", "파트너십", "기금", "다이렉트", "리드", "tm", "기업"] }
  ];
  const match = rules.find((rule) => rule.words.some((word) => normalized.includes(normalize(word))));
  return match ? match.category : "기타";
}

function inferArticleQuality(text) {
  const normalized = normalize(text);
  if (/포토|사진|화보|캡션|tf사진관|현장사진/i.test(text)) {
    return { quality: "하", basis: "사진·캡션 중심 기사로 추정" };
  }
  if (normalized.includes("서울환경연합") && /발행|성명|논평|기자회견|촉구|주장|밝혔다|제안/.test(text)) {
    return { quality: "하", basis: "보도자료 단순 전재 가능성이 높음" };
  }
  if (/인터뷰|말했다|설명했다|덧붙였다|관계자는|활동가/.test(text)) {
    return { quality: "중", basis: "보도자료 외 인터뷰나 추가 설명 가능성" };
  }
  if (/단독|취재|현장|논란|추적|분석|왜|어떻게|확인/.test(text)) {
    return { quality: "상", basis: "별도 취재 또는 분석 기사 가능성" };
  }
  return { quality: "미분류", basis: "관리자 확인 필요" };
}

async function fileToPayload(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return {
    name: file.name,
    mimeType: file.type,
    base64: btoa(binary)
  };
}

function formatDate(value) {
  if (!value) return "날짜 미정";
  return value.replaceAll("-", ".");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalize(value) {
  try {
    const url = new URL(value);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((param) => {
      url.searchParams.delete(param);
    });
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return value || "";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSeed(value) {
  return normalize(value).replace(/[^\p{L}\p{N}]+/gu, "-");
}

function isViewerRoute() {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "viewer" || params.get("role") === "viewer";
}

function loadRole() {
  if (isViewerRoute()) return "viewer";
  return localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) ? "admin" : "locked";
}

function loadArticles() {
  const loaded = loadCollection(ARTICLE_STORAGE_KEY, cloneSeedArticles, LEGACY_ARTICLE_STORAGE_KEY);
  return loaded.map((article) => ({
    ...article,
    sourceType: article.sourceType || "media",
    matchedProgram: article.matchedProgram || "program-citytreeclub-2026",
    programName: article.programName || "나무의 권리 재인식 플랫폼: 시티트리클럽",
    programCategory: article.programCategory || "생태도시",
    quality: article.quality || "미분류",
    qualityBasis: article.qualityBasis || "관리자 확인 필요"
  }));
}

function loadCollection(key, fallback, legacyKey) {
  const stored = localStorage.getItem(key) || (legacyKey ? localStorage.getItem(legacyKey) : "");
  if (!stored) return fallback();
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return fallback();
    return parsed;
  } catch {
    return fallback();
  }
}

function cloneSeedArticles() {
  return seedArticles.map((article) => ({ ...article, matchedKeywords: [...article.matchedKeywords] }));
}

function cloneDefaultKeywords() {
  return DEFAULT_KEYWORDS.map((keyword) => ({ ...keyword }));
}

function cloneDefaultPrograms() {
  return DEFAULT_PROGRAMS.map((program) => ({ ...program }));
}

function saveArticles() {
  localStorage.setItem(ARTICLE_STORAGE_KEY, JSON.stringify(state.articles));
}

function saveKeywords() {
  localStorage.setItem(KEYWORD_STORAGE_KEY, JSON.stringify(state.keywords));
}

function savePlans() {
  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(state.plans));
}

function savePrograms() {
  localStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify(state.programs));
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("visible"), 1800);
}
