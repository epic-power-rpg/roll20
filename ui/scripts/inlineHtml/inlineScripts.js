'use strict';
/**
 * See also: https://wiki.roll20.net/Sheet_Worker_Scripts#setAttrs.28values.2Coptions.2Ccallback.29
 */
// ----- Utilities -----
const removeNonNumeric = function (s) {
  return String(s).trim().replace(/[^\d.-]/g, '');
}

const convertToFloat = function (s) {
  let str = removeNonNumeric(s);
  if (!str) {
    return 0;
  } else {
    let f = parseFloat(str);
    if (isNaN(f)) {
      return 0;
    } else {
      return f;
    }
  }
};

const roundToTwoPlaces = function (s) {
  return Math.floor(s * 100) / 100;
};

const sumValues = function (value_map) {
  return Object.values(value_map).reduce(
    (accum, b) => accum + convertToFloat(b), 0);
};

const isEmptyValue = function (value) {
  return value === undefined || value.trim() === '';
};

// Add up the total cost for repeating_<section>:<name>FP
// and put it in <section>_total_FP
const updateTotalFP = function (section, name) {
  if (name === undefined) { name = section; }
  getSectionIDs(section, function (ids) {
    let FP_fields = ids.map(id => `repeating_${section}_${id}_${name}FP`);
    getAttrs(FP_fields, function (fps) {
      let update = {};
      update[section + '_total_FP'] = sumValues(fps);
      setAttrs(update);
    });
  });
};

// Add up the total cost for repeating_<section>:<name>CP
// and put it in <section>_total_CP
const updateTotalCP = function (section, name) {
  if (name === undefined) { name = section; }
  getSectionIDs(section, function (ids) {
    let CP_fields = ids.map(id => `repeating_${section}_${id}_${name}CP`);
    getAttrs(CP_fields, function (cps) {
      let update = {};
      update[section + '_total_CP'] = sumValues(cps);
      setAttrs(update);
    });
  });
};


const getSectionIDsOrdered = function (sectionName, callback) {
  const order_name = `_reporder_repeating_${sectionName}`;
  getAttrs([order_name], function (v) {
    getSectionIDs(sectionName, function (idArray) {
      let reporderArray = (v[order_name] ?
          v[order_name].toLowerCase().split(',') :
          []),
        still_present = reporderArray.filter(x => idArray.includes(x));
      callback([...new Set(still_present.concat(idArray))]);
    });
  });
};

// ----- Top action and roll -----

const toggleSavePending = function () {
  getAttrs(['save_pending'],
    function (values) {
      let new_value = Number(values['save_pending']) ? 0 : 1;
      setAttrs({ 'save_pending': new_value });
    });
};
on('clicked:saveroll', toggleSavePending);

const roll_keys = ['action_description', 'action_feats',
  'action_EP', 'action_SP',
  'roll_skill', 'roll_ability',
  'roll_mod1', 'roll_mod2', 'roll_mod3',
  'roll_advance_boost'];

const saveRollState = function (key, roll_chosen) {
  getAttrs(roll_keys,
    function (values) {
      let update = {
        'save_pending': 0,
        'roll_chosen': roll_chosen
      };
      // We write the values in a fixed order, so we can do equality
      // checks.
      update[key] = JSON.stringify(values, roll_keys);
      setAttrs(update);
    });
};

const loadRollState = function (key, roll_chosen) {
  getAttrs([key],
    function (values) {
      if (values[key] !== '') {
        let change = JSON.parse(values[key]);
        change['roll_chosen'] = roll_chosen;
        setAttrs(change);
        return true;
      } else {
        return false;
      }
    });
};

const checkRollChosen = function () {
  getAttrs(['roll_chosen'], function (values) {
    let roll_chosen = Number(values['roll_chosen']);
    if (roll_chosen) {
      let saved_roll = 'saved_roll_' + roll_chosen;
      getAttrs(roll_keys.concat([saved_roll]), function (values) {
        let saved = values[saved_roll];
        let current = JSON.stringify(values, roll_keys);
        if (saved !== current) {
          setAttrs({ 'roll_chosen': '' });
        }
      });
    }
  });
};
on(roll_keys.map(name => 'change:' + name).join(' '), checkRollChosen);

const doChooseRoll = function (number) {
  let saved_roll = 'saved_roll_' + number;
  getAttrs(['save_pending'], function (values) {
    if (Number(values['save_pending'])) {
      saveRollState(saved_roll, number);
    } else {
      loadRollState(saved_roll, number);
    }
  });
};
const roll_choices = ['1', '2', '3', '4', '5', '6'];
roll_choices.forEach(function (value) {
  on(`clicked:choose_roll_${value}`, function () { doChooseRoll(value); });
});

const topActionDeltas = function (values) {
  let action_feats = Number(values['action_feats']);
  let feats_EP = action_feats;
  let action_EP = Number(values['action_EP']);
  let action_SP = Number(values['action_SP']);
  return {
    'EPS': (action_feats !== 0 ? [-feats_EP] : []).concat(
      (action_EP !== 0 ? [-action_EP] : [])),
    'SPS': action_SP !== 0 ? [-action_SP] : []
  };
};

const topRollDeltas = function (values) {
  let advance_boost = Number(values['roll_advance_boost']);
  let boost_EP = advance_boost;
  return {
    'EPS': advance_boost !== 0 ? [-boost_EP] : [],
    'SPS': []
  };
};

const addDeltas = function (deltas1, deltas2) {
  return {
    'EPS': deltas1['EPS'].concat(deltas2['EPS']),
    'SPS': deltas1['SPS'].concat(deltas2['SPS'])
  };
};

const multiplyDeltas = function (deltas, multiplier) {
  return {
    'EPS': deltas['EPS'].map(x => x * multiplier),
    'SPS': deltas['SPS'].map(x => x * multiplier)
  };
};

const modifiersToTotal = function (modifiers) {
  return modifiers.reduce((accum, modifier) => accum + modifier,
    0);
};

const modifiersToString = function (modifiers) {
  return modifiers.reduce(function (accum, modifier) {
    if (modifier === 0) {
      return accum;
    } else if (modifier > 0) {
      return accum + '+' + String(modifier);
    } else {
      return accum + String(modifier);
    }
  },
  '');
};

const isLegalUpdate = function (current, deltas) {
  return ((-modifiersToTotal(deltas['EPS']) <= Number(current['EP_t']))
    && (-modifiersToTotal(deltas['SPS']) <= Number(current['SP'])));
};

