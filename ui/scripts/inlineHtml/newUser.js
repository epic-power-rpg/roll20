// -------- Create New User --------
const OTHER_RACE = 'other';

['human', 'elf', 'dwarf', 'gnome', 'orc', 'minotaur', 'owlin', 'dryad', OTHER_RACE].forEach(function (newUser) {
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
    const attributeValue = attributes[attributeName];
    if (attributeValue !== undefined) {
      newAttributes[`repeating_${section}_${rowId}_${attributeName}`] = attributeValue;
    }
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


function createInnateSpellAttributes(props) {
  const { isSphereAttribute, name, castTime, spellType, range, target, duration, epValue, cpValue } = props;
  return createBaseAttributes({
    section: 'innate',
    attributes: {
      skillinnatesphere: isSphereAttribute ? 'S' : '',
      skillname: name,
      skillEP: epValue,
      spellcasttime: castTime,
      spelltype: spellType,
      spellrange: range,
      spelltarget: target,
      spellduration: duration,
      skillCP: cpValue,
    },
  });
}

const newUserAttributesByRace = {
  human: {},
  elf: {
    ...createFeatAttributes({ featName: 'Low Light Vision', cpValue: 1 }),
    ...createFeatAttributes({ featName: 'Ease of Movement', cpValue: 1 }),
  },
  dwarf: {
    ...createFeatAttributes({ featName: 'Infravision', cpValue: 1 }),
  },
  gnome: {
    ...createFeatAttributes({ featName: 'Infravision', cpValue: 1 }),
  },
  orc: {
    ...createFeatAttributes({ featName: 'Infravision', cpValue: 1 }),
    ...createExtraAdvantageAttributes({ name: 'Not Attractive', cpValue: -1 }),
  },
  minotaur: {
    height: 6.5,
    weight: 200,
    ...createFeatAttributes({ featName: 'Natural Attack', cpValue: 3 }),
  },
  owlin: {
    weight: 100,
    DX: 2,
    ...createFeatAttributes({ featName: 'Low Light Vision', cpValue: 1 }),
    ...createFeatAttributes({ featName: 'Natural Armor', cpValue: 1 }),
    ...createFeatAttributes({ featName: 'Glide', cpValue: 1 }),
  },
  dryad: {
    ...createFeatAttributes({ featName: 'Low Light Vision', cpValue: 1 }),
    ...createFeatAttributes({ featName: 'Natural Armor', cpValue: 3 }),
    ...createExtraAdvantageAttributes({ name: 'Arboreal Connection', cpValue: 0 }),
    ...createExtraAdvantageAttributes({ name: 'Avoid Metal', cpValue: -2 }),
    chosenspelltype: 'innate',
    ...createInnateSpellAttributes({ isSphereAttribute: true, name: 'Nature', cpValue: 2 }),
    ...createInnateSpellAttributes({ name: 'Meld with Tree', target: 'Self', duration: '1 minute', epValue: 2, cpValue: 1 }),
  },
  [OTHER_RACE]: {},
};

on('clicked:confirm_create_new_user', () => {
  getAttrs(['selected_user_race_option'], (values) => {
    const { selected_user_race_option: selectedRace } = values;
    const newUserAttributes = newUserAttributesByRace[selectedRace];
    if (!newUserAttributes) {
      log(`Something went wrong for selectedUserOption: ${selectedRace}`);
      return;
    }
    const racePicked = selectedRace !== OTHER_RACE;
    setAttrs({
      ...createBaseSkillsAttributes(racePicked),
      ...newUserAttributes,
      race: `${selectedRace.charAt(0).toUpperCase()}${selectedRace.slice(1)}`,
      chosentab: 'basic',
    });
  });
});

log('!!! newUser SCRIPT LOADED !!!');
