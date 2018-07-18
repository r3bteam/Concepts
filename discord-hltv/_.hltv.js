const { HLTV } = require('hltv');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

const enums = {
	RoundEndReasons: {
		Target_Saved: 'Time ran out',
		Bomb_Defused: 'Bomb has been defused',
		Target_Bombed: 'Bomb has exploded',
		CTs_Win: 'All Terrorists eliminated',
		Terrorists_Win: 'All Counter-Terrorists eliminated'
	},
	TeamNames: {
		TERRORIST: 'T',
		CT: 'CT'
	}
}

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'hltv') {
		if (!args[0]) return msg.channel.send(config.prefix + 'hltv <matchID>');

		var m = await msg.channel.send('Getting HLTV information...');

		var events = [ ];
		var lastScoreboard = undefined;
		var updateInterval = undefined;
		var lastEvent = undefined;
		var lastEventsLength = 0;

		HLTV.getMatch({id: parseInt(args[0])}).then(async (res) => {
			if (res.live && res.hasScorebot) {
				HLTV.connectToScorebot({id: parseInt(args[0]), onConnect: async() => {
					await m.edit('Scorebot connected... This message will update itself in a few seconds. Please wait...');

					updateInterval = setInterval(() => {
						if (events.length <= 0 || events.length > 15) return m.edit('Waiting for next round start...');
						if (events.length === lastEventsLength) return;
						lastEventsLength = events.length;

						var backup = [];
						for (let i = 1; i < events.length; i++) backup.push(events[i]);
						m.edit(events[0] + '\n```\n' + backup.reverse().join('\n') + '```');
					}, 2000);
				}, onDisconnect: async () => {
					clearInterval(updateInterval);
					await m.edit(m.content + '\n\n**Scorebot disconnected**');
				}, onScoreboardUpdate: (data) => {
					lastScoreboard = data;

					if (false /* Stuff to figure out if match is over or not */) {
						setTimeout(() => {
							clearInterval(updateInterval);
							m.edit('Match over // TODO');
						}, 10000);
					}
				}, onLogUpdate: async (data) => {
					if (data.log[0].RoundStart) {
						events = [];
						if (!lastScoreboard) events.push('Round started\n*Information missing please wait for the next round to start*');
						else events.push('__Round ' + parseInt(lastScoreboard.currentRound + 1) + ' started__\n**(CT) ' + lastScoreboard.ctTeamName + ' ' + lastScoreboard.ctTeamScore + ':' + lastScoreboard.terroristScore + ' ' + lastScoreboard.terroristTeamName + '(T)**');
					} else if (data.log[0].BombPlanted && events.length >= 1) {
						var toPush = data.log[0].BombPlanted.playerName + ' planted the bomb in a (CT) ' + data.log[0].BombPlanted.ctPlayers + ' on ' + data.log[0].BombPlanted.tPlayers + ' (T) scenario';
						if (lastEvent === toPush) return;
						
						events.push(toPush);
						lastEvent = toPush;
					} else if (data.log[0].BombDefused && events.length >= 1) {
						var toPush = data.log[0].BombDefused.playerName + 'defused the bomb';
						if (lastEvent === toPush) return;
						
						events.push(toPush);
						lastEvent = toPush;
					} else if (data.log[0].Kill && events.length >= 1) {
						var toPush = '(' + enums.TeamNames[data.log[0].Kill.killerSide] + ') ' + data.log[0].Kill.killerName + ' killed (' + enums.TeamNames[data.log[0].Kill.victimSide] + ') ' + data.log[0].Kill.victimName + (data.log[0].Kill.headShot ? ' (Headshot)' : '');
						if (lastEvent === toPush) return;
						
						events.push(toPush);
						lastEvent = toPush;
					} else if (data.log[0].RoundEnd && events.length >= 1) {
						var toPush = '\n' + enums.TeamNames[data.log[0].RoundEnd.winner] + ' win\n' + enums.RoundEndReasons[data.log[0].RoundEnd.winType] + '\n\n';
						if (lastEvent === toPush) return;
						
						events.push(toPush);
						lastEvent = toPush;

						if (data.log[0].RoundEnd.winner === 'CT') events[0] = '__Round ' + parseInt(lastScoreboard.currentRound + 1) + ' started__\n**`CT ' + parseInt(lastScoreboard.ctTeamScore + 1) + ':' + lastScoreboard.terroristScore + ' T`**';
						if (data.log[0].RoundEnd.winner === 'TERRORIST') events[0] = '__Round ' + parseInt(lastScoreboard.currentRound + 1) + ' started__\n**`CT ' + lastScoreboard.ctTeamScore + ':' + parseInt(lastScoreboard.terroristScore + 1) + ' T`**';

						if (events.length <= 0 || events.length > 15) return;
						if (events.length === lastEventsLength) return;
						lastEventsLength = events.length;

						var backup = [];
						for (let i = 1; i < events.length; i++) backup.push(events[i]);
						m.edit(events[0] + '\n```\n' + backup.reverse().join('\n') + '```');
					}
				}});
			} else {
				if (res.winnerTeam) {
					await m.edit('**__Match already over__**\n\nWinner: ' + res.winnerTeam.name);
				} else {
					await m.edit('Match is not live | TODO: Match info');
				}
			}
		}).catch((err) => {
			m.edit('Could not find requested match');
			console.error(err);
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);