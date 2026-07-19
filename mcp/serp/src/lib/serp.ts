import { SerpError } from "./errors.js";

const LOCATION_MAX_LENGTH = 100;

export interface SerpOrganicResult {
  url: string;
  rank_position: number;
  title: string;
  snippet: string;
}

export interface SerpResponse {
  keyword: string;
  results: SerpOrganicResult[];
  /** Resolved location used for geo-targeting, or null for global. */
  location_applied: string | null;
  /** Present when a localized search returned fewer than requested results. */
  note?: string;
}

export interface ResolvedLocation {
  /** Human-friendly label shown to users (e.g. "Austin, TX"). */
  displayName: string;
  /** Canonical name passed to SerpAPI `location`. */
  canonicalName: string;
  countryCode: string | null;
}

function mapApiError(status: number, message: string): never {
  const lower = message.toLowerCase();
  if (status === 401 || lower.includes("invalid api key")) {
    throw new SerpError("SERP_INVALID_KEY", message, 401);
  }
  if (status === 429 || lower.includes("rate limit")) {
    throw new SerpError("SERP_RATE_LIMITED", message, 429);
  }
  if (
    lower.includes("unsupported `location`") ||
    lower.includes("unsupported location") ||
    lower.includes("invalid location")
  ) {
    throw new SerpError("SERP_INVALID_LOCATION", message, 400);
  }
  throw new SerpError("SERP_API_ERROR", message, status >= 400 ? status : 502);
}

/** Strip control characters and cap length. Empty after sanitize → null. */
export function sanitizeLocation(
  location: string | null | undefined
): string | null {
  if (location == null) return null;
  const cleaned = location
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, LOCATION_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/** USPS abbreviations → full state names (SerpAPI Locations matches full names, not "UT"). */
const US_STATE_ABBREVIATIONS: Record<string, string> = {
  al: "Alabama",
  ak: "Alaska",
  az: "Arizona",
  ar: "Arkansas",
  ca: "California",
  co: "Colorado",
  ct: "Connecticut",
  de: "Delaware",
  dc: "District of Columbia",
  fl: "Florida",
  ga: "Georgia",
  hi: "Hawaii",
  id: "Idaho",
  il: "Illinois",
  in: "Indiana",
  ia: "Iowa",
  ks: "Kansas",
  ky: "Kentucky",
  la: "Louisiana",
  me: "Maine",
  md: "Maryland",
  ma: "Massachusetts",
  mi: "Michigan",
  mn: "Minnesota",
  ms: "Mississippi",
  mo: "Missouri",
  mt: "Montana",
  ne: "Nebraska",
  nv: "Nevada",
  nh: "New Hampshire",
  nj: "New Jersey",
  nm: "New Mexico",
  ny: "New York",
  nc: "North Carolina",
  nd: "North Dakota",
  oh: "Ohio",
  ok: "Oklahoma",
  or: "Oregon",
  pa: "Pennsylvania",
  ri: "Rhode Island",
  sc: "South Carolina",
  sd: "South Dakota",
  tn: "Tennessee",
  tx: "Texas",
  ut: "Utah",
  vt: "Vermont",
  va: "Virginia",
  wa: "Washington",
  wv: "West Virginia",
  wi: "Wisconsin",
  wy: "Wyoming",
};

const US_STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_ABBREVIATIONS).map(([abbr, name]) => [
    name.toLowerCase(),
    abbr.toUpperCase(),
  ])
);

const US_STATE_NAMES = new Set(Object.values(US_STATE_ABBREVIATIONS).map((n) => n.toLowerCase()));

type LocationCandidate = {
  name?: string;
  canonical_name?: string;
  country_code?: string;
  target_type?: string;
  reach?: number;
  keys?: string[];
};

type LocationIntent = {
  raw: string;
  zip: string | null;
  stateName: string | null;
  stateAbbr: string | null;
  /** Bare state input (abbr or full name only). */
  isStateOnly: boolean;
  /** Bare ZIP input (optionally with state). */
  isZipQuery: boolean;
};

const ZIP_PATTERN = /\b(\d{5})(?:-\d{4})?\b/;

