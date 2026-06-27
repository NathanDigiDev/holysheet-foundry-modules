import { clampPercent } from "./config.mjs";

export async function rollD100({ actor, label, target, modifier = 0 }) {
  const safeActorName = escapeHTML(actor.name);
  const safeLabel = escapeHTML(label);
  const rawTarget = clampPercent(target);
  const numericModifier = Number(modifier) || 0;
  const finalTarget = clampPercent(rawTarget + numericModifier, rawTarget);
  const roll = new Roll("1d100", actor.getRollData());
  await roll.evaluate();

  const natural = roll.total;
  const success = natural <= finalTarget;
  const critical = success && natural >= 1 && natural <= 10;
  const fumble = !success && natural >= 91 && natural <= 100;
  const status = critical
    ? game.i18n.localize("HOLYSHEET.Roll.Critical")
    : fumble
      ? game.i18n.localize("HOLYSHEET.Roll.Fumble")
      : success
        ? game.i18n.localize("HOLYSHEET.Roll.Success")
        : game.i18n.localize("HOLYSHEET.Roll.Failure");

  const modifierLine = numericModifier
    ? `<li><strong>${game.i18n.localize("HOLYSHEET.Roll.Modifier")}:</strong> ${numericModifier > 0 ? "+" : ""}${numericModifier}</li>`
    : "";

  const flavor = `
    <section class="holysheet-chat-card">
      <h3>${game.i18n.localize("HOLYSHEET.Roll.Title")} - ${safeLabel}</h3>
      <ul>
        <li><strong>${safeActorName}</strong></li>
        <li><strong>Formule:</strong> ${roll.formula}</li>
        <li><strong>${game.i18n.localize("HOLYSHEET.Roll.Natural")}:</strong> ${natural}</li>
        <li><strong>${game.i18n.localize("HOLYSHEET.Roll.Target")}:</strong> ${finalTarget}</li>
        ${modifierLine}
        <li><strong>Statut:</strong> ${status}</li>
      </ul>
    </section>
  `;

  return roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    flags: {
      holysheet: {
        label,
        rawTarget,
        finalTarget,
        modifier: numericModifier,
        natural,
        success,
        critical,
        fumble
      }
    }
  });
}

function escapeHTML(value) {
  const element = document.createElement("span");
  element.innerText = String(value ?? "");
  return element.innerHTML;
}