const makeUpdate = function (current, deltas) {
  let EP_delta = modifiersToTotal(deltas['EPS']);
  const current_EP_t = Number(current['EP_t']);
  const EP_t_max = Number(current['EP_t_max']);
  const new_EP_t = Math.max(0, Math.min(EP_t_max * 2, current_EP_t + EP_delta));
  // log("EP_delta " + EP_delta + "  current_EP_t " + current_EP_t);
  // log("EP_t_max " + EP_t_max + "  new_EP_t" + new_EP_t);
  return {
    'EP_t': new_EP_t,
    'SP': Number(current['SP']) + modifiersToTotal(deltas['SPS'])
  };
};

const deltasDescription = function (deltas) {
  let description = '';
  if (deltas['EPS'].length) {
    description = (description + ' ('
      + modifiersToString(deltas['EPS']) + ' EP)');
  }
  if (deltas['SPS'].length) {
    description = (description + ' ('
      + modifiersToString(deltas['SPS']) + ' SP)');
  }
  return description;
};

const doTopAction = function () {
  getAttrs(['EP_t', 'EP_t_max', 'SP',
    'action_description', 'action_feats',
    'action_EP', 'action_SP'],
  function (values) {
    let deltas = topActionDeltas(values);
    let update = makeUpdate(values, deltas);
    update['pendingchat'] = (values['action_description']
        + deltasDescription(deltas));
    setAttrs(update);
  });
};
on('clicked:topaction', doTopAction);

const undoTopAction = function () {
  getAttrs(['EP_t', 'EP_t_max', 'SP',
    'action_feats', 'action_EP', 'action_SP'],
  function (values) {
    let deltas = multiplyDeltas(topActionDeltas(values), -1);
    let update = makeUpdate(values, deltas);
    let restored = deltasDescription(deltas);
    if (restored !== '') {
      update['pendingchat'] = 'Undo restoring' + restored;
    }
    setAttrs(update);
  });
};
on('clicked:undotopaction', undoTopAction);

const topRollCommand = function (values) {
  let ability = Number(values['roll_ability']);
  let modifiers = [Number(values['roll_mod1']),
    Number(values['roll_mod2']),
    Number(values['roll_mod3']),
    Number(values['roll_advance_boost'])];
  let base = ability + modifiersToTotal(modifiers);
  let description = (values['roll_skill'] + ' '
    + String(ability) + modifiersToString(modifiers));
  return '!EPRoll ' + String(base) + ' Tries ' + description;
};

const doTopRoll = function () {
  getAttrs(['EP_t', 'EP_t_max', 'SP',
    'action_description', 'action_feats',
    'action_EP', 'action_SP',
    'roll_skill', 'roll_ability',
    'roll_mod1', 'roll_mod2', 'roll_mod3', 'roll_advance_boost'],
  function (values) {
    let deltas = addDeltas(topActionDeltas(values),
      topRollDeltas(values));
    let update = makeUpdate(values, deltas);
    let description = (values['action_description']
        + deltasDescription(deltas));
    if (description !== '') {
      description = description + '\n';
    }
    update['pendingchat'] = description + topRollCommand(values);
    setAttrs(update);
  });
};
on('clicked:toproll', doTopRoll);

const undoTopRoll = function () {
  getAttrs(['EP_t', 'EP_t_max', 'SP',
    'action_feats', 'action_EP', 'action_SP',
    'roll_advance_boost'],
  function (values) {
    let deltas = multiplyDeltas(addDeltas(topActionDeltas(values),
      topRollDeltas(values)),
    -1);
    let update = makeUpdate(values, deltas);
    let restored = deltasDescription(deltas);
    if (restored !== '') {
      update['pendingchat'] = 'Undo restoring' + restored;
    }
    setAttrs(update);
  });
};
on('clicked:undotoproll', undoTopRoll);

const EP_ROLL_OPTIONS = [{
  actionId: 'epRoll',
  attributes: [],
  getChatMessage: () => {
    return '!EPRoll';
  },
}, {
  actionId: 'epRoll_roll_modifier',
  attributes: ['roll_modifier'],
  getChatMessage: (values) => {
    const { roll_modifier } = values;
    return `!EPRoll ${roll_modifier}`;
  },
}, {
  actionId: 'epRoll_initiative',
  attributes: ['initiative', 'initiativemodifier', 'character_id'],
  getChatMessage: (values) => {
    const { initiative, initiativemodifier, character_id } = values;
    return `!EPRoll ${initiative}+${initiativemodifier} Rolls initiative ${initiative} + ${initiativemodifier} SEND_TO_TRACKER ${character_id}`;
  },
}, {
  actionId: 'epRoll_IQmodifier',
  attributes: ['IQ', 'IQmodifier'],
  getChatMessage: (values) => {
    const { IQ, IQmodifier } = values;
    return `!EPRoll ${IQ}+${IQmodifier} Tries to be smart: ${IQ} + ${IQmodifier}`;
  },
}, {
  actionId: 'epRoll_DXmodifier',
  attributes: ['DX', 'DXmodifier'],
  getChatMessage: (values) => {
    const { DX, DXmodifier } = values;
    return `!EPRoll ${DX}+${DXmodifier} Tries to be nimble: ${DX} + ${DXmodifier}`;
  },
}, {
  actionId: 'epRoll_BRmodifier',
  attributes: ['BR', 'BRmodifier'],
  getChatMessage: (values) => {
    const { BR, BRmodifier } = values;
    return `!EPRoll ${BR}+${BRmodifier} Tries to be strong: ${BR} + ${BRmodifier}`;
  },
}];

EP_ROLL_OPTIONS.forEach((rollOption) => {
  const { actionId, attributes, getChatMessage } = rollOption;
  on(`clicked:${actionId}`, () => {
    getAttrs(attributes, (values) => {
      setAttrs({ pendingchat: getChatMessage(values) });
    });
  });
});

const updateTopActEnables = function () {
  log('Updating top action enables');
  getAttrs(['EP_t', 'SP',
    'action_feats', 'action_EP', 'action_SP', 'roll_advance_boost'],
  function (values) {
    let top_action_deltas = topActionDeltas(values);
    let top_roll_deltas = addDeltas(topActionDeltas(values),
      topRollDeltas(values));
    log(values);
    log(top_action_deltas);
    let update = {
      'disable_do':
          isLegalUpdate(values, top_action_deltas) ? '0' : '1',
      'disable_do_and_roll':
          isLegalUpdate(values, top_roll_deltas) ? '0' : '1'
    };
    log(update);
    setAttrs(update);
  });
};

