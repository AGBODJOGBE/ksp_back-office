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
│   ├── (app)/               espace des agents : tableau de bord, nettoyage/, finance/, clients/ (écrans), [module] (pages d'attente)
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
| Route `(app)/[module]`                         | `app/`                                                        | Pages d'attente générées depuis le catalogue, sauf les modules qui ont leurs écrans (`MODULES_WITH_SCREENS`) ; voir « D'une page d'attente à un module ».                                              |
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

Le nom d'une fonctionnalité est celui du service du backend, en anglais (le code est en anglais, les adresses en français). Seules `features/dashboard`, `features/identity` (connexion, session, comptes entreprise), `features/cleaning` (Nettoyage), `features/billing` (factures) et `features/payment` (paiements en ligne) existent aujourd'hui : les autres domaines n'ont encore que leur entrée dans le catalogue des modules, et **aucun dossier n'est créé avant ses écrans**. Correspondance prévue :

| Module (adresse)                   | Fonctionnalité(s)                                               | Service(s) du backend     | Phase | État                                       |
| ---------------------------------- | --------------------------------------------------------------- | ------------------------- | ----- | ------------------------------------------ |
| Ma journée (`/`)                   | `features/dashboard`                                            | — (sections des services) | 1     | file « À traiter » branchée                |
| Recouvrement (`/recouvrement`)     | `features/recovery`                                             | recovery                  | 1     | page d'attente                             |
| Nettoyage (`/nettoyage`)           | `features/cleaning`                                             | cleaning                  | 1     | v2 : catalogue et réglages (sous-lot 1a)   |
| Finance (`/finance`)               | `features/payment`, `features/wallet`, `features/billing`       | payment, wallet, billing  | 1     | factures et paiements branchés             |
| Clients et comptes (`/clients`)    | `features/identity`                                             | identity                  | 1     | comptes entreprise branchés                |
| Notifications (`/notifications`)   | `features/notification`                                         | notification              | 1     | historique des envois et modèles (ADR-039) |
| Administration (`/administration`) | `features/identity` (agents, rôles), `features/audit` (journal) | identity, audit           | 1     | comptes et rôles branchés                  |
| Immobilier (`/immobilier`)         | `features/realestate`                                           | realestate                | 2     | masqué (phase suivante)                    |
| Impression (`/impression`)         | `features/print`                                                | print                     | 3     | masqué                                     |
| Livraison (`/livraison`)           | `features/delivery`                                             | delivery                  | 3     | masqué                                     |
| Marketplace (`/marketplace`)       | `features/catalog`, `features/order`                            | catalog, order            | 4     | masqué                                     |

**Finance** (validé le 19 octobre 2026, aligné sur les services `payment`, `wallet` et `billing` du backend) : un seul module dans le menu, `/finance`, et une fonctionnalité par service : `payment` (paiements reçus, rapprochement), `wallet` (portefeuilles, demandes de versement validées par une autre personne), `billing` (factures et avoirs). Le module assemble les trois ; chaque écran a sa sous-adresse (`/finance/paiements`, `/finance/portefeuilles`, `/finance/factures`) et `/finance` ouvre les factures. Pas de fonctionnalité `finance` : elle mélangerait trois contrats de la gateway et ses fichiers grossiraient sans frontière.

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

| Règle                                                                                                          | Où                                                             |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Imports relatifs limités au dossier courant (`./`) ; ailleurs, alias `@/`                                      | tout `src/`                                                    |
| Une fonctionnalité s'importe par `@/features/<domaine>` (ou `/server`, `/session`, `/organizations`, `/queue`) | tout `src/`                                                    |
| Dans sa propre fonctionnalité : `./…` ou `@/features/<domaine>/…`, jamais son propre `index.ts`                | `features/<domaine>/`                                          |
| Rien n'importe `@/app`                                                                                         | `features`, `components`, `lib`, `config`, `i18n` (hors tests) |
| Aucune fonctionnalité                                                                                          | `components`, `lib`, `config`, `i18n` (hors tests)             |
| Aucun composant                                                                                                | `lib`, `config`, `i18n`                                        |
| `components/ui` n'importe que `components/ui` et `lib` (ni `config`, ni `i18n`, ni le reste)                   | `components/ui`                                                |
| `fetch` interdit hors de `src/lib/api` (F-004)                                                                 | tout le dépôt sauf tests et `e2e`                              |

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

## Nettoyage v2 (`features/cleaning`, ADR-054 à ADR-059)

Le backend a remplacé le Nettoyage v1 sur place, sans compatibilité (ADR-054) : routes `quote-requests`, `quote-request-groups`, `missions`, `interventions`, `catalog`, mesures v1 supprimées. Le module du back-office est reconstruit en trois sous-lots sur la même branche : **1a** socle v2, catalogue, tarifs et réglages (ci-dessous) ; **1b** dossiers (demandes, visites, constat retenu, devis) ; **1c** agents, équipes, planning, affectations, programmes, séances, réclamations. Le code v1 (écrans, schémas, textes, tests, sections de « Ma journée ») est retiré. Les trois sous-lots sont livrés (1c-4 : réclamations, sections de « Ma journée ») : il ne reste plus aucune page provisoire dans le module (`ComingSoon` supprimé).

```
features/cleaning/
├── index.ts               onglets, menus de section, écrans (relais à la demande), textes des pages
├── queue.ts               point d'entrée `@/features/cleaning/queue` : sections de « Ma journée » (+ queue-texts.ts)
├── access.ts              permissions du contrat (x-ksp-permission) ← rôles par défaut (x-ksp-default-roles) ; rolesWith
├── api.ts                 42 opérations admin du sous-lot 1a (listes paginées, lectures complètes, total)
├── requests-api.ts        1b : dossiers, visites, version retenue, devis (+ requests-schemas, -filters, -texts)
├── agents-api.ts          1c-1 : agents, disponibilités, équipes (+ agents-schemas, -filters, -texts, teams-texts)
├── planning-api.ts        1c-2 : planning, à affecter, affectations, propositions, automatique (+ planning-*)
├── programs-api.ts        1c-3 : programmes, séances, décisions (+ programs-*, schedule-plan.ts, session-texts)
├── claims-api.ts          1c-4 : réclamations (+ claims-schemas, claims-filters, claims-texts)
├── schemas.ts             zod/mini, champ par champ, énumérations du contrat
├── errors.ts              message affichable, champ refusé (details.field), tarif incomplet (details.reason, index)
├── inputs.ts              entiers, FCFA, coefficients (points de base ↔ « 1,15 »), pourcentages, codes
├── paths.ts, sections.ts  adresses ; étapes du catalogue et sections des réglages (fichier léger des coques)
├── texts.ts, catalog-texts.ts, simulator-texts.ts, settings-texts.ts
├── *-fixtures.test-utils.ts, fake-gateway.test-utils.ts   passerelle commune + réponses TEST v2
└── components/
    ├── lazy.tsx                 relais next/dynamic : une page ne télécharge que son écran
    ├── cleaning-tabs.tsx, section-nav.tsx, legacy-mission.tsx
    ├── parts.tsx, editors.tsx, catalog-parts.tsx, request-parts.tsx   états, formulaires, motifs, clés
    ├── catalog-overview.tsx, parameters.tsx, categories.tsx, places.tsx, skills.tsx,
    │   cleaning-types.tsx, offers.tsx, tariffs.tsx, simulator.tsx
    ├── settings.tsx, zones.tsx, holidays.tsx
    ├── requests-*.tsx, request-*.tsx, visits-*.tsx, visit-panel.tsx        dossiers et visites (1b)
    ├── agent-*.tsx, agents-*.tsx, team-*.tsx, teams-list.tsx              agents et équipes (1c-1)
    ├── planning-*.tsx, assignment-*.tsx                                   planning (1c-2)
    ├── program-*.tsx, programs-*.tsx, session-*.tsx                       programmes et séances (1c-3)
    └── claims-queue.tsx, claims-filter-bar.tsx, claim-detail.tsx, claim-actions.tsx, claim-messages.tsx (1c-4)
```

**Parcours du module** (onglets, dans l'ordre du métier, chacun suivant la permission de sa route) : Catalogue · Dossiers · Visites · Planning · Programmes · Agents et équipes · Réclamations · Réglages.

| Adresse                                                            | Écran                                                                                                 | Sous-lot |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------- |
| `/nettoyage/catalogue`                                             | Ordre de construction, nombre d'éléments par étape, première étape vide mise en avant                 | 1a       |
| `/nettoyage/catalogue/parametres[/nouveau, /{id}]`                 | 1. Paramètres (nombre, choix, oui/non ; valeurs désactivables)                                        | 1a       |
| `/nettoyage/catalogue/categories[/nouveau, /{id}]`                 | 2. Catégories de lieu, frais de visite, lieux rattachés                                               | 1a       |
| `/nettoyage/catalogue/lieux[/nouveau, /{id}]`                      | 3. Lieux (`?categorie=`), paramètres ordonnés, superficie, visibilité sur le portail, offres du lieu  | 1a       |
| `/nettoyage/catalogue/competences`                                 | 4. Compétences (ajout, renommage, désactivation)                                                      | 1a       |
| `/nettoyage/catalogue/types[/nouveau, /{id}]`                      | 5. Types de nettoyage et packs, liste de contrôle                                                     | 1a       |
| `/nettoyage/catalogue/offres[/nouveau, /{id}]`                     | 6. Offres (`?lieu=`, `?type=`), équipe par tranches ; tarif : versions, brouillon, essai, publication | 1a       |
| `/nettoyage/catalogue/simulateur`                                  | 7. Simulateur (`?lieu=&types=&brouillons=`), détail ligne par ligne                                   | 1a       |
| `/nettoyage/reglages`, `/reglages/zones`, `/reglages/jours-feries` | Réglages bornés ; zones et communes ; jours fériés (`?annee=`)                                        | 1a       |
| `/nettoyage` (Dossiers), `/nettoyage/dossiers/{id}`                | File des dossiers (« À traiter », filtres) ; fiche par étapes : demande, visite, retenu, devis        | 1b       |
| `/nettoyage/visites`                                               | Calendrier des visites (jour, semaine, filtres), gestion d'une visite                                 | 1b       |
| `/nettoyage/equipe[/agents/{id}, /agents/nouveau, /equipes…]`      | Agents (candidatures en tête), fiche et cycle de vie, disponibilités ; équipes                        | 1c-1     |
| `/nettoyage/planning` (`?vue=jour&date=`)                          | Planning jour/semaine, colonne « à affecter », affectation contrôlée, propositions, automatique       | 1c-2     |
| `/nettoyage/programmes[/{id}, /{id}/seances/{sessionId}]`          | Programmes, décisions (horaire, avenant, suspension, arrêt validé par une 2ᵉ personne) ; séance       | 1c-3     |
| `/nettoyage/missions/{id}`                                         | Ancienne fiche mission (v1) encore citée par factures et paiements : renvoi vers les programmes       | 1c-3     |
| `/nettoyage/reclamations[/{id}]`                                   | File (`?statut=&agent=&client=&organisation=&tri=`, compteurs) ; fiche : échanges, décision, crédit   | 1c-4     |

| Route du contrat (`/api/v1/admin/cleaning`)                                       | Écran ou composant                                                     |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `GET`, `POST /parameters` ; `GET`, `PATCH /parameters/{id}`                       | `ParametersList`, `NewParameter`, `ParameterDetail`                    |
| `GET`, `POST /place-categories` ; `GET`, `PATCH /place-categories/{id}`           | `CategoriesList`, `NewCategory`, `CategoryDetail`                      |
| `GET`, `POST /place-types` ; `GET`, `PATCH /place-types/{id}`                     | `PlacesList`, `NewPlace`, `PlaceDetail`, `CategoryPlaces`              |
| `GET`, `POST /skills` ; `PATCH /skills/{id}`                                      | `SkillsScreen`, choix de la compétence d'un type                       |
| `GET`, `POST /cleaning-types` ; `GET`, `PATCH /cleaning-types/{id}`               | `CleaningTypesList`, `NewCleaningType`, `CleaningTypeDetail`           |
| `GET`, `POST /offers` ; `GET`, `PATCH /offers/{id}`                               | `OffersList`, `NewOffer`, `OfferDetail`, `PlaceOffers`                 |
| `GET`, `POST /offers/{id}/tariffs` ; `PUT …/tariffs/{version}` ; `POST …/publish` | `TariffsPanel` (fiche de l'offre), brouillons du simulateur            |
| `POST /simulations`                                                               | `Simulator`                                                            |
| `GET`, `POST /holidays` ; `DELETE /holidays/{id}`                                 | `HolidaysScreen`                                                       |
| `GET`, `POST /zones` ; `PATCH /zones/{id}` ; `POST /zones/{id}/activation`        | `ZonesScreen` ; communes du simulateur                                 |
| `GET /communes`                                                                   | `ZonesScreen` (communes sans zone)                                     |
| `GET`, `PATCH /settings`                                                          | `SettingsScreen`                                                       |
| `GET /claims` ; `GET`, `PATCH /claims/{id}`                                       | `ClaimsQueue` ; `ClaimDetail` (prise en charge, réponse)               |
| `POST /claims/{id}/decision` ; `POST …/decision/approve`                          | `ClaimActions` (décision confirmée, crédit validé par une 2ᵉ personne) |

Les routes des sous-lots 1b et 1c (dossiers, visites, devis, agents, équipes, planning, programmes, séances) sont listées dans les en-têtes de `requests-api.ts`, `agents-api.ts`, `planning-api.ts` et `programs-api.ts`.

Aucune route publique `/api/v1/cleaning/catalog/*` n'est lue : le back-office voit les mêmes données (et les éléments désactivés) par ses routes.

- **Ordre de construction** : paramètres, catégories, lieux, compétences (facultatif), types, offres et tarifs, simulateur. Les paramètres viennent d'abord parce que le contrat exige la superficie d'un lieu (`areaParameterId`, R-CA-14) et un paramètre de base pour un tarif. L'accueil compte les éléments de chaque étape (`total`, lecture `limit=1`) et met en avant la première étape vide : orientation seulement.
- **Droits** (`access.ts`) : chaque permission du contrat (`x-ksp-permission`, liste dans `config/permissions.ts`) est lue dans le jeton (claims `perms` et `zone_perms`, ADR-057, via `lib/api/claims.ts` et `lib/grants.ts`) : un rôle créé ou modifié au back-office s'applique sans changer le code, au menu (`permissions` du module), aux onglets et à la file « À traiter » (`permission` d'une section). **Repli** pour un jeton sans permissions (émis avant ADR-057) : la table des rôles par défaut (`x-ksp-default-roles`) de `access.ts`. Les autres modules décident encore par rôle (`x-ksp-roles`), aucune de leurs routes ne déclarant de permission. `cleaning_agent` n'a plus aucune route du back-office (application de l'agent) : il sort du module ; `support_agent` y entre (lecture du catalogue, des dossiers et des programmes ; réclamations). Écrans en lecture seule sans `cleaning.catalog.manage`, `cleaning.zone.manage` ou `cleaning.settings.manage` ; 403 en note neutre, 404 « introuvable ».
- **Rien n'est supprimé** (R-CA-06) : désactiver demande une confirmation ; activer se fait d'un geste. Lieux et offres sont créés désactivés (R-CA-12) ; leur visibilité sur le portail (`publiclyVisible`, `visibilityReasons`) est affichée.
- **Codes** proposés à partir du nom, modifiables avant la création, figés ensuite ; codes des valeurs de choix et des points de contrôle tirés des libellés.
- **Tarif** (ADR-056) : version en vigueur, brouillon (préparé depuis la version en vigueur ; première sauvegarde `POST` avec clé, suivantes `PUT`), « Essayer ce brouillon au simulateur », publication confirmée (`Idempotency-Key`). Saisie en FCFA entiers, coefficients en multiplicateur (« 1,15 » = 11 500 points de base), remise de pack en pourcentage. Contiguïté et cohérence jugées par la gateway : `CLEANING_TARIFF_INCOMPLETE` traduit avec le rang, `CLEANING_VALIDATION_FAILED` placé sous le champ (`brackets[2].to`).
- **Idempotence** : clé tirée au premier envoi, renvoyée telle quelle après une coupure ou une erreur du serveur, renouvelée après une réussite ou un refus définitif.
- **Montants masqués** sans `cleaning.amounts.read` : « Montant masqué », champ non envoyé.
- **Réclamations** (1c-4, `cleaning.claim.manage`, support compris) : file triée des plus anciennes aux plus récentes (défaut du contrat), compteurs « Nouvelles » et « En cours », colonne « À faire » (prendre en charge, décider, crédit à valider) et signal « plus de 24 h sans réponse » (objectif `firstResponseAt`). Fiche : séance et programme liés, récit et photos, échanges avec le client et réponse (`PATCH`, 2 000 caractères), décision confirmée avec motif (repasse gratuite, crédit en FCFA entiers, rejet), validation d'un crédit au-delà de 50 000 FCFA par une autre personne que l'auteur (bouton masqué pour l'auteur, `CLEANING_SECOND_APPROVER_REQUIRED` en dernier ressort). Crédit « Montant masqué » sans `cleaning.amounts.read`. Les trois gestes portent une `Idempotency-Key`.
- **Double authentification récente** : clôture et absence d'une séance ou d'une visite, retrait de photo, décision et validation d'un crédit exigent une double authentification de moins de 10 minutes (`x-ksp-mfa-max-age: 600`). Le contrat n'offre aucune route pour la refaire pendant une session (`/identity/mfa/verify` exige le `mfaToken` de la connexion) : l'écran l'annonce en note et affiche le refus de la gateway (`GATEWAY_MFA_REQUIRED`, 403, absent du contrat). **Manque du backend.**
- **Ma journée** : sections v2 par `@/features/cleaning/queue` (voir « Ma journée » ci-dessous).

## Finance et comptes entreprise (`features/billing`, `features/payment`, `features/identity`)

Branchés sur 12 routes du contrat (`ksp-api.v1.yaml`) : facturation (ADR-025, ADR-028), paiements en ligne (ADR-031) et comptes entreprise (ADR-027). Même modèle que le Nettoyage : coque statique, écrans client chargés à la demande (`components/lazy.tsx`, `organizations-lazy.tsx`), schémas `zod/mini` champ par champ, états chargement, vide et erreur avec « Réessayer », filtres dans l'adresse.

```
features/billing/            factures, paiement manuel, réglages (service billing)
├── access.ts                rôles du contrat (affichage seulement)
├── api.ts, schemas.ts       5 routes /admin/billing/*
├── errors.ts, texts.ts      refus précisés (details.reason), libellés, adresses
└── components/              invoices-list, invoice-detail, billing-settings, lazy
features/payment/            paiements en ligne (service payment)
├── access.ts, api.ts, schemas.ts, texts.ts
└── components/              payments-list, lazy
features/identity/           + comptes entreprise, point d'entrée organizations.ts : organization-*.ts, organizations-api.ts,
                               components/organizations-list, organization-detail, organizations-lazy
app/(app)/finance/           layout (onglets filtrés par rôle : finance-tabs.tsx), factures, paiements, réglages
app/(app)/clients/           layout, entreprises, entreprises/[id]
```

| Adresse                     | Écran                                                                                                        | Rôles (contrat)                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `/finance`                  | redirige vers `/finance/factures`                                                                            | —                                                                         |
| `/finance/factures`         | Factures : filtres `?etat=`, `?entreprise=` (organisation), `?mission=` (contrat), passés à la gateway       | `finance_officer`, `cleaning_supervisor`, `cleaning_admin`, `super_admin` |
| `/finance/factures/[id]`    | Fiche : montants, échéance, en-tête figé, lignes au prorata, règlements ; paiement manuel (confirmation)     | idem                                                                      |
| `/finance/paiements`        | Paiements en ligne : filtres `?etat=`, `?objet-type=`, `?objet=` ; alerte des paiements « à examiner »       | `finance_officer`, `cleaning_admin`, `super_admin`                        |
| `/finance/reglages`         | Délai de règlement ; renvoi vers les seuils d'impayés du Nettoyage                                           | `finance_officer`, `cleaning_admin`, `super_admin`                        |
| `/clients`                  | redirige vers `/clients/entreprises`                                                                         | —                                                                         |
| `/clients/entreprises`      | Comptes entreprise, filtre `?etat=` (`pending_review` : demandes à traiter)                                  | `super_admin`, `support_agent`                                            |
| `/clients/entreprises/[id]` | Fiche : identité légale, membres (demandeur signalé, téléphone), motifs ; valider, refuser, suspendre, lever | lecture : les deux rôles ; décisions : `super_admin`                      |

| Route du contrat                                     | Écran                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `GET /admin/billing/invoices`                        | `InvoicesList` (`status`, `organizationId`, `contractId`)     |
| `GET /admin/billing/invoices/{id}`                   | `InvoiceDetail`                                               |
| `POST /admin/billing/invoices/{id}/payments`         | `InvoiceDetail` (boîte « Enregistrer un paiement »)           |
| `GET /admin/billing/settings`                        | `BillingSettingsScreen`                                       |
| `PUT /admin/billing/settings`                        | `BillingSettingsScreen` (délai de 1 à 90 jours)               |
| `GET /admin/payment/payments`                        | `PaymentsList` (`status`, `subjectType`, `subjectId`), alerte |
| `GET /admin/identity/organizations`                  | `OrganizationsList` (`status`)                                |
| `GET /admin/identity/organizations/{id}`             | `OrganizationDetail`                                          |
| `POST /admin/identity/organizations/{id}/validate`   | `OrganizationDetail` (confirmation)                           |
| `POST /admin/identity/organizations/{id}/reject`     | `OrganizationDetail` (confirmation, motif obligatoire)        |
| `POST /admin/identity/organizations/{id}/suspend`    | `OrganizationDetail` (confirmation, motif obligatoire)        |
| `POST /admin/identity/organizations/{id}/reactivate` | `OrganizationDetail` (confirmation)                           |

- **Point d'entrée `@/features/identity/organizations`** (troisième exception à la règle de l'index, après `/server` et `/session`, ajoutée à `eslint.config.mjs`) : passées par l'index d'identity, les pages du module chargeaient le parcours de connexion (220,2 Ko, au-delà du budget) et `/connexion` chargeait les écrans des comptes entreprise (+3 Ko). **À valider**, comme `/session`.
- **Point d'entrée `@/features/identity/accounts`** (même raison que `/organizations`, ajouté à `eslint.config.mjs`) : écrans « Administration → Comptes et rôles » (ADR-043 du backend), chargés à la demande. Le front n'applique aucune règle de droits : identity renvoie dans la fiche les actions permises (`actions`, `revocable`) et le front n'affiche que celles-là. La recherche reste dans l'état de la page, pas dans l'adresse : un numéro de téléphone n'a pas à finir dans l'historique du navigateur.
- **Modules** (`config/modules.ts`) : Finance s'ouvre aux rôles des factures (`finance_officer`, `cleaning_supervisor`, `cleaning_admin`) ; « Clients et comptes » à `support_agent` seul (`recovery_admin` et `cleaning_admin` retirés : aucune route du module ne leur est ouverte, **à valider**). `super_admin` voit tout.
- **Liens entre fiches**, montrés seulement si le module cible est dans le menu de l'agent : facture → mission du Nettoyage et compte entreprise ; facture → ses paiements en ligne ; paiement → mission ou facture payée, et entreprise payeuse ; compte entreprise → ses factures. Les adresses d'une autre fonctionnalité sont écrites en dur quand l'importer créerait un cycle entre index (comme le portail).
- **Paiement manuel** : sans clé d'idempotence (le contrat n'en prévoit pas sur cette route, **à valider** côté backend) ; le bouton est désactivé pendant l'envoi. Refus précisés : `BILLING_PAYMENT_INVALID` (`exceeds_balance`, `amount_invalid`, `method_not_allowed`) ; `BILLING_INVALID_TRANSITION` et `BILLING_CONCURRENT_UPDATE` relisent la fiche.
- **Décisions sur un compte entreprise** : `IDENTITY_ORGANIZATION_INVALID_TRANSITION` (décision prise ailleurs entre-temps) relit la fiche ; les membres restent affichés après une décision (la réponse ne porte que l'organisation).
- **Période facturée** : `periodEnd` est la borne de fin (minuit, heure du Bénin, du lendemain du dernier jour facturé, service billing) : l'écran affiche le jour qui la précède. Le contrat ne le précise pas : **à valider** (le portail affiche la borne telle quelle).
- **Paiements « à examiner »** (`amount_mismatch`) : badge rouge, en tête du filtre d'état, et alerte au-dessus de la liste (une lecture `limit=1` filtrée), avec un lien vers le filtre.

Briques ajoutées : `components/ui/loading-block.tsx`, `panel.tsx`, `back-link.tsx`, `resource-view.tsx` (sorties de `features/cleaning/components/parts.tsx`, qui les reprend) ; `lib/api/error-text.ts` (`apiErrorText`) ; `lib/api/gateway.test-utils.ts` (gateway simulée commune aux tests).

## Ma journée (`features/dashboard`, étape 2)

Accueil `/` : file « À traiter », puis « Vos modules ». Chaque fonctionnalité fournit ses sections par un point d'entrée `@/features/<domaine>/queue` (forme commune `WorkQueueSection` de `lib/work-queue.ts`) ; le tableau de bord les ordonne, filtre par rôle (`sectionsFor`, affichage seulement) et les lit en parallèle. La file est chargée à la demande (`day-queue-lazy.tsx`). Les points d'entrée `/queue` ne sont pas exportés par les index : une page serveur qui lit un index ne charge donc pas la file (exportés par les index, ils ajoutaient 3,7 à 4,5 Ko aux pages des modules, mesuré).

| Ordre | Section                      | Route et filtres du contrat                                        | Rôles (`x-ksp-roles`)                                             | Action de la ligne                  |
| ----- | ---------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------- |
| 1     | Écarts de paiement           | `GET /admin/payment/payments?underReview=true&limit=20`            | finance_officer, cleaning_admin, super_admin                      | « Traiter l'écart » sur place       |
| 2     | Réclamations à traiter       | `GET /admin/cleaning/claims?status=open` puis `status=in_progress` | `cleaning.claim.manage` (support compris)                         | fiche (geste attendu)               |
| 3     | Interventions à affecter     | `GET /admin/cleaning/planning/unassigned?sort=urgency`             | `cleaning.planning.manage`                                        | planning du jour                    |
| 4     | Visites à planifier          | `GET /admin/cleaning/requests?status=visit_to_schedule`            | `cleaning.request.process`                                        | fiche dossier                       |
| 5     | Devis à préparer             | `GET /admin/cleaning/requests?status=visit_done`                   | `cleaning.quote.manage`                                           | fiche dossier                       |
| 6     | Candidatures d'agents        | `GET /admin/cleaning/agents?status=applicant` puis `under_review`  | `cleaning.agent.manage`                                           | fiche agent                         |
| 7     | Comptes entreprise à valider | `GET /admin/identity/organizations?status=pending_review&limit=20` | super_admin, support_agent                                        | fiche (décision : super_admin)      |
| 8     | Factures impayées            | `GET /admin/billing/invoices?status=overdue&limit=20`              | finance_officer, cleaning_supervisor, cleaning_admin, super_admin | fiche (« Enregistrer un paiement ») |

- Compteur : les listes sans total affichent « N », ou « 20+ » quand `nextCursor` n'est pas nul ; celles du Nettoyage donnent `total` (compteur exact, somme des deux statuts lus). 5 lignes au plus, dans l'ordre de la gateway ; « Tout voir » ouvre la liste déjà filtrée.
- Nettoyage : rôles d'une section = rôles par défaut de la permission de sa route (`rolesWith`, `access.ts`). Place des cinq sections entre les écarts de paiement et les comptes entreprise, et leur ordre interne : **à valider**. Arrêts de programme à valider : pas de section, `GET /programs` n'a pas de filtre sur `pendingCancellation` (**manque du contrat**).
- États : squelette par section, section repliée « Rien à traiter », « Tout est à jour » quand toutes sont vides, erreur limitée à la section (message, référence, « Réessayer »), section absente hors des rôles.
- Nettoyage v1 : les trois sections (incidents, comptes rendus à saisir, demandes à visiter) lisaient des routes supprimées par la v2 (ADR-054) ; remplacées par les sections v2 ci-dessus.
- Menu : modules rangés par groupe (`group` dans `config/modules.ts` : Ma journée, Opérations, Finance, Clients, Pilotage), sans compteur.

Écran lié : `/finance/paiements?a-examiner=1` (`underReview=true`) et « Traiter l'écart » (`POST /admin/payment/payments/{id}/resolve-mismatch`, note obligatoire, `Idempotency-Key` tirée à l'ouverture, accusé de réception, liste relue).

