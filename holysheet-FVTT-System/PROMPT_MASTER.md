# PROMPT MASTER - Systeme Foundry VTT Holysheet

Ce fichier est le cahier des charges source du systeme Foundry VTT a creer.
Les choix de gameplay du Prototype 1 sont consideres comme confirmes, sauf mention explicite contraire.

## 0. Sources techniques a respecter

- Documentation API cible : Foundry VTT API v14, Context7 `/websites/foundryvtt_api_v14`
- Version Foundry cible : V14
- Derniere build stable constatee le 11 juin 2026 : `14.364`, publiee le 10 juin 2026
- Points API v14 importants :
  - `system.json` doit declarer l'identite du package et sa compatibilite.
  - `compatibility` accepte notamment `minimum`, `verified` et optionnellement `maximum`.
  - Les langues se declarent via `languages`, avec `lang`, `name` et `path`.
  - Les donnees systeme des Actors et Items sont migrees selon le schema du systeme.
  - Pour les jets, `Actor#getRollData()` peut exposer les donnees utilisables dans les formules.
  - Si on utilise des data models v14, les enregistrer pendant `Hooks.on("init")` via `CONFIG.Actor.dataModels` et `CONFIG.Item.dataModels`.

## 1. Carte d'identite du systeme

### Valeurs proposees

- Nom technique du systeme : `holysheet`
- Titre affiche : `HolySheet`
- Description courte : `Systeme D100 simple, generique et customisable pour Foundry Virtual Tabletop.`
- Version initiale du systeme : `0.1.0`
- Compatibilite Foundry :
  - Minimum : `14`
  - Verifie : `14.364`
  - Maximum : ne pas definir pour l'instant, sauf incompatibilite connue.
- Langue par defaut : francais
- Fichier de traduction principal : `lang/fr.json`
- Auteur(s) : `HalTorns`, `Nathantenpouin`
- URL projet / depot : non requis pour le Prototype 1, a definir avant publication
- Licence : `MIT` recommandee pour le code, a confirmer avant publication

### Structure attendue du manifest `system.json`

Le systeme doit utiliser un manifest proche de cette intention :

```json
{
  "id": "holysheet",
  "title": "HolySheet",
  "description": "Systeme D100 simple, generique et customisable pour Foundry Virtual Tabletop.",
  "version": "0.1.0",
  "compatibility": {
    "minimum": "14",
    "verified": "14.364"
  },
  "authors": [
    {
      "name": "HalTorns"
    },
    {
      "name": "Nathantenpouin"
    }
  ],
  "languages": [
    {
      "lang": "fr",
      "name": "Francais",
      "path": "lang/fr.json"
    }
  ],
  "esmodules": [
    "scripts/main.mjs"
  ],
  "styles": [
    "styles/holysheet.css"
  ],
  "template": "template.json"
}
```

## 2. Vision du jeu

Decrire ici ce que le systeme doit permettre en une phrase claire.

- Pitch du jeu : `HolySheet est un systeme D100 simple et jouable sur n'importe quel univers, basique et entierement customisable.`
- Genre : `generique / multi-univers`
- Ton : `adaptable selon l'univers`
- Niveau de complexite souhaite : `simple`
- Public vise : `MJ et joueurs cherchant un systeme D100 simple, generique et customisable`

## 3. Modele de donnees - Actors

### Types d'Actors

Types a creer :

- `character` : personnage joueur
- `npc` : personnage non-joueur / creature

### Modules de fiche activables

HolySheet doit etre entierement customisable.
Le MJ doit pouvoir activer ou desactiver les grands modules de fiche selon le JDR joue.

Modules actives par defaut :

- Nom du personnage
- Image / portrait
- Aptitudes
- Competences communes
- Competences speciales
- Points de Vie
- Inventaire
- Monnaie

Modules optionnels desactivables / activables selon les besoins :

- Competences communes
- Competences speciales
- Points de Vie
- Armure
- Etats / jauges custom
- Inventaire
- Monnaie
- Armes
- Armures
- Sorts / pouvoirs
- Talents
- Niveau
- Biographie / notes narratives