/** Expand "Logan, UT" → "Logan, Utah" so SerpAPI Locations can match. */
export function expandUsStateAbbreviations(input: string): string {
  return input.replace(
    /(^|[\s,])([A-Za-z]{2})(?=$|[\s,])/g,
    (full, prefix: string, abbr: string) => {
      const expanded = US_STATE_ABBREVIATIONS[abbr.toLowerCase()];
      return expanded ? `${prefix}${expanded}` : full;
    }
  );
}

export function extractUsZip(input: string): string | null {
  const match = input.match(ZIP_PATTERN);
  return match?.[1] ?? null;
}

function resolveStateHint(input: string): {
  stateName: string | null;
  stateAbbr: string | null;
} {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (US_STATE_ABBREVIATIONS[lower]) {
    const stateName = US_STATE_ABBREVIATIONS[lower];
    return { stateName, stateAbbr: lower.toUpperCase() };
  }
  if (US_STATE_NAMES.has(lower)) {
    return {
      stateName: US_STATE_ABBREVIATIONS[
        US_STATE_NAME_TO_ABBR[lower].toLowerCase()
      ],
      stateAbbr: US_STATE_NAME_TO_ABBR[lower],
    };
  }

  // "Logan, UT" / "84321 UT" / city + state
  const expanded = expandUsStateAbbreviations(trimmed);
  for (const [abbr, name] of Object.entries(US_STATE_ABBREVIATIONS)) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(^|[\\s,])(${abbr}|${escapedName})(?=$|[\\s,])`,
      "i"
    );
    if (re.test(expanded) || re.test(trimmed)) {
      return { stateName: name, stateAbbr: abbr.toUpperCase() };
    }
  }

  return { stateName: null, stateAbbr: null };
}

export function parseLocationIntent(raw: string): LocationIntent {
  const zip = extractUsZip(raw);
  const withoutZip = raw.replace(ZIP_PATTERN, " ").replace(/[,\s]+/g, " ").trim();
  const { stateName, stateAbbr } = resolveStateHint(withoutZip || raw);
  const normalized = expandUsStateAbbreviations(withoutZip || raw)
    .trim()
    .toLowerCase();
  const isStateOnly =
    !zip &&
    Boolean(
      stateName &&
        (normalized === stateName.toLowerCase() ||
          normalized === (stateAbbr?.toLowerCase() ?? ""))
    );
  const isZipQuery = Boolean(zip);

  return { raw, zip, stateName, stateAbbr, isStateOnly, isZipQuery };
}

/** Build lookup queries to try, most specific first. */
export function locationLookupQueries(raw: string): string[] {
  const intent = parseLocationIntent(raw);
  const expanded = expandUsStateAbbreviations(raw).trim();
  const queries: string[] = [];
  const add = (value: string) => {
    const v = value.trim().replace(/\s+/g, " ");
    if (v && !queries.some((q) => q.toLowerCase() === v.toLowerCase())) {
      queries.push(v);
    }
  };

  // ZIP codes: SerpAPI matches the 5-digit code; "84321, UT" returns nothing.
  if (intent.zip) {
    add(intent.zip);
  }

  // Bare abbreviations like "CA" / "UT" must query the full state name first
  // (abbr lookups hit unrelated foreign places).
  if (intent.isStateOnly && intent.stateName) {
    add(intent.stateName);
    if (intent.stateAbbr) add(intent.stateAbbr);
  }

  add(raw);
  add(expanded);
  add(expanded.replace(/,/g, " "));

  const cityPart = expanded
    .replace(ZIP_PATTERN, " ")
    .split(",")[0]
    ?.trim();
  if (
    cityPart &&
    cityPart.toLowerCase() !== expanded.toLowerCase() &&
    !/^\d{5}$/.test(cityPart)
  ) {
    add(cityPart);
  }

  return queries;
}

function tokenizeLocation(input: string): string[] {
  const expanded = expandUsStateAbbreviations(input).toLowerCase();
  return expanded
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && t !== "united" && t !== "states");
}

function candidateHaystack(candidate: LocationCandidate): string {
  return [
    candidate.name,
    candidate.canonical_name,
    ...(candidate.keys ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreLocationCandidate(
  candidate: LocationCandidate,
  tokens: string[],
  intent: LocationIntent
): number {
  const haystack = candidateHaystack(candidate);
  const target = (candidate.target_type ?? "").toLowerCase();
  const country = (candidate.country_code ?? "").toUpperCase();

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }

  if (intent.isZipQuery && target === "postal code") score += 3;
  if (intent.isStateOnly && target === "state") score += 3;
  if (!intent.isZipQuery && !intent.isStateOnly && target === "city") {
    score += 0.25;
  }

  // Prefer US when the user hinted a US state/ZIP
  if ((intent.stateName || intent.zip) && country === "US") score += 0.5;
  if (intent.stateName && haystack.includes(intent.stateName.toLowerCase())) {
    score += 1;
  }
  if (intent.zip && (candidate.name === intent.zip || haystack.startsWith(intent.zip))) {
    score += 2;
  }

  return score;
}

function pickBestLocation(
  candidates: LocationCandidate[],
  userQuery: string
): LocationCandidate | null {
  if (candidates.length === 0) return null;

  const intent = parseLocationIntent(userQuery);
  const tokens = tokenizeLocation(userQuery);
  const scored = candidates
    .map((c) => ({ c, score: scoreLocationCandidate(c, tokens, intent) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.c.reach ?? 0) - (a.c.reach ?? 0);
    });

  const best = scored[0];
  // Never accept a candidate with no token overlap (avoids "CA" → Vietnam).
  if (best.score < 1) return null;

  if (intent.zip && intent.stateName) {
    const haystack = candidateHaystack(best.c);
    if (!haystack.includes(intent.stateName.toLowerCase())) {
      return null;
    }
  }

  return best.c;
}

async function fetchLocationCandidates(
  query: string
): Promise<LocationCandidate[]> {
  const params = new URLSearchParams({ q: query, limit: "10" });
  let response: Response;
  try {
    response = await fetch(
      `https://serpapi.com/locations.json?${params.toString()}`
    );
  } catch {
    throw new SerpError(
      "SERP_API_ERROR",
      "Could not validate location (Locations API unreachable)",
      502
    );
  }

  if (!response.ok) {
    throw new SerpError(
      "SERP_API_ERROR",
      `Location lookup failed (HTTP ${response.status})`,
      response.status >= 400 ? response.status : 502
    );
  }

  const data = (await response.json()) as LocationCandidate[];
  return Array.isArray(data) ? data : [];
}

