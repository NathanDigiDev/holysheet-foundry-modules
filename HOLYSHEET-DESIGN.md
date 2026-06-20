# HolySheet — Design Pattern

> Guide de référence du langage visuel **HolySheet** pour Foundry VTT.
> À placer à la racine du dossier des modules. Tout nouveau module (ou refonte
> de CSS d'un module existant) doit reprendre ces jetons, ces classes et ces
> conventions pour rester cohérent avec la fiche de personnage et les modules
> déjà habillés (Quest System, Calendrier…).

---

## 1. Direction artistique

**Med-fan sombre & moderne.** Cuir / parchemin foncé, bordures laiton, accent
émeraude, surfaces en **verre dépoli**, jauges = barres fines translucides à
remplissage lumineux, titres en capitales **Cinzel**.

Principes :

- **Sombre par défaut** (`color-scheme: dark`). Fonds très foncés, encre crème.
- **Verre dépoli** plutôt que cartes opaques : `backdrop-filter: blur(...)` +
  fonds translucides + 1px de hairline laiton/crème.
- **Émeraude = action / vivant** (focus, objectifs, états actifs, glow).
  **Laiton = structure / valeur** (titres, jauges, cadres, comptes).
- **Pas de coins trop ronds, pas de gradients criards.** Rayons 9–16px,
  ombres profondes et douces.
- **Titres en `Cinzel`**, capitales, `letter-spacing` large. Corps en `Spectral`.
- Glow et halos **discrets et fonctionnels** (focus, complétion), jamais
  décoratifs en boucle sur du contenu.

---

## 2. Typographie

```html
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
```

| Rôle | Famille | Usage |
|------|---------|-------|
| Titres | `Cinzel` | Titres de fenêtre, h1–h4, badges, onglets, labels de champ, en-têtes de section. **Capitales + letter-spacing 0.05–0.18em.** |
| Corps | `Spectral` | Paragraphes, champs, descriptions, notes. |

```css
--hs-title: "Cinzel", "Bookman Old Style", Georgia, serif;
--hs-body:  "Spectral", "Palatino Linotype", Georgia, serif;
```

Échelle indicative : titre de fiche/quête 24px · sous-titre bannière 26px ·
h3 de section 14px · corps 13.5–14px · labels/onglets 11–12.5px · badges 10.5px.
`font-variant-numeric: tabular-nums` pour tous les compteurs (x/y, timers).

Icônes : **Font Awesome 6** (`fa-solid` / `fa-regular`). Pas d'emoji.

---

## 3. Jetons de couleur (source de vérité)

Déclarés sur le conteneur racine du module. **Toujours passer par les `var(--hs-*)`,
ne jamais coder un hex en dur** dans les règles de composant.

```css
.holysheet {            /* ou .quest-system, #quest-system-tracker, etc. */
  /* Encres */
  --hs-ink:        #ece1cd;   /* texte courant */
  --hs-ink-strong: #fff6e6;   /* titres, valeurs */
  --hs-muted:      #a3957c;   /* labels, texte secondaire */

  /* Fonds */
  --hs-bg-0: #110e0a;
  --hs-bg-1: #1a1610;
  --hs-bg-2: #221d16;

  /* Verre dépoli */
  --hs-glass:           rgba(244, 234, 211, 0.055);
  --hs-glass-2:         rgba(244, 234, 211, 0.09);
  --hs-glass-line:      rgba(244, 234, 211, 0.16);
  --hs-glass-line-soft: rgba(244, 234, 211, 0.1);

  /* Accent émeraude (action / vivant) */
  --hs-accent:        #34c98a;
  --hs-accent-bright: #4ee0a2;
  --hs-accent-deep:   #126b4b;
  --hs-accent-soft:   rgba(52, 201, 138, 0.16);
  --hs-accent-line:   rgba(78, 224, 162, 0.42);
  --hs-accent-glow:   rgba(52, 201, 138, 0.42);

  /* Laiton (structure / valeur) */
  --hs-brass:        #c9a24e;
  --hs-brass-bright: #eccd80;
  --hs-brass-soft:   rgba(201, 162, 78, 0.22);

  /* Rayons + ombres */
  --hs-r:    14px;
  --hs-r-sm: 9px;
  --hs-shadow:    0 18px 40px rgba(0, 0, 0, 0.45);
  --hs-shadow-sm: 0 8px 18px  rgba(0, 0, 0, 0.35);
}
```

### Couleurs d'état (statuts)

Une seule variable `--qs-accent` portée par une classe `status-*`, réutilisée
par le bord gauche, les badges, les icônes :

| Statut | Couleur |
|--------|---------|
| `status-inactive`  | `#9a8c72` (gris-cuir) |
| `status-active`    | `#3bbf86` (émeraude) |
| `status-paused`    | `#d8a23e` (ambre) |
| `status-completed` | `#c9a24e` (laiton) |
| `status-cancelled` | `#c0584a` (rouge brique) |

```css
.status-active { --qs-accent: #3bbf86; }
/* puis : border-left-color: var(--qs-accent); color: var(--qs-accent); … */
```

---

## 4. Surfaces & composants

### Fenêtre (ApplicationV2)

```css
border: 1px solid var(--hs-glass-line);
border-radius: 16px;
background:
  radial-gradient(900px 440px at 12% -6%, rgba(201,162,78,.12), transparent 60%),
  radial-gradient(800px 400px at 92%  6%, rgba(59,191,134,.08), transparent 58%),
  linear-gradient(160deg, #221a10, #14100a 62%);
box-shadow: var(--hs-shadow);
```

En-tête : dégradé cuir `linear-gradient(115deg,#160f08,#2a1c0d,#3a2a12)`,
titre **Cinzel capitales laiton clair**, hairline laiton en bas.

### Champs — verre dépoli (atome de base)

```css
border: 1px solid var(--hs-glass-line);
border-radius: var(--hs-r-sm);
background: var(--hs-glass);
backdrop-filter: blur(7px) saturate(1.1);
box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
/* focus */
border-color: var(--hs-accent-line);
background: var(--hs-glass-2);
box-shadow: 0 0 0 3px var(--hs-accent-soft), inset 0 1px 0 rgba(255,255,255,.06);
```

### Boutons (`.qs-btn`, `.qs-icon-btn`)

Verre dépoli + hairline ; **hover = bord émeraude + glow émeraude doux**.
Variante `.small` (12px). Variante `.danger` au hover : rouge brique.
`:active { transform: translateY(1px); }`.

### Badges (`.qs-badge`)

Pilule, fond `rgba(0,0,0,.4)`, `border: 1px solid currentColor`, texte
**Cinzel capitales** coloré par `--qs-accent`.

### Barre de progression (`.qs-progress`)

Rail noir + hairline ; remplissage **dégradé laiton lumineux**
`linear-gradient(90deg, var(--hs-brass), var(--hs-brass-bright))` + glow laiton.
Hauteur ~7px, `border-radius: 999px`.

### Fieldset (`.qs-fieldset`)

Cadre verre dépoli flouté, `legend` en **Cinzel capitales laiton clair** avec
icône FA.

### Item « caché / MJ »

Teinte violette discrète pour distinguer le contenu réservé au MJ :
`background: rgba(120,70,160,.14); border-color: rgba(160,110,200,.4);` +
icône `fa-eye-slash` couleur `#b07ad0`.

---

## 5. Overlays en jeu

### Tracker (façon MMO)

Posé sur la scène, **semi-transparent, sans cadre lourd**, déplaçable.
`position: fixed; pointer-events: none` sur le conteneur, `pointer-events: auto`
sur la carte. Fond cuir translucide + `backdrop-filter: blur`. Titres Cinzel
laiton, puces d'objectifs émeraude, objectif fait = barré + opacité 0.5.

### Bannières immersives

Apparition animée (translateY + scale, `cubic-bezier(.2,.9,.3,1.3)`) au
démarrage / à la complétion. Thématisables par quête via variables locales :

```css
--qs-primary   /* couleur de cadre + halo (laiton début, émeraude complétion) */
--qs-secondary /* fond */
--qs-border-style /* double | ridge | groove | solid */
--qs-bg-image  /* image de fond optionnelle, opacité 0.26 */
```

Cadre 3px `double` laiton, halo `--qs-primary` pulsé, icône estampée ronde
(pop animé), filet lumineux en bas. `z-index` très élevé, `top: ~12%`, centrée.

---

## 6. Conventions de structure

- **Conteneur racine = porteur des jetons.** Chaque module pose ses `var(--hs-*)`
  sur sa racine (`.holysheet`, `.quest-system`, `#quest-system-tracker`…).
  Le fichier d'un module re-déclare le bloc de jetons en tête (modules isolés
  dans Foundry → pas d'héritage garanti).
- **Nommage BEM-ish, préfixé par module** : `.qs-quest-list__item`,
  `.qs-objective--…`, etc. Préfixe court par module (`qs-` pour Quest System).
- **Le CSS d'habillage remplace 1:1 le CSS d'origine** du module : on reprend
  *exactement* les classes émises par les templates Handlebars, on ne change que
  l'apparence. Un fichier d'habillage = drop-in de `styles/<module>.css`.
- **États par classe** (`.is-selected`, `.is-done`, `.is-hidden`,
  `.is-tracked`, `.is-visible`, `.is-leaving`, `status-*`).
- **Scrollbars** stylées laiton translucide (`::-webkit-scrollbar-thumb`).

---

## 7. Thèmes (variantes)

Une classe de thème sur la racine `.holysheet` ajuste l'intensité :

| Classe | Effet |
|--------|-------|
| `.hs-theme-sobre` | Hairlines, peu de glow — le plus calme. |
| `.hs-theme-lueur` | Émeraude lumineuse — **rendu de base**. |
| `.hs-theme-cuir`  | Cuir chaud + laiton, cadres plus marqués. |

Pour un nouveau module, partir du rendu `lueur` (défaut) et n'exposer d'autres
thèmes que si nécessaire.

---

## 8. Checklist pour un nouveau module

1. Charger Cinzel + Spectral + Font Awesome 6.
2. Re-déclarer le bloc de jetons `--hs-*` sur la racine du module.
3. N'utiliser que `var(--hs-*)` — zéro hex en dur dans les composants.
4. Champs/boutons → atome verre dépoli ; focus émeraude.
5. Titres Cinzel capitales ; compteurs en `tabular-nums`.
6. États via classes (`is-*`, `status-*`) pilotant `--qs-accent`.
7. Glow/animations discrets, désactivés au repos et respectant
   `prefers-reduced-motion`.
8. Le fichier reprend **exactement** les classes du template Foundry du module.

---

*Fichiers de référence (habillages existants) : `styles/holysheet.css` (base
thématisable), `styles/quest-system-holysheet.css`, `styles/calendar-holysheet.css`.*
