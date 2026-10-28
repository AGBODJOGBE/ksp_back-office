/** Adresses des écrans du Nettoyage dans le back-office. */
export const cleaningPaths = {
  requests: '/nettoyage',
  request: (id: string) => `/nettoyage/demandes/${encodeURIComponent(id)}`,
  missions: '/nettoyage/missions',
  mission: (id: string) => `/nettoyage/missions/${encodeURIComponent(id)}`,
  intervention: (missionId: string, id: string) =>
    `/nettoyage/missions/${encodeURIComponent(missionId)}/passages/${encodeURIComponent(id)}`,
  catalog: '/nettoyage/catalogue',
  zones: '/nettoyage/zones',
  team: '/nettoyage/equipe',
} as const;