## Stratégie de rendu

Cache Components (`cacheComponents`) n'est pas activé : c'est le modèle de cache « précédent » de Next 16 qui s'applique (voir le modèle du portail).

| Type de route     | Exemples                                       | Rendu                                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page d'attente    | tableau de bord, `[module]`, 404               | **Statique** (○ et ● par `generateStaticParams`) ; un module d'une phase suivante répond 404                                                                                                              |
| Connexion         | `/connexion`                                   | **Statique** ; composant client en feuille (`LoginFlow` : formulaire, double authentification) qui appelle `api`                                                                                          |
| Écran d'un module | liste des dossiers, fiche, file des versements | **Coque statique** + composants client en feuille qui appellent `api` (F-005, option A) ; état des filtres dans l'URL ; une fiche (`[id]`) est rendue à la demande (ƒ) sans donnée, comme dans le portail |
| Technique         | `/api/health`, `/robots.txt`                   | Sonde dynamique (ƒ) ; `robots.txt` statique                                                                                                                                                               |

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

Mesure du 28 octobre 2026, Nettoyage branché (`pnpm build && pnpm size`) :

| Page                                                  | First Load JS | Avant    |
| ----------------------------------------------------- | ------------- | -------- |
| `/nettoyage` et ses quatre sous-pages statiques       | 214,4 Ko      | 208,7 Ko |
| `/` (tableau de bord)                                 | 210,2 Ko      | 209,4 Ko |
| Pages d'attente des cinq autres modules de la phase 1 | 209,5 Ko      | 208,7 Ko |
| `/connexion`                                          | 211,6 Ko      | 211,5 Ko |
| 404                                                   | 178,0 Ko      | 178,0 Ko |

