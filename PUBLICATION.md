# HolySheet Foundry public submission checklist

This file tracks the package information needed before submitting modules and the HolySheet system to the official Foundry VTT package list.

## Package manifest URLs

Use these URLs when testing installation or filling package version data.

| Package | Type | Manifest URL |
| --- | --- | --- |
| Holysheet Custom Calendar | Module | `https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-custom-calendar-module.json` |
| Holysheet Foundry Friendly Interface | Module | `https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-foundry-friendly-interface-module.json` |
| HolySheet GM Stories | Module | `https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-gm-stories-module.json` |
| Holysheet Immersive Books | Module | `https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-immersive-books-module.json` |
| Holysheet Interactive Zones | Module | `https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-interactive-zones-module.json` |
| HolySheet Item Storage | Module | `https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-item-storage-module.json` |
| Holysheet Lockpicking | Module | `https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-lockpicking-module.json` |
| Quest System | Module | `https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-quest-system-module.json` |
| HolySheet | System | `https://github.com/NathanDigiDev/holysheet-foundry-modules/releases/latest/download/holysheet-system.json` |

## Public metadata checklist

- Each `module.json` declares `id`, `type: "module"`, `title`, `description`, `version`, `compatibility`, `authors`, `media`, `url`, `manifest`, `download`, `readme`, `changelog`, `bugs`, and `license`.
- The system `system.json` declares the same public metadata, with `type: "system"`.
- `manifest` and `download` URLs must point to `releases/latest/download/...` assets, never to `raw.githubusercontent.com/.../main/...`.
- Each package has a README with an installation manifest URL.
- Public issue tracking is the repository issue tracker: `https://github.com/NathanDigiDev/holysheet-foundry-modules/issues`.
- Changelog/release notes are tracked through GitHub Releases: `https://github.com/NathanDigiDev/holysheet-foundry-modules/releases`.
- License metadata points to MIT: `https://opensource.org/licenses/MIT`.

## Before submitting to Foundry

- Install each package from its manifest URL in a clean Foundry setup.
- Activate each module in a clean test world and check the browser console.
- Confirm that no non-publishable DnD converted content is present in the release assets.
- Review the Foundry AI Content Policy and only submit packages whose user-facing content complies.
- Prepare at least one screenshot or short media asset per package if you want richer package pages.

