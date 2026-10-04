export function isAllowedEmail(email: unknown): boolean {
  if (typeof email !== 'string' || !email.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return [process.env.ALLOWED_EMAIL_1, process.env.ALLOWED_EMAIL_2]
    .some(allowed => Boolean(allowed?.trim()) && allowed?.trim().toLowerCase() === normalized);
}

export function isAuthorizedIdentity(identity: { email?: unknown; provider?: unknown; emailVerified?: unknown } | null | undefined): boolean {
  return Boolean(identity && identity.provider === 'google' && identity.emailVerified === true && isAllowedEmail(identity.email));
}
