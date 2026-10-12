# Décisions des fronts

Décisions communes à `ksp_portail`, `ksp_shop` et `ksp_print`. Les décisions d'architecture de l'écosystème sont dans le dépôt `ksp_back` (`docs/adr`).

| N°    | Décision                                                                                                                                                                                          | Statut                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| F-001 | Next.js 16 (App Router), React 19, TypeScript strict ; rendu serveur des pages publiques                                                                                                          | Accepté                              |
| F-002 | Tailwind CSS 4 ; charte commune sous forme de jetons (`@theme`) ; seule la couleur d'accent change par site                                                                                       | Accepté                              |
| F-003 | Un dépôt par site, sans dépôt partagé pour l'instant : les composants de base sont dupliqués dans `src/components/ui` et migreront dans `ksp-ui` dès qu'un deuxième site les réutilise réellement | Accepté                              |
| F-004 | Client unique de la gateway (`src/lib/api`) ; `fetch` direct interdit ailleurs                                                                                                                    | Accepté                              |
| F-005 | Session : jeton d'accès en mémoire ; jeton de renouvellement dans un cookie sécurisé posé par la gateway sur `ksp.bj` (un seul compte pour tous les sites)                                        | Accepté                              |
| F-006 | Polices système, aucune police téléchargée : affichage immédiat sur les connexions lentes                                                                                                         | Accepté                              |
| F-007 | Vitest + Testing Library pour les tests unitaires ; Playwright pour les parcours, sur téléphone et ordinateur                                                                                     | Accepté                              |
| F-008 | Image Docker autonome (`output: 'standalone'`) construite par environnement, déployée sur k3s comme les services                                                                                  | Accepté                              |
| F-009 | Couleurs de la charte                                                                                                                                                                             | À valider (charte graphique KSP)     |
| F-010 | Route de renouvellement de session `POST /api/v1/auth/refresh`                                                                                                                                    | À confirmer (contrats de la gateway) |
| F-011 | Back-office : jamais indexé, double authentification obligatoire, menu filtré par rôles et par phase (le backend reste seul juge des droits)                                                      | Accepté                              |
