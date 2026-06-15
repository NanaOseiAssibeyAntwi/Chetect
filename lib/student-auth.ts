import { supabase } from '@/lib/supabase';

const KNUST_EMAIL_DOMAIN = 'knust.edu.gh';

type ProfileRow = {
  institutional_id: string | null;
  role: string;
};

type RoleConfig = {
  invalidCredentialsMessage: string;
  notAuthorizedMessage: string;
  requiredRole: 'student' | 'invigilator';
  requiredValuesMessage: string;
  toEmail: (identifier: string) => string;
};

function normalizeIdentifier(identifierInput: string) {
  return identifierInput.trim().toLowerCase();
}

function identifierToEmail(identifierInput: string, numericPrefix: string) {
  const identifier = normalizeIdentifier(identifierInput);

  if (identifier.includes('@')) {
    return identifier;
  }

  if (/^\d+$/.test(identifier)) {
    return `${numericPrefix}${identifier}@${KNUST_EMAIL_DOMAIN}`;
  }

  return `${identifier}@${KNUST_EMAIL_DOMAIN}`;
}

export function studentIdentifierToEmail(identifierInput: string) {
  return identifierToEmail(identifierInput, 'osei');
}

export function invigilatorIdentifierToEmail(identifierInput: string) {
  return identifierToEmail(identifierInput, 'staff');
}

async function signInWithRole(
  identifierInput: string,
  passwordInput: string,
  roleConfig: RoleConfig
) {
  const identifier = normalizeIdentifier(identifierInput);
  const password = passwordInput.trim();

  if (!identifier || !password) {
    throw new Error(roleConfig.requiredValuesMessage);
  }

  const email = roleConfig.toEmail(identifier);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error(roleConfig.invalidCredentialsMessage);
    }

    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Authentication failed. Please try again.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, institutional_id')
    .eq('id', data.user.id)
    .single<ProfileRow>();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    throw new Error('Unable to verify your profile. Contact admin support.');
  }

  const metadataUsername = String(data.user.user_metadata?.username ?? '').toLowerCase();
  const profileInstitutionId = String(profile.institutional_id ?? '').toLowerCase();
  const signedInEmail = String(data.user.email ?? '').toLowerCase();

  const identityIsValid =
    identifier === signedInEmail ||
    identifier === metadataUsername ||
    identifier === profileInstitutionId;

  if (profile.role !== roleConfig.requiredRole || !identityIsValid) {
    await supabase.auth.signOut();
    throw new Error(roleConfig.notAuthorizedMessage);
  }

  return data;
}

export async function signInStudent(identifierInput: string, passwordInput: string) {
  return signInWithRole(identifierInput, passwordInput, {
    invalidCredentialsMessage: 'Invalid credentials. Use your KNUST student ID/username and password.',
    notAuthorizedMessage: 'This account is not authorized as a KNUST student profile.',
    requiredRole: 'student',
    requiredValuesMessage: 'Enter your student ID or username and password.',
    toEmail: studentIdentifierToEmail,
  });
}

export async function signInInvigilator(identifierInput: string, passwordInput: string) {
  return signInWithRole(identifierInput, passwordInput, {
    invalidCredentialsMessage: 'Invalid credentials. Use your KNUST staff ID/username and password.',
    notAuthorizedMessage: 'This account is not authorized as a KNUST invigilator profile.',
    requiredRole: 'invigilator',
    requiredValuesMessage: 'Enter your staff ID or username and password.',
    toEmail: invigilatorIdentifierToEmail,
  });
}
