export class HolySheetActor extends Actor {
  getRollData() {
    const rollData = foundry.utils.deepClone(super.getRollData());
    rollData.actorName = this.name;
    rollData.aptitudes = rollData.aptitudeValues ?? {};
    rollData.commonSkills = rollData.commonSkillValues ?? {};
    return rollData;
  }
}
