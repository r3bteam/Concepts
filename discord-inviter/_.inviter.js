const moment = require('moment');
require('moment-duration-format');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

var internalInviteStorage = [];
var firstStart = true;

client.once('ready', () => {
	// Function which constantly refreshes our internal invite store
	async function updateTime() {
		if (!client.guilds.get(config.guild)) {
			setTimeout(updateTime, 30000);
			return;
		}

		// Fetch invites
		await client.guilds.get(config.guild).fetchInvites().then(async (invites) => {
			// If this is not the first start and we can get the channel defined in config.logs then check if any invite got created/deleted
			if (firstStart === false && client.channels.get(config.logs)) {
				// This is not 100% accurate - Discord please add InviteCreate/Delete events, ty.

				// Setup the collections in order to easily check if any invite is missing
				var changes = [];
				var newInvites = invites;
				var inviteStorage = new Map();
				for (let i = 0; i < internalInviteStorage.length; i++) inviteStorage.set(internalInviteStorage[i].code, internalInviteStorage[i]);

				// Go through each new invite
				newInvites.forEach((inv) => {
					// Check if one doesnt exist in the storage
					if (!inviteStorage.get(inv.code)) {
						// If so add it to the change list
						changes.push(inv);
					}
				});

				// Go through each stored invite
				inviteStorage.forEach((inv) => {
					// Check if one doesnt exist in the new invites
					if (!newInvites.get(inv.code)) {
						// If so add it to the change list
						changes.push(inv);
					}
				});

				// Remove all duplicates
				var actualChanges = [];

				// Loop throuh all changes
				for (let i = 0; i < changes.length; i++) {
					// If "actualChanges" already has one of the objects then skip
					if (actualChanges.filter((e) => { return e.code === changes[i].code; }).length > 0) continue;

					// Else add it to the changes
					actualChanges.push(changes[i]);
				}

				// Check if there is 1 or more changes
				if (actualChanges.length >= 1) { // Typically there is only 1 single change, but it is possible there could be multiple

					// Loop through all changes
					for (let i = 0; i < actualChanges.length; i++) {
						// Fetch the audit logs of the 
						client.guilds.get(config.guild).fetchAuditLogs({ limit: 5 }).then((auditLogs) => {
							var audits = auditLogs.entries.array();
							var audit = undefined;
							for (let x = 0; x < audits.length; x++) {
								if (audits[x].action === 'INVITE_CREATE' && (new Date().getTime() - audits[x].createdTimestamp) < (5 * 1000)) {
									for (let y = 0; y < audits[x].changes.length; y++) {
										if (audits[x].changes[y].key === 'code') {
											if (audits[x].changes[y].new === actualChanges[i].code) {
												audit = audits[x];
												break;
											}
										}
									}
									if (audit) break;
								} else if (audits[x].action === 'INVITE_DELETE' && (new Date().getTime() - audits[x].createdTimestamp) < (5 * 1000)) {
									for (let y = 0; y < audits[x].changes.length; y++) {
										if (audits[x].changes[y].key === 'code') {
											if (audits[x].changes[y].old === actualChanges[i].code) {
												audit = audits[x];
												break;
											}
										}
									}
									if (audit) break;
								}
							}

							var isDeleted = (((((actualChanges[i].uses === null) ? 0 : actualChanges[i].uses) >= ((actualChanges[i].maxUses === null) ? '∞' : actualChanges[i].maxUses)) || ((actualChanges[i].expiresTimestamp !== actualChanges[i].createdTimestamp) && parseInt(actualChanges[i].expiresTimestamp - new Date().getTime()) < 0)) ? true : false);
							var description = [];

							const embed = new Discord.MessageEmbed();
							embed.setTimestamp();

							if (audit && audit.action === 'INVITE_CREATE') {
								embed.setColor([ 0, 255, 0 ]);
								embed.setTitle('Invite created by ' + audit.executor.tag + ' (' + audit.executor.id + ')');
								embed.setFooter('It is possible that the algorythm to detect if a invite was deleted automatically is wrong. Possible reasons could be a slow internet connection or Discord having issues.');
								isDeleted = false;
							} else if (audit && audit.action === 'INVITE_DELETE') {
								embed.setColor([ 255, 0, 0 ]);
								embed.setTitle('Invite deleted ' + audit.executor.tag + ' (' + audit.executor.id + ')');
								embed.setFooter('It is possible that the algorythm to detect if a invite was deleted automatically is wrong. Possible reasons could be a slow internet connection or Discord having issues.');
								isDeleted = true;
							} else { // Automatically deleted
								embed.setColor([ 255, 0, 0 ]);
								embed.setTitle('Invite deleted');
								embed.setFooter('It is possible that the algorythm to detect if a invite was deleted automatically is wrong. Possible reasons could be a slow internet connection or Discord having issues.');
								isDeleted = true;
							}

							description.push('**Invite by:** ' + actualChanges[i].inviter.toString() + ' (' + actualChanges[i].inviter.id + ')');
							description.push('**Invite code:** ' + ((isDeleted === true) ? ('~~' + actualChanges[i].url + '~~') : actualChanges[i].url) + ' (' + actualChanges[i].code + ')');
							description.push('**Invite code uses/max uses:** ' + ((actualChanges[i].uses === null) ? '0' : actualChanges[i].uses) + '/' + ((actualChanges[i].maxUses === null) ? '∞' : actualChanges[i].maxUses));
							description.push('**Invite expires in:** ' + ((actualChanges[i].expiresTimestamp !== actualChanges[i].createdTimestamp) ? moment.duration(parseInt(actualChanges[i].expiresTimestamp - new Date().getTime())).format('H [hrs], m [mins], s [secs]') : 'Never'));
							description.push('**Temporary membership:** ' + (actualChanges[i].temporary ? 'true' : 'false'));

							if (audit && audit.action === 'INVITE_CREATE') description.push('**Automatically created?:** false'); // Can this even be true?
							else if (audit && audit.action === 'INVITE_DELETE') description.push('**Automatically deleted?:** false');
							else description.push('**Automatically deleted?:** true'); // Automatically deleted

							embed.setDescription(description.join('\n'));

							if (client.channels.get(config.logs)) client.channels.get(config.logs).send({ embed: embed });
						});
					}
				}
			} else {
				firstStart = false;
			}

			// Clear the internal storge and set it to the current invitse
			internalInviteStorage = invites.array();

			// Refetch the invites again after 100ms
			setTimeout(updateTime, 100);
		}).catch((err) => {
			console.error(err);
			setTimeout(updateTime, 500);
		});
	}

	// Start the fetching loop
	updateTime();
});