Cas minimal autorise :

- Le MJ peut configurer une fiche tres minimale, par exemple avec seulement le nom et l'image du personnage.

### Actor `character`

#### Identite

- Nom : gere par Foundry (`name`)
- Image : geree par Foundry (`img`)
- Classe / Archetype : texte court
- Origine : texte court
- Description : champ HTML riche
- Histoire : champ HTML riche
- Niveau : option activable, desactivee par defaut, valeur manuelle si activee
- Experience : pas de systeme d'XP par defaut
- Pas de champ Notes MJ dedie : Foundry VTT propose deja des outils de notes separes.

#### Aptitudes

Les caracteristiques principales s'appellent des `Aptitudes`.
Elles sont volontairement configurables pour adapter HolySheet a n'importe quel univers.

Regles de configuration :

- Le systeme propose une liste d'Aptitudes par defaut.
- Le MJ doit pouvoir personnaliser la liste d'Aptitudes selon le JDR joue.
- Nombre minimum d'Aptitudes : `1`
- Nombre maximum d'Aptitudes : `10`
- Chaque Aptitude a :
  - un nom complet, ex. `Force`
  - une abreviation de `3` ou `4` lettres, ex. `FOR`
  - une valeur en pourcentage
- Valeur affichee par defaut : `30%`
- Les valeurs sont modifiables manuellement.
- Les jets d'Aptitude utilisent le systeme `1d100 roll-under`.

Aptitudes proposees par defaut :

| Cle technique | Libelle | Abreviation | Valeur initiale | Description |
| --- | --- | --- | ---: | --- |
| `intelligence` | Intelligence | INT | 30 | Analyse, savoir, raisonnement |
| `charisme` | Charisme | CHA | 30 | Influence, presence sociale |
| `endurance` | Endurance | END | 30 | Resistance, souffle, robustesse |
| `dexterite` | Dexterite | DEX | 30 | Precision, adresse, coordination |
| `force` | Force | FOR | 30 | Puissance physique |

Regles confirmees :

- Valeur minimale d'une Aptitude : `1`
- Valeur maximale d'une Aptitude : `100`
- Valeur par defaut d'une Aptitude sur une nouvelle fiche : `30%`

#### Ressources

Les Points de Vie sont la ressource centrale par defaut.

Ressources par defaut :

| Cle technique | Libelle | Abreviation | Donnees | Calcul automatique |
| --- | --- | --- | --- | --- |
| `pv` | Points de Vie | PV | `value`, `max` | Aucun |
| `armure` | Armure | ARM | `value` | Aucun |

Regles :

- Les PV ne sont pas calcules automatiquement.
- Valeur par defaut des PV sur une nouvelle fiche : `10/10`.
- Le joueur ou le MJ peut ensuite renseigner manuellement la valeur actuelle et la valeur maximum.
- L'armure est une valeur manuelle / derivee des armures equipees selon le module actif.
- Valeur d'armure par defaut : `0`.
- Aucun calcul automatique de PV, d'armure ou de defense n'est impose par defaut.

#### Etats et jauges custom

Le MJ doit pouvoir configurer d'autres etats ou jauges selon l'univers.
Ces elements sont disponibles pour les PJ et les PNJ.
Aucun etat / jauge custom n'est cree par defaut.

Exemples :

- Mana
- Faim
- Soif
- Stress
- Fatigue
- Moral

Types possibles :

- Jauge numerique
- Etat a cocher

Chaque jauge numerique doit avoir :

- un nom
- une description
- une valeur actuelle
- une valeur maximum
- une option d'affichage sur la fiche

Affichage :

- Format `actuel/max`, par exemple `8/12`.
- Les deux valeurs sont modifiables librement.
- Le maximum est indicatif et ne doit pas imposer de blocage strict par defaut.
- La description est visible au survol de la souris sur le nom.

Chaque etat a cocher doit avoir :

- un nom
- une description
- une case cochee / non cochee
- une option d'affichage sur la fiche

Affichage :

