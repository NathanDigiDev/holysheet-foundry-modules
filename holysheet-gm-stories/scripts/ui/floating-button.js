import { MODULE_ID, SETTINGS, localize } from "../config.js";
import { openMainApp } from "../apps/gm-stories-app.js";

let button = null;
let drag = null;
let frame = null;
let pending = null;

export function installFloatingButton() {
  if (!game.user.isGM || button) return;
  button = document.createElement("button");
  button.id = "hsgm-floating-button";
  button.className = "holysheet hs-theme-lueur hsgm-floating";
  button.type = "button";
  button.dataset.tooltip = localize("HSGM.Open");
  button.setAttribute("aria-label", localize("HSGM.Open"));
  button.innerHTML = '<i class="fa-solid fa-scroll"></i>';
  document.body.appendChild(button);

  const position = game.settings.get(MODULE_ID, SETTINGS.FLOATING_POSITION) ?? { left: 88, top: 120 };
  setPosition(position.left, position.top);

  button.addEventListener("click", (event) => {
    if (drag?.moved) return;
    event.preventDefault();
    openMainApp();
  });
  button.addEventListener("pointerdown", startDrag);
}

function startDrag(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  button.setPointerCapture(event.pointerId);
  const rect = button.getBoundingClientRect();
  drag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    left: rect.left,
    top: rect.top,
    moved: false
  };
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointercancel", endDrag, { once: true });
  window.addEventListener("pointerup", endDrag, { once: true });
}

function moveDrag(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag.moved = true;
  queuePosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
}

async function endDrag(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
  window.removeEventListener("pointermove", moveDrag);
  const left = pending?.left ?? drag.left;
  const top = pending?.top ?? drag.top;
  setPosition(left, top);
  await game.settings.set(MODULE_ID, SETTINGS.FLOATING_POSITION, {
    left: Math.round(left),
    top: Math.round(top)
  });
  window.setTimeout(() => {
    drag = null;
    pending = null;
  }, 0);
}

function queuePosition(left, top) {
  const position = clampPosition(left, top);
  pending = position;
  drag.left = position.left;
  drag.top = position.top;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    if (!pending) return;
    button.style.transform = `translate3d(${Math.round(pending.left)}px, ${Math.round(pending.top)}px, 0)`;
  });
}

function setPosition(left, top) {
  const position = clampPosition(left, top);
  button.style.left = "0";
  button.style.top = "0";
  button.style.transform = `translate3d(${Math.round(position.left)}px, ${Math.round(position.top)}px, 0)`;
}

function clampPosition(left, top) {
  const safeLeft = Math.max(8, Math.min(window.innerWidth - 58, Number(left) || 88));
  const safeTop = Math.max(8, Math.min(window.innerHeight - 58, Number(top) || 120));
  return { left: safeLeft, top: safeTop };
}
