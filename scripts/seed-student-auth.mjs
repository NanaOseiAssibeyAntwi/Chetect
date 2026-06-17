#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SEEDED_USERS = [
  {
    departmentName: 'Computer Science',
    email: 'osei12345678@knust.edu.gh',
    fullName: 'Osei KNUST Student',
    institutionalId: '12345678',
    label: 'Student',
    password: 'password',
    role: 'student',
    username: 'osei12345678',
  },
  {
    departmentName: 'Academic Affairs',
    email: 'staff87654321@knust.edu.gh',
    fullName: 'KNUST Invigilator',
    institutionalId: '87654321',
    label: 'Invigilator',
    password: 'staff12345678',
    role: 'invigilator',
    username: 'staff87654321',
  },
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

function normalizeSupabaseUrl(url) {
  const parsed = new URL(url);
  let path = parsed.pathname.replace(/\/+$/, '');
  if (path.toLowerCase().endsWith('/rest/v1')) {
    path = path.slice(0, -'/rest/v1'.length);
  }

  parsed.pathname = path || '/';
  parsed.search = '';
  parsed.hash = '';

  return parsed.toString().replace(/\/+$/, '');
}

async function findUserByEmail(adminClient, email) {
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const existing = users.find((user) => String(user.email ?? '').toLowerCase() === email);
    if (existing) {
      return existing;
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return null;
}

async function upsertAuthAndProfile(admin, seededUser) {
  const userMetadata = {
    department_name: seededUser.departmentName,
    full_name: seededUser.fullName,
    institutional_id: seededUser.institutionalId,
    role: seededUser.role,
    username: seededUser.username,
  };

  let userId = '';
  let action = 'created';

  const { data: createdUserData, error: createUserError } = await admin.auth.admin.createUser({
    app_metadata: { role: seededUser.role },
    email: seededUser.email,
    email_confirm: true,
    password: seededUser.password,
    user_metadata: userMetadata,
  });

  if (!createUserError && createdUserData?.user?.id) {
    userId = createdUserData.user.id;
  } else {
    const duplicateLikely =
      !!createUserError &&
      /already|exists|registered|duplicate/i.test(createUserError.message ?? '');

    if (!duplicateLikely) {
      throw createUserError ?? new Error(`Failed to create auth user for ${seededUser.label}.`);
    }

    const existingUser = await findUserByEmail(admin, seededUser.email.toLowerCase());
    if (!existingUser) {
      throw new Error(`${seededUser.label} auth user exists but could not be retrieved by email.`);
    }

    userId = existingUser.id;
    action = 'updated';

    const { error: updateUserError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...(existingUser.app_metadata ?? {}), role: seededUser.role },
      email_confirm: true,
      password: seededUser.password,
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        ...userMetadata,
      },
    });

    if (updateUserError) {
      throw updateUserError;
    }
  }

  const { error: profileUpsertError } = await admin.from('profiles').upsert(
    {
      department_name: seededUser.departmentName,
      email: seededUser.email,
      full_name: seededUser.fullName,
      id: userId,
      institutional_id: seededUser.institutionalId,
      metadata: {
        role_seed: seededUser.role,
        seeded_by: 'scripts/seed-student-auth.mjs',
        username: seededUser.username,
      },
      role: seededUser.role,
    },
    { onConflict: 'id' }
  );

  if (profileUpsertError) {
    throw profileUpsertError;
  }

  return { action, userId };
}

async function main() {
  const envFromFile = parseDotEnv(resolve(process.cwd(), '.env'));
  const env = { ...envFromFile, ...process.env };

  const rawSupabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawSupabaseUrl) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL.');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  for (const seededUser of SEEDED_USERS) {
    const { action } = await upsertAuthAndProfile(admin, seededUser);
    console.log(`${seededUser.label} seed successful (${action}).`);
    console.log(`  ID: ${seededUser.institutionalId}`);
    console.log(`  Username: ${seededUser.username}`);
    console.log(`  Password: ${seededUser.password}`);
    console.log(`  Auth email: ${seededUser.email}`);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
