import { localize } from "../config.js";

export async function shareLinkedDocumentImage(note) {
  if (!note?.linkedUuid) return;
  const document = await fromUuid(note.linkedUuid);
  const src = documentImage(document);
  if (!document || !src) {
    ui.notifications?.warn(localize("HSGM.NoLinkedImage"));
    return;
  }

  const ImagePopout = foundry.applications?.apps?.ImagePopout;
  if (!ImagePopout) {
    ui.notifications?.warn(localize("HSGM.NoLinkedImage"));
    return;
  }

  const popout = new ImagePopout({
    src,
    uuid: document.uuid,
    window: { title: document.name }
  });
  popout.render(true);
  popout.shareImage();
  ui.notifications?.info(localize("HSGM.ImageShared"));
}

function documentImage(document) {
  if (!document) return "";
  if (document.documentName === "Scene") {
    return document.background?.src || document.foreground || document.thumb || document.img || "";
  }
  return document.img || document.prototypeToken?.texture?.src || document.texture?.src || "";
}
