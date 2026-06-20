/**
 * Reward automation.
 *
 * On quest completion, item rewards are cloned into every assigned actor's
 * inventory and text rewards are whispered to the relevant players. Item rewards
 * reference a source Item by UUID, so this works in any game system that uses
 * core Items (which is all of them).
 */

import { REWARD_TYPE, log, warn } from "./config.mjs";

/**
 * Resolve the set of recipient actors for a quest.
 * @param {object} quest
 * @returns {Actor[]}
 */
export function questRecipients(quest) {
  const actors = new Map();

  // Explicitly assigned actors.
  for (const id of quest.participants.actors) {
    const actor = game.actors.get(id);
    if (actor) actors.set(actor.id, actor);
  }

  // Each assigned user contributes their selected character (if any).
  for (const userId of quest.participants.users) {
    const user = game.users.get(userId);
    if (user?.character) actors.set(user.character.id, user.character);
  }

  return Array.from(actors.values());
}

/**
 * Grant all not-yet-granted rewards for a quest. GM-only.
 * @param {object} quest
 * @returns {Promise<object[]>} The reward objects flagged as granted.
 */
export async function grantRewards(quest) {
  const recipients = questRecipients(quest);
  const granted = [];

  for (const reward of quest.rewards) {
    if (reward.granted) continue;

    if (reward.type === REWARD_TYPE.ITEM) {
      await grantItemReward(reward, recipients, quest);
    } else if (reward.type === REWARD_TYPE.TEXT) {
      announceTextReward(reward, quest);
    }

    reward.granted = true;
    granted.push(reward);
  }

  return granted;
}

/**
 * Clone a source item into each recipient's inventory.
 * @param {object} reward
 * @param {Actor[]} recipients
 * @param {object} quest
 */
async function grantItemReward(reward, recipients, quest) {
  if (!reward.itemUuid) return warn("Item reward has no source UUID", reward);

  let source;
  try {
    source = await fromUuid(reward.itemUuid);
  } catch (err) {
    return warn("Failed to resolve reward item", reward.itemUuid, err);
  }
  if (!source) return warn("Reward source item not found", reward.itemUuid);

  const quantity = Math.max(1, Number(reward.quantity) || 1);

  for (const actor of recipients) {
    const itemData = source.toObject();
    delete itemData._id;

    // Best-effort quantity support across systems that store it under system.quantity.
    if (quantity > 1 && foundry.utils.hasProperty(itemData, "system.quantity")) {
      foundry.utils.setProperty(itemData, "system.quantity", quantity);
    }

    // Tag the granted item so it can be traced back to the quest.
    foundry.utils.setProperty(itemData, `flags.holysheet-quest-system.sourceQuest`, quest.id);

    try {
      await actor.createEmbeddedDocuments("Item", quantity > 1 && !foundry.utils.hasProperty(itemData, "system.quantity")
        ? Array.from({ length: quantity }, () => foundry.utils.deepClone(itemData))
        : [itemData]);
      log(`Granted "${source.name}" to ${actor.name}`);
    } catch (err) {
      warn(`Could not grant item to ${actor.name}`, err);
    }
  }
}

/**
 * Whisper a text reward to the assigned players.
 * @param {object} reward
 * @param {object} quest
 */
function announceTextReward(reward, quest) {
  if (!reward.text) return;
  const recipients = game.users.filter((u) => quest.participants.users.includes(u.id) || (u.character && quest.participants.actors.includes(u.character.id)));
  const whisper = recipients.length ? recipients.map((u) => u.id) : game.users.filter((u) => u.isGM).map((u) => u.id);

  ChatMessage.create({
    content: `<div class="quest-system reward-chat"><h3><i class="fa-solid fa-scroll"></i> ${quest.name}</h3><p>${reward.text}</p></div>`,
    whisper,
    speaker: { alias: game.i18n.localize("QUESTSYSTEM.RewardSpeaker") }
  });
}
