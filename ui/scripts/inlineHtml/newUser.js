// -------- Create New User --------
['human', 'elf', 'dwarf', 'gnome', 'orc', 'minotaur', 'owlin', 'dryad', 'custom'].forEach(function (newUser) {
  on(`clicked:create_user_pick_${newUser}_option`, () => {
    setAttrs({
      selected_user_race_option: newUser,
    });
  });
});

function createBaseFeatAttributes({ featName, cpValue}) {
  const section = 'feat';
  const newAttributes = {};
  function addNewAttributeRow(attributesBySuffix) {
    const rowId = generateTrulyUniqueRowId();
    Object.keys(attributesBySuffix).forEach((attributeName) => {
      newAttributes[`repeating_${section}_${rowId}_${attributeName}`] = attributesBySuffix[attributeName];
    });
  }
  addNewAttributeRow({
    featname: featName,
    featCP: cpValue,
  });
  return newAttributes;
}
const newUserAttributesByRace = {
  human: {},
  elf: {
    ...createBaseFeatAttributes({ featName: 'Low Light Vision', cpValue: 2 }),
    ...createBaseFeatAttributes({ featName: 'Ease of Movement', cpValue: 2 }),
  },
  dwarf: {
    ...createBaseFeatAttributes({ featName: 'Infravision', cpValue: 2 }),
  },
  gnome: {
    ...createBaseFeatAttributes({ featName: 'Infravision', cpValue: 2 }),
  },
  orc: {
    ...createBaseFeatAttributes({ featName: 'Infravision', cpValue: 2 }),
  },
  minotaur: {},
  owlin: {
    ...createBaseFeatAttributes({ featName: 'Low Light Vision', cpValue: 2 }),
    ...createBaseFeatAttributes({ featName: 'Natural Armor', cpValue: 2 }),
    ...createBaseFeatAttributes({ featName: 'Glide', cpValue: 2 }),
  },
  dryad: {
    ...createBaseFeatAttributes({ featName: 'Low Light Vision', cpValue: 2 }),
    ...createBaseFeatAttributes({ featName: 'Natural Armor', cpValue: 6 }),
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