- Case a cocher avec le nom de l'etat.
- Description visible au survol de la souris sur le nom.

Placement :

- Sur la fiche PJ, les etats et jauges visibles doivent apparaitre dans la partie haute, sous le bloc image + Aptitudes.
- Sur la fiche PNJ, ils doivent apparaitre dans la page unique, pres des PV et de l'armure.

Ces etats / jauges doivent rester generiques et ne pas imposer de regles de recuperation.
Les valeurs sont modifiables manuellement par le MJ ou les utilisateurs ayant les droits sur la fiche.

#### Competences

Les competences representent des actions plus precises que les Aptitudes.

Regles generales :

- Les competences sont optionnelles.
- Dans les parametres du monde ou du systeme, le MJ doit pouvoir activer ou desactiver les competences.
- Si les competences sont desactivees, les personnages jouent uniquement avec les Aptitudes.
- Si les competences sont activees, le MJ configure une liste de competences commune au JDR joue.
- Cette liste commune est fixe pour le JDR une fois parametree.
- Elle reste modifiable uniquement par le MJ dans les parametres.
- Nombre minimum de competences communes : `1`
- Nombre maximum de competences communes : `100`
- Chaque competence commune a :
  - un nom
  - une description optionnelle
  - une valeur en pourcentage sur chaque personnage
- Le score d'une competence peut etre modifie a tout moment par le MJ ou par un joueur ayant les droits sur la fiche.
- Valeur par defaut d'une competence commune sur une nouvelle fiche : `30%`.

Competences communes proposees par defaut :

- Artisanat
- Combat a Distance
- Combat rapproche
- Courir, Sauter
- Discretion
- Intimider
- Mentir, convaincre
- Perception
- Psychologie
- Reflexes
- Soigner
- Survie

#### Competences speciales

En plus des competences communes, chaque personnage peut avoir ses propres competences speciales.

Regles :

- Les competences speciales sont propres a chaque Actor.
- Elles sont affichees dans une seconde colonne sur la fiche.
- Le joueur proprietaire de la fiche et le MJ peuvent les creer, modifier et supprimer directement depuis la fiche.
- Chaque competence speciale a :
  - un nom
  - une description
  - une valeur en pourcentage
- Elles utilisent aussi le systeme `1d100 roll-under`.
- Une nouvelle fiche commence sans competence speciale.

#### Donnees derivees

Calculer automatiquement :

- Pas de modificateur de caracteristique de type D20.
- Les valeurs d'Aptitudes et de competences sont directement des pourcentages cibles.
- Initiative : pas de formule par defaut, module optionnel futur si necessaire
- Armure : valeur manuelle, si le module Armure est actif
- PV max : valeur manuelle
- Encombrement maximum : pas de formule par defaut, module optionnel futur si necessaire

## 4. Modele de donnees - Items

### Inventaire

L'inventaire est active par defaut, mais doit rester un module desactivable dans les parametres.

HolySheet doit privilegier des objets generiques et customisables plutot que des types d'Items trop rigides.

### Categories d'objets

Le MJ doit pouvoir ajouter, renommer ou supprimer des categories d'objets dans les parametres du systeme / monde.

Categories proposees par defaut :

- Armes
- Armure
- Bijou
- Consommable
- Documents
- Divers
- Ingredient et Materiau
- Munition
- Potion
- Vetement
- Invocation et pet

### Item generique `equipment`

Tous les objets d'inventaire peuvent utiliser un type technique commun `equipment`, avec une categorie configurable.

Proprietes :

- Nom
- Image
- Categorie
- Description libre HTML
- Quantite
- Prix / valeur optionnel
- Equipe : oui / non
- Valeur d'armure : nombre optionnel, utile seulement pour les objets de categorie `Armure`
- Notes libres

Regles :

- Les armes n'ont pas de formule de degats par defaut.
- Les armes utilisent une description libre.
- Les consommables, documents, potions, bijoux, vetements, ingredients, munitions, invocations et autres objets utilisent aussi une description libre.
- L'encombrement / poids est optionnel pour plus tard et ne doit pas etre inclus comme mecanique obligatoire du prototype.

