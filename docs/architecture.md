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

| Module (adresse)                   | Fonctionnalité(s)                                               | Service(s) du backend        | Phase | État                                |
| ---------------------------------- | --------------------------------------------------------------- | ---------------------------- | ----- | ----------------------------------- |
| Tableau de bord (`/`)              | `features/dashboard`                                            | — (indicateurs des services) | 1     | présentation provisoire des modules |
| Recouvrement (`/recouvrement`)     | `features/recovery`                                             | recovery                     | 1     | page d'attente                      |
| Nettoyage (`/nettoyage`)           | `features/cleaning`                                             | cleaning                     | 1     | écrans branchés (28 routes + 3)     |
| Finance (`/finance`)               | `features/payment`, `features/wallet`, `features/billing`       | payment, wallet, billing     | 1     | factures et paiements branchés      |
| Clients et comptes (`/clients`)    | `features/identity`                                             | identity                     | 1     | comptes entreprise branchés         |
| Notifications (`/notifications`)   | `features/notification`                                         | notification                 | 1     | page d'attente                      |
| Administration (`/administration`) | `features/identity` (agents, rôles), `features/audit` (journal) | identity, audit              | 1     | page d'attente                      |
| Immobilier (`/immobilier`)         | `features/realestate`                                           | realestate                   | 2     | masqué (phase suivante)             |
| Impression (`/impression`)         | `features/print`                                                | print                        | 3     | masqué                              |
| Livraison (`/livraison`)           | `features/delivery`                                             | delivery                     | 3     | masqué                              |
| Marketplace (`/marketplace`)       | `features/catalog`, `features/order`                            | catalog, order               | 4     | masqué                              |

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

## Nettoyage (`features/cleaning`)

Module branché sur les 28 routes `/api/v1/admin/cleaning/*` du contrat (`ksp-api.v1.yaml`), plus deux routes publiques — `GET /api/v1/cleaning/services` (noms des prestations : les fiches ne portent que leur code) et `GET /api/v1/cleaning/zones` (filtre de commune du superviseur) — et la recherche de compte d'identity, `POST /api/v1/admin/identity/accounts/lookup` (ADR-029, dans `features/identity/account-lookup.ts`, exportée par l'index d'identity). Aucune règle métier dans le front : prix, lignes du devis, acompte, transitions et refus viennent de la gateway ; l'écran propose les actions que l'état permet et affiche le refus du backend (message français, référence pour le support sur une erreur serveur).

```
features/cleaning/
├── index.ts               onglets, écrans (relais à la demande), textes des titres
├── api.ts                 28 appels admin + noms des prestations et zones ouvertes (routes publiques)
├── schemas.ts             zod/mini, champ par champ selon le contrat
├── access.ts              rôles → sections affichées (affichage seulement)
├── paths.ts, errors.ts    adresses des écrans ; message affichable d'une erreur (refus précisés par leurs détails)
├── texts.ts               libellés communs et états ; *-texts.ts : textes propres à chaque écran
└── components/
    ├── lazy.tsx           relais next/dynamic : une page ne télécharge que son écran
    ├── cleaning-tabs.tsx  onglets du module filtrés par rôle
    ├── requests-list.tsx, request-detail.tsx, quote-form.tsx
    ├── missions-list.tsx, mission-detail.tsx, intervention-form.tsx, intervention-screen.tsx
    ├── catalog-screen.tsx, service-form.tsx, zones-screen.tsx, team-screen.tsx
    ├── register-agent.tsx rattacher un agent : recherche du compte par téléphone, puis confirmation
    └── parts.tsx          états communs (chargement, erreur, panneaux), droits de la session
```

