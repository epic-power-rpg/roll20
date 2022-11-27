on('ready', () => {
  const getTurnOrder = () => (
    Campaign().get('turnorder') === '' ?
      [] :
      JSON.parse(Campaign().get('turnorder'))
  );
  const setTurnOrder = (turnOrder) => Campaign().set({ turnorder: JSON.stringify(turnOrder) });

  function addSpellDurationToTurnOrder(event, commandValues) {
    const { who } = event;
    const [characterId, spellName, spellDuration] = commandValues;
    const pageid = Campaign().get('playerpageid');
    const tokens = findObjs({
      _pageid: pageid,
      _type: 'graphic'
    });
    const matchingCharacterToken = tokens.find((token) => token.get('represents') === characterId);

    // const player = getObj('player', characterId);
    if (!matchingCharacterToken) {
      log(`Unable to get player token for ${characterId}`);
    }
    const playerName = matchingCharacterToken ? matchingCharacterToken.name : '';
    const turnOrder = getTurnOrder();
    const customEntry = `${playerName} ${spellName}`;
    log(`Adding ${spellName} to turn order`);
    const entry = {
      id: '-1',
      source: 'addSpellDurationToTurnOrder',
      custom: customEntry,
      pr: parseInt(spellDuration) || 0,
      formula: -1,
    };
    setTurnOrder([entry, ...turnOrder]);
    const message = `Added ${customEntry} to turn order`;
    sendChat(who, message);
    log(message);
  }

  // Register a function for the 'chat:message' event.  This event occurs for all
  //   chat messages, so it's important to filter down to just the ones you care about
  on('chat:message', (event) => {
    const { type, content } = event;
    //  First check the type is an API message.  API messages are not show shown in chat
    //    and begin with a ! in the first character of the message.
    //
    //  Next, make sure this is our API message.  The regular expression checks that the 
    //    command starts with "!call-my-func" and either ends or has a space, all case 
    //    insensitive.
    if ('api' === type && /^!addSpellDurationToTurnOrder(\b\s|$)/i.test(content)) {
      const [, ...commandValues] = content.split(' ');
      log(commandValues.join(', '));
      addSpellDurationToTurnOrder(event, commandValues || []);
    }
  });
});