on(
  'change:ep_t ' +
  'change:sp ' +
  'change:action_feats ' +
  'change:action_ep ' +
  'change:action_sp ' +
  'change:roll_advance_boost',
  updateTopActEnables);

// ----- EP_t, and SP ----
const updateEP = function () {
  const power = 'power';
  const EP_t_max = 'EP_t_max';
  const SP_max = 'SP_max';
  getAttrs([power, EP_t_max, SP_max], function (values) {
    let power_v = Number(values[power]);
    const EP_t_max_v = Number(values[EP_t_max]);
    const SP_max_v = Number(values[SP_max]);
    const power_points = (power_v < 6 ?
      power_v :
      Math.floor(5 * (Math.sqrt(power_v - 1) - 1)));
    const new_SP_max = Math.floor((power_points - 3 * EP_t_max_v) / 2);
    // We get called from spurrios changes to SP_max,
    // So only reset all the values if something actually changed.
    log('EP_t: ' + EP_t_max_v + '  SP: ' + SP_max_v
      + '  new SP: ' + new_SP_max);
    if (new_SP_max !== SP_max_v) {
      setAttrs({
        'EP_t': EP_t_max_v,
        'SP_max': new_SP_max,
        'SP': new_SP_max
      });
    }
  });
};
on('change:power change:ep_t_max', updateEP);

const fixPower = function () {
  const power = 'power';
  const EP_max = 'EP_max';
  const SP_max = 'SP_max';
  getAttrs([power, EP_max, SP_max], function (values) {
    let power_v = Number(values[power]);
    const EP_max_v = Number(values[EP_max]);
    const SP_max_v = Number(values[SP_max]);
    // Set power to EP if we have an old sheet, where it wasn't set yet.
    if (power_v === 0 && SP_max_v === 0 && EP_max_v > 0) {
      power_v = EP_max_v;
    }
    setAttrs({ 'power': power_v }, null, updateEP);
  });
};
on('sheet:opened', fixPower);

// ----- Tab navigation -----
['overview', 'basic', 'equipment', 'skills', 'spells', 'notes'].forEach(
  button => {
    on(`clicked:${button}`, function () {
      setAttrs({ chosentab: button });
    });
  });

// ----- Popovers -----
// Close all popovers on page load
function closePopovers() {
  setAttrs({ chosenPopover: 'false' });
}
on('sheet:opened', closePopovers);
['weightPenalties', 'addBaseSkills'].forEach(
  popoverToToggle => {
    on(`clicked:popover_${popoverToToggle}`, function () {
      getAttrs(['chosenPopover'], (attributes) => {
        const { chosenPopover } = attributes;
        setAttrs({ chosenPopover: chosenPopover === popoverToToggle ? 'false' : popoverToToggle });
      });
    });
  });

function setupSpellNotes(spellDomain) {
  function closeAllSpellNotes() {
    getSectionIDs(`repeating_${spellDomain}`, function (ids) {
      console.log('*** Close all spell notes ***');
      ids.forEach((id) => {
        setAttrs({ [`repeating_${spellDomain}_${id}_visiblepopover`]: 'false' });
      });
    });
  }

  on('sheet:opened', closeAllSpellNotes);

  on(`clicked:repeating_${spellDomain}:togglepopoverspellnote`, function () {
    closeAllSpellNotes();
    getAttrs([`repeating_${spellDomain}_visiblepopover`], (attributes) => {
      const { [`repeating_${spellDomain}_visiblepopover`]: visiblePoppover } = attributes;
      setAttrs({ [`repeating_${spellDomain}_visiblepopover`]: visiblePoppover === 'false' ? '1' : 'false' });
    });
  });

  on(`clicked:repeating_${spellDomain}:closepopoverspellnotes`, closeAllSpellNotes);
}
['arcane', 'divine', 'innate'].forEach(setupSpellNotes);

// ----- Focus points -----
const updateFP = function () {
  const CP = 'CP';
  // const FP = 'FP';
  getAttrs([CP], function (values) {
    const FP_v = Math.floor(Number(values[CP]) / 5);
    setAttrs({ 'FP': FP_v });
  });
};
on('change:cp sheet:opened', updateFP);

// ----- Attribute costs -----
const updateAttributeCost = function () {
  getAttrs(['IQ', 'DX', 'BR'], function (attributes) {
    const IQ = Number(attributes.IQ);
    const DX = Number(attributes.DX);
    const BR = Number(attributes.BR);
    const total = IQ + DX + BR;
    const total_squares = IQ ** 2 + DX ** 2 + BR ** 2;
    let cost = '??';
    if (total === 3) {
      if (total_squares === 3) {
        cost = -2;
      } else if (total_squares === 5) {
        cost = 0;
      } else if (total_squares <= 9) {
        cost = 4;
      }
    }
    setAttrs({
      displayed_attribute_CP: String(cost),
      attribute_CP: cost === '??' ? 0 : cost
    });
  });
};
on('change:iq change:dx change:br', updateAttributeCost);

// ----- Advantage and disadvantage costs -----
const advantageCosts = {
  healthy: 2,
  packmule: 2,
  strongarms: 3,
  brute: 1,
  fast: 2,
  athlete: 1,
  alert: 1,
  wary: 1,
  attractive: 1,
  mage: 3,
  devout: 3,
};
// const advantageNameTranslations = {
//   packmule: 'Pack Mule',
//   strongarms: 'Strong Arms',
//   athlete: 'Natural Athlete',
// };

// Advantages used to be stored as _plus or _minus, rather than as _count.
// Go through all of those, transfer them to _count, and eliminate them.
const migrateAdvantages = function () {
  const fixed_advantage_prefixes = Object.keys(advantageCosts).map(
    advantage => 'advantage_' + advantage + '_');
  const fixed_advantage_plus_fields = fixed_advantage_prefixes.map(
    prefix => prefix + 'plus');
  const fixed_advantage_minus_fields = fixed_advantage_prefixes.map(
    prefix => prefix + 'minus');
  getAttrs(fixed_advantage_plus_fields.concat(fixed_advantage_minus_fields),
    function (attributes) {
      const update = {};
      for (const advantage of Object.keys(advantageCosts)) {
        const prefix = 'advantage_' + advantage + '_';
        for (const polarity of ['plus', 'minus']) {
          if (Number(attributes[prefix + polarity]) === 1) {
            update[prefix + 'count'] = polarity === 'plus' ? '1' : '-1';
            update[prefix + polarity] = '0';
          }
        }
      }
      if (Object.keys(update).length > 0) {
        setAttrs(update);
        updateAdvantagesCosts();
      }
    });
};
on('sheet:opened', migrateAdvantages);

