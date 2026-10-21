# ksp_back-office

Site **KSP Back-office** (admin.ksp.bj) de l'écosystème KSP : outil interne de l'équipe KSP. Chaque agent ne voit que les modules de ses rôles ; la double authentification est obligatoire et chaque consultation sensible est tracée.

Règles propres au back-office :

- **Jamais indexé** : `robots.txt` interdit tout, en-tête `X-Robots-Tag: noindex`.
- **Double authentification obligatoire** et sessions courtes (branchées au lot 1 avec `identity`).
- **Modules par rôle** (`src/config/modules.ts`) : le menu n'affiche que les modules des rôles de l'agent et de la phase en cours. Ce n'est qu'un confort d'affichage : le backend contrôle les droits à chaque appel.
- **Traçabilité** : chaque consultation sensible est enregistrée par le backend dans `audit`.
- Les contenus des sites (textes, réalisations, actualités) se gèrent dans l'administration de Payload CMS, pas ici.

L'outil n'appelle qu'un seul serveur : la gateway du backend (`ksp_back`), sous `/api/v1`. Il ne contient aucune règle métier.

## Pile technique

| Besoin            | Choix                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Cadre             | Next.js 16 (App Router), React 19, TypeScript strict                                      |
| Styles            | Tailwind CSS 4, jetons de la charte KSP dans `src/app/globals.css`                        |
| Appels au backend | Client unique `src/lib/api` (corrélation, renouvellement de session, erreurs en français) |
| Configuration     | Variables validées au démarrage (`src/config/env.ts`)                                     |
| Tests             | Vitest + Testing Library (unitaires), Playwright (bout en bout, téléphone et ordinateur)  |
| Qualité           | ESLint, Prettier, commitlint, husky                                                       |
| Livraison         | Image Docker autonome (`output: 'standalone'`), GitHub Actions                            |

## Démarrer

Prérequis : Node.js 22 (`.nvmrc`), pnpm 10 (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local
pnpm dev                       # http://localhost:3040
```

La gateway locale (`ksp_back`) répond sur http://localhost:3000. Ports des sites en local : portail 3010, shop 3020, print 3030.

## Commandes

| Commande                                             | Rôle                                        |
| ---------------------------------------------------- | ------------------------------------------- |
| `pnpm dev`                                           | Serveur de développement                    |
| `pnpm lint` · `pnpm format:check` · `pnpm typecheck` | Contrôles de qualité                        |
| `pnpm test`                                          | Tests unitaires                             |
| `pnpm build` puis `pnpm test:e2e`                    | Tests de bout en bout sur le site construit |
| `pnpm build` puis `pnpm size`                        | Poids JavaScript de chaque page             |

## Architecture du front

Le code est découpé par fonctionnalité (`src/features/<domaine>`, aligné sur les services du backend) autour d'un cadre (`src/components/layout`) et de composants de base portables (`src/components/ui`, futur `ksp-ui`), avec des frontières vérifiées par ESLint, des écrans en coques statiques et un menu filtré par rôle pour l'affichage seulement. Le détail (dossiers, règles de dépendance, droits, rendu, budget de poids) est dans [docs/architecture.md](docs/architecture.md).

## Variables d'environnement

Voir `.env.example`. Les variables `NEXT_PUBLIC_*` sont figées au build : l'image Docker est construite par environnement (préproduction, production).

Adresses de préproduction utilisées par défaut en CI (`*.staging.ksp.bj`) : **à valider** lors du choix de l'hébergeur.

## Documentation

- [Règles de travail](CONTRIBUTING.md)
- [Architecture du front](docs/architecture.md)
- [Décisions des fronts](docs/decisions.md)
- Architecture et ADR de l'écosystème : dépôt `ksp_back`, dossier `docs/`.