### Systeme monetaire

HolySheet doit prevoir un systeme monetaire customisable.

Regles :

- Le systeme monetaire est active par defaut.
- Il est entierement customisable par monde.
- Par defaut, une seule monnaie existe : `Credits`.
- Les valeurs de monnaie sont stockees uniquement sur les Actors de type `character`.
- Les PNJ n'ont pas de monnaie par defaut.
- Quantite de monnaie par defaut sur une nouvelle fiche PJ : `0 Credit`.

Chaque monnaie configuree par le MJ doit avoir :

- un logo / icone
- un nom
- une quantite sur chaque personnage joueur
- une valeur d'equivalence optionnelle avec une autre monnaie

### Equivalences et conversion

Le systeme doit permettre des equivalences entre monnaies.

Exemples :

- `10 eteins = 1 cuivre`
- `10 cuivres = 1 argent`

Fonctionnalites attendues :

- Bouton pour convertir automatiquement vers les monnaies les plus hautes possibles.
- Action pour ajouter un montant precis dans une ou plusieurs monnaies.
- Action pour soustraire un montant precis dans une ou plusieurs monnaies.
- Le systeme doit rester generique : les noms et equivalences dependent de la configuration du monde.

### Armure equipee

Si le module Armure est actif sur la fiche :

- Un objet de categorie `Armure` peut avoir une valeur d'armure.
- Quand une piece d'armure est equipee, sa valeur contribue a la valeur d'armure affichee sur la fiche.
- Si plusieurs armures sont equipees, leurs valeurs d'armure s'additionnent.
- Le MJ reste responsable de decider ce qu'il autorise dans son univers.

## 5. Parametres de monde et customisation MJ

HolySheet doit stocker sa configuration principale par monde Foundry.
Chaque monde peut donc avoir sa propre configuration de systeme.

Parametres configurables par le MJ :

- Modules de fiche actives / desactives
- Liste des Aptitudes
- Liste des competences communes
- Categories d'objets
- Etats / jauges custom

Regles :

- Les joueurs peuvent voir les noms et descriptions des Aptitudes.
- Les joueurs peuvent voir les noms et descriptions des competences.
- Sur la fiche, la description d'une Aptitude ou competence doit etre accessible au survol de la souris sur son nom.
- La configuration globale est modifiable par le MJ uniquement.
- Les valeurs propres a une fiche peuvent etre modifiees par le MJ ou par un utilisateur ayant les droits sur cette fiche.

### Droits de modification des fiches PJ

Ne pas appliquer une regle simple de type "le proprietaire peut tout modifier".
Respecter une liste explicite de champs autorises.

Un joueur proprietaire de la fiche peut modifier :

- ses PV
- ses scores d'Aptitudes
- ses scores de competences communes
- ses competences speciales
- son inventaire
- sa monnaie
- ses champs narratifs autorises

Un joueur proprietaire de la fiche ne peut pas modifier :

- les noms / abreviations des Aptitudes globales
- les descriptions globales des Aptitudes
- les noms des competences communes
- les descriptions globales des competences communes
- les categories globales d'objets
- la configuration globale des monnaies
- la configuration globale des etats / jauges

Armure :

- Le joueur ne modifie pas directement la valeur d'armure calculee si le module Armure est actif.
- La valeur d'armure vient des pieces d'armure equipees.
- Le joueur peut equiper / desequiper une piece d'equipement s'il a les droits sur la fiche.

Competences speciales :

- Le joueur proprietaire de la fiche peut les voir, ajouter, modifier et supprimer.
- Le MJ peut les voir, ajouter, modifier et supprimer.

### Propagation des competences communes

La liste des competences communes est globale au monde.

Si le MJ modifie cette liste :

- Le changement se reflete directement sur toutes les fiches.
- Une competence ajoutee apparait sur toutes les fiches.
- Une competence retiree disparait de toutes les fiches.
- Les scores de competences restent stockes par Actor.
- Si une competence commune existe dans la configuration globale mais pas encore dans les donnees d'un Actor, elle apparait avec la valeur par defaut.