// Given a array, where each element is an advantage object containing:
//   {base_cost, count}
// update the objects in the array to also contain a cost_description
// property, which will be a string like "3" or "2*4", that describes
// how the cost of that advantage was computed.
// Return the total of all the costs.
// The order of the elements of the array may be changed by the function.
const calculateAdvantageCosts = function (advantages) {
  log('Calculating');
  // Sort them from most expensive to least.
  advantages.sort(function (a, b) { return b.base_cost - a.base_cost; });
  let seen = 0; // the number of positive advantages we have seen so far
  let total_cost = 0;
  for (const advantage of advantages) {
    const base_cost = Number(advantage.base_cost);
    const count = advantage.count;
    if (count < 0) {
      total_cost += -(base_cost / 2);
      advantage.cost_description = '-' + String(base_cost) + '/2';
    } else if (count > 0) {
      if (base_cost <= 0) {
        total_cost += base_cost;
        advantage.cost_description = String(base_cost);
      } else {
        const multiplier = (seen + 1 + seen + count) * count / 2;
        total_cost += base_cost * multiplier;
        if (multiplier === 1) {
          advantage.cost_description = String(base_cost);
        } else {
          advantage.cost_description = (
            String(multiplier) + '×' + String(base_cost));
        }
        seen = seen + count;
      }
    } else {
      advantage.cost_description = ' ';
    }
  }
  total_cost = Math.ceil(total_cost); // If any fractional disadvantages were left over, truncate the benefit.
  log('Total cost ' + String(total_cost));
  log('Advantages ' + JSON.stringify(advantages));
  return total_cost;
};

const updateAdvantagesCosts = function () {
  const fixed_advantage_prefixes = Object.keys(advantageCosts).map(
    advantage => 'advantage_' + advantage + '_');
  const fixed_advantage_count_fields = fixed_advantage_prefixes.map(
    prefix => prefix + 'count');
  getSectionIDs('extraadvantage', function (extra_ids) {
    const extra_advantage_cost_fields = extra_ids.map(
      id => 'repeating_extraadvantage_' + id + '_extraadvantageCP');
    getAttrs(fixed_advantage_count_fields.concat(extra_advantage_cost_fields),
      function (attributes) {
        const fixed_advantages = Object.keys(advantageCosts).map(
          function (advantage) {
            const prefix = 'advantage_' + advantage + '_';
            return {
              description_key: prefix + 'CPdescription',
              base_cost: advantageCosts[advantage],
              count: Number(attributes[prefix + 'count'])
            };
          });
        const extra_advantages = extra_ids.map(
          function (extra_id) {
            const prefix = 'repeating_extraadvantage_' + extra_id + '_';
            return {
              description_key: prefix + 'extraadvantageCPdescription',
              base_cost: Number(attributes[prefix + 'extraadvantageCP']),
              count: 1
            };
          });
        const advantages = fixed_advantages.concat(extra_advantages);
        const total_cost = calculateAdvantageCosts(advantages);
        const update = { advantage_total_CP: total_cost };
        for (const advantage of advantages) {
          update[advantage.description_key] = advantage.cost_description;
        }
        setAttrs(update);
      });
  });
};

on(Object.keys(advantageCosts).map(
  advantage => `change:advantage_${advantage}_count`
).join(' '),
updateAdvantagesCosts);

on((
  'change:repeating_extraadvantage:extraadvantageCP ' +
  'remove:repeating_extraadvantage'),
updateAdvantagesCosts);

const updateHPMax = function () {
  const BR = 'BR';
  const healthy = 'advantage_healthy_count';
  getAttrs([BR, healthy], function(values) {
    const effective_BR = (
      Number(values[BR]) +
      Number(values[healthy]));
    const max_hp = (effective_BR <= -3 ?
      8 + effective_BR :
      12 + effective_BR * (effective_BR + 7) / 2);
    setAttrs({ 'HP_max': max_hp });
  });
};
on('change:br change:advantage_healthy_count sheet:opened',
  updateHPMax);

const reset_EP_t = function () {
  const EP_t = 'EP_t';
  const EP_t_max = 'EP_t_max';
  getAttrs([EP_t, EP_t_max], function (values) {
    const EP_t_max_v = Number(values[EP_t_max]);
    setAttrs({ EP_t: EP_t_max_v + Math.min(EP_t_max_v, Number(values[EP_t])) });
  });
};
on('clicked:reset_ep_t', reset_EP_t);

const convertSP = function () {
  const EP_t = 'EP_t';
  const SP = 'SP';
  getAttrs([EP_t, SP], function (attributes) {
    let EP_t_v = Number(attributes[EP_t]);
    let SP_v = Number(attributes[SP]);
    if (SP_v > 0) {
      setAttrs({
        'EP_t': EP_t_v + 2,
        'SP': SP_v - 1
      });
    }
  });
};
on('clicked:convert_sp', convertSP);

const reset_SP = function () {
  const SP_max = 'SP_max';
  getAttrs([SP_max], function (values) {
    setAttrs({ 'SP': values[SP_max] });
  });
};
on('clicked:reset_sp', reset_SP);

const reset_HP = function () {
  const HP_max = 'HP_max';
  getAttrs([HP_max], function (values) {
    setAttrs({ 'HP': values[HP_max] });
  });
};
on('clicked:reset_hp', reset_HP);


// ----- Epic Feats -----

// Set E for extraordinary
on('change:repeating_feat:featextraordinary', function () {
  getAttrs(['repeating_feat_featextraordinary'], function (values) {
    const letter = (
      values.repeating_feat_featextraordinary === '1' ? 'E' : ' ');
    setAttrs({ 'repeating_feat_featextraordinaryletter': letter });
  });
});

on('change:repeating_feat:featcp remove:repeating_feat',
  function () { updateTotalCP('feat'); });

// Set default CP cost
// There is no event for a row being added, so new rows start out with
// empty cost. Then we set it to the usual 4 when a feat name is entered.
on('change:repeating_feat:featname', function (event) {
  let prev_name = event.previousValue;
  const new_name = event.newValue;
  // When a new row is filled in for the first time, previousValue
  // comes back as the new value.
  if (prev_name === new_name) { prev_name = undefined; }
  if (isEmptyValue(prev_name) !== isEmptyValue(new_name)) {
    let field_name_parts = event.sourceAttribute.split('_');
    field_name_parts.pop();
    field_name_parts.push('featCP');
    const CP_field = field_name_parts.join('_');
    getAttrs([field_name_parts.join('_')], function (values) {
      const prev_CP_cost = values[CP_field];
      if (isEmptyValue(prev_CP_cost) === isEmptyValue(prev_name)) {
        let default_value = {};
        default_value[CP_field] = isEmptyValue(new_name) ? '0' : '1';
        setAttrs(default_value);
      }
    });
  }
});

