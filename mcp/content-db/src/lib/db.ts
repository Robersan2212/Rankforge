import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export interface BriefPayload {
  title: string;
  keywords: string[];
  outline: string[];
}

export async function saveBrief(
  projectId: string,
  keyword: string,
  brief: BriefPayload
) {
  const db = getPool();
  const row = await db.query(
    `INSERT INTO public.briefs (project_id, keyword, content)
     VALUES ($1::uuid, $2, $3::jsonb)
     RETURNING id, project_id, keyword, content, created_at`,
    [projectId, keyword, JSON.stringify(brief)]
  );
  return row.rows[0];
}

export async function listBriefs(projectId: string) {
  const db = getPool();
  const row = await db.query(
    `SELECT id, project_id, keyword, content, created_at
     FROM public.briefs
     WHERE project_id = $1::uuid
     ORDER BY created_at DESC`,
    [projectId]
  );
  return row.rows;
}