/**
 * Resolve a free-text location via SerpAPI Locations API (no search credit).
 * Throws SERP_INVALID_LOCATION when unrecognized — never silently falls back.
 */
export async function resolveLocation(
  locationQuery: string
): Promise<ResolvedLocation> {
  const q = sanitizeLocation(locationQuery);
  if (!q) {
    throw new SerpError(
      "SERP_INVALID_LOCATION",
      "location must be a non-empty city, region, ZIP, or country",
      400
    );
  }

  const queries = locationLookupQueries(q);
  let match: LocationCandidate | null = null;

  for (const query of queries) {
    const candidates = await fetchLocationCandidates(query);
    match = pickBestLocation(candidates, q);
    if (match?.canonical_name?.trim()) break;
    match = null;
  }

  if (!match?.canonical_name?.trim()) {
    throw new SerpError(
      "SERP_INVALID_LOCATION",
      `Unrecognized location: "${q}". Try a city ("Logan, UT"), state ("Utah" or "UT"), or ZIP code ("84321").`,
      400
    );
  }

  const canonicalName = match.canonical_name.trim();
  return {
    displayName: formatLocationDisplayName(match, canonicalName),
    canonicalName,
    countryCode: match.country_code?.trim().toLowerCase() || null,
  };
}

function formatLocationDisplayName(
  match: LocationCandidate,
  canonicalName: string
): string {
  const named = match.name?.trim();
  const target = (match.target_type ?? "").toLowerCase();
  const parts = canonicalName.split(",").map((p) => p.trim()).filter(Boolean);

  if (target === "postal code" && parts.length >= 2) {
    const zip = parts[0];
    const region = parts[1];
    const abbr = US_STATE_NAME_TO_ABBR[region.toLowerCase()];
    return abbr ? `${zip} (${abbr})` : `${zip}, ${region}`;
  }

  if (target === "state" && parts.length >= 1) {
    const state = parts[0];
    const abbr = US_STATE_NAME_TO_ABBR[state.toLowerCase()];
    return abbr ? `${state} (${abbr})` : state;
  }

  if (named && /,\s*[A-Z]{2}\b/.test(named)) return named;

  if (parts.length >= 2) {
    const city = parts[0];
    const region = parts[1];
    const abbr = US_STATE_NAME_TO_ABBR[region.toLowerCase()];
    if (abbr) return `${city}, ${abbr}`;
    if (region.toLowerCase() !== "united states") return `${city}, ${region}`;
  }

  return named || canonicalName;
}

