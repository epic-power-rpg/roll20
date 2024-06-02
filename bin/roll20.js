// eslint-disable-next-line no-unused-vars

// Roll a single special die, and return its value and text string.
const RollSpecialDie = function () {
  const die = Math.ceil(6 * Math.random());
  let value;
  let text;
  if (die === 6) {
    value = 0;
    extra = 1;
    text = '&#127922;'; // game die character
  } else {
    value = die - 3;
    extra = 0;
    color = value < 0 ? 'red' : (value > 0 ? 'DodgerBlue': 'silver');
    digit = value.toString();
      text = '<span style="color:' + color + '";>' + digit + '</span>';
  }
  return [value, extra, text];
};

// Roll a single extra die, and return its value and text string.
const RollExtraDie = function () {
  const die = Math.ceil(6 * Math.random());
  let value;
  let extra;
  let text;
  if (die === 6) {
    value = 4;
    extra = 1;
    text = '<span style="color:silver";>4/</span>&#127922;'; // gamedie char.
  } else {
    value = die;
    extra = 0;
    digit = value.toString();
    text = '<span style="color:silver";>' + digit + '</span>';
  }
  return [value, extra, text];
};

// Roll three special dice.
const RollSpecialDice = function() {
  let total_value = 0;
  let total_extra = 0;
  let description = '';
  for (let i = 0; i < 3; i++) {
    let [value, extra, text] = RollSpecialDie();
    total_value = total_value + value;
    total_extra = total_extra + extra;
    if (description === '') {
      description = text;
    } else {
    description = description + ', ' + text;
    }
  }
  return [total_value, total_extra, description];
};

// Do the EP roll.
const EPRoll = function () {
  let good_initial = false;
  let total_value;
  let total_extra;
  let description;
  while (! good_initial) {
    [total_value, total_extra, description] = RollSpecialDice();
    good_initial = (total_value !== 0) || (total_extra === 0)
  }
  while (total_extra > 0) {
    let [value, extra, text] = RollExtraDie(null);
    if (total_value < 0) {
      value = -value;
    }
    total_value = total_value + value;
    total_extra = total_extra - 1 + extra;
    description = description + ', ' + text;
  }
  return {
    total: total_value,
    text: description
  };
};

// This script is for rolling success rolls in the Epic Power RPG system.
// The script is easily activated by entering a macro, like
//   !EPRoll ?{Enter your success roll modifier|0}
// The modifier after !EPRoll can be a sum of terms, like @{X}+@{Y}.
// If there is additional text after the modifier, it is displayed
// before the roll.
on('chat:message', function (event) {
  let cmdName = '!EPRoll';
  let msgtxt = event.content;
  if (event.type === 'api' && msgtxt.indexOf(cmdName) !== -1) {
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
      const tokens = findObjs({
        _pageid: pageid,
        _type: 'graphic'
      });
      const right_tokens = tokens.filter((token) =>
        token.get('represents') === character_id);
      if (right_tokens.length > 0) {
        token_id = right_tokens[0].id;
        let turnorder = JSON.parse(Campaign().get('turnorder') || '[]');
        let already_there = false;
        for (let i = 0; i < turnorder.length; i++) {
          if (turnorder[i].id === token_id) {
            already_there = true;
            turnorder[i].pr = grand_total;
            break;
          }
        }
        if (!already_there) {
          turnorder.push({
            id: token_id,
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

on('change:attribute', function (
  attribute,
  // eslint-disable-next-line no-unused-vars
  prev
) {
  if (attribute.get('name') === 'pendingchat') {
    let charid = attribute.get('_characterid');
    let message = attribute.get('current');
    if (message !== '') {
      sendChat('character|' + charid, message);
      attribute.set('current', '');
    }
  }
});
