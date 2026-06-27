export class HolySheetCharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return actorSchema();
  }
}

export class HolySheetNpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return actorSchema();
  }
}

export class HolySheetEquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      category: new fields.StringField({ required: true, blank: false, initial: "Divers" }),
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      price: new fields.StringField({ required: false, blank: true, initial: "" }),
      prices: new fields.ObjectField({ required: false, initial: {} }),
      equipable: new fields.BooleanField({ required: true, initial: false }),
      equipped: new fields.BooleanField({ required: true, initial: false }),
      armorValue: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      notes: new fields.HTMLField({ required: false, blank: true, initial: "" })
    };
  }
}

function actorSchema() {
  const fields = foundry.data.fields;

  return {
    archetype: new fields.StringField({ required: false, blank: true, initial: "" }),
    origin: new fields.StringField({ required: false, blank: true, initial: "" }),
    description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
    history: new fields.HTMLField({ required: false, blank: true, initial: "" }),
    level: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
    portrait: new fields.SchemaField({
      x: new fields.NumberField({ required: true, integer: true, min: 0, max: 100, initial: 50 }),
      y: new fields.NumberField({ required: true, integer: true, min: 0, max: 100, initial: 35 }),
      scale: new fields.NumberField({ required: true, min: 1, max: 2.5, initial: 1 })
    }),
    resources: new fields.SchemaField({
      pv: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 })
      }),
      armure: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      })
    }),
    aptitudeValues: new fields.ObjectField({ required: false, initial: {} }),
    commonSkillValues: new fields.ObjectField({ required: false, initial: {} }),
    specialSkills: new fields.ArrayField(
      new fields.SchemaField({
        id: new fields.StringField({ required: true, blank: false }),
        name: new fields.StringField({ required: true, blank: false, initial: "Nouvelle competence" }),
        description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
        value: new fields.NumberField({ required: true, integer: true, min: 1, max: 100, initial: 30 })
      }),
      { required: false, initial: [] }
    ),
    currencies: new fields.ObjectField({ required: false, initial: {} }),
    customStates: new fields.ObjectField({ required: false, initial: {} }),
    rollModifiers: new fields.ObjectField({ required: false, initial: {} })
  };
}
