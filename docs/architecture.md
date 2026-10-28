# Architecture du front

Décision F-012 (`docs/decisions.md`). Le modèle commun aux quatre fronts KSP (portail, shop, print, back-office) est décrit dans le dépôt `ksp_portail`, fichier `docs/architecture.md` : ce document en reprend la structure, renvoie au modèle pour ce qui est **commun** et détaille ce qui est **propre au back-office**.

## Principes

Communs aux quatre fronts (détail dans le modèle du portail) :

1. **Les règles métier vivent dans `ksp_back`** (F-004). Le front affiche, recueille et transmet : pas de couches domaine ou application, pas de « repository » ni d'interface sans seconde implémentation réelle.
2. **Découpage vertical par fonctionnalité**, aligné sur les services du backend, plutôt que par type de fichier.
3. **Serveur d'abord** : composants serveur par défaut ; composants client petits, en feuille de l'arbre, pour l'interactivité réelle seulement. L'état partageable va dans l'URL (`searchParams`). Pas de bibliothèque d'état global ni de récupération de données.
4. **Rendu statique par défaut** : le serveur Next ne refait pas à chaque requête ce qui peut être construit une fois.
5. **Frontières vérifiées par ESLint**, sans dépendance ajoutée, et **poids mesuré** à chaque build (`pnpm size`).

Propre au back-office :

6. **Le backend reste seul juge des droits.** Le front filtre seulement l'affichage (menu, pages d'attente) selon les rôles fournis par la gateway ; aucun code du front ne se présente comme une vérification de sécurité (voir « Droits et affichage »).
7. **Jamais indexé, double authentification, audit** : `robots.txt` interdit tout, l'en-tête `X-Robots-Tag: noindex, nofollow` est posé sur toutes les adresses (`next.config.ts`) et le layout racine déclare `robots: { index: false }` ; la double authentification et la traçabilité des consultations sont à la charge de `identity` et `audit`.

## Dossiers

```
src/
├── app/                     routes : page, layout, error, not-found, metadata, robots ; compose, aucune logique
│   ├── (app)/               espace des agents : tableau de bord, [module] (pages d'attente)
│   ├── (auth)/connexion/    connexion (téléphone + code, double authentification, ADR-023)
│   └── api/health/          sonde de santé
├── features/<domaine>/      une tranche verticale par domaine administré (voir ci-dessous)
├── components/
│   ├── ui/                  composants de base, futur paquet ksp-ui (F-003)
│   └── layout/              cadre du back-office : AppShell, menu des modules
├── lib/                     technique transverse : client de la gateway, filtre d'affichage des modules, SEO
├── config/                  environnement, identité de l'outil, catalogue des modules
└── i18n/                    textes communs de l'interface
```

