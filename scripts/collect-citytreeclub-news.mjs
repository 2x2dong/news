#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const START_DATE = "2026-01-01";
const OUTPUT_DIR = path.resolve("data");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const googleNewsQueries = [
  '"시티트리클럽"',
  '"가로수 기록 커뮤니티맵"',
  '"서울환경연합" "시티트리클럽"',
  '"나무의 권리" "시티트리클럽"',
  '"가로수" "시티트리클럽"',
  '"기록해서 지키는" "시티트리클럽"'
];

const naverQueries = [
  "시티트리클럽",
  "가로수 기록 커뮤니티맵 시티트리클럽",
  "서울환경연합 시티트리클럽",
  "나무의 권리 시티트리클럽",
  "가로수에 이름 붙여보세요 시티트리클럽",
  "기록해서 지키는 시티트리클럽",
  "site:news.skbroadband.com 시티트리클럽",
  "site:lak.co.kr 시티트리클럽",
  "site:ekoreanews.co.kr 시티트리클럽"
];

const mediaDomains = new Map([
  ["khan.co.kr", "경향신문"],
  ["news.nate.com", "네이트 뉴스"],
  ["m.news.nate.com", "네이트 뉴스"],
  ["news.skbroadband.com", "Btv뉴스"],
  ["lifein.news", "라이프인"],
  ["lak.co.kr", "환경과조경"],
  ["ekoreanews.co.kr", "이코리아"],
  ["socialimpactnews.net", "소셜임팩트뉴스"],
  ["ntoday.co.kr", "투데이신문"],
  ["ohmynews.com", "오마이뉴스"],
  ["univalli.com", "대학알리"]
]);

const excludedDomains = [
  "seoulkfem.or.kr",
  "snpo.kr",
  "instagram.com",
  "blog.naver.com",
  "x.com",
  "twitter.com",
  "careet.net"
];

const directActivityTerms = ["시티트리클럽", "가로수 기록 커뮤니티맵"];
const contextTerms = ["서울환경연합", "서울환경운동연합", "가로수", "나무의 권리"];

await main();

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const discovered = [];

  for (const query of googleNewsQueries) {
    const url = googleNewsUrl(query);
    const xml = await fetchText(url);
    discovered.push(...parseGoogleNews(xml, query, url));
  }

  for (const query of naverQueries) {
    for (const where of ["news", "web"]) {
      const url = naverSearchUrl(query, where);
      const html = await fetchText(url, { tolerateFailure: true });
      await sleep(250);
      if (!html) continue;
      discovered.push(...parseNaverSearch(html, query, url, where));
    }
  }

  const candidates = dedupe(discovered)
    .map(enrichCandidate)
    .filter((candidate) => candidate.keep)
    .sort(sortCandidates);

  const report = {
    generatedAt: new Date().toISOString(),
    startDate: START_DATE,
    strategy: {
      googleNewsQueries,
      naverQueries,
      mediaDomains: [...mediaDomains.values()],
      excludedDomains,
      dedupeRule:
        "같은 언론사 안의 같은 canonical URL 또는 같은 normalized title만 중복 의심으로 본다. 서로 다른 언론사의 유사 제목은 별도 보도로 유지한다."
    },
    summary: summarize(candidates),
    candidates
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "discovery-report.json"), JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(path.join(OUTPUT_DIR, "discovery-report.md"), renderMarkdown(report), "utf8");

  console.log(
    JSON.stringify(
      {
        totalCandidates: candidates.length,
        includedSources: report.summary.sources,
        outputs: ["data/discovery-report.json", "data/discovery-report.md"]
      },
      null,
      2
    )
  );
}

function googleNewsUrl(query) {
  const q = `${query} after:${START_DATE}`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
}

function naverSearchUrl(query, where) {
  return `https://search.naver.com/search.naver?where=${where}&query=${encodeURIComponent(query)}`;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent": USER_AGENT
    }
  });
  if (!response.ok) {
    if (options.tolerateFailure) {
      console.warn(`[warn] skipped ${response.status}: ${url}`);
      return "";
    }
    throw new Error(`Fetch failed ${response.status}: ${url}`);
  }
  return response.text();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGoogleNews(xml, query, searchUrl) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items.map(([, item]) => ({
    discoverySource: "google-news-rss",
    query,
    searchUrl,
    title: stripTags(readXml(item, "title")),
    source: stripTags(readXml(item, "source")),
    publishedAt: parseRssDate(readXml(item, "pubDate")),
    url: decodeEntities(readXml(item, "link")),
    rawUrl: decodeEntities(readXml(item, "link"))
  }));
}

