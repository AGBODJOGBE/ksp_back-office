# Règles de travail

Les règles de l'écosystème s'appliquent (dépôt `ksp_back`, `CONTRIBUTING.md`). Ce qui suit est propre aux fronts.

## Règles des fronts

1. **Un seul serveur** : toutes les données passent par la gateway, via `src/lib/api`. `fetch` direct est interdit ailleurs (ESLint).
2. **Aucune règle métier** : un prix, un droit ou un statut est calculé par le backend ; le front l'affiche.
3. **Mobile d'abord** : chaque écran est conçu pour le téléphone, puis adapté à l'ordinateur. Pages légères, images optimisées (`next/image`).
4. **Outil interne** : jamais indexé ; aucune donnée personnelle dans les adresses (identifiants opaques uniquement).
5. **Accessibilité** : contrastes suffisants, navigation au clavier, textes alternatifs, cibles tactiles de 44 px minimum.
6. **Textes** : en français, dans `src/i18n` pour les textes communs ; les contenus éditoriaux viennent du CMS.
7. **Session** : le jeton d'accès reste en mémoire ; jamais de jeton dans `localStorage` ni dans un cookie lisible par le JavaScript.
8. **Montants** : entiers en francs CFA reçus du backend, affichés avec `Intl.NumberFormat('fr-BJ', { style: 'currency', currency: 'XOF' })`.
9. **Actions sensibles** : un versement, une suspension ou un changement de rôle se confirme explicitement ; l'écran affiche qui a fait quoi (journal d'audit).

## Définition de « terminé »

Critères d'acceptation couverts par des tests (unitaires et bout en bout pour les parcours), CI au vert, code relu, rendu vérifié sur téléphone.

## Git

- `main` protégée : toute modification passe par une demande de fusion avec la CI au vert.
- Une branche par sujet : `feat/accueil`, `fix/menu-mobile`.
- Messages au format Conventional Commits, vérifiés par commitlint : `feat(home): bloc des services`.
- Fusion en un seul commit.

## Secrets

Jamais de secret dans le dépôt. Seul `.env.example` décrit les variables.

## Outillage personnel

Les fichiers de configuration personnels (outils, assistants, notes locales) ne sont jamais versionnés ni mentionnés dans les commits, demandes de fusion ou README. On les exclut avec `.git/info/exclude` ou l'exclusion globale de git de son poste, pas avec le `.gitignore` du dépôt.