| Dossier                     | Rôle                                                                                                                                                                                                                   | Portée                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `app/`                      | Une route = un dossier. La page assemble le cadre et une fonctionnalité ; elle ne calcule rien. Le travail propre à une route (paramètres, `generateStaticParams`, `notFound`, métadonnées) y reste.                   | Commun                                            |
| `features/<domaine>/`       | Tout ce qui est propre à un domaine administré : écrans, schémas des réponses de la gateway, composants client qui appellent `api`.                                                                                    | Commun (la liste des domaines est propre au site) |
| `components/ui/`            | Briques sans connaissance du site : `Button`, `ButtonLink`, `Container`. N'importe que `ui` et `lib`.                                                                                                                  | Commun (voir « Convergence de `components/ui` »)  |
| `components/layout/`        | Cadre du back-office : `AppShell` (menu à gauche, tiroir `popover` sur téléphone), `SidebarNav` (menu filtré par rôle, page courante), `ModuleGate` (module hors des rôles). Reçoit le compte et le contenu par props. | Commun (le contenu est propre au site)            |
| `lib/`                      | Code technique sans interface : `api` (seul endroit où `fetch` est permis, session en mémoire), `navigation/visible-modules` (filtre d'affichage par rôle et par phase), `seo`.                                        | Commun (`navigation` propre au back-office)       |
| `config/`                   | `env.ts` (zod), `site.ts` ; pour le back-office, `modules.ts` : le catalogue des modules (adresse, libellé, description, rôles, phase), analogue de `metiers.ts` du portail.                                           | Commun (`modules.ts` propre au back-office)       |
| `i18n/`                     | Textes communs de l'interface (français ; anglais prévu). Les textes d'un écran vivent dans sa fonctionnalité.                                                                                                         | Commun                                            |
| `scripts/first-load-js.mjs` | Mesure du poids JavaScript par page (`pnpm size`), identique au portail.                                                                                                                                               | Commun                                            |

### Où vit chaque élément existant

| Élément                                        | Place                                                         | Pourquoi                                                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Catalogue des modules (rôles, phase, adresses) | `config/modules.ts`                                           | Lu par le menu, le tableau de bord et les routes : c'est une donnée transverse. Une fonctionnalité ne peut pas le porter, car `config` et `components` n'importent aucune fonctionnalité.              |
| Filtre d'affichage par rôle                    | `lib/navigation/visible-modules.ts` (anciennement `lib/auth`) | Fonction pure (rôles, phase, catalogue → modules à afficher) qui sert la navigation. Le dossier `auth` laissait croire à un contrôle d'accès ; `navigation` dit ce qu'il fait : choisir quoi afficher. |
| Cadre et menu                                  | `components/layout/` (anciennement `components/shell`)        | Même rôle que `components/layout` dans les autres fronts.                                                                                                                                              |
| Tableau de bord                                | `features/dashboard`                                          | Écran propre au domaine « tableau de bord » ; la route `(app)/page.tsx` ne fait plus que l'assembler avec le cadre.                                                                                    |
| Route `(app)/[module]`                         | `app/`, inchangée                                             | Pages d'attente générées depuis le catalogue ; voir « D'une page d'attente à un module ».                                                                                                              |
| Page `(auth)/connexion`                        | `app/` (coque statique) + `features/identity` (`LoginFlow`)   | La route pose la coque ; le parcours (téléphone, code, double authentification) est un composant client de `features/identity`.                                                                        |

### Une fonctionnalité

Même forme que dans le modèle du portail :

```
features/<domaine>/
├── index.ts         API publique : seul point d'entrée depuis l'extérieur
├── types.ts         types partagés de la fonctionnalité, quand ils ne sont ni un contenu ni un schéma
├── schemas.ts       schémas zod des réponses de la gateway (validation à la frontière)
└── components/      écrans du domaine, tests à côté
```

**Un fichier n'existe que s'il a du contenu.** Dans le back-office, toutes les données sont personnelles ou réservées aux agents, et chaque écriture demande la session de l'agent : lectures et écritures passent par `api` depuis le navigateur (option A, plus bas). `queries.ts`, `server.ts` (lectures côté serveur via `serverApi()`) et `actions.ts` (Server Actions, sans jeton côté serveur) n'y ont donc pas d'usage aujourd'hui, et `content.ts` non plus : les textes des écrans ne viennent pas du CMS.

Le nom d'une fonctionnalité est celui du service du backend, en anglais (le code est en anglais, les adresses en français). Seules `features/dashboard` et `features/identity` (connexion et session) existent aujourd'hui : les autres domaines n'ont encore que leur entrée dans le catalogue des modules, et **aucun dossier n'est créé avant ses écrans**. Correspondance prévue :

| Module (adresse)                   | Fonctionnalité(s)                                               | Service(s) du backend        | Phase | État                                |
| ---------------------------------- | --------------------------------------------------------------- | ---------------------------- | ----- | ----------------------------------- |
| Tableau de bord (`/`)              | `features/dashboard`                                            | — (indicateurs des services) | 1     | présentation provisoire des modules |
| Recouvrement (`/recouvrement`)     | `features/recovery`                                             | recovery                     | 1     | page d'attente                      |
| Nettoyage (`/nettoyage`)           | `features/cleaning`                                             | cleaning                     | 1     | page d'attente                      |
| Finance (`/finance`)               | `features/payment`, `features/wallet`, `features/billing`       | payment, wallet, billing     | 1     | page d'attente                      |
| Clients et comptes (`/clients`)    | `features/identity`                                             | identity                     | 1     | page d'attente ; connexion branchée |
| Notifications (`/notifications`)   | `features/notification`                                         | notification                 | 1     | page d'attente                      |
| Administration (`/administration`) | `features/identity` (agents, rôles), `features/audit` (journal) | identity, audit              | 1     | page d'attente                      |
| Immobilier (`/immobilier`)         | `features/realestate`                                           | realestate                   | 2     | masqué (phase suivante)             |
| Impression (`/impression`)         | `features/print`                                                | print                        | 3     | masqué                              |
| Livraison (`/livraison`)           | `features/delivery`                                             | delivery                     | 3     | masqué                              |
| Marketplace (`/marketplace`)       | `features/catalog`, `features/order`                            | catalog, order               | 4     | masqué                              |

**Finance** (validé le 19 octobre 2026, aligné sur les services `payment`, `wallet` et `billing` du backend) : un seul module dans le menu, `/finance`, et une fonctionnalité par service : `payment` (paiements reçus, rapprochement), `wallet` (portefeuilles, demandes de versement validées par une autre personne), `billing` (factures et avoirs). La page `/finance` assemble les trois ; chaque écran a sa sous-adresse (`/finance/paiements`, `/finance/portefeuilles`, `/finance/factures`). Pas de fonctionnalité `finance` : elle mélangerait trois contrats de la gateway et ses fichiers grossiraient sans frontière.

**Administration** : agents et rôles relèvent d'`identity` (les rôles sont déclarés par chaque service auprès d'identity), le journal d'audit d'`audit`. Le service des « paramètres généraux » reste **à préciser** avec les contrats de la gateway. **Marketplace** : la validation des vendeurs est rangée provisoirement dans `catalog`, les litiges, retours et commissions dans `order` (**à valider** au lot de la phase 4).

