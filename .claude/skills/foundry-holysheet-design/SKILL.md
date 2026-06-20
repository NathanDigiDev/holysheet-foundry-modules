---
name: foundry-holysheet-design
description: Appliquer le langage visuel HolySheet (med-fan sombre & moderne, verre dépoli, accent émeraude, laiton, Cinzel/Spectral) au CSS d'un module FoundryVTT. Utiliser OBLIGATOIREMENT pour tout nouveau module ou toute refonte de CSS, afin de rester cohérent avec la fiche de perso et les modules déjà habillés (Quest System, Calendrier).
---

# Habillage HolySheet (design pattern)

> **Source de vérité** : `HOLYSHEET-DESIGN.md` à la racine du repo — le lire pour
> la direction artistique complète, les overlays (tracker, bannières) et la
> philosophie. Ce skill est le mode d'emploi pratique + le socle CSS prêt à poser.

## Règle

Tout **nouveau module** (ou refonte de CSS) reprend ce langage visuel. On ne code
**jamais un hex en dur** dans un composant : on passe par les jetons `var(--hs-*)`.

## Étape 1 — Poser le socle (drop-in)

Copier l'asset de ce skill dans le module :

```
.claude/skills/foundry-holysheet-design/assets/holysheet-base.css
        →  <module>/styles/holysheet.css
```

Il contient : `@import` des polices Cinzel + Spectral, le bloc de jetons `--hs-*`
sur `.holysheet`, les atomes champs/boutons/range/scrollbar en verre dépoli, le
respect de `prefers-reduced-motion`, et les 3 thèmes (`hs-theme-sobre/lueur/cuir`).

Déclarer les deux feuilles dans `module.json`, **socle d'abord** :

```json
"styles": ["styles/holysheet.css", "styles/<id>.css"]
```

Charger aussi **Font Awesome 6** (Foundry le fournit déjà ; sinon l'ajouter).

## Étape 2 — Marquer la racine de l'app

Sur chaque `ApplicationV2`, ajouter la classe `holysheet` (porteuse des jetons)
+ le thème voulu (défaut conseillé : `hs-theme-lueur`) :

```javascript
static DEFAULT_OPTIONS = {
  classes: ["holysheet", "hs-theme-lueur", "<id>"],   // <id> = préfixe module
  // ...
};
```

> Les modules sont isolés dans Foundry → pas d'héritage garanti. La racine de
> CHAQUE fenêtre/overlay doit porter `holysheet` pour hériter des jetons.

## Étape 3 — Écrire `styles/<id>.css` avec les recettes

Nommage **BEM-ish préfixé par module** (`qs-` pour Quest System ; choisir un
préfixe court `<pfx>-` par module). N'utiliser que `var(--hs-*)`.

### Fenêtre

```css
.holysheet.<pfx>-window {
  border: 1px solid var(--hs-glass-line);
  border-radius: 16px;
  background:
    radial-gradient(900px 440px at 12% -6%, rgba(201,162,78,.12), transparent 60%),
    radial-gradient(800px 400px at 92% 6%, rgba(59,191,134,.08), transparent 58%),
    linear-gradient(160deg, #221a10, #14100a 62%);
  box-shadow: var(--hs-shadow);
}
```
En-tête : `linear-gradient(115deg,#160f08,#2a1c0d,#3a2a12)`, titre Cinzel
capitales laiton clair, hairline laiton en bas.

### Titres

```css
.<pfx>-title, .holysheet h1, .holysheet h2, .holysheet h3 {
  font-family: var(--hs-title);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--hs-brass-bright);
}
```

### Bouton

```css
.<pfx>-btn {
  font-family: var(--hs-title);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid var(--hs-glass-line);
  border-radius: var(--hs-r-sm);
  background: var(--hs-glass);
  color: var(--hs-ink);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  transition: border-color 130ms, color 130ms, box-shadow 130ms, background 130ms;
}
.<pfx>-btn:hover { border-color: var(--hs-accent-line); color: var(--hs-ink-strong); box-shadow: 0 0 14px var(--hs-accent-soft); }
.<pfx>-btn:active { transform: translateY(1px); }
.<pfx>-btn.small { font-size: 12px; }
.<pfx>-btn.danger:hover { border-color: #c0584a; color: #e9a99f; box-shadow: 0 0 14px rgba(192,88,74,.3); }
```

### Badge (pilule colorée par l'état)

```css
.<pfx>-badge {
  font-family: var(--hs-title);
  text-transform: uppercase;
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0,0,0,.4);
  border: 1px solid currentColor;
  color: var(--qs-accent, var(--hs-brass));
}
```

### Barre de progression (remplissage laiton lumineux)

```css
.<pfx>-progress { height: 7px; border-radius: 999px; background: rgba(0,0,0,.5); border: 1px solid var(--hs-glass-line); overflow: hidden; }
.<pfx>-progress__fill { height: 100%; background: linear-gradient(90deg, var(--hs-brass), var(--hs-brass-bright)); box-shadow: 0 0 10px var(--hs-brass-soft); }
```

### Fieldset

```css
.<pfx>-fieldset { border: 1px solid var(--hs-glass-line); border-radius: var(--hs-r); background: var(--hs-glass); -webkit-backdrop-filter: blur(7px); backdrop-filter: blur(7px); }
.<pfx>-fieldset > legend { font-family: var(--hs-title); text-transform: uppercase; letter-spacing: .1em; color: var(--hs-brass-bright); }
```

### États / statuts (couleur pilotée par `--qs-accent`)

```css
.status-inactive  { --qs-accent: #9a8c72; }
.status-active    { --qs-accent: #3bbf86; }
.status-paused    { --qs-accent: #d8a23e; }
.status-completed { --qs-accent: #c9a24e; }
.status-cancelled { --qs-accent: #c0584a; }
/* usage : border-left-color: var(--qs-accent); color: var(--qs-accent); */
```

### Item réservé au MJ (teinte violette discrète)

```css
.<pfx>-item.is-hidden { background: rgba(120,70,160,.14); border-color: rgba(160,110,200,.4); }
.<pfx>-item.is-hidden .<pfx>-gm-icon { color: #b07ad0; }   /* fa-eye-slash */
```

### Compteurs

```css
.<pfx>-count { font-variant-numeric: tabular-nums; }
```

## Étape 4 — Si on RE-HABILLE un module existant

Le CSS d'habillage **remplace 1:1** l'ancien : reprendre **exactement** les
classes émises par les templates `.hbs` (ne pas inventer de nouvelles classes,
ne changer que l'apparence). Un fichier d'habillage = drop-in de `styles/<id>.css`.

## Checklist (reprise de HOLYSHEET-DESIGN.md §8)

- [ ] `styles/holysheet.css` (socle) posé + déclaré AVANT `styles/<id>.css`.
- [ ] Racine de chaque app/overlay = classe `holysheet` (+ thème).
- [ ] Zéro hex en dur dans les composants → uniquement `var(--hs-*)`.
- [ ] Champs/boutons en verre dépoli, focus émeraude.
- [ ] Titres Cinzel capitales ; compteurs en `tabular-nums`.
- [ ] États via classes (`is-*`, `status-*`) pilotant `--qs-accent`.
- [ ] Glow/animations discrets, `prefers-reduced-motion` respecté (déjà dans le socle).
- [ ] Font Awesome 6 chargé (pas d'emoji).