Valeur par defaut proposee pour une nouvelle competence commune : `30%`

### Structure technique des donnees customisables

Decisions confirmees :

- Les Aptitudes sont configurees dans les parametres du monde.
- Les valeurs d'Aptitudes sont stockees sur chaque Actor.
- Les competences communes sont configurees dans les parametres du monde.
- Les valeurs des competences communes sont stockees sur chaque Actor.
- Les competences speciales sont stockees directement sur chaque Actor.
- Les objets d'inventaire sont des Items Foundry classiques.
- Les categories d'objets sont configurees dans les parametres du monde.
- Les monnaies sont configurees dans les parametres du monde.
- Les quantites de monnaie sont stockees sur chaque Actor `character`.
- Les etats / jauges custom sont configures dans les parametres du monde.
- Les valeurs d'etats / jauges custom sont stockees sur chaque Actor.

## 6. Regles de calcul

### Calculs du Prototype 1

HolySheet utilise des valeurs en pourcentage directement testees au D100.
Il n'y a pas de modificateur derive de type D20.

Regles confirmees pour le Prototype 1 :

- Points de Vie maximum : valeur manuelle
- Armure : valeur manuelle
- Ressources secondaires : valeurs manuelles configurees par le MJ
- Defense : pas de formule par defaut
- Initiative : pas de formule par defaut
- Encombrement maximum : pas de formule par defaut
- Autres calculs automatiques : aucun par defaut

### Niveau

Le niveau est un module optionnel, desactive par defaut.

Regles :

- Pas de systeme d'XP par defaut.
- Si le module Niveau est active, il affiche un champ numerique manuel sur la fiche.
- Le niveau ne declenche aucun calcul automatique.
- Le niveau ne modifie pas les PV, Aptitudes, competences ou autres valeurs.

## 7. Systeme de resolution - Jets de des

### Regle confirmee

- Type : `1d100`
- Principe : roll-under
- Les Aptitudes et competences sont notees directement sur 100.
- Formule de base : `1d100`
- Reussite : le resultat du `1d100` doit etre inferieur ou egal a la valeur testee.
- Echec : le resultat du `1d100` est superieur a la valeur testee.
- Reussite critique : resultat naturel de `1` a `10`, seulement si le jet est aussi une reussite roll-under.
- Echec critique : resultat naturel de `91` a `100`, seulement si le jet est aussi un echec.
- Pas de niveaux de reussite.
- Pas d'avantage / desavantage.

### Declenchement des jets

- Clic gauche sur le titre / abreviation d'une Aptitude : lance immediatement le jet D100.
- Clic gauche sur le titre d'une competence commune : lance immediatement le jet D100.
- Clic gauche sur le titre d'une competence speciale : lance immediatement le jet D100.
- Si possible dans Foundry, clic droit sur une Aptitude ou competence : ouvrir une option pour ajouter, modifier ou supprimer un bonus / malus de jet.
- Il ne doit pas y avoir de fenetre de confirmation avant chaque jet par defaut.

### Modificateurs de difficulte

Le systeme de base ne prevoit pas d'avantage / desavantage.
Les modificateurs sont des bonus ou malus appliques a la valeur cible avant le jet.

Exemple :

- Competence testee : `60`
- Modificateur : `-10`
- Valeur cible finale : `50`
- Reussite si le `1d100` donne `50` ou moins

Regle :

- Le modificateur change la cible, pas le resultat du de.
- Si aucun modificateur n'est defini, le clic lance le jet directement sur la valeur brute.
- Si un modificateur est defini sur l'Aptitude ou la competence, il est affiche dans le chat.

### Sortie dans le chat

Chaque jet doit afficher :

- Nom du personnage
- Nom de l'action / competence / arme / sort
- Formule lancee
- Resultat du de naturel
- Valeur cible testee
- Modificateur applique si applicable
- Statut : reussite, echec, critique, fumble

## 8. Feuilles de personnage - UX