## Règles de dépendance

```
                 app                         compose tout, rien ne l'importe
                  │
                  ▼
        features/<domaine>                   API publique (index.ts) entre fonctionnalités
                  │
                  ▼
          components/layout                  cadre du back-office
                  │
                  ▼
           components/ui                     portable (ksp-ui) : n'importe que ui et lib
                  │
                  ▼
     lib  ──►  config, i18n                  aucun composant, aucune fonctionnalité
```

Une flèche signifie « peut importer ». Les règles, identiques au portail, sont dans `eslint.config.mjs` (`no-restricted-imports`) :

| Règle                                                                                           | Où                                                             |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Imports relatifs limités au dossier courant (`./`) ; ailleurs, alias `@/`                       | tout `src/`                                                    |
| Une fonctionnalité s'importe par `@/features/<domaine>` (ou `/server`, `/session`)              | tout `src/`                                                    |
| Dans sa propre fonctionnalité : `./…` ou `@/features/<domaine>/…`, jamais son propre `index.ts` | `features/<domaine>/`                                          |
| Rien n'importe `@/app`                                                                          | `features`, `components`, `lib`, `config`, `i18n` (hors tests) |
| Aucune fonctionnalité                                                                           | `components`, `lib`, `config`, `i18n` (hors tests)             |
| Aucun composant                                                                                 | `lib`, `config`, `i18n`                                        |
| `components/ui` n'importe que `components/ui` et `lib` (ni `config`, ni `i18n`, ni le reste)    | `components/ui`                                                |
| `fetch` interdit hors de `src/lib/api` (F-004)                                                  | tout le dépôt sauf tests et `e2e`                              |

Les fonctionnalités sont lues dans `src/features` au lancement d'ESLint : une nouvelle fonctionnalité reçoit ses règles sans modifier la configuration. Limite connue : un `import()` dynamique n'est pas contrôlé.

## Droits et affichage

Le front **n'autorise rien**. Il reçoit de la gateway la session de l'agent (ses rôles) et s'en sert pour choisir quoi montrer :