client.on('guildMemberAdd', async (member) => {
	if (member.guild.id !== config.guild) return;

	await member.guild.fetchInvites().then((invites) => {
		var newInvites = invites.array();
		var change = undefined;

		// Check if there are no more invites
		if (!newInvites[0]) change = internalInviteStorage[0];

		// If we havent found a change yet then check if an entry is missing
		if (change === undefined) {
			for (let i = 0; i < internalInviteStorage.length; i++) {
				if (newInvites.map((e) => { return e.code; }).indexOf(internalInviteStorage[i].code) == -1) {
					change = internalInviteStorage[i];
					break;
				}
			}
		}

		// If we havent found a change yet then check all invites and find the one with different uses
		if (change === undefined) {
			for (let i = 0; i < internalInviteStorage.length; i++) {
				if (!internalInviteStorage[i]) continue;

				for (let x = 0; x < newInvites.length; x++) {
					if (!newInvites[x]) continue;
					if (internalInviteStorage[i].code !== newInvites[x].code) continue;

					if (internalInviteStorage[i].uses !== newInvites[x].uses) {
						if (parseInt(internalInviteStorage[i].uses + 1) === newInvites[x].uses) {
							// This invite was used
							change = newInvites[x];
							break;
						}
					}
				}
			}
		}

		// Increase uses of the changed invite by 1 if invite still exists (For display purposes only)
		if (change !== undefined) change.uses = (isNaN(change.uses) ? 1 : parseInt(change.uses + 1));

		// Setup the embed
		const embed = new Discord.MessageEmbed();
		embed.setTimestamp();
		embed.setTitle(member.user.tag);

		// Check if we found a changed-invite or not
		if (change === undefined) {
			// No changed-invite found (Unknown inviter)
			var description = [];
			description.push('**Invited by:** *Unknown*');
			description.push('**Invite code used:** *Unknown*');
			description.push('**Invite code uses:** *Unknown*');
			description.push('**Invite code max uses:** *Unknown*');
			description.push('**Invite expires in:** *Unknown*');
			description.push('**Is code now deleted:** *Unknown*');
			embed.setDescription(description.join('\n'));
		} else {
			// Changed-invite found (Inviter found)
			var isDeleted = (((((change.uses === null) ? 0 : change.uses) >= ((change.maxUses === null) ? '∞' : change.maxUses)) || ((change.expiresTimestamp !== change.createdTimestamp) && parseInt(change.expiresTimestamp - new Date().getTime()) < 0)) ? true : false);

			var description = [];
			description.push('**Invited by:** ' + change.inviter.toString() + ' (' + change.inviter.id + ')');
			description.push('**Invite code used:** ' + ((isDeleted === true) ? ('~~' + change.url + '~~') : change.url) + ' (' + change.code + ')');
			description.push('**Invite code uses/max uses:** ' + ((change.uses === null) ? '0' : change.uses) + '/' + ((change.maxUses === null) ? '∞' : change.maxUses));
			description.push('**Invite expires in:** ' + ((change.expiresTimestamp !== change.createdTimestamp) ? moment.duration(parseInt(change.expiresTimestamp - new Date().getTime())).format('H [hrs], m [mins], s [secs]') : 'Never'));
			description.push('**Temporary membership:** ' + (change.temporary ? 'true' : 'false'));
			description.push('**Is code now deleted:** ' + isDeleted);
			embed.setDescription(description.join('\n'));
		}

		// Send embed if we have access to the systemChannel (Automated "Welcome"-Messages channel) of the defined guild
		if (client.guilds.get(config.guild).systemChannel) client.guilds.get(config.guild).systemChannel.send({ embed: embed });
	});
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));
client.on('rateLimit', (rl) => console.log(rl)); // Just for ratelimit checks - Specifically to see of "fetchInvites()" causes a ratelimit

client.login(config.botToken);

process.on('uncaughtException', (e) => console.error(e));
process.on('unhandledRejection', (e) => console.error(e));
