# Holysheet Immersive Books for Foundry VTT

Module **system agnostic** pour Foundry VTT 13–14. Un livre reste un `JournalEntry`, mais dispose de deux expériences spécialisées : un lecteur immersif pour les joueurs et un atelier de composition pour le MJ.

## Lecteur immersif

- Aucun cadre de fenêtre Foundry : uniquement le livre, sa croix de fermeture et la scène assombrie.
- Couverture et quatrième de couverture seules ; pages intérieures en double page.
- Mise en page fixe et identique chez tous les joueurs, avec page unique sur petit écran.
- Pages images plein cadre ou pages composées de blocs.
- Navigation par les coins, le clavier et les signets privés.
- Post-it privé, déplaçable et attaché à chaque page.
- Pages visibles, réservées au MJ ou verrouillées derrière un visuel personnalisable.
- Action MJ « Montrer cette page à tous ».

## Atelier du livre

- Miniatures et réorganisation des pages à gauche, canevas au centre, propriétés à droite.
- Pages image avec recadrage et point focal.
- Blocs texte, image, encadré, décoration, forme et numéro de page.
- Déplacement, redimensionnement, rotation, opacité, calques, sélection multiple et alignement.
- Grille et magnétisme désactivables.
- Détection visuelle des textes qui dépassent.
- Modèles intégrés : chapitre, illustration, deux colonnes, lettre et bestiaire.
- Modèles personnels enregistrés dans les flags de l’utilisateur.
- Brouillon autosauvegardé, publication explicite, annuler/rétablir et cinq versions publiées.
- Corbeille récupérable jusqu’à publication.
- Verrou d’édition mono-MJ.

## Données

- Le Journal et ses `JournalEntryPage` restent les documents Foundry de référence.
- Le modèle, le brouillon, la version publiée et l’historique sont stockés dans `flags.holysheet-immersive-books.book`.
- Les signets, notes et modèles personnels sont stockés dans les flags du `User` concerné.
- Aucune position de lecture n’est mémorisée : chaque ouverture commence à la couverture.

## Installation de développement

Copier ce dossier dans `Data/modules/holysheet-immersive-books`, puis activer **Holysheet Immersive Books** dans le monde. Le manifeste est `module.json`.

## Utilisation

1. Dans les Journaux, cliquer sur **Créer un livre**.
2. Composer les pages dans l’atelier ; le brouillon est sauvegardé automatiquement.
3. Utiliser **Prévisualiser** pour contrôler le brouillon.
4. Cliquer sur **Publier** pour rendre la version visible aux joueurs.
5. Donner au Journal au moins la permission **Observateur**.

Un double-clic sur un livre dans les Journaux ouvre directement le lecteur. Le menu contextuel permet aussi d’ouvrir l’atelier ou le Journal natif.

```js
game.immersiveBooks.open("JOURNAL_ID");
game.immersiveBooks.design("JOURNAL_ID");
game.immersiveBooks.create();
game.immersiveBooks.showToAll("JOURNAL_ID", "PAGE_LAYOUT_ID");
```

## Vérification locale

```powershell
npm run check
npm test
```

Le projet reprend de [Xbozon/storyteller](https://github.com/Xbozon/storyteller) l’idée du Journal présenté comme un livre, mais utilise `ApplicationV2`, des brouillons publiables et un composeur natif sans `turn.js`.
