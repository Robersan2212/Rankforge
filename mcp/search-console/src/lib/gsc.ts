import pg from "pg";
import { decryptToken, encryptToken } from "./token-crypto.js";
import { GscError } from "./errors.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new GscError("CONFIG_ERROR", "DATABASE_URL is not set", 500);
    pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface GscMetricsResult {
  impressions: number;
  clicks: number;
  ctr: number;
  avg_position: number;
  date_range_start: string;
  date_range_end: string;
  fetched_at: string;
  cached: boolean;
  status?: string;
  message?: string;
}

interface ConnectionRow {
  gsc_property_url: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  token_expires_at: Date;
  status: string;
}

function clientId(): string {
  const v = process.env.GSC_CLIENT_ID?.trim();
  if (!v) throw new GscError("CONFIG_ERROR", "GSC_CLIENT_ID is not set", 500);
  return v;
}

function clientSecret(): string {
  const v = process.env.GSC_CLIENT_SECRET?.trim();
  if (!v) throw new GscError("CONFIG_ERROR", "GSC_CLIENT_SECRET is not set", 500);
  return v;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok) {
    if (data.error === "invalid_grant") {
      throw new GscError("GSC_RECONNECT_REQUIRED", "GSC connection revoked", 401);
    }
    throw new GscError("GSC_TOKEN_ERROR", "Failed to refresh access token", 502);
  }
  if (!data.access_token) {
    throw new GscError("GSC_TOKEN_ERROR", "No access token in refresh response", 502);
  }
  return { access_token: data.access_token, expires_in: data.expires_in ?? 3600 };
}

async function getConnection(projectId: string): Promise<ConnectionRow> {
  const db = getPool();
  const result = await db.query(
    `SELECT gsc_property_url, encrypted_access_token, encrypted_refresh_token,
            token_expires_at, status
     FROM public.gsc_connections
     WHERE project_id = $1::uuid AND status = 'connected'`,
    [projectId]
  );
  if (!result.rows[0]) {
    throw new GscError("GSC_NOT_CONNECTED", "GSC not connected for this project", 404);
  }
  return result.rows[0] as ConnectionRow;
}

async function getValidAccessToken(projectId: string): Promise<{
  accessToken: string;
  propertyUrl: string;
}> {
  const row = await getConnection(projectId);
  const refreshToken = decryptToken(row.encrypted_refresh_token);
  const expiresAt = new Date(row.token_expires_at).getTime();
  const needsRefresh = expiresAt <= Date.now() + 2 * 60 * 1000;

  if (!needsRefresh) {
    return {
      accessToken: decryptToken(row.encrypted_access_token),
      propertyUrl: row.gsc_property_url,
    };
  }

  const refreshed = await refreshAccessToken(refreshToken);
  const newExpires = new Date(Date.now() + refreshed.expires_in * 1000);
  const db = getPool();
  await db.query(
    `UPDATE public.gsc_connections
     SET encrypted_access_token = $1, token_expires_at = $2, updated_at = now()
     WHERE project_id = $3::uuid`,
    [encryptToken(refreshed.access_token), newExpires, projectId]
  );
  return { accessToken: refreshed.access_token, propertyUrl: row.gsc_property_url };
}

async function readCache(
  projectId: string,
  url: string,
  start: string,
  end: string
): Promise<GscMetricsResult | null> {
  const db = getPool();
  const result = await db.query(
    `SELECT impressions, clicks, ctr, avg_position, date_range_start,
            date_range_end, fetched_at
     FROM public.gsc_metrics_cache
     WHERE project_id = $1::uuid AND audited_url = $2
       AND date_range_start = $3::date AND date_range_end = $4::date`,
    [projectId, url, start, end]
  );
  const row = result.rows[0];
  if (!row) return null;
  const fetchedAt = new Date(row.fetched_at).getTime();
  if (Date.now() - fetchedAt > CACHE_TTL_MS) return null;
  return {
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    ctr: Number(row.ctr),
    avg_position: Number(row.avg_position),
    date_range_start: formatDate(row.date_range_start),
    date_range_end: formatDate(row.date_range_end),
    fetched_at: new Date(row.fetched_at).toISOString(),
    cached: true,
    status: "ok",
  };
}

async function writeCache(
  projectId: string,
  url: string,
  metrics: GscMetricsResult
): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO public.gsc_metrics_cache
       (project_id, audited_url, impressions, clicks, ctr, avg_position,
        date_range_start, date_range_end, fetched_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::date, $8::date, now())
     ON CONFLICT (project_id, audited_url, date_range_start, date_range_end)
     DO UPDATE SET
       impressions = EXCLUDED.impressions,
       clicks = EXCLUDED.clicks,
       ctr = EXCLUDED.ctr,
       avg_position = EXCLUDED.avg_position,
       fetched_at = now()`,
    [
      projectId,
      url,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.avg_position,
      metrics.date_range_start,
      metrics.date_range_end,
    ]
  );
}

function formatDate(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 27);
  return { start: formatDate(start), end: formatDate(end) };
}

function encodeSiteUrl(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}

export async function getGscMetrics(options: {
  projectId: string;
  url: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  bypassCache?: boolean;
}): Promise<GscMetricsResult> {
  const auditedUrl = options.url.trim();
  if (!auditedUrl) {
    throw new GscError("INVALID_URL", "url is required", 400);
  }

  const range = {
    start: options.dateRangeStart ?? defaultDateRange().start,
    end: options.dateRangeEnd ?? defaultDateRange().end,
  };

  if (!options.bypassCache) {
    const cached = await readCache(
      options.projectId,
      auditedUrl,
      range.start,
      range.end
    );
    if (cached) return cached;
  }

  const { accessToken, propertyUrl } = await getValidAccessToken(options.projectId);

  const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeSiteUrl(propertyUrl)}/searchAnalytics/query`;
  const body = {
    startDate: range.start,
    endDate: range.end,
    dimensions: ["page"],
    dimensionFilterGroups: [
      {
        filters: [
          {
            dimension: "page",
            operator: "equals",
            expression: auditedUrl,
          },
        ],
      },
    ],
    rowLimit: 1,
  };

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    throw new GscError("GSC_QUOTA_EXCEEDED", "Search Console API quota exceeded", 429);
  }

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const message = errBody.error?.message ?? `GSC API error (${res.status})`;
    if (res.status === 401 || res.status === 403) {
      const db = getPool();
      await db.query(
        `UPDATE public.gsc_connections SET status = 'disconnected', updated_at = now()
         WHERE project_id = $1::uuid`,
        [options.projectId]
      );
      throw new GscError("GSC_RECONNECT_REQUIRED", message, 401);
    }
    throw new GscError("GSC_API_ERROR", message, 502);
  }

  const data = (await res.json()) as {
    rows?: Array<{
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
  };

  const row = data.rows?.[0];
  const metrics: GscMetricsResult = {
    impressions: row?.impressions ?? 0,
    clicks: row?.clicks ?? 0,
    ctr: row?.ctr ?? 0,
    avg_position: row?.position ?? 0,
    date_range_start: range.start,
    date_range_end: range.end,
    fetched_at: new Date().toISOString(),
    cached: false,
    status: "ok",
  };

  await writeCache(options.projectId, auditedUrl, metrics);
  return metrics;
}