Sans le relais `components/lazy.tsx`, l'index de la fonctionnalité faisait charger les neuf écrans à chaque page du module : 232,7 Ko (mesuré), au-delà du budget. Avec lui, la coque du module (onglets, états communs) ajoute 4,9 Ko et chaque écran est demandé après la reprise de la session. JavaScript réellement téléchargé jusqu'à l'affichage de l'écran (build de production, gateway simulée, navigateur récent, donc sans les polyfills que compte `pnpm size`) : 177,7 Ko pour une page d'attente ; de 182,8 Ko (zones) à 185,7 Ko (fiche d'une demande), soit +5,1 à +8,0 Ko. Les formulaires lourds (devis, planification d'un passage, prestation) ne sont chargés qu'à leur ouverture. Les fiches (`[id]`, rendues à la demande) n'apparaissent pas dans `pnpm size`. Le socle des autres pages a pris 0,8 Ko (briques partagées regroupées par Turbopack : variante `danger`, `put`, catalogue des modules ; cause exacte **à confirmer**).

Mesure du 28 octobre 2026, noms, filtres et suspensions (`pnpm build && pnpm size`) :

| Page                                                  | First Load JS | Avant    |
| ----------------------------------------------------- | ------------- | -------- |
| `/nettoyage` et ses quatre sous-pages statiques       | 215,6 Ko      | 214,4 Ko |
| `/` (tableau de bord)                                 | 210,1 Ko      | 210,2 Ko |
| Pages d'attente des cinq autres modules de la phase 1 | 209,4 Ko      | 209,5 Ko |
| `/connexion`                                          | 212,4 Ko      | 211,6 Ko |
| 404                                                   | 178,0 Ko      | 178,0 Ko |

La recherche de compte vit dans `features/identity` (service qui la porte) ; son module est marqué `'use client'`, car l'index d'identity est aussi lu par des pages serveur (`/connexion`) qui ne doivent pas recevoir le client de la gateway.

Mesure du 31 octobre 2026, Finance et comptes entreprise branchés (`pnpm build && pnpm size`) :

| Page                                                   | First Load JS | Avant              |
| ------------------------------------------------------ | ------------- | ------------------ |
| `/finance` et ses trois sous-pages statiques           | 215,3 Ko      | 209,4 Ko (attente) |
| `/clients` et `/clients/entreprises`                   | 212,8 Ko      | 209,4 Ko (attente) |
| `/nettoyage` et ses quatre sous-pages statiques        | 216,0 Ko      | 215,6 Ko           |
| `/` (tableau de bord)                                  | 210,3 Ko      | 210,1 Ko           |
| Pages d'attente des trois autres modules de la phase 1 | 209,6 Ko      | 209,4 Ko           |
| `/connexion`                                           | 212,5 Ko      | 212,4 Ko           |
| 404                                                    | 178,1 Ko      | 178,0 Ko           |

Les écrans sont chargés à la demande (`lazy.tsx`) ; les fiches (`[id]`) n'apparaissent pas dans `pnpm size`. Passées par l'index d'identity, les pages du module « Clients et comptes » pesaient 220,2 Ko (parcours de connexion chargé) et `/connexion` 215,4 Ko : d'où le point d'entrée `@/features/identity/organizations`.

Mesure du 5 novembre 2026, charte F-017 (F-018 : jetons, `components/ui`, logo, signature ; `pnpm build && pnpm size`) :

| Page                                                   | First Load JS | Avant (31 octobre) |
| ------------------------------------------------------ | ------------- | ------------------ |
| `/nettoyage` et ses quatre sous-pages statiques        | 216,2 Ko      | 216,0 Ko           |
| `/finance` et ses trois sous-pages statiques           | 215,4 Ko      | 215,3 Ko           |
| `/clients` et `/clients/entreprises`                   | 212,9 Ko      | 212,8 Ko           |
| `/connexion`                                           | 212,6 Ko      | 212,5 Ko           |
| `/` (tableau de bord)                                  | 210,5 Ko      | 210,3 Ko           |
| Pages d'attente des trois autres modules de la phase 1 | 209,8 Ko      | 209,6 Ko           |
| 404                                                    | 178,1 Ko      | 178,1 Ko           |

Le logo et la signature sont des SVG rendus par le serveur : la charte n'ajoute que 0,1 à 0,2 Ko (nouvelles classes du bouton, du badge et du message de formulaire).

Mesure du 5 novembre 2026, Ma journée (`pnpm build && pnpm size`) :

| Page                                                    | First Load JS | Avant    |
| ------------------------------------------------------- | ------------- | -------- |
| `/` (Ma journée)                                        | 212,7 Ko      | 210,5 Ko |
| `/nettoyage` et ses sous-pages statiques (dont visites) | 216,9 Ko      | 216,2 Ko |
| `/finance` et ses trois sous-pages statiques            | 216,1 Ko      | 215,4 Ko |
| `/clients` et `/clients/entreprises`                    | 213,2 Ko      | 212,9 Ko |
| Pages d'attente des trois autres modules                | 210,0 Ko      | 209,8 Ko |
| `/connexion`                                            | 212,6 Ko      | 212,6 Ko |

La file elle-même (lectures et schémas des quatre services, boîte « Traiter l'écart ») est un morceau chargé après la reprise de la session : 14,8 Ko compressés, hors « First Load JS ».

Mesure du 5 novembre 2026, de la demande au devis (`pnpm build && pnpm size`) :

| Page                                     | First Load JS | Avant    |
| ---------------------------------------- | ------------- | -------- |
| `/nettoyage` et ses sous-pages statiques | 217,3 Ko      | 216,9 Ko |
| `/finance` et ses trois sous-pages       | 216,3 Ko      | 216,1 Ko |
| `/` (Ma journée)                         | 212,9 Ko      | 212,7 Ko |
| `/clients` et `/clients/entreprises`     | 213,4 Ko      | 213,2 Ko |
| `/connexion`                             | 212,8 Ko      | 212,6 Ko |

Fiche d'une demande, vue du groupe, formulaires de devis et boîte de position sont des morceaux chargés à la demande (environ 9, 5,5, 5 et 4,7 Ko compressés), hors « First Load JS ». Les fiches (`[id]`, `[groupId]`) n'apparaissent pas dans `pnpm size`.

Mesure du 9 novembre 2026, après le module Notifications (ADR-039) : `/notifications/envois` et `/notifications/modeles` 212,5 Ko (écrans chargés à la demande ; budget « espace connecté » : 215 Ko) ; `/` 213,0 Ko.

Mesure du 24 novembre 2026, Nettoyage v2, sous-lot 1a (`pnpm build && pnpm size`) : `/nettoyage` et ses 24 sous-pages statiques 216,8 Ko (avant : 217,5 Ko pour les pages v1) ; autres pages inchangées (à 0,1 Ko près). Les écrans du catalogue, du tarif, du simulateur et des réglages sont des morceaux chargés à la demande (`lazy.tsx`) ; la coque ne charge que les onglets, les menus de section (`sections.ts`) et la session. Les fiches (`[id]`) n'apparaissent pas dans `pnpm size`.

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

`(app)/[module]/page.tsx` génère une page d'attente par module de la phase en cours à partir du catalogue (`generateStaticParams`, via `waitingModules()` de `lib/navigation/visible-modules.ts`) et répond 404 pour les autres. Les modules listés dans `MODULES_WITH_SCREENS` (`config/modules.ts`) en sont exclus : le Nettoyage a été le premier (28 octobre 2026). Quand les écrans d'un module arrivent (exemple : recouvrement) :

1. Créer `src/features/recovery/` (schémas, écrans, `index.ts`).
2. Créer la route statique `src/app/(app)/recouvrement/page.tsx` (puis ses sous-routes, par exemple `recouvrement/[dossier]/page.tsx`) : `AppShell current="recouvrement"` + l'écran de la fonctionnalité. L'adresse ne change pas : le menu pointe déjà vers `/recouvrement`.
3. Ajouter son adresse à `MODULES_WITH_SCREENS` (`config/modules.ts`) : `waitingModules()` le retire des pages générées par `[module]`, pour qu'une adresse n'ait jamais deux pages (test dans `visible-modules.test.ts`).
4. Le catalogue `config/modules.ts` garde l'entrée du module (libellé, rôles, phase) : le menu et le tableau de bord continuent de la lire.
5. Quand le dernier module a sa route, supprimer `[module]`.

## Données des espaces connectés (décision : option A)

L'analyse des deux options (jeton en mémoire dans le navigateur, ou serveur Next qui lit le cookie) est dans le modèle du portail. **Décision (19 octobre 2026) : option A, F-005 conservé**, pour « Mon espace KSP » et le back-office.

Conséquences pour le back-office :

- Chaque écran est une coque statique servie sans calcul ; un composant client en feuille renouvelle la session dès le chargement de l'espace, puis lit la gateway avec `api`, lectures en parallèle.
- Au lot 1, le filtrage du menu par les vrais rôles se fera dans une petite feuille client du cadre, qui reçoit le catalogue en propriétés et lit les rôles de la session ; `AppShell` reste un composant serveur.
- Le premier écran réel (liste des dossiers de recouvrement) est mesuré en 3G simulée ; si le budget ou le temps d'affichage n'est pas tenu, l'option B est rouverte pour cet écran.

## Convergence de `components/ui`

Depuis F-018 (charte F-017 tirée du logo), les jetons de `globals.css` sont **copiés à l'identique** du portail (seules différences : pas de transitions entre pages, F-013 ; en plus, le tiroir `drawer-panel`). Sont repris tels quels du portail : `Button` (variantes `action`, `primary`, `secondary`, `ghost`, `danger` discret, `inverse`), `Badge` (ton `action`, pastille `dot`), `Eyebrow` (flèche de la signature), `FormMessage` (ton `success`), `PagedListState` (squelette de chargement), les icônes, `brand/logo.tsx` (logo en tracés, version claire automatique sur fond bleu nuit), `brand/signature.tsx` (séparateur, fil de progression, toile de fond) et le favicon `src/app/icon.svg`. Le motif tissé et l'ocre ont disparu.

Restent propres au back-office, recolorés selon les rôles (bleu nuit pour la marque, vert pour l'action et le succès, or pour l'accent seulement en détail ou sur fond bleu nuit, rouge discret pour les actions destructrices) : `ResponsiveTable`, `ConfirmAction`, `SubNav`, `SelectField`, `DescriptionList`, `Panel`, `ResourceView`, `LoadingBlock`, `BackLink`, et dans `components/layout` le cadre bleu nuit et `BackofficeLogo` (logo du groupe suivi de « Back-office »). Ils rejoindront `ksp-ui` quand un deuxième site les utilisera (F-003).

## Volontairement exclu

Les exclusions communes (couches domaine et application, bibliothèques d'état et de récupération de données, dossiers `hooks/`, `utils/`, `types/`, `services/`, barillets dans `components/`, paquet `ksp-ui` anticipé, greffon `eslint-plugin-boundaries`, Cache Components) sont justifiées dans le modèle du portail. Propre au back-office :

| Exclu                                                                           | Pourquoi                                                                                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Dossiers de fonctionnalités pour les modules encore en attente                  | Ils n'auraient aucun contenu : le catalogue suffit tant qu'il n'y a pas d'écran.                                             |
| Fonctionnalité `finance` regroupant `payment`, `wallet`, `billing`              | Une fonctionnalité par service garde un contrat de la gateway par dossier.                                                   |
| Contrôle des rôles dans le front (`proxy.ts`, layout, garde de route)           | Le backend est seul juge des droits ; un contrôle côté front serait une fausse sécurité et un second endroit à tenir à jour. |
| Lectures côté serveur (`queries.ts`, `serverApi()`) pour les données des agents | Option A : aucune donnée personnelle ne passe par le serveur Next ni par son cache.                                          |