function parseNaverSearch(html, query, searchUrl, where) {
  const links = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const url = decodeEntities(match[1]);
    if (seen.has(url)) continue;
    seen.add(url);
    const title = stripTags(match[2]);
    if (!title && !url.includes("article")) continue;
    links.push({
      discoverySource: `naver-${where}`,
      query,
      searchUrl,
      title,
      source: "",
      publishedAt: "",
      url,
      rawUrl: url
    });
  }
  return links;
}

function readXml(content, tag) {
  const match = content.match(new RegExp(`<${tag}(?: [^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function enrichCandidate(candidate) {
  const host = getHost(candidate.url);
  const source = inferSource(candidate.source, host, candidate.title);
  const excluded = excludedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  const knownMedia =
    [...mediaDomains.keys()].some((domain) => host === domain || host.endsWith(`.${domain}`)) ||
    isKnownMediaSource(source);
  const haystack = normalize(`${candidate.title} ${candidate.url}`);
  const directTermCount = directActivityTerms.filter((term) => haystack.includes(normalize(term))).length;
  const contextTermCount = contextTerms.filter((term) => haystack.includes(normalize(term))).length;

  return {
    ...candidate,
    source,
    host,
    canonicalUrl: canonicalize(candidate.url),
    matchedTerms: [...directActivityTerms, ...contextTerms].filter((term) => haystack.includes(normalize(term))),
    relevanceBasis: directTermCount > 0 ? "직접 보도 후보" : contextTermCount > 0 ? "키워드 관련 후보" : "낮음",
    keep: !excluded && knownMedia && (directTermCount > 0 || contextTermCount > 0)
  };
}

function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    const key = canonicalize(item.url);
    const current = map.get(key);
    if (!current || scoreRaw(item) > scoreRaw(current)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function scoreRaw(item) {
  let score = 0;
  if (item.title.includes("시티트리클럽")) score += 10;
  if (item.discoverySource.startsWith("naver")) score += 2;
  if (item.publishedAt) score += 1;
  return score;
}

function sortCandidates(a, b) {
  return (b.publishedAt || "").localeCompare(a.publishedAt || "") || a.source.localeCompare(b.source, "ko");
}

function summarize(candidates) {
  const sources = [...new Set(candidates.map((candidate) => candidate.source))].sort((a, b) => a.localeCompare(b, "ko"));
  const duplicateGroups = new Map();
  for (const candidate of candidates) {
    const key = `${normalize(candidate.source)}:${normalize(candidate.title)}`;
    duplicateGroups.set(key, (duplicateGroups.get(key) || 0) + 1);
  }
  return {
    candidateCount: candidates.length,
    sources,
    duplicateWithinSourceGroups: [...duplicateGroups.values()].filter((count) => count > 1).length
  };
}

function renderMarkdown(report) {
  const rows = report.candidates
    .map(
      (item) =>
        `| ${item.publishedAt || "날짜 미확인"} | ${item.source} | ${escapeMd(item.title || "제목 미확인")} | ${item.relevanceBasis} | ${item.url} |`
    )
    .join("\n");
  return `# 시티트리클럽 기사 발견 리포트

- 생성 시각: ${report.generatedAt}
- 검색 시작일: ${report.startDate}
- 후보 기사: ${report.summary.candidateCount}건
- 포함 언론사: ${report.summary.sources.join(", ")}

## 누락 방지 전략

- Google News RSS만 사용하지 않고 네이버 뉴스/웹 검색도 함께 사용합니다.
- 정확 문구 검색, 맥락어 검색, 언론사별 site 검색을 함께 돌립니다.
- 서울환경연합 홈페이지, 서울시공익활동지원센터, 블로그, 인스타그램 등 비언론사/소셜 출처는 제외합니다.
- 서로 다른 언론사의 유사 제목은 별도 보도로 둡니다.
- 같은 언론사 안의 같은 제목 또는 같은 canonical URL만 중복 의심으로 봅니다.

## 후보

| 날짜 | 언론사 | 제목 | 판정 | URL |
| --- | --- | --- | --- | --- |
${rows}
`;
}

function inferSource(source, host, title) {
  if (host.includes("news.nate.com") && title.includes("경향신문")) return "경향신문";
  if (source === "ntoday.co.kr") return "투데이신문";
  for (const [domain, name] of mediaDomains) {
    if (host === domain || host.endsWith(`.${domain}`)) return name;
  }
  return source || host;
}

function isKnownMediaSource(source) {
  const knownNames = [...new Set(mediaDomains.values())];
  return knownNames.some((name) => source === name || source.includes(name));
}

function canonicalize(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|igsh|from|output|where|sm|ref)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function getHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function parseRssDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}