function isValueDefined(value) {
  return value !== null && value !== undefined;
}
// -------- Skills ---------

function updateUserStatistics() {
  getAttrs(['race'], (attrs) => {
    const { race } = attrs;
    getSectionIDs('skill', (ids) => {
      const skillCount = ids.length;
      setAttrs({
        skillCount,
        isNewUser: skillCount === 0 && !race,
      });
    });
  });
}
// The change:repeating_skill:skillname catches new skills.
on('change:race change:repeating_skill:skillname remove:repeating_skill ', updateUserStatistics);

function updateEffectiveness() {
  getAttrs(['EP', 'SP', 'HP', 'highest_weapon_damage', 'highest_attack',
            'current_dodge_with_armor', 'current_parry_with_armor', 'current_block_with_armor'], (attrs) => {
    const attack = getValidNumber(attrs['highest_attack']);
    const defense = Math.max(getValidNumber(attrs['current_dodge_with_armor']),
                             getValidNumber(attrs['current_parry_with_armor']),
                             getValidNumber(attrs['current_block_with_armor']));
    const EP = getValidNumber(attrs['EP']);
    const SP = getValidNumber(attrs['SP']);
    const HP = getValidNumber(attrs['HP']);
    const damage_per_attack = getValidNumber(attrs['highest_weapon_damage']) + 2;
    const enemy_health = 16;
    const damage_per_incoming_attack = 8;
    // The amount of the character's damage the is probably wasted on the attack that takes an enemy down.
    const damage_overshoot = damage_per_attack * (enemy_health + damage_per_attack) / (2*enemy_health + damage_per_attack);
    effectiveness = Math.sqrt(
      2**((attack + defense + 1.2*EP) * 0.315) *
      // Kills per attack
      damage_per_attack / (enemy_health + damage_overshoot) *
      // Attacks to get killed
      (HP / damage_per_incoming_attack +
       damage_per_incoming_attack / (damage_per_incoming_attack + HP) +
       SP));
    setAttrs({'effectiveness': roundToTwoPlaces(effectiveness)});
  });
}
on('change:EP change:SP change:HP change:highest_weapon_damage change:highest_attack' +
   ' change:current_dodge_with_armor change:current_parry_with_armor change:current_block_with_armor' +
   ' sheet:opened',
   updateEffectiveness)

// Calculate these ability values from the skills, modify them for the weight
// penalty if appropriate, and set attributes to record the result:
//    dodge, block, parry, touch_spell, aim_spell, best_attack
// Then update everything that depends on those quantities.
const updateCopiedAbilities = function () {
  const DX = 'DX';
  const weight_penalty = 'weight_penalty';
  getSectionIDsOrdered('skill', function (ids) {
    const disciplineinfoFields = ids.map(
      id => `repeating_skill_${id}_skilldisciplineinfo`);
    const expertiseFields = ids.map(
      id => `repeating_skill_${id}_skillexpertise`);
    const abilityFields = ids.map(
      id => `repeating_skill_${id}_skillability`);
    const nameFields = ids.map(
      id => `repeating_skill_${id}_skillname`);
    getAttrs(disciplineinfoFields.concat(expertiseFields)
      .concat(abilityFields).concat(nameFields)
      .concat([DX, weight_penalty]), function (values) {
      const DX_n = Number(values[DX]);
      const weight_penalty_n = Number(values[weight_penalty]);
      // Find the ability of the best attack: the highest skill under the attack
      // discipline.
      let best_attack = -5;
      let under_attack_discipline = false;
      for (let i = 0; i < ids.length; ++i) {
        if (values[disciplineinfoFields[i]] === 'D') {
          under_attack_discipline = values[nameFields[i]].toLowerCase().trim() === 'attack';
        } else {
          if (values[disciplineinfoFields[i]] === '⇡' && under_attack_discipline) {
            // We have a skill under the attack discipline.
            best_attack = Math.max(best_attack, values[abilityFields[i]]);
          }
        }
      }
      console.log('Best attack: ' + best_attack.toString());
      let update = {'best_attack': best_attack};
      // Make a map from skill names to their index.
      let skill_map = _.object(
        nameFields.map(name => values[name].toLowerCase().trim()),
        _.range(ids.length));
      let min_expertises = {};
      for (let discipline of ['defense', 'defend', // Try both ways.
        'attack']) {
        let min_expertise = -5;
        // If the character has the discipline, that gives them
        // a better minimum expertise.
        if (discipline in skill_map) {
          const discipline_index = skill_map[discipline];
          const expertise_v = values[expertiseFields[discipline_index]];
          if (values[disciplineinfoFields[discipline_index]] === 'D'
              && expertise_v !== '--') {
            min_expertise = -2 + Number(expertise_v);
          }
        }
        min_expertises[discipline] = min_expertise;
      }
      // Try to find an ability for each skill.
      for (let skill of ['dodge', 'block', 'parry', 'aim spell', 'spell touch']) {
        // First, get the ability assuming there is no training
        let ability = DX_n + (skill === 'aim spell' ?
          min_expertises['attack'] + 4 :
          skill === 'spell touch' ?
            min_expertises['attack'] + 5 :
            Math.max(
              min_expertises['defense'],
              min_expertises['defend']) - 3);
        let skill_index = skill_map[skill];
        if (isValueDefined(skill_index) && values[disciplineinfoFields[skill_index]] === 'D') {
          skill_index = null;
        }
        // Check for the user using "shield" as an alternative for "block"
        if (!isValueDefined(skill_index) && skill === 'block') {
          skill_index = skill_map['shield'];
          if (isValueDefined(skill_index) && values[disciplineinfoFields[skill_index]] === 'D') {
            skill_index = null;
          }
        }
        if (isValueDefined(skill_index)) {
          ability = Number(values[abilityFields[skill_index]]);
        }
        if (skill === 'dodge' || skill === 'block' || skill === 'parry') {
          ability = ability + weight_penalty_n;
        }
        update[skill.replace(' ', '_')] = ability;
      }
      setAttrs(update);
    });
  });
};
on(
  'change:repeating_skill:skilldisciplineinfo ' +
  'change:repeating_skill:skillexpertise ' +
  'change:repeating_skill:skillability ' +
  'change:repeating_skill:skillname ' +
  'change:DX change:weight_penalty remove:repeating_skill ' +
  'sheet:opened',
  updateCopiedAbilities);

