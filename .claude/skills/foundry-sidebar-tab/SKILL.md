---
name: foundry-sidebar-tab
description: Ajouter proprement un onglet/bouton dans la sidebar de FoundryVTT v13/v14. Corrige le bug récurrent de la mauvaise icône (double-icône) et du mauvais alignement (bouton collé à côté de la colonne). Utiliser dès qu'un module doit afficher une entrée custom dans la sidebar droite.
---

# Ajouter un onglet dans la sidebar FoundryVTT (v13/v14)

## Quand l'utiliser

Dès qu'un module doit ajouter une **entrée dans la sidebar de droite** de
Foundry (bouton qui ouvre une fenêtre, un panneau, un journal, etc.). C'est un
problème **rencontré très souvent** sur les modules HolySheet — appliquer cette
recette plutôt que de réinventer.

## Le bug (pourquoi on ne reconstruit PAS le bouton à la main)

En v13/v14, construire le bouton « à la main » en copiant le `className` d'un
onglet voisin provoque deux problèmes :

1. **Mauvaise icône** : l'icône d'un onglet est désormais une **classe sur le
   bouton lui-même** (ex. `fa-solid fa-comments`), pas un `<i>` interne. Copier
   les classes du voisin fait hériter de son icône (ex. la bulle de chat).
2. **Mauvais alignement** : ajouter en plus un `<i>` interne crée une
   **double-icône** → bouton trop large → il ne s'empile pas et se colle à
   droite de la colonne.

## Le correctif — cloner un onglet réel

On **clone un onglet existant** (`cloneNode(true)`) pour hériter exactement de
la structure, des classes de positionnement et de la taille natives. Puis on
adapte de façon ciblée :

1. `data-tab`, `data-tooltip`, `aria-label` (via `game.i18n.localize`).
2. Retirer `data-action` (évite que Foundry tente d'activer un onglet natif
   inexistant) et la classe `active`.
3. **Retirer TOUTES les classes `fa-*` héritées** avant de poser la nôtre.
4. Poser l'icône : sur un `<i>` interne s'il existe (anciennes versions), sinon
   sur le bouton (v13/v14).
5. Supprimer les badges de notif clonés (`.notification-pip`, etc.).
6. **Insérer dans le MÊME conteneur** que le bouton modèle
   (`model.insertAdjacentElement("afterend", ...)`) — en v14 les boutons
   vivent souvent dans un enfant de `<nav>`, donc `appendChild` sur `<nav>`
   placerait l'onglet à côté de la colonne.

## Points clés à ne pas oublier

- **Réinjecter à chaque rendu** : `Hooks.on("renderSidebar", ...)` (la sidebar
  est re-rendue), + une injection initiale si `ui.sidebar?.element` existe déjà.
- **Idempotence** : ne rien faire si `[data-tab="<TAB>"]` existe déjà.
- **`html` peut être HTMLElement ou jQuery** selon la version → normaliser.
- Réserver le clic via `addEventListener` avec `preventDefault` +
  `stopPropagation` pour ne pas déclencher la navigation native.

## Implémentation de référence (testée sur les modules HolySheet)

```javascript
const MODULE_ID = "mon-module";
const TAB = "mon-onglet";
const ICON = "fa-scroll";              // l'icône FontAwesome voulue

export function setupSidebarTab() {
  // Réinjecte à chaque rendu de la sidebar.
  Hooks.on("renderSidebar", (app, html) => injectTab(resolveRoot(html)));
  if (ui.sidebar?.element) injectTab(resolveRoot(ui.sidebar.element));
}

function resolveRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];           // jQuery
  return document.getElementById("sidebar") ?? document;
}

function injectTab(root) {
  if (!root) return;
  const nav = root.querySelector("#sidebar-tabs")
           ?? document.getElementById("sidebar-tabs");
  if (!nav) return;
  if (nav.querySelector(`[data-tab="${TAB}"]`)) return;           // déjà présent

  // 1. Modèle = un onglet réel (chat de préférence, sinon n'importe lequel).
  const model = nav.querySelector('[data-tab="chat"]')
             ?? nav.querySelector("[data-tab]");
  if (!model) return;

  // 2. Cloner pour hériter structure + taille natives.
  const button = model.cloneNode(true);
  button.setAttribute("data-tab", TAB);
  button.setAttribute("data-tooltip", game.i18n.localize("MONMODULE.Tab"));
  button.setAttribute("aria-label", game.i18n.localize("MONMODULE.Tab"));
  button.removeAttribute("data-action");                          // pas de nav native
  button.classList.remove("active");

  // 3. Retirer TOUTES les classes fa-* héritées (évite la double-icône).
  Array.from(button.classList)
    .filter((c) => c.startsWith("fa-"))
    .forEach((c) => button.classList.remove(c));

  // 4. Poser l'icône : <i> interne (ancien) sinon sur le bouton (v13/v14).
  const inner = button.querySelector("i");
  if (inner) inner.className = `fa-solid ${ICON}`;
  else button.classList.add("fa-solid", ICON);

  // 5. Retirer les badges de notif clonés du voisin.
  button.querySelectorAll(".notification-pip, .notification-count, .pip")
    .forEach((n) => n.remove());

  // 6. Clic → ton action (ouvrir une fenêtre, etc.).
  button.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openMyWindow();                                               // à définir
  });

  // 7. Insérer dans le MÊME conteneur, juste après le modèle (alignement OK).
  model.insertAdjacentElement("afterend", button);
}
```

Brancher `setupSidebarTab()` dans un hook `Hooks.once("ready", ...)` (ou
`renderSidebar` seul si l'injection initiale n'est pas requise).

## Variante MJ uniquement

Si l'onglet ne doit apparaître que pour le MJ, garder en tête de
`setupSidebarTab` : `if (!game.user?.isGM) return;`

## Checklist avant de valider

- [ ] L'onglet s'empile **dans** la colonne (pas collé à droite).
- [ ] L'icône est la bonne (pas la bulle de chat).
- [ ] Une seule icône (pas de double).
- [ ] Survit à un re-rendu de la sidebar (changer d'onglet et revenir).
- [ ] Pas de doublon si le hook se déclenche plusieurs fois.
- [ ] Tooltip/aria-label localisés (fr + en).
