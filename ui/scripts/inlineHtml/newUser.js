// -------- Create New User --------
['human', 'elf', 'dwarf', 'gnome', 'orc', 'minotaur', 'owlin', 'dryad', 'custom'].forEach(function (newUser) {
  on(`clicked:create_user_pick_${newUser}_option`, () => {
    setAttrs({
      selected_user_race_option: newUser,
    });
  });
});

function createBaseAttributes({ section, attributes }) {
  const newAttributes = {};
  const rowId = generateTrulyUniqueRowId();
  Object.keys(attributes).forEach((attributeName) => {
    newAttributes[`repeating_${section}_${rowId}_${attributeName}`] = attributes[attributeName];
  });
  return newAttributes;
}

function createFeatAttributes({ featName, cpValue }) {
  return createBaseAttributes({
    section: 'feat',
    attributes: {
      featname: featName,
      featCP: cpValue,
    },
  });
}

function createExtraAdvantageAttributes({ name, cpValue }) {
  return createBaseAttributes({
    section: 'extraadvantage',
    attributes: {
      extraadvantagename: name,
      extraadvantageCP: cpValue,
    },
  });
}


const newUserAttributesByRace = {
  human: {},
  elf: {
    ...createFeatAttributes({ featName: 'Low Light Vision', cpValue: 2 }),
    ...createFeatAttributes({ featName: 'Ease of Movement', cpValue: 2 }),
  },
  dwarf: {
    ...createFeatAttributes({ featName: 'Infravision', cpValue: 2 }),
  },
  gnome: {
    ...createFeatAttributes({ featName: 'Infravision', cpValue: 2 }),
  },
  orc: {
    ...createFeatAttributes({ featName: 'Infravision', cpValue: 2 }),
    ...createExtraAdvantageAttributes({ name: 'Not Attractive', cpValue: -2 }),
  },
  minotaur: {
    height: 6.5,
    weight: 200,
    ...createFeatAttributes({ featName: 'Natural Attack', cpValue: 6 }),
  },
  owlin: {
    weight: 100,
    DX: 2,
    ...createFeatAttributes({ featName: 'Low Light Vision', cpValue: 2 }),
    ...createFeatAttributes({ featName: 'Natural Armor', cpValue: 2 }),
    ...createFeatAttributes({ featName: 'Glide', cpValue: 2 }),
  },
  dryad: {
    ...createFeatAttributes({ featName: 'Low Light Vision', cpValue: 2 }),
    ...createFeatAttributes({ featName: 'Natural Armor', cpValue: 6 }),
    ...createExtraAdvantageAttributes({ name: 'Arboreal Connection', cpValue: 0 }),
    ...createExtraAdvantageAttributes({ name: 'Avoid Metal', cpValue: -4 }),
  },
  custom: {},
};

on('clicked:confirm_create_new_user', () => {
  getAttrs(['selected_user_race_option'], (values) => {
    const { selected_user_race_option: selectedRace } = values;
    const newUserAttributes = newUserAttributesByRace[selectedRace];
    if (!newUserAttributes) {
      log(`Something went wrong for selectedUserOption: ${selectedRace}`);
      return;
    }
    setAttrs({
      ...(createBaseSkillsAttributes()),
      ...newUserAttributes,
      race: `${selectedRace.charAt(0).toUpperCase()}${selectedRace.slice(1)}`,
      chosentab: 'basic',
    });
  });
});

log('!!! newUser SCRIPT LOADED !!!');