// skilldisciplineexpertise holds the expertise of the discipline that
// applies to the skill. We walk through all the items, in order,
// note which are disciplines (which is used by the CSS),
// and set the discipline expertise of
// all skills to that of the most recent discipline we encountered.
const updateSkillDisciplineExpertises = function (section) {
  getSectionIDsOrdered(section, function (ids) {
    const disciplineinfoFields = ids.map(
      id => `repeating_${section}_${id}_skilldisciplineinfo`);
    const isdisciplineFields = ids.map(
      id => `repeating_${section}_${id}_skillisdiscipline`);
    const expertiseFields = ids.map(
      id => `repeating_${section}_${id}_skillexpertise`);
    const disciplineexpertiseFields = ids.map(
      id => `repeating_${section}_${id}_skilldisciplineexpertise`);
    getAttrs(disciplineinfoFields.concat(isdisciplineFields).concat(expertiseFields)
      .concat(disciplineexpertiseFields),
    function (attributes) {
      let discipline_expertise = 0;
      let update = {};
      for (let i = 0; i < ids.length; ++i) {
        if (attributes[disciplineinfoFields[i]] === 'D') {
          discipline_expertise = attributes[expertiseFields[i]];
          if (attributes[isdisciplineFields[i]] !== '1') {
            update[isdisciplineFields[i]] = '1';
          }
        } else {
          if (attributes[isdisciplineFields[i]] !== '0') {
            update[isdisciplineFields[i]] = '0';
          }
          let this_discipline_expertise = 0;
          if (attributes[disciplineinfoFields[i]] === '⇡') {
            this_discipline_expertise = discipline_expertise;
          }
          if (this_discipline_expertise !== attributes[disciplineexpertiseFields[i]]) {
            update[disciplineexpertiseFields[i]] = this_discipline_expertise;
          }
        }
      }
      if (!_.isEmpty(update)) {
        setAttrs(update);
      }
    });
  });
};

const updateSkillDerivedForId = function (section, row_id) {
  const name = `repeating_${section}_${row_id}_skillname`;
  const disciplineinfo = `repeating_${section}_${row_id}_skilldisciplineinfo`;
  const expertise = `repeating_${section}_${row_id}_skillexpertise`;
  const disciplineexpertise = (
    `repeating_${section}_${row_id}_skilldisciplineexpertise`);
  const attribute = `repeating_${section}_${row_id}_skillattribute`;
  const base = `repeating_${section}_${row_id}_skillbase`;
  const fp = `repeating_${section}_${row_id}_skillFP`;
  const cp = `repeating_${section}_${row_id}_skillCP`;
  const ability = `repeating_${section}_${row_id}_skillability`;
  const mage = 'advantage_mage_count';
  const devout = 'advantage_devout_count';
  getAttrs([name, disciplineinfo, expertise, disciplineexpertise,
    attribute, base, 'IQ', 'DX', 'BR', mage, devout],
  function (values) {
    // Update FP and CP costs
    let update = {};
    if (values[disciplineinfo] === 'D') {
      const cost = ({
        '--': 0,
        'ST': 0,
        'B': 0,
        '-1': 0, // This shouldn't appear any more. But it might be left over from old characters.
        '0': 1,
        '1': 2,
        '2': 4,
        '3': 7,
        '4': 11,
        '5': 16,
        '6': 22,
        '7': 29,
        '8': 37,
        '9': 46
      }[values[expertise]]);
      update[cp] = cost === 0 ? ' ' : cost;
      update[fp] = ' ';
      // Fix illegal values for expertise of discipline.
      if ({ 'ST': true, 'B': true, '-1': true}[values[expertise]]) {
        update[expertise] = '--';
      }
    } else {
      // Negative values indicate CP cost. Positive indicate FP cost.
      const cost = ({
        '--': 0,
        'ST': 0,
        'B': 0,
        '-1': 0, // This shouldn't appear any more. But it might be left over from old characters.
        '0': -1,
        '1': 1,
        '2': 3,
        '3': 6,
        '4': 10,
        '5': 15,
        '6': 21,
        '7': 28,
        '8': 36,
        '9': 45
      }[values[expertise]]);
      update[cp] = cost >= 0 ? ' ' : -cost;
      update[fp] = cost <= 0 ? ' ' : cost;
      // Get rid of any old -1s, which are no longer an option.
      if ({ '-1': true }[values[expertise]]) {
        update[expertise] = '--';
      }
      // Clear base if it is 0.
      if (values[base] === '0') {
        update[base] = ' ';
      }
      // Update ability
      const expertise_v = values[expertise];
      const attribute_v = values[attribute];
      const disciplineexpertise_v = values[disciplineexpertise];
      const disciplineexpertise_n = (
        disciplineexpertise_v === '--' ? 0 : Number(disciplineexpertise_v));
      const IQ_n = Number(values['IQ']);
      const DX_n = Number(values['DX']);
      const BR_n = Number(values['BR']);
      if (attribute_v === '') {
        update[ability] = '??';
      } else {
        /* eslint-disable indent */
        const attribute_value = (
          attribute_v === 'IQ' ? IQ_n :
          attribute_v === 'DX' ? DX_n :
          attribute_v === 'BR' ? BR_n :
          IQ_n + DX_n);
        const focus = (
          expertise_v === 'ST' ? -1 :
          expertise_v === 'B' ? -1 :
          expertise_v === '--' ? (disciplineexpertise_n === 0 ? -5 : -2) :
          Number(expertise_v));
        /* eslint-enable indent */
        let ability_v = disciplineexpertise_n + focus + attribute_value + Number(values[base]);
        if (section === 'arcane') {
          ability_v += Number(values[mage]) * 2;
        }
        if (values[name].toLowerCase().trim().startsWith('pray')) {
          ability_v += Number(values[devout]) * 2;
        }
        update[ability] = ability_v;
      }
    }
    setAttrs(update);
  });
};

const updateSkillDerived = function (section, event) {
  const row_id = event.sourceAttribute.split('_')[2];
  updateSkillDerivedForId(section, row_id);
  updateTotalFP(section, 'skill');
  updateTotalCP(section, 'skill');
};

const updateAllSkillsDerived = function (section) {
  getSectionIDs(section, function (ids) {
    for (let i = 0; i < ids.length; ++i) {
      updateSkillDerivedForId(section, ids[i]);
    }
    updateTotalFP(section, 'skill');
    updateTotalCP(section, 'skill');
  });
};

