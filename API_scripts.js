const EPRoll = function() {
    var total = 0;
    var text = '';
    var any_positive = false;
    var any_negative = false;
    var must_roll = true;
    while (must_roll) {
	must_roll = false;
	const only_positive = any_positive && !any_negative
	const only_negative = !any_positive && any_negative
	for (var i = 0; i < 3; i++) {
	    const die = randomInteger(6);
	    var roll;
	    if (die === 6) {
		must_roll = true
	        roll = "\u29C9"; // two joined squares character
	    } else {
		var roll = die - 3
		if (only_positive) {
		    roll = Math.abs(roll);
		} else if (only_negative) {
		    roll = -Math.abs(roll);
		}
                total = total + roll;
	        if (roll < 0) {
		    any_negative = true;
		    roll = '<span style="color:red";>' + roll + '</span>'
	        } else if (roll >  0) {
		    any_positive = true;
		    roll = '<span style="color:blue";>+' + roll + '</span>'
	        }
	    }
	    if (text === '') {
	        text = String(roll)
	    } else {
                text = text + ", " + roll;
	    }
	}
    }
    return {total: total,
	    text: text}
}

// This script is for rolling success rolls in the Epic Power RPG system.
// The script is easily activated by entering a macro, like
//   !EPRoll ?{Enter your success roll modifier|0}
// The modifier after !EPRoll can be a sum of terms, like @{X}+@{Y}.
// If there is additional text after the modifier, it is displayed
// before the roll.
on('chat:message', function(event) {
    var cmdName = '!EPRoll';
    var msgtxt = event.content;
    if(event.type == 'api' && msgtxt.indexOf(cmdName) !== -1) {
        var message = msgtxt.slice(cmdName.length + 1).trim()
	var parts = message.split(' ')
	var mod = 0
	if (parts.length > 0) {
	    terms = parts[0].split('+')
	    mod = 0
	    for (var i = 0; i < terms.length; i++) {
		if (terms[i].length > 0) {
		    mod = mod + parseInt(terms[i])
		}
	    }
	    if (isNaN(mod)) {
                mod = 0
	    } else {
		parts = parts.slice(1)
		message = parts.join(' ')
	    }
	}
	var send_to_tracker = false;
	var character_id = false;
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
		message = "Rolls"
	    } else {
		message = `Rolls with modifier ${mod}`
	    }
	}
	const roll = EPRoll()
	const grand_total = roll.total + mod
	// Don't show the die sum if the modifier is 0
	const die_sum = mod !== 0 ? `&emsp;dice: ${roll.total}` : ''
	const msg = (`${message}<br>` +
		     roll.text + die_sum + '<br>' +
		     `<strong>Total: ${grand_total}</strong>`)
        sendChat(event.who, msg);
	if (send_to_tracker) {
	    // We have to manipulate the turn order directly.
            // sendChat with &{tracker} doesn't work, because that
            // requires a selected token, and there is no selected token
            // when API scripts run.
	    const pageid = Campaign().get('playerpageid');
	    const tokens = findObjs({_pageid: pageid,
                                     _type: "graphic"});
            const right_tokens = tokens.filter((token) =>
                token.get('represents') == character_id);
	    if (right_tokens.length > 0) {
		token_id = right_tokens[0].id
	        var turnorder = JSON.parse(Campaign().get('turnorder')||'[]');
	        var already_there = false;
	        for (var i = 0; i < turnorder.length; i++) {
		    if (turnorder[i].id == token_id) {
		        already_there = true;
		        turnorder[i].pr = grand_total;
		        break;
		    }
	        }
	        if (!already_there) {
		    turnorder.push({id: token_id,
				    pr: grand_total,
				    custom: "",
				    _pageid: pageid,
				   });
		}
		Campaign().set('turnorder', JSON.stringify(turnorder));
	    }
	}
    }
});

on("change:attribute", function(attribute, prev) {
    if(attribute.get("name") == "pendingchat") {
        let charid = attribute.get("_characterid");
        let message = attribute.get("current");
        if (message != "") {
            sendChat('character|'+charid, message);
            attribute.set("current", "");
	}
    }
});
