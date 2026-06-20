# .agents/ — Pointeur vers les skills

Pour éviter la duplication, les skills de ce workspace ont **une seule source de
vérité** : `../.claude/skills/`. Ce dossier `.agents/` n'en contient pas de
copie — il sert uniquement de point d'entrée pour les agents qui cherchent ici.

Voir `../AGENTS.md` (résumé des conventions) et les skills :

| Sujet | Fichier |
| --- | --- |
| Doc FoundryVTT v14 via Context7 | `../.claude/skills/foundry-docs-context7/SKILL.md` |
| Scaffold d'un module v14 | `../.claude/skills/foundry-module-scaffold/SKILL.md` |
| Habillage visuel HolySheet (socle CSS + recettes) | `../.claude/skills/foundry-holysheet-design/SKILL.md` |
| UI en ApplicationV2 (fenêtre, formulaire, onglets) | `../.claude/skills/foundry-applicationv2/SKILL.md` |
| Settings & hooks de cycle de vie | `../.claude/skills/foundry-settings-hooks/SKILL.md` |
| Sockets (joueur→MJ) & flags | `../.claude/skills/foundry-socket-flags/SKILL.md` |
| Onglet sidebar v13/v14 (fix double-icône / alignement) | `../.claude/skills/foundry-sidebar-tab/SKILL.md` |

> Pour modifier un comportement, éditer le `SKILL.md` dans `.claude/skills/`,
> pas une copie ici.
