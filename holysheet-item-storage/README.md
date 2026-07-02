# HolySheet Item Storage

Foundry VTT v14 module for shared item containers.

## MVP

- Mark or create Items as containers.
- Open a dedicated container window.
- GM can drop Items into the container from Foundry directories.
- Players can take entries into an owned/selected Actor inventory.
- Container contents are copied at drop time and removed/decremented when taken.
- Container Items can be dropped on the canvas to create clickable chest markers.
- GM can right-click a marker to lock or unlock it.

The module stores data in `flags.holysheet-item-storage` so it can stay portable across systems. When the HolySheet system is active, new containers are created as `equipment` Items with the `Contenant` category.