- `visibleModules(roles, phase)` décide des entrées du menu et des cartes du tableau de bord ; `isModuleVisible` dit seulement si un module figure dans ce menu. Ni l'un ni l'autre ne protège une donnée.
- Une coque statique ne contient aucune donnée : afficher un module à un agent sans le rôle n'expose rien, puisque la gateway refusera ses appels (403, message affiché par `ApiError`). Inversement, masquer un module n'est pas une protection.
- Pas de contrôle de rôle dans `proxy.ts` ni dans un layout : il dupliquerait les règles du backend et finirait par diverger.
- Les rôles viennent du jeton d'accès de la session (claim `roles`, lu sans vérification dans `lib/api/claims.ts`) : la gateway ne les renvoie dans aucune réponse.
- Une page de module ouverte par son adresse hors des rôles de l'agent affiche un message (`ModuleGate`) au lieu du module : confort d'affichage, pas une protection (**à valider**).

## Connexion et session (`features/identity`, ADR-023)

| Route de la gateway (contrat `ksp-api.v1.yaml`) | Écran ou composant                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `POST /api/v1/identity/otp/request`             | `PhoneStep` (numéro), renvoi dans `CodeStep`                                                           |
| `POST /api/v1/identity/otp/verify`              | `CodeStep` ; `mfa_required` mène à la configuration (`enrollmentRequired`) ou au code de l'application |
| `POST /api/v1/identity/mfa/totp/enroll`         | `EnrollStep` : QR code calculé dans la page (`uqr`, chargé à cette étape seulement) et clé à la main   |
| `POST /api/v1/identity/mfa/totp/confirm`        | `EnrollStep` (premier code), puis `RecoveryCodesStep` (10 codes : copie, `.txt`, case à cocher)        |
| `POST /api/v1/identity/mfa/verify`              | `MfaStep` (code de l'application ou code de récupération, jamais de SMS), `RemainingCodesStep`         |
| `POST /api/v1/identity/token/refresh`           | `lib/api/refresh.ts` : reprise au chargement d'une page, et une fois sur 401                           |
| `POST /api/v1/identity/logout`                  | `AccountPanel` (pied du menu)                                                                          |
| `GET /api/v1/identity/me`                       | `AccountPanel` (nom, téléphone, e-mail vérifié)                                                        |

Le cadre des pages `(app)` importe `@/features/identity/session` (garde et panneau du compte) et non l'index, pour ne pas charger le parcours de connexion sur chaque page : point d'entrée secondaire autorisé par la règle ESLint, comme `/server`. Les pages `(app)` sont gardées par `RequireSession` : sans session, retour à `/connexion?retour=<page demandée>` (chemin interne seulement) ; session terminée pendant la visite (12 h, 30 min sans activité, rôle retiré), explication et lien pour se reconnecter. Le jeton d'accès reste en mémoire ; le jeton de renouvellement est dans le cookie `__Secure-ksp_admin_rt` posé par la gateway. Aucune minuterie ne renouvelle la session : seul l'agent qui agit la prolonge.

## Stratégie de rendu

Cache Components (`cacheComponents`) n'est pas activé : c'est le modèle de cache « précédent » de Next 16 qui s'applique (voir le modèle du portail).

| Type de route     | Exemples                                       | Rendu                                                                                                                 |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Page d'attente    | tableau de bord, `[module]`, 404               | **Statique** (○ et ● par `generateStaticParams`) ; un module d'une phase suivante répond 404                          |
| Connexion         | `/connexion`                                   | **Statique** ; composant client en feuille (`LoginFlow` : formulaire, double authentification) qui appelle `api`      |
| Écran d'un module | liste des dossiers, fiche, file des versements | **Coque statique** + composants client en feuille qui appellent `api` (F-005, option A) ; état des filtres dans l'URL |
| Technique         | `/api/health`, `/robots.txt`                   | Sonde dynamique (ƒ) ; `robots.txt` statique                                                                           |

Interdits : `serverApi()` pour une donnée d'agent ou de client (il n'envoie ni cookie ni jeton : routes publiques seulement) ; données personnelles dans un cache partagé (`next.revalidate`, `tags`) ; `cookies()` ou `headers()` dans un layout commun (toutes les pages deviendraient dynamiques) ; retrait de `X-Robots-Tag`, de `robots.txt` ou de `robots: { index: false }`.

