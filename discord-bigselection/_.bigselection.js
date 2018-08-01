const twemoji = require('twemoji');
const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});



var collectors = {}; // Collectors - Can be used later to modify the collectors
var currentData = undefined;

client.on('messageReactionRemove', (messageReaction, user) => {
	if (collectors[messageReaction.message.id]) { // Original "remove" event doesn't work so we emit the event ourselves 
		collectors[messageReaction.message.id].emit('remove', messageReaction, user);
	}
});

// Only runs only on the very first "ready" event
client.once('ready', () => {
	if (fs.existsSync('./reactionCollector.json')) { // If file exists we already have something set up
		var messages = JSON.parse(fs.readFileSync('./reactionCollector.json')).msgs; // Get the messages

		var channel = client.channels.get(JSON.parse(fs.readFileSync('./reactionCollector.json')).channel); // Get the channel
		if (!channel) return console.log('Failed to get channel'); // Cant get channel :/

		createCollectors(channel, messages); // Setup collectors
	}

	// Start a timer to constantly check if the messages are still fetched
	// If they are not fetched refetch them and setup the reaction collectors again
	function checkMessagesCache() {
		if (!currentData) return setTimeout(checkMessagesCache, 1000); // No current data yet

		var msgIds = Object.keys(currentData.messages);
		var channel = client.channels.get(currentData.channel);
		if (!channel) {
			setTimeout(checkMessagesCache, 1000);
			return;
		}

		var i = -1;
		function refetchMessage() {
			i = i + 1;
			if (i >= msgIds.length) {
				setTimeout(checkMessagesCache, 1000);
				return;
			}

			// Skip if message is already fetched
			if (channel.messages.has(msgIds[i])) return refetchMessage();

			// Fetch the message
			channel.messages.fetch(msgIds[i]).then((m) => {
				// Creation collectors don't need time to setup so we can immediately recall the fetch function
				refetchMessage();

				// Setup the reaction collector
				const filter = (reaction, user) => !user.bot && currentData.messages[msgIds[i]].includes(reaction.emoji.identifier);
				collectors[msgIds[i]] = m.createReactionCollector(filter, {});
	
				// Collection event
				collectors[msgIds[i]].on('collect', (r, user) => {
					// Find the role we want
					var role = undefined;
					for (let x = 0; x < config.setup.length; x++) {
						for (let y = 0; y < config.setup[x].reactions.length; y++) {
							// Find out if a emote is custom or default
							var emote = findEmoji(config.setup[x].reactions[y].emote)[0];
							if (client.emojis.resolve(config.setup[x].reactions[y].emote)) emote = client.emojis.resolve(config.setup[x].reactions[y].emote);
							if (!emote) continue; // Invalid emoji or no access to it
	
							// Check if the reaction the user added is used in our config
							if (typeof emote === 'string' && config.setup[x].reactions[y].emote === r.emoji.identifier || config.setup[x].reactions[y].emote === emote.id) {
								role = config.setup[x].reactions[y].role;
							}
						}
					}
					if (!role) return; // Could not find role ID
	
					var guildRole = r.message.guild.roles.get(role);
					if (!guildRole) return; // Could not get role
	
					var guildMember = r.message.guild.member(user);
					if (!guildMember) return; // Could not get guild member of user
	
					// Add role if user doesnt have it
					if (!guildMember.roles.has(guildRole.id)) guildMember.roles.add(guildRole);
				});
	
				// Remove event - Doesn't work at all - This is why we have the hacky thing at the top
				collectors[msgIds[i]].on('remove', (r, user) => {
					// Find the role we want
					var role = undefined;
					for (let x = 0; x < config.setup.length; x++) {
						for (let y = 0; y < config.setup[x].reactions.length; y++) {
							// Find out if a emote is custom or default
							var emote = findEmoji(config.setup[x].reactions[y].emote)[0];
							if (client.emojis.resolve(config.setup[x].reactions[y].emote)) emote = client.emojis.resolve(config.setup[x].reactions[y].emote);
							if (!emote) continue; // Invalid emoji or no access to it
	
							// Check if the reaction the user added is used in our config
							if (typeof emote === 'string' && config.setup[x].reactions[y].emote === r.emoji.identifier || config.setup[x].reactions[y].emote === emote.id) {
								role = config.setup[x].reactions[y].role;
							}
						}
					}
					if (!role) return; // Could not find role ID
	
					var guildRole = r.message.guild.roles.get(role);
					if (!guildRole) return; // Could not get role
	
					var guildMember = r.message.guild.member(user);
					if (!guildMember) return; // Could not get guild member of user
	
					// Remove role if user has it
					if (guildMember.roles.has(guildRole.id)) guildMember.roles.remove(guildRole);
				});
			});
		}
		refetchMessage();
	}
	setTimeout(checkMessagesCache, 10000);
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'setup' && msg.member.hasPermission('MANAGE_ROLES', { checkAdmin: true, checkOwner: true })) {
		var messages = {}; // Messages with IDs and which reactions are part of that specific message
		var i = -1; // Start -1 because we immediately do +1
		function sendMessages() {
			i = i + 1;

			if (i >= config.setup.length) {
				// Done sending messages - Setup reaction collector thingies
				createCollectors(msg.channel, messages);

				// Save all important information in a JSON so we can use it later incase the bot restarts
				fs.writeFileSync('./reactionCollector.json', JSON.stringify({ msgs: messages, channel: msg.channel.id }, null, 4));

				// Done with everything
				msg.channel.send('Done!').then((m) => m.delete({ timeout: 5000 }));
				return;
			}

			// Default text is Zero-Width-Space - If we have a text use that one
			var text = String.fromCharCode(0x200B);
			if (config.setup[i].msg && config.setup[i].msg.length >= 1) text = config.setup[i].msg;

			// Send message
			msg.channel.send(text).then(async (m) => {
				// Setup the array
				messages[m.id] = [];

				var x = -1;

				// Add each reaction one by one
				function addReaction() {
					x = x + 1;

					if (x >= config.setup[i].reactions.length) {
						// Done adding reactions - Continue with the next message
						sendMessages();
						return;
					}

					// Find out if a emote is custom or default
					var emote = findEmoji(config.setup[i].reactions[x].emote)[0];
					if (!emote && client.emojis.resolve(config.setup[i].reactions[x].emote)) emote = client.emojis.resolve(config.setup[i].reactions[x].emote);
					if (!emote) return addReaction() // Invalid emoji or no access to it

					// Add the reaction to the message
					m.react(emote).then((r) => {
						messages[m.id].push(r.emoji.identifier); // Add the reaction to the message array
						addReaction(); // Continue with the next reaction
					});
				}
				addReaction(); // Start reaction process
			});
		}
		sendMessages(); // Start message process
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);

function createCollectors(channel, messages) {
	// Save channel ID
	currentData = {};
	currentData.channel = channel.id;
	currentData.messages = messages;

	// Get all keys (message IDs) of the messages object
	var msgIds = Object.keys(messages);

	for (let i = 0; i < msgIds.length; i++) {
		// Fetch the message
		channel.messages.fetch(msgIds[i]).then((m) => {
			// Setup the reaction collector
			const filter = (reaction, user) => !user.bot && messages[msgIds[i]].includes(reaction.emoji.identifier);
			collectors[msgIds[i]] = m.createReactionCollector(filter, {});

			// Collection event
			collectors[msgIds[i]].on('collect', (r, user) => {
				// Find the role we want
				var role = undefined;
				for (let x = 0; x < config.setup.length; x++) {
					for (let y = 0; y < config.setup[x].reactions.length; y++) {
						// Find out if a emote is custom or default
						var emote = findEmoji(config.setup[x].reactions[y].emote)[0];
						if (client.emojis.resolve(config.setup[x].reactions[y].emote)) emote = client.emojis.resolve(config.setup[x].reactions[y].emote);
						if (!emote) continue; // Invalid emoji or no access to it

						// Check if the reaction the user added is used in our config
						if (typeof emote === 'string' && config.setup[x].reactions[y].emote === r.emoji.identifier || config.setup[x].reactions[y].emote === emote.id) {
							role = config.setup[x].reactions[y].role;
						}
					}
				}
				if (!role) return; // Could not find role ID

				var guildRole = r.message.guild.roles.get(role);
				if (!guildRole) return; // Could not get role

				var guildMember = r.message.guild.member(user);
				if (!guildMember) return; // Could not get guild member of user

				// Add role if user doesnt have it
				if (!guildMember.roles.has(guildRole.id)) guildMember.roles.add(guildRole);
			});

			// Remove event - Doesn't work at all - This is why we have the hacky thing at the top
			collectors[msgIds[i]].on('remove', (r, user) => {
				// Find the role we want
				var role = undefined;
				for (let x = 0; x < config.setup.length; x++) {
					for (let y = 0; y < config.setup[x].reactions.length; y++) {
						// Find out if a emote is custom or default
						var emote = findEmoji(config.setup[x].reactions[y].emote)[0];
						if (client.emojis.resolve(config.setup[x].reactions[y].emote)) emote = client.emojis.resolve(config.setup[x].reactions[y].emote);
						if (!emote) continue; // Invalid emoji or no access to it

						// Check if the reaction the user added is used in our config
						if (typeof emote === 'string' && config.setup[x].reactions[y].emote === r.emoji.identifier || config.setup[x].reactions[y].emote === emote.id) {
							role = config.setup[x].reactions[y].role;
						}
					}
				}
				if (!role) return; // Could not find role ID

				var guildRole = r.message.guild.roles.get(role);
				if (!guildRole) return; // Could not get role

				var guildMember = r.message.guild.member(user);
				if (!guildMember) return; // Could not get guild member of user

				// Remove role if user has it
				if (guildMember.roles.has(guildRole.id)) guildMember.roles.remove(guildRole);
			});
		});
	}
}

// Credit: https://github.com/blargbot/blargbot/blob/6eb4b48f1be1cf47d61b1cb55882f1454d759ade/src/utils/generic.js#L1665
function findEmoji(text, distinct) {
	if (typeof text != 'string') return [];
	let match;
	let result = [];

	// Find custom emotes
	let regex = /<(a?:\w+:\d{17,23})>/gi;
	while (match = regex.exec(text)) result.push(match[1]);

	// Find twemoji defined emotes
	twemoji.replace(text, (match) => {
		result.push(match);
		return match;
	});

	if (distinct) result = [...new Set(result)];

	// Sort by order of appearance
	result = result.map(r => {
		return {
			value: r,
			index: text.indexOf(r)
		};
	});

	return result.sort((a, b) => a.index - b.index).map(r => r.value);
}