| Adresse                                         | Écran                                                                                                   | Onglet visible pour                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `/nettoyage`                                    | Demandes : filtres état, commune (code de zone) et type de client, tous passés à la gateway, dans l'URL | `cleaning_supervisor`, `cleaning_admin`             |
| `/nettoyage/demandes/[id]`                      | Fiche : client, locaux, visite, devis, historique ; visite, compte rendu, devis, refus                  | idem                                                |
| `/nettoyage/missions`                           | Missions, filtre par état dans l'URL                                                                    | les trois rôles (l'agent ne reçoit que les siennes) |
| `/nettoyage/missions/[id]`                      | Fiche : passages, paiement ; planifier un passage, paiement manuel, annulation                          | les trois rôles ; actions : superviseur et admin    |
| `/nettoyage/missions/[id]/passages/[passageId]` | Passage (téléphone de l'agent) : démarrer, liste de contrôle, incident, reprise, clôture                | les trois rôles                                     |
| `/nettoyage/catalogue`                          | Prestations et grille, réglages                                                                         | `cleaning_admin`                                    |
| `/nettoyage/zones`                              | Zones desservies : ouverture, désactivation, réactivation                                               | `cleaning_admin`                                    |
| `/nettoyage/equipe`                             | Agents (rattachement, indisponibilités) et équipes                                                      | superviseur (lecture) et admin                      |

| Route de la gateway                                            | Écran ou composant                                   |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| `GET /admin/cleaning/quote-requests`                           | `RequestsList` (`status`, `commune`, `customerKind`) |
| `GET /admin/cleaning/quote-requests/{id}`                      | `RequestDetail`                                      |
| `POST /admin/cleaning/quote-requests/{id}/reject`              | `RequestDetail` (confirmation, motif obligatoire)    |
| `POST /admin/cleaning/quote-requests/{id}/visits`              | `RequestDetail` (boîte « Planifier la visite »)      |
| `POST /admin/cleaning/visits/{id}/complete`                    | `RequestDetail` (compte rendu)                       |
| `POST /admin/cleaning/quote-requests/{id}/quote`               | `QuoteForm` (chargé à l'ouverture)                   |
| `GET /admin/cleaning/missions`                                 | `MissionsList`                                       |
| `GET /admin/cleaning/missions/{id}`                            | `MissionDetail`, `InterventionScreen`                |
| `POST /admin/cleaning/missions/{id}/interventions`             | `InterventionForm` (chargé à l'ouverture)            |
| `POST /admin/cleaning/missions/{id}/payments`                  | `MissionDetail` (particulier, `Idempotency-Key`)     |
| `POST /admin/cleaning/missions/{id}/cancel`                    | `MissionDetail` (confirmation, motif obligatoire)    |
| `POST /admin/cleaning/interventions/{id}/start`                | `InterventionScreen`                                 |
| `PUT /admin/cleaning/interventions/{id}/checklist`             | `InterventionScreen` (case par case)                 |
| `POST /admin/cleaning/interventions/{id}/incident`             | `InterventionScreen` (confirmation, note)            |
| `POST /admin/cleaning/interventions/{id}/resume`               | `InterventionScreen`                                 |
| `POST /admin/cleaning/interventions/{id}/complete`             | `InterventionScreen` (confirmation)                  |
| `GET /admin/cleaning/catalog`                                  | `CatalogScreen`                                      |
| `PUT /admin/cleaning/catalog/services/{code}`                  | `ServiceForm` (chargé à l'ouverture)                 |
| `PUT /admin/cleaning/catalog/settings`                         | `CatalogScreen` (réglages)                           |
| `GET /admin/cleaning/zones`                                    | `ZonesScreen`, filtre de commune de l'admin          |
| `POST /admin/cleaning/zones`                                   | `ZonesScreen` (ouverture et réactivation)            |
| `POST /admin/cleaning/zones/{code}/deactivate`                 | `ZonesScreen` (confirmation)                         |
| `GET /admin/cleaning/agents`                                   | `TeamScreen`, choix des agents (visite, passage)     |
| `POST /admin/cleaning/agents`                                  | `RegisterAgentDialog` (après la recherche du compte) |
| `POST /admin/cleaning/agents/{id}/unavailabilities`            | `TeamScreen`                                         |
| `GET /admin/cleaning/teams`                                    | `TeamScreen`, `InterventionForm`                     |
| `POST /admin/cleaning/teams`, `PUT /admin/cleaning/teams/{id}` | `TeamScreen` (composer, modifier)                    |
| `GET /cleaning/zones` (publique)                               | filtre de commune du superviseur                     |
| `POST /admin/identity/accounts/lookup`                         | `RegisterAgentDialog` (numéro dans le corps)         |

Noms et suspensions (PR #25 et #26 du backend, ADR-029 et ADR-030) :

- **Droits** : `super_admin` a la même portée que `cleaning_admin` (`access.ts`, `config/modules.ts`) : tous les onglets, toutes les actions. Le module est aussi ouvert à `cleaning_agent` (missions et passages) : **à valider**.
- **Noms affichés** (lus dans identity par cleaning, facultatifs, `null` si inconnus) : client et organisation des demandes et des missions, agent de la visite, auteur d'un paiement, auteur de la grille, des réglages et des zones. Repli sur un libellé court (« Client sans nom », « Entreprise sans nom », « un membre de l'équipe ») ; les identifiants techniques ne sont plus affichés, sauf la colonne « Compte » des agents.
- **Type de client de la mission** (`customerKind`, `organizationId`) : le paiement manuel est masqué pour une entreprise ; la demande d'origine n'est plus relue.
- **Paiement manuel idempotent** : clé tirée à l'ouverture du formulaire (`ConfirmAction.onOpen`, `newIdempotencyKey` de `lib/api`) et renvoyée telle quelle à chaque nouvel essai ; nouvelle clé à la prochaine ouverture.
- **Refus précisés** (`errors.ts`) : `CLEANING_INTERVENTION_TOO_EARLY` (jour prévu), `CLEANING_VISIT_TOO_EARLY` (heure prévue), `CLEANING_PAYMENT_INVALID` avec `details.remainingDue` (reste dû), `CLEANING_ORGANIZATION_SUSPENDED`. Les autres refus gardent le message de la gateway.
- **« Démarrer le passage »** est désactivé avant le jour prévu, à l'heure du Bénin, avec le jour affiché : confort d'affichage seulement, la gateway tranche (la règle est réglable de son côté : **à valider**).
- **Suspension** : toutes les causes actives (`suspension.causes`, la plus ancienne d'abord) s'affichent en clair, par exemple « Compte entreprise suspendu par KSP » et « 2 factures impayées ».
- **Rattacher un agent** : l'admin saisit un numéro (sans indicatif, +229 est ajouté), voit le compte trouvé (nom, numéro masqué, état) et confirme, avec un nom affiché modifiable. Compte introuvable (404) et limite de recherches (429, délai de la gateway) ont leur message.

Les photos des passages ne sont pas envoyables : la gateway n'expose aucune route du service `file` (l'écran le dit).

Briques ajoutées à `components/ui` (à faire converger avec le portail avant `ksp-ui`) : `ResponsiveTable` (tableau qui devient des cartes sous 768 px), `ConfirmAction` (`<dialog>` modal natif), `SubNav` (onglets en liens), `SelectField` et `TextAreaField`, `DescriptionList`, variante `danger` de `Button`. Côté `lib` : `format.ts` (XOF, dates `Africa/Porto-Novo`, champs `datetime-local`), `use-resource.ts` (repris du portail), `put` dans le client de la gateway.

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
- **Modules** (`config/modules.ts`) : Finance s'ouvre aux rôles des factures (`finance_officer`, `cleaning_supervisor`, `cleaning_admin`) ; « Clients et comptes » à `support_agent` seul (`recovery_admin` et `cleaning_admin` retirés : aucune route du module ne leur est ouverte, **à valider**). `super_admin` voit tout.
- **Liens entre fiches**, montrés seulement si le module cible est dans le menu de l'agent : facture → mission du Nettoyage et compte entreprise ; facture → ses paiements en ligne ; paiement → mission ou facture payée, et entreprise payeuse ; compte entreprise → ses factures. Les adresses d'une autre fonctionnalité sont écrites en dur quand l'importer créerait un cycle entre index (comme le portail).
- **Paiement manuel** : sans clé d'idempotence (le contrat n'en prévoit pas sur cette route, **à valider** côté backend) ; le bouton est désactivé pendant l'envoi. Refus précisés : `BILLING_PAYMENT_INVALID` (`exceeds_balance`, `amount_invalid`, `method_not_allowed`) ; `BILLING_INVALID_TRANSITION` et `BILLING_CONCURRENT_UPDATE` relisent la fiche.
- **Décisions sur un compte entreprise** : `IDENTITY_ORGANIZATION_INVALID_TRANSITION` (décision prise ailleurs entre-temps) relit la fiche ; les membres restent affichés après une décision (la réponse ne porte que l'organisation).
- **Période facturée** : `periodEnd` est la borne de fin (minuit, heure du Bénin, du lendemain du dernier jour facturé, service billing) : l'écran affiche le jour qui la précède. Le contrat ne le précise pas : **à valider** (le portail affiche la borne telle quelle).
- **Paiements « à examiner »** (`amount_mismatch`) : badge rouge, en tête du filtre d'état, et alerte au-dessus de la liste (une lecture `limit=1` filtrée), avec un lien vers le filtre.

Briques ajoutées : `components/ui/loading-block.tsx`, `panel.tsx`, `back-link.tsx`, `resource-view.tsx` (sorties de `features/cleaning/components/parts.tsx`, qui les reprend) ; `lib/api/error-text.ts` (`apiErrorText`) ; `lib/api/gateway.test-utils.ts` (gateway simulée commune aux tests).

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

`components/ui` du back-office (`Button`, `ButtonLink`, `Container`, et depuis le Nettoyage `ResponsiveTable`, `ConfirmAction`, `SubNav`, `SelectField`, `DescriptionList`) n'a pas été aligné sur celui du portail : le copier changerait le rendu, et la charte du back-office viendra avec son design (F-009). Les deux devront **converger avant la création de `ksp-ui`** (F-003) : mêmes noms, mêmes propriétés, mêmes jetons sémantiques, seules les couleurs d'accent différant.

## Volontairement exclu

Les exclusions communes (couches domaine et application, bibliothèques d'état et de récupération de données, dossiers `hooks/`, `utils/`, `types/`, `services/`, barillets dans `components/`, paquet `ksp-ui` anticipé, greffon `eslint-plugin-boundaries`, Cache Components) sont justifiées dans le modèle du portail. Propre au back-office :

| Exclu                                                                           | Pourquoi                                                                                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Dossiers de fonctionnalités pour les modules encore en attente                  | Ils n'auraient aucun contenu : le catalogue suffit tant qu'il n'y a pas d'écran.                                             |
| Fonctionnalité `finance` regroupant `payment`, `wallet`, `billing`              | Une fonctionnalité par service garde un contrat de la gateway par dossier.                                                   |
| Contrôle des rôles dans le front (`proxy.ts`, layout, garde de route)           | Le backend est seul juge des droits ; un contrôle côté front serait une fausse sécurité et un second endroit à tenir à jour. |
| Copie de `components/ui` du portail                                             | Changement visible ; à faire avec la charte du back-office, avant `ksp-ui`.                                                  |
| Lectures côté serveur (`queries.ts`, `serverApi()`) pour les données des agents | Option A : aucune donnée personnelle ne passe par le serveur Next ni par son cache.                                          |