on('change:repeating_skill:skilldisciplineinfo' +
  ' change:repeating_skill:skillexpertise' +
  ' change:repeating_skill:skillname' + // Fires for new skill.
  ' remove:repeating_skill' +
  ' change:_reporder:skill',
function () { updateSkillDisciplineExpertises('skill'); });

on('change:repeating_skill:skilldisciplineinfo' +
  ' change:repeating_skill:skillexpertise' +
  ' change:repeating_skill:skilldisciplineexpertise' +
  ' change:repeating_skill:skillattribute' +
  ' change:repeating_skill:skillbase',
function (event) { updateSkillDerived('skill', event); });

on('change:IQ change:DX change:advantage_mage_count'
  + ' change:advantage_devout_count',
function () { updateAllSkillsDerived('skill'); });

on('remove:repeating_skill',
  function () {
    updateTotalFP('skill');
    updateTotalCP('skill');
  });

function createBaseSkillsAttributes() {
  const section = 'skill';
  const newAttributes = {};
  function addNewAttributeRow(attributesBySuffix) {
    const rowId = generateTrulyUniqueRowId();
    Object.keys(attributesBySuffix).forEach((attributeName) => {
      newAttributes[`repeating_${section}_${rowId}_${attributeName}`] = attributesBySuffix[attributeName];
    });
  }
  function addNewDiscipline(skillname, props) {
    addNewAttributeRow({
      skilldisciplineinfo: 'D',
      skillname,
      ...props,
    });
  }
  function addNewSkill(skillname, props) {
    addNewAttributeRow({
      skilldisciplineinfo: '⇡',
      skillname,
      ...props,
    });
  }
  addNewDiscipline('People');
  addNewSkill('Language(Common)', { skillattribute: 'IQ', skillexpertise: 'ST' });
  addNewSkill('Persuade', { skillattribute: 'IQ', skillexpertise: 'ST' });
  addNewSkill('People Insight', { skillattribute: 'IQ', skillexpertise: 'ST' });
  addNewDiscipline('Defense', { skillexpertise: 1 });
  addNewSkill('Dodge', { skillattribute: 'DX', skillexpertise: '1', skillbase: -3 });
  addNewSkill('Resolve', { skillattribute: 'IQ', skillexpertise: 'ST', skillbase: 0 });
  addNewSkill('Fortitude', { skillattribute: 'BR', skillexpertise: 'ST', skillbase: 0 });
  addNewDiscipline('Attack', { skillexpertise: 1 });
  addNewSkill('Your Weapon', { skillattribute: 'DX', skillexpertise: '1', skillbase: 0 });
  return newAttributes;
}

on('clicked:addbaseskills', () => {
  setAttrs(createBaseSkillsAttributes(), () => {
    console.log('Added attributes. The sheet auto-calculates after this.');
    closePopovers();
  });
});
// -------------- Equipment -------------

function getValidNumber(stringValue) {
  const value = Number(stringValue);
  if (Number.isNaN(value)) {
    return 0;
  }
  return value;
}

// Given the contents of a weapon damage field, return the base damage.
// That is the whole field, if it is a number, otherwise, it's the part before the '+'.
const baseDamage = function(representation) {
  as_number = getValidNumber(representation);
  return as_number ? as_number : getValidNumber(representation.split('+')[0]);
}

// Update the derived properties: highest_weapon_defense and highest_weapon_damage.
const updateCopiedWeaponInfo = function () {
  getSectionIDs('weapon', function (ids) {
    const defenseFields = ids.map(
      id => `repeating_weapon_${id}_weapondefense`);
    const damageFields = ids.map(
      id => `repeating_weapon_${id}_weapondamage`);
    const countFields = ids.map(
      id => `repeating_weapon_${id}_weaponcount`);
    getAttrs([...defenseFields, ...damageFields, ...countFields], function (values) {
      let update = {};
      update['highest_weapon_defense'] = _.range(ids.length).reduce((memo, i) => {
        const defense = getValidNumber(values[defenseFields[i]]);
        const count = getValidNumber(values[countFields[i]]);
        if (defense > 0 && count > 0) {
          return Math.max(memo, defense);
        }
        return memo;
      }, 0);
      update['highest_weapon_damage'] = _.range(ids.length).reduce((memo, i) => {
        const damage = baseDamage(values[damageFields[i]]);
        const count = getValidNumber(values[countFields[i]]);
        if (damage > 0 && count > 0) {
          return Math.max(memo, damage);
        }
        return memo;
      }, -5);
      console.log('highest weapon defense: ' + update['highest_weapon_defense'].toString() +
        ' highest weapon damage: ' + update['highest_weapon_damage'].toString());
      setAttrs(update);
    });
  });
}
on('change:repeating_weapon:weaponcount change:repeating_weapon:weapondefense' +
   ' change:repeating_weapon:weapondamage remove:repeating_weapon',
updateCopiedWeaponInfo);

const updateDefenseValues = function () {
  const armorName = 'armor_defense';
  const shieldName = 'shield_defense';
  const defenseBoostName = 'defense_boost';
  const highestWeaponDefenseName = 'highest_weapon_defense'
  const dodgeName = 'dodge';
  const blockName = 'block';
  const parryName = 'parry';
  const reactionPenaltyName = 'reaction_penalty';
  getAttrs([armorName, shieldName, defenseBoostName, highestWeaponDefenseName,
            dodgeName, blockName, parryName, reactionPenaltyName],
    function (values) {
      const cur_armor = getValidNumber(values[armorName]);
      const cur_shield = getValidNumber(values[shieldName]);
      const highestWeaponDefense = getValidNumber(values[highestWeaponDefenseName]);
      const update = {};
      for (let defense of ['dodge', 'block', 'parry']) {
        const defenseIsDodge = defense === 'dodge';
        const defenseIsBlock = defense === 'block';
        const defenseIsParry = defense === 'parry';
        const curDefenseName = defenseIsDodge ? dodgeName : defenseIsBlock ? blockName : parryName;
        const cur_defense = getValidNumber(values[curDefenseName]);
        const base = (
          cur_defense
          + (defenseIsBlock ? cur_shield : 0)
          + (defenseIsParry ? highestWeaponDefense : 0)
          - Math.abs(getValidNumber(values[reactionPenaltyName]))
        );
        const total = base + getValidNumber(values['defense_boost']);
        /**
          * Block is only valid if there is a shield value and Parry is only valid if there is a weapon.
          */
        const blockIsValid = defenseIsBlock && cur_shield;
        const parryIsValid = defenseIsParry && highestWeaponDefense;
        const defenseIsValid = defenseIsDodge || blockIsValid || parryIsValid;
        update[`current_${defense}_without_armor`] = defenseIsValid ? String(total) : '--';
        update[`current_${defense}_with_armor`] = defenseIsValid ? String(total + cur_armor) : '--';
      }
      setAttrs(update);
    });
}
on('change:armor_defense change:shield_defense change:highest_weapon_defense' +
   ' change:dodge change:block change:parry' +
   ' change:defense_boost change:reaction_penalty sheet:opened',
updateDefenseValues);