### Themes visuels

HolySheet doit avoir une identite visuelle propre, mais rester adaptable a plusieurs genres.

Objectif :

- Prevoir un theme HolySheet par defaut.
- Si possible, permettre au MJ de choisir une variante visuelle par monde.

Themes souhaites :

- `holysheet` : theme generique par defaut
- `fantasy` : ambiance parchemin / aventure / med-fan sobre
- `contemporain` : ambiance moderne, claire et lisible
- `futuriste` : ambiance SF, interfaces plus techniques

Regle de conception :

- Les themes ne doivent pas changer les donnees ni les regles.
- Ils doivent seulement modifier l'apparence : couleurs, bordures, fonds, typographies compatibles, espacements.
- Si plusieurs themes complets sont trop ambitieux pour le prototype 1, creer d'abord une architecture CSS permettant de les ajouter ensuite.

### Feuille Actor `character`

La fiche des personnages joueurs utilise une structure en deux zones :

1. Une partie haute persistante, toujours visible.
2. Une partie basse avec onglets.

La reference visuelle fournie par l'utilisateur montre une fiche type parchemin avec un portrait central, le nom et les informations principales au-dessus, et les Aptitudes disposees autour du portrait. Il ne faut pas copier cette fiche a l'identique, mais respecter l'intention UX : l'identite, l'image et les Aptitudes restent visibles pendant que l'utilisateur change d'onglet.

#### Partie haute persistante

Contenu :

- Nom
- Image / portrait
- Classe / Archetype
- Origine
- Niveau, seulement si le module Niveau est actif
- Ressources : PV, Armure et etats / jauges custom si les modules correspondants sont actifs
- Aptitudes avec boutons de jet
- Les Aptitudes doivent etre mises en avant visuellement autour du portrait quand la place le permet.
- Comme le nombre maximum d'Aptitudes est de 10, la feuille doit tenter une disposition circulaire ou semi-circulaire autour de l'image.
- Les etats et jauges custom visibles doivent apparaitre sous le bloc portrait + Aptitudes.
- Sur petit ecran ou petite fenetre, la disposition doit rester lisible sous forme de grille compacte.
- Cliquer sur le titre / abreviation d'une Aptitude lance son jet D100.
- Cliquer sur le titre d'une competence lance son jet D100.
- Le clic droit sert a gerer un bonus / malus de jet si l'implementation Foundry le permet.

### Edition de la fiche

La fiche doit proposer un mode edition global.

Regles :

- Si l'utilisateur a les droits, il peut activer le mode edition.
- En mode lecture, la fiche privilegie l'affichage clair et les jets rapides.
- En mode edition, les champs modifiables deviennent editables.
- Le MJ conserve toujours les droits de modification.
- Un joueur peut modifier les champs autorises sur une fiche dont il a les droits.

#### Onglet Bio

Contenu :

- Description
- Histoire

Regles :

- L'onglet Bio est active par defaut.
- Les champs narratifs ne sont pas customisables pour le prototype.
- Pas de champ Notes MJ dedie.

#### Onglet Competences

Contenu :

- Deux colonnes :
  - Competences communes
  - Competences speciales
- Valeur en pourcentage
- Description
- Bouton de jet pour chaque competence
- Boutons ajouter / modifier / supprimer pour les competences speciales si l'utilisateur a les droits

#### Onglet Inventaire

Contenu :

- Monnaies du personnage joueur en haut de l'onglet, si le module Monnaie est actif
- Boutons ajouter, soustraire et convertir vers les plus hautes monnaies possibles
- Liste des objets groupes par categorie
- Categories configurables par le MJ
- Description libre
- Bouton equiper / desequiper
- Quantite
- Prix / valeur optionnel des objets
- Pas d'encombrement obligatoire dans le prototype

### Feuilles Item

Chaque type d'Item doit avoir une feuille claire :

- Header : nom, image, type
- Description
- Champs mecaniques propres au type
- Tags / proprietes

### Feuille Actor `npc`

La fiche PNJ doit etre plus simple que la fiche joueur.
Elle doit tenir sur une seule page, sans onglets.

