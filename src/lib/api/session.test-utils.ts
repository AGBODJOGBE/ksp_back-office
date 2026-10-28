/**
 * Sessions factices pour les tests : jeton d'accès non signé portant des rôles (comme ceux d'identity)
 * et réponse `SessionResponse` du contrat.
 */

const base64url = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Jeton d'accès factice (non signé) portant les rôles donnés. */
export function accessToken(roles: string[] = ['super_admin']): string {
  const claims = {
    sub: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
    client_id: 'backoffice',
    roles: roles.map((role) => ({ role, scopeType: 'global', scopeId: null })),
    mfa: true,
    auth_time: 1_800_000_000,
  };
  return `${base64url({ alg: 'ES256', typ: 'at+jwt' })}.${base64url(claims)}.signature`;
}

export const TEST_USER = {
  id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11',
  status: 'active',
  firstName: 'Koffi' as string | null,
  lastName: 'Adjovi' as string | null,
  phone: '+2290197000001' as string | null,
  email: null as string | null,
  emailVerified: false,
  preferredLanguage: 'fr',
  createdAt: '2026-10-21T09:00:00Z',
};

/** Réponse `SessionResponse` d'une session du back-office (champ `activeContext` compris, ignoré par le front). */
export function sessionBody(roles: string[] = ['super_admin']) {
  return {
    status: 'authenticated' as const,
    accessToken: accessToken(roles),
    accessTokenExpiresAt: '2099-01-01T00:15:00Z',
    refreshTokenExpiresAt: '2099-01-01T12:00:00Z',
    sessionId: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e10',
    user: TEST_USER,
    profileIncomplete: false,
    activeContext: { type: 'individual', organizationId: null },
  };
}