export async function getTopResults(
  keyword: string,
  count = 10,
  location?: string | null
): Promise<SerpResponse> {
  const trimmed = keyword.trim();
  if (!trimmed) {
    throw new SerpError("INVALID_KEYWORD", "keyword is required", 400);
  }

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new SerpError(
      "SERP_INVALID_KEY",
      "SERP_API_KEY is not set. Add a SerpAPI key to fetch live SERP results.",
      401
    );
  }

  const limit = Math.min(Math.max(1, count), 10);
  const locationInput = sanitizeLocation(location);

  let locationApplied: string | null = null;
  let countryCode: string | null = null;

  if (locationInput) {
    const resolved = await resolveLocation(locationInput);
    locationApplied = resolved.displayName;
    countryCode = resolved.countryCode;

    // Use canonical name for SerpAPI targeting
    const params = new URLSearchParams({
      engine: "google",
      q: trimmed,
      api_key: apiKey,
      num: String(limit),
      location: resolved.canonicalName,
    });
    if (countryCode) {
      params.set("gl", countryCode);
    }

    return fetchOrganicResults({
      params,
      keyword: trimmed,
      limit,
      locationApplied,
    });
  }

  const params = new URLSearchParams({
    engine: "google",
    q: trimmed,
    api_key: apiKey,
    num: String(limit),
  });

  return fetchOrganicResults({
    params,
    keyword: trimmed,
    limit,
    locationApplied: null,
  });
}

async function fetchOrganicResults(opts: {
  params: URLSearchParams;
  keyword: string;
  limit: number;
  locationApplied: string | null;
}): Promise<SerpResponse> {
  const { params, keyword, limit, locationApplied } = opts;

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`
  );

  const data = (await response.json()) as {
    organic_results?: Array<{
      position?: number;
      title?: string;
      link?: string;
      snippet?: string;
    }>;
    error?: string;
  };

  if (!response.ok) {
    mapApiError(response.status, data.error ?? `HTTP ${response.status}`);
  }

  if (data.error) {
    mapApiError(502, data.error);
  }

  const organic = data.organic_results ?? [];
  if (organic.length === 0) {
    throw new SerpError(
      "SERP_NO_RESULTS",
      locationApplied
        ? `No organic results found for keyword "${keyword}" in ${locationApplied}`
        : `No organic results found for keyword: ${keyword}`,
      404
    );
  }

  const results = organic.slice(0, limit).map((row, index) => ({
    rank_position: row.position ?? index + 1,
    title: row.title ?? "",
    url: row.link ?? "",
    snippet: row.snippet ?? "",
  }));

  const responseBody: SerpResponse = {
    keyword,
    results,
    location_applied: locationApplied,
  };

  if (locationApplied && results.length < limit) {
    responseBody.note = `Only ${results.length} organic result${
      results.length === 1 ? "" : "s"
    } available for this location (requested ${limit}).`;
  }

  return responseBody;
}

/** @deprecated Use getTopResults */
export async function fetchSerp(keyword: string): Promise<
  Array<{ position: number; title: string; link: string; snippet: string }>
> {
  const { results } = await getTopResults(keyword);
  return results.map((r) => ({
    position: r.rank_position,
    title: r.title,
    link: r.url,
    snippet: r.snippet,
  }));
}