Modules affiches par defaut :

- Nom
- Image
- PV
- Armure
- Description
- Aptitudes
- Inventaire

Regles :

- Les PNJ utilisent les memes Aptitudes globales que les personnages joueurs.
- Les PNJ n'utilisent pas les competences communes.
- Les PNJ n'utilisent pas les competences speciales par defaut.
- Les PNJ ont un inventaire.
- Les PNJ peuvent faire des jets D100 d'Aptitude comme les PJ.
- Les PNJ n'ont pas de monnaie par defaut.

## 9. Priorites de developpement

### Prototype 1

Objectif : obtenir un systeme installable dans Foundry VTT v14.

- Creer `system.json`
- Creer `template.json`
- Creer `lang/fr.json`
- Creer `scripts/main.mjs`
- Creer les feuilles Actor et Item basiques
- Afficher les Actors `character` et `npc`
- Afficher les Items principaux
- Implementer les jets de caracteristique
- Implementer les jets de competence si `skill` est un Item

### Prototype 2

- Ajouter equiper / desequiper
- Ajouter la contribution automatique des armures equipees a la valeur d'armure
- Ajouter les modules optionnels avances : encombrement, initiative ou autres calculs si definis
- Ameliorer l'UX et le CSS

### Prototype 3

- Ajouter sorts / pouvoirs si definis
- Ajouter talents actifs si definis
- Ajouter migrations si le schema change
- Ajouter tests ou scripts de validation JSON

## 10. Questions restantes a trancher

Repondre a ces questions avant le codage complet :

1. Le nom definitif du jeu est-il bien `HolySheet` ? `CONFIRME`
2. Le nom technique doit-il etre `holysheet` ? `CONFIRME`
3. Quelle est la liste officielle des Aptitudes ? `CONFIRME : liste configurable, defaut INT, CHA, END, DEX, FOR`
4. Quelles ressources existent vraiment ? `CONFIRME : PV manuels, Armure manuelle, etats / jauges custom configurables`
5. Le systeme de resolution est-il bien en `1d100 roll-under`, avec critique de `1` a `10` et fumble de `91` a `100` ? `CONFIRME`
6. Les competences sont-elles des Items ou des champs fixes sur la fiche ? `CONFIRME : competences communes configurees en parametres de monde avec valeurs sur Actor, competences speciales stockees sur Actor, pas comme Items`
7. Quels types d'objets doivent etre presents des le prototype ? `CONFIRME : Item generique equipment avec categories configurables, defaut Armes, Armure, Bijou, Consommable, Documents, Divers, Ingredient et Materiau, Munition, Potion, Vetement, Invocation et pet`
8. Quelle formule officielle pour les PV, la defense et l'initiative ? `CONFIRME : PV et Armure manuels, pas de defense ni initiative par defaut dans le Prototype 1`
9. Comment fonctionne la progression XP / niveau ? `CONFIRME : Niveau optionnel desactive par defaut, pas d'XP, pas de calcul automatique`
10. Faut-il une feuille `npc` simplifiee ou identique a celle des personnages ? `CONFIRME : fiche npc simplifiee sur une seule page, sans onglets, avec Nom, Image, PV, Armure, Description, Aptitudes et Inventaire`
11. Les parametres sont-ils propres a chaque monde Foundry ? `CONFIRME`
12. Si le MJ modifie les competences communes, cela influe-t-il sur toutes les fiches ? `CONFIRME`
13. Comment fonctionne le systeme monetaire ? `CONFIRME : actif par defaut, customisable par monde, Credits par defaut, stocke uniquement sur les PJ, equivalences et conversion ascendante`

## 11. Instruction a donner a l'agent de code

Quand ce fichier est rempli, lancer le travail avec une instruction du type :

```text
Lis PROMPT_MASTER.md. Cree un systeme Foundry VTT v14 installable dans ce dossier en respectant ce cahier des charges. Commence par le Prototype 1, garde le code simple, documente les choix importants, et verifie les JSON.
```