## Budget de poids

« First Load JS » : JavaScript téléchargé à la première visite d'une page, compressé (gzip). Next 16 ne l'affiche plus à la fin de `pnpm build` : `pnpm build && pnpm size` le recalcule à partir des pages construites.

Mesure du 19 octobre 2026 (identique avant et après la réorganisation F-012) :

| Page                                                                  | First Load JS |
| --------------------------------------------------------------------- | ------------- |
| `/`, `/connexion`, 404, pages d'attente des six modules de la phase 1 | 177,2 Ko      |

Le socle (React, Next, routeur, page d'erreur) pèse 177,2 Ko : aucune page n'ajoute encore de composant client.

Budgets :

| Type de page                                                                | Budget                        | Statut                                         |
| --------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| Fronts publics (contenu, vitrine, formulaire, espace connecté)              | 180, 190, 200 et 215 Ko       | validés le 19 octobre 2026 (modèle du portail) |
| Page d'attente ou coque sans composant client propre                        | socle (≈ 177 Ko), sans hausse | validé le 19 octobre 2026                      |
| Écran du back-office (liste, fiche, formulaire, avec ses composants client) | ≤ 220 Ko                      | validé le 19 octobre 2026                      |

Le budget « écran du back-office » laisse environ 40 Ko au-dessus du socle, la même marge que l'écran d'espace connecté du portail (215 Ko pour un socle de 174,8 Ko). Règle : une page qui dépasse son budget, ou un socle qui grossit, se justifie dans la demande de fusion (mesure avant et après). Pas de nouvelle dépendance (tableau de données, graphiques, dates) sans cette mesure et sans validation.

Mesure du 28 octobre 2026 (connexion et session branchées, `pnpm build && pnpm size`) :

| Page                                          | First Load JS | Avant (19 octobre) |
| --------------------------------------------- | ------------- | ------------------ |
| `/connexion`                                  | 211,5 Ko      | 177,2 Ko           |
| `/` (tableau de bord)                         | 209,4 Ko      | 177,2 Ko           |
| Pages d'attente des six modules de la phase 1 | 208,7 Ko      | 177,2 Ko           |
| 404                                           | 178,0 Ko      | 177,2 Ko           |

Les pages de l'espace ne sont plus des coques sans composant client : le cadre lit la session (menu, compte, garde). Elles relèvent donc du budget « écran du back-office » (220 Ko), tenu, mais le cadre en consomme l'essentiel de la marge : zod/mini et le client de la gateway (18,5 Ko, que tout écran paiera de toute façon), le parcours de connexion entier (12,6 Ko) et le cadre (9,1 Ko). Le parcours de connexion est chargé par les pages de l'espace parce que l'index de `features/identity` regroupe connexion et session : importer `AccountPanel` et `RequireSession` sans passer par l'index ramène ces pages à 209,3 Ko (mesuré). La bibliothèque de QR code (`uqr`, 3,8 Ko) n'est chargée qu'à l'étape de configuration. **À valider** : point d'entrée séparé pour la session (`@/features/identity/session`, exception à la règle de l'index) ou chargement différé du parcours de connexion.

## Ajouter une fonctionnalité