const updateSpeed = function () {
  const DX = 'DX';
  const fast = 'advantage_fast_count';
  const penalty = 'weight_penalty';
  getAttrs([DX, fast, penalty], function (values) {
    const effective_DX = (Number(values[DX])
      + Number(values[fast]));
    const penalty_n = Number(values[penalty]);
    const DX_reduction = Math.max(0, Math.min(effective_DX,
      Math.floor(-penalty_n / 2)));
    setAttrs({
      'speed':
        Math.max(0, 6 + effective_DX + penalty_n - DX_reduction)
    });
  });
};
on('change:dx change:advantage_fast_count'
  + ' change:weight_penalty sheet:opened',
updateSpeed);

const updateInitiative = function () {
  const IQ = 'IQ';
  const alert = 'advantage_alert_count';
  getAttrs([IQ, alert], function (values) {
    const effective_IQ = (Number(values[IQ])
      + Number(values[alert]));
    setAttrs({ 'initiative': effective_IQ });
  });
};
on('change:iq change:advantage_alert_count'
  + ' sheet:opened',
updateInitiative);

const updateWeightPenalties = function () {
  const weight = 'equipment_total_weight';
  const BR = 'BR';
  const packmule = 'advantage_packmule_count';
  const highlight = function (penalty) {
    return `highlight_weight_penalty_${penalty}`;
  };
  getAttrs([weight, BR, packmule], function (values) {
    const weight_n = convertToFloat(values[weight]);
    const effective_BR = (Number(values[BR])
      + Number(values[packmule]));
    let current_level = 0;
    let update = {};
    for (let level = 1; level <= 6; ++level) {
      const limit = Math.round(((level * level - 1) * 12 / 7 + 8.333)
        * 3 * 2 ** (effective_BR / 3));
      if (weight_n >= limit) { current_level = level; }
      update[`penalty_weight_${level}`] = limit;
      update[highlight(level)] = '0';
    }
    if (current_level !== 0) {
      update[highlight(current_level)] = '1';
    }
    if (current_level === 6) { current_level = 100; }
    update['weight_penalty'] = -current_level;
    update['displayed_weight_penalty'] = (
      current_level === 0 ? ' ' :
        current_level === 100 ? '-∞' :
          -current_level);
    setAttrs(update);
  });
};
on('change:equipment_total_weight' +
  ' change:br' +
  ' change:advantage_packmule_count' +
  ' sheet:opened',
updateWeightPenalties);

const updateTotalX = function (x) {
  const armor = `armor_${x}`;
  const shield = `shield_${x}`;
  const weapons = `weapon_total_${x}`;
  const items = `item_total_${x}`;
  getAttrs([armor, shield, weapons, items], function (values) {
    let update = {};
    update[`equipment_total_${x}`] = roundToTwoPlaces(
      convertToFloat(values[armor]) + convertToFloat(values[shield]) +
      convertToFloat(values[weapons]) + convertToFloat(values[items]));
    setAttrs(update);
  });
};

on('change:armor_weight change:shield_weight' +
  ' change:weapon_total_weight change:item_total_weight',
function () { updateTotalX('weight'); });
on('change:armor_value change:shield_value' +
  ' change:weapon_total_value change:item_total_value',
function () { updateTotalX('value'); });

// Add up the total weight for repeating_<section>:<section><X>
// and put it in <section>_total_<X>
const updateTotalRepeatingX = function (section, x) {
  getSectionIDs(section, function (ids) {
    const x_fields = ids.map(
      id => `repeating_${section}_${id}_${section}${x}`);
    const count_fields = ids.map(
      id => `repeating_${section}_${id}_${section}count`);
    getAttrs(x_fields.concat(count_fields), function (values) {
      let total = 0;
      for (let i = 0; i < ids.length; ++i) {
        total += (convertToFloat(values[x_fields[i]])
          * convertToFloat(values[count_fields[i]]));
      }
      let update = {};
      update[`${section}_total_${x}`] = total;
      setAttrs(update);
    });
  });
};

on('change:repeating_weapon:weaponweight' +
  ' change:repeating_weapon:weaponcount' +
  ' remove:repeating_weapon',
function () { updateTotalRepeatingX('weapon', 'weight'); });
on('change:repeating_weapon:weaponvalue' +
  ' change:repeating_weapon:weaponcount' +
  ' remove:repeating_weapon',
function () { updateTotalRepeatingX('weapon', 'value'); });
on('change:repeating_item:itemweight' +
  ' change:repeating_item:itemcount' +
  ' remove:repeating_item',
function () { updateTotalRepeatingX('item', 'weight'); });
on('change:repeating_item:itemvalue' +
  ' change:repeating_item:itemcount' +
  ' remove:repeating_item',
function () { updateTotalRepeatingX('item', 'value'); });

// -------- Spells ----------
['arcane', 'divine', 'innate'].forEach(button => {
  on(`clicked:${button}`, function () {
    setAttrs({ chosenspelltype: button });
  });
});

on('change:repeating_arcane:skilldisciplineinfo' +
  ' change:repeating_arcane:skillexpertise' +
  ' change:repeating_arcane:skillname' + // Fires for new skill.
  ' remove:repeating_arcane' +
  ' change:_reporder:arcane',
function () { updateSkillDisciplineExpertises('arcane'); });

on('change:repeating_arcane:skilldisciplineinfo' +
  ' change:repeating_arcane:skillexpertise' +
  ' change:repeating_arcane:skilldisciplineexpertise' +
  ' change:repeating_arcane:skillattribute' +
  ' change:repeating_arcane:skillbase',
function (event) { updateSkillDerived('arcane', event); });

on('change:IQ change:advantage_mage_count',
  function () { updateAllSkillsDerived('arcane'); });

on('remove:repeating_arcane',
  function () {
    updateTotalFP('arcane', 'skill');
    updateTotalCP('arcane', 'skill');
  });

on('remove:repeating_innate change:repeating_innate:skillCP',
  function () { updateTotalCP('innate', 'skill'); });


log('!!! SCRIPT LOADED !!!');
