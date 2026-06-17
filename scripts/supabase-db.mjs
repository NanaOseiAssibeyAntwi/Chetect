#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REQUIRED_TABLE_PATHS = [
  '/profiles',
  '/courses',
  '/exams',
  '/exam_invigilators',
  '/exam_registrations',
  '/analysis_sessions',
  '/analysis_frames',
  '/suspicious_events',
  '/session_reviews',
  '/notifications',
  '/audit_logs',
];

function parseDotEnv(dotEnvPath) {
  if (!existsSync(dotEnvPath)) {
    return {};
  }

  const result = {};
  const content = readFileSync(dotEnvPath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const [rawKey, ...rawValueParts] = trimmed.split('=');
    const key = rawKey.trim();
    if (!key) {
      continue;
    }

    const rawValue = rawValueParts.join('=').trim();
    const unquoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    result[key] = unquoted;
  }

  return result;
}

function getEnv() {
  const projectRoot = resolve(process.cwd());
  const dotEnvPath = resolve(projectRoot, '.env');
  const fromFile = parseDotEnv(dotEnvPath);

  return {
    ...fromFile,
    ...process.env,
  };
}

function normalizeBaseUrl(url) {
  const parsed = new URL(url);
  let path = parsed.pathname.replace(/\/+$/, '');

  // Accept either:
  // - https://<project>.supabase.co
  // - https://<project>.supabase.co/rest/v1
  if (path.toLowerCase().endsWith('/rest/v1')) {
    path = path.slice(0, -'/rest/v1'.length);
  }

  parsed.pathname = path || '/';
  parsed.search = '';
  parsed.hash = '';

  return parsed.toString().replace(/\/+$/, '');
}

function getProjectRef(supabaseUrl) {
  const parsed = new URL(supabaseUrl);
  return parsed.hostname.split('.')[0];
}

async function fetchOpenApi({ supabaseUrl, serviceRoleKey }) {
  const endpoint = `${normalizeBaseUrl(supabaseUrl)}/rest/v1/`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Failed to fetch PostgREST OpenAPI (${response.status}). ${bodyText.slice(0, 220)}`
    );
  }

  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new Error('Supabase OpenAPI response was not valid JSON.');
  }

  return json;
}

async function getSchemaStatus({ supabaseUrl, serviceRoleKey }) {
  const openApi = await fetchOpenApi({ supabaseUrl, serviceRoleKey });
  const pathNames = Object.keys(openApi.paths ?? {});
  const missing = REQUIRED_TABLE_PATHS.filter((pathName) => !pathNames.includes(pathName));
  return { missing, pathNames };
}

async function runPgSchemaApply({ dbUrl, schemaPath }) {
  const sql = readFileSync(schemaPath, 'utf8');
  await runPgSql({ dbUrl, sql });
}

async function runPgSql({ dbUrl, sql }) {
  const parsedUrl = new URL(dbUrl);
  const hasSslMode = parsedUrl.searchParams.has('sslmode');
  const isSupabaseHost = parsedUrl.hostname.endsWith('.supabase.co');

  const pgModule = await import('pg');
  const Client = pgModule.Client ?? pgModule.default?.Client;
  if (!Client) {
    throw new Error('Unable to load pg Client from installed pg package.');
  }

  const client = new Client({
    connectionString: dbUrl,
    ...(hasSslMode || !isSupabaseHost ? {} : { ssl: { rejectUnauthorized: false } }),
  });

  let connected = false;
  try {
    await client.connect();
    connected = true;
    await client.query(sql);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      error.code === 'ENOTFOUND' &&
      parsedUrl.hostname.startsWith('db.') &&
      parsedUrl.hostname.endsWith('.supabase.co')
    ) {
      throw new Error(
        `Could not resolve ${parsedUrl.hostname}. This host is often IPv6-only. Use the Supabase Session Pooler URL (aws-*.pooler.supabase.com) in SUPABASE_DB_URL for IPv4-compatible access.`
      );
    }
    throw error;
  } finally {
    if (connected) {
      await client.end();
    }
  }
}

function printStatus(status) {
  if (status.missing.length === 0) {
    console.log('Schema status: complete. All required tables are present.');
    return;
  }

  console.log('Schema status: incomplete. Missing tables detected:');
  for (const pathName of status.missing) {
    console.log(`- ${pathName.slice(1)}`);
  }
}

async function main() {
  const mode = process.argv[2] ?? 'status';
  const env = getEnv();

  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL in .env or environment.');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY in .env or environment.'
    );
  }

  const projectRef = getProjectRef(supabaseUrl);
  console.log(`Target project: ${projectRef}`);

  if (!['status', 'apply', 'apply-migration'].includes(mode)) {
    throw new Error(`Unsupported mode "${mode}". Use "status", "apply", or "apply-migration".`);
  }

  const dbUrl = env.SUPABASE_DB_URL ?? env.DATABASE_URL;

  if (mode === 'apply-migration') {
    const migrationArg = process.argv[3];
    if (!migrationArg) {
      throw new Error('Missing migration path. Use: node ./scripts/supabase-db.mjs apply-migration supabase/migrations/<file>.sql');
    }

    if (!dbUrl) {
      throw new Error(
        'Cannot apply migration without direct SQL access. Add SUPABASE_DB_URL (or DATABASE_URL) using the Supabase session pooler connection string.'
      );
    }

    const migrationPath = resolve(process.cwd(), migrationArg);
    if (!existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = readFileSync(migrationPath, 'utf8');
    console.log(`Applying migration from ${migrationPath} ...`);
    await runPgSql({ dbUrl, sql });
    console.log('Migration applied successfully.');
    return;
  }

  const before = await getSchemaStatus({ supabaseUrl, serviceRoleKey });
  printStatus(before);

  if (mode === 'status') {
    return;
  }

  if (before.missing.length === 0) {
    console.log('Nothing to apply.');
    return;
  }

  if (before.missing.length < REQUIRED_TABLE_PATHS.length) {
    throw new Error(
      'Partial schema detected. The current schema.sql is a one-shot bootstrap script; apply it on a clean database or convert it to idempotent migrations first.'
    );
  }

  if (!dbUrl) {
    throw new Error(
      'Cannot apply schema with REST keys alone. Add SUPABASE_DB_URL (or DATABASE_URL) for direct SQL access via psql.'
    );
  }

  const schemaPath = resolve(process.cwd(), 'supabase', 'schema.sql');
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  console.log(`Applying schema from ${schemaPath} ...`);
  await runPgSchemaApply({ dbUrl, schemaPath });

  const after = await getSchemaStatus({ supabaseUrl, serviceRoleKey });
  printStatus(after);

  if (after.missing.length > 0) {
    throw new Error('Schema apply completed, but required tables are still missing.');
  }

  console.log('Schema apply finished successfully.');
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