1. Nommer le domaine comme le service du backend : `src/features/<domaine>/`.
2. Créer seulement les fichiers utiles : `schemas.ts` pour une réponse de la gateway, `components/` pour les écrans, `types.ts` si besoin.
3. Valider chaque réponse de la gateway avec son schéma zod dans le composant client qui la lit (`schema.parse(await api.get(…))`) ; les types dérivent des schémas (`z.infer`). Zod entre alors dans le JavaScript du navigateur : son coût se mesure au premier écran réel (`zod/mini` en repli), **à valider**.
4. Exporter dans `index.ts` ce dont les routes ont besoin, et rien d'autre.
5. Créer la route dans `src/app/(app)/` : elle assemble `AppShell` et la fonctionnalité.
6. Composant serveur par défaut ; `'use client'` seulement sur la feuille qui lit la session ou la gateway, ou qui porte l'interaction.
7. Action sensible (versement, suspension, changement de rôle) : confirmation explicite et clé d'idempotence (`idempotencyKey`).
8. Tests à côté du code (`*.test.tsx`), parcours dans `e2e/`.
9. `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, puis `pnpm build && pnpm size` et comparaison avec le budget.

### D'une page d'attente à un module

Aujourd'hui, `(app)/[module]/page.tsx` génère une page d'attente par module de la phase en cours à partir du catalogue (`generateStaticParams`) et répond 404 pour les autres. Elle reste telle quelle tant que les modules sont des pages d'attente. Quand les écrans d'un module arrivent (exemple : recouvrement) :

1. Créer `src/features/recovery/` (schémas, écrans, `index.ts`).
2. Créer la route statique `src/app/(app)/recouvrement/page.tsx` (puis ses sous-routes, par exemple `recouvrement/[dossier]/page.tsx`) : `AppShell current="recouvrement"` + l'écran de la fonctionnalité. L'adresse ne change pas : le menu pointe déjà vers `/recouvrement`.
3. Retirer ce module des pages générées par `[module]`, pour qu'une adresse n'ait jamais deux pages : filtre explicite dans `available()` (à écrire au premier module concerné, avec son test).
4. Le catalogue `config/modules.ts` garde l'entrée du module (libellé, rôles, phase) : le menu et le tableau de bord continuent de la lire.
5. Quand le dernier module a sa route, supprimer `[module]`.

## Données des espaces connectés (décision : option A)

L'analyse des deux options (jeton en mémoire dans le navigateur, ou serveur Next qui lit le cookie) est dans le modèle du portail. **Décision (19 octobre 2026) : option A, F-005 conservé**, pour « Mon espace KSP » et le back-office.

Conséquences pour le back-office :

- Chaque écran est une coque statique servie sans calcul ; un composant client en feuille renouvelle la session dès le chargement de l'espace, puis lit la gateway avec `api`, lectures en parallèle.
- Au lot 1, le filtrage du menu par les vrais rôles se fera dans une petite feuille client du cadre, qui reçoit le catalogue en propriétés et lit les rôles de la session ; `AppShell` reste un composant serveur.
- Le premier écran réel (liste des dossiers de recouvrement) est mesuré en 3G simulée ; si le budget ou le temps d'affichage n'est pas tenu, l'option B est rouverte pour cet écran.

## Convergence de `components/ui`

`components/ui` du back-office (`Button`, `ButtonLink`, `Container`) n'a pas été aligné sur celui du portail : le copier changerait le rendu, et la charte du back-office viendra avec son design (F-009). Les deux devront **converger avant la création de `ksp-ui`** (F-003) : mêmes noms, mêmes propriétés, mêmes jetons sémantiques, seules les couleurs d'accent différant.

## Volontairement exclu

Les exclusions communes (couches domaine et application, bibliothèques d'état et de récupération de données, dossiers `hooks/`, `utils/`, `types/`, `services/`, barillets dans `components/`, paquet `ksp-ui` anticipé, greffon `eslint-plugin-boundaries`, Cache Components) sont justifiées dans le modèle du portail. Propre au back-office :

| Exclu                                                                           | Pourquoi                                                                                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Dossiers de fonctionnalités pour les modules encore en attente                  | Ils n'auraient aucun contenu : le catalogue suffit tant qu'il n'y a pas d'écran.                                             |
| Fonctionnalité `finance` regroupant `payment`, `wallet`, `billing`              | Une fonctionnalité par service garde un contrat de la gateway par dossier.                                                   |
| Contrôle des rôles dans le front (`proxy.ts`, layout, garde de route)           | Le backend est seul juge des droits ; un contrôle côté front serait une fausse sécurité et un second endroit à tenir à jour. |
| Copie de `components/ui` du portail                                             | Changement visible ; à faire avec la charte du back-office, avant `ksp-ui`.                                                  |
| Lectures côté serveur (`queries.ts`, `serverApi()`) pour les données des agents | Option A : aucune donnée personnelle ne passe par le serveur Next ni par son cache.                                          |
