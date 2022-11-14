(function() {
  /**
   * This is a test function that has no effect.
   * Just testing the mergeScripts.sh
   * This is also an example of an IIFE, which allows each script to be self-contained to reduce risks of collisions between scripts.
   */
})();
// eslint-disable-next-line no-unused-vars
const prevEPRoll = function() {
  let total = 0;
  let text = '';
  let any_positive = false;
  let any_negative = false;
  let must_roll = true;
  while (must_roll) {
    must_roll = false;
    const only_positive = any_positive && !any_negative;
    const only_negative = !any_positive && any_negative;
    for (let i = 0; i < 3; i++) {
      const die = randomInteger(6);
      let roll;
      if (die === 6) {
        must_roll = true;
        roll = '\u29C9'; // two joined squares character
      } else {
        roll = die - 3;
        if (only_positive) {
          roll = Math.abs(roll);
        } else if (only_negative) {
          roll = -Math.abs(roll);
        }
        total = total + roll;
        if (roll < 0) {
          any_negative = true;
          roll = '<span style="color:red";>' + roll + '</span>';
        } else if (roll >  0) {
          any_positive = true;
          roll = '<span style="color:blue";>+' + roll + '</span>';
        }
      }
      if (text === '') {
        text = String(roll);
      } else {
        text = `${text}, ${roll}`;
      }
    }
  }
  return {total: total,
    text: text};
};

// Roll a single die, and return its value and text string.
// If required_sign is present, flip any signed values so they agree with it.
const RollDie = function(required_sign) {
  const die = Math.ceil(6 * Math.random());
  let value;
  let text;
  if (die === 6) {
    value = 'two_dice';
    text = '\u29C9'; // two joined squares character
  } else {
    value = die - 3;
    if (required_sign) {
      if (required_sign != Math.sign(value)) {
        value = -value;
      }
    }
    text = value.toString();
    if (value < 0) {
      text = '<span style="color:red";>' + text + '</span>';
    } else if (value >  0) {
      text = '<span style="color:blue";>+' + text + '</span>';
    }
  }
  return [value, text];
};

// Do the EP roll.
const EPRoll = function() {
  let total = 0;
  let description = '';
  let required_sign = null;
  // We start with 2 dice.
  let rolls_needed = 2;
  let rolls_done = 0;
  while (rolls_needed > rolls_done) {
    let [value, text] = RollDie(required_sign);
    rolls_done = rolls_done + 1;
    if (value == 'two_dice') {
      rolls_needed = rolls_needed + 2;
    }
    // If we are rolling extra dice, the 0s get rerolled.
    else if (value == 0 && rolls_done > 2) {
      rolls_needed = rolls_needed + 1;
    } else {
      total = total + value;
    }
    if (description === '') {
      description = text;
    } else {
      description = description + ', ' + text;
    }
    // After we have rolled the first 2 dice,
    // if we got any two_dice rolls, we have to do some special stuff.
    if (rolls_done == 2 && rolls_needed > 2) {
      // If one of the dice was a 0, we have to reroll it.
      if (total == 0) {
        // If one of the dice was a 0, we have to reroll it.
        if (rolls_needed == 4) {
          rolls_needed = rolls_needed + 1;
        }
        value = 0;
        while (value == 0 || value == 'two_dice') {
          [value, text] = RollDie(null);
        }
        total = value;
        description = description + ', ' + text;
      }
      required_sign = Math.sign(total);
    }
  }
  return {total: total,
    text: description};
};

// This script is for rolling success rolls in the Epic Power RPG system.
// The script is easily activated by entering a macro, like
//   !EPRoll ?{Enter your success roll modifier|0}
// The modifier after !EPRoll can be a sum of terms, like @{X}+@{Y}.
// If there is additional text after the modifier, it is displayed
// before the roll.
on('chat:message', function(event) {
  let cmdName = '!EPRoll';
  let msgtxt = event.content;
  if(event.type == 'api' && msgtxt.indexOf(cmdName) !== -1) {
    let message = msgtxt.slice(cmdName.length + 1).trim();
    let parts = message.split(' ');
    let mod = 0;
    if (parts.length > 0) {
      terms = parts[0].split('+');
      mod = 0;
      for (let i = 0; i < terms.length; i++) {
        if (terms[i].length > 0) {
          mod = mod + parseInt(terms[i]);
        }
      }
      if (isNaN(mod)) {
        mod = 0;
      } else {
        parts = parts.slice(1);
        message = parts.join(' ');
      }
    }
    let send_to_tracker = false;
    let character_id = false;
    if (parts.length > 1) {
      if (parts.slice(-2)[0] === 'SEND_TO_TRACKER') {
        send_to_tracker = true;
        character_id = parts.slice(-2)[1];
        parts = parts.slice(0, -2);
        message = parts.join(' ');
      }
    }
    if (message === '') {
      if (mod === 0) {
        message = 'Rolls';
      } else {
        message = `Rolls with modifier ${mod}`;
      }
    }
    const roll = EPRoll();
    const grand_total = roll.total + mod;
    // Don't show the die sum if the modifier is 0
    const die_sum = mod !== 0 ? `&emsp;dice: ${roll.total}` : '';
    const msg = (`${message}<br>` +
      roll.text + die_sum + '<br>' +
      `<strong>Total: ${grand_total}</strong>`);
    sendChat(event.who, msg);
    if (send_to_tracker) {
      // We have to manipulate the turn order directly.
      // sendChat with &{tracker} doesn't work, because that
      // requires a selected token, and there is no selected token
      // when API scripts run.
      const pageid = Campaign().get('playerpageid');
      const tokens = findObjs({_pageid: pageid,
        _type: 'graphic'});
      const right_tokens = tokens.filter((token) =>
        token.get('represents') == character_id);
      if (right_tokens.length > 0) {
        token_id = right_tokens[0].id;
        let turnorder = JSON.parse(Campaign().get('turnorder')||'[]');
        let already_there = false;
        for (let i = 0; i < turnorder.length; i++) {
          if (turnorder[i].id == token_id) {
            already_there = true;
            turnorder[i].pr = grand_total;
            break;
          }
        }
        if (!already_there) {
          turnorder.push({id: token_id,
            pr: grand_total,
            custom: '',
            _pageid: pageid,
          });
        }
        Campaign().set('turnorder', JSON.stringify(turnorder));
      }
    }
  }
});

on('change:attribute', function(
  attribute,
  // eslint-disable-next-line no-unused-vars
  prev
) {
  if(attribute.get('name') == 'pendingchat') {
    let charid = attribute.get('_characterid');
    let message = attribute.get('current');
    if (message != '') {
      sendChat('character|'+charid, message);
      attribute.set('current', '');
    }
  }
});
