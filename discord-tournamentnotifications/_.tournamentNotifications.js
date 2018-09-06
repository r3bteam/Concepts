const { HLTV } = require('hltv');
const moment = require('moment');
require('moment-duration-format');
const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

var dontTriggerOn = (!fs.existsSync('./dontTriggerOn.json') ? [] : JSON.parse(fs.readFileSync('./dontTriggerOn.json')));

const Enums = {
	tba: 'TBA',
	d2: 'Dust 2',
	trn: 'Train',
	mrg: 'Mirage',
	inf: 'Inferno',
	ovp: 'Overpass',
	cch: 'Cache',
	nuke: 'Nuke'
};

client.once('ready', () => {
	function getMatchInformation() {
		HLTV.getEvent({id: parseInt(config.eventID)}).then((event) => {
			HLTV.getResults({pages: 1}).then(async (res) => {
				var majorMatches = [];
				for (let i in res) {
					if (res[i] && res[i].event && res[i].event.id === parseInt(config.eventID)) {
						majorMatches.push(res[i]);
					}
				}

				majorMatches.reverse();

				const embed = new Discord.MessageEmbed();
				embed.setColor(Discord.Util.resolveColor(config.embedColor));
				embed.setTitle(event.name);
				embed.setURL('https://www.hltv.org/results?event=' + parseInt(config.eventID));
				embed.setDescription('**Prize Pool:** ' + event.prizePool + '\n**Teams (' + event.teams.length + ')**\n' + event.teams.map((team) => team.name).join(', ') + '\n' + String.fromCodePoint(0x200B));

				var allowedToSend = false;
				for (let i in majorMatches) {
					if (!dontTriggerOn.includes(majorMatches[i].id)) {
						allowedToSend = true;
						dontTriggerOn.push(majorMatches[i].id);
						fs.writeFileSync('./dontTriggerOn.json', JSON.stringify(dontTriggerOn, null, 4));
					} else {
						continue;
					}

					var matchInfo = await HLTV.getMatch({ id: majorMatches[i].id });

					var duration = new Date().getTime() - matchInfo.date;
					var description = [
						'__**Match winner: ' + matchInfo.winnerTeam.name + '**__',
						'**Results:** ' + matchInfo.maps.map((map) => {
							return Enums[map.name] + ': ' + map.result;
						}).join('\n' + String.fromCodePoint(0x200B) + '		'),
						'**Time since match start:** ' + moment.duration(duration).format(' D [days], H [hrs], m [mins], s [secs]'),
						'**Format:** ' + matchInfo.format
					];

					embed.addField(majorMatches[i].team1.name + ' **VS** ' + majorMatches[i].team2.name, description.join('\n') + '\n' + String.fromCodePoint(0x200B));
				}

				if (allowedToSend === true) client.channels.get(config.channelID).send({ embed: embed });
			});
		});
	}
	setInterval(getMatchInformation, parseInt(config.loopDelay));
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'info') {
		var m = await msg.channel.send({ embed: { title: 'Getting data... Please wait!' } });
		var startDate = new Date().getTime();

		HLTV.getEvent({id: parseInt(config.eventID)}).then((event) => {
			const embed = new Discord.MessageEmbed();
			embed.setColor(Discord.Util.resolveColor(config.embedColor));
			embed.setTitle(event.name);
			embed.setURL('https://www.hltv.org/events/' + parseInt(config.eventID) + '/' + encodeURI(event.name.toLowerCase().replace(/ /g, '-')));
			embed.setDescription('**Prize Pool:** ' + event.prizePool + '\n**Teams (' + event.teams.length + '):** ' + event.teams.map((team) => team.name).join(', ') + '\n' + String.fromCodePoint(0x200B));

			HLTV.getMatches().then(async (res) => {
				var majorMatches = [];
				for (let i in res) {
					if (res[i] && res[i].event && res[i].event.id === parseInt(config.eventID)) {
						majorMatches.push(res[i]);
					}
				}

				for (let i in majorMatches) {
					var matchInfo = await HLTV.getMatch({ id: majorMatches[i].id });

					var duration = majorMatches[i].date - new Date().getTime();
					var description = [
						'**Live in:** ' + ((duration <= 0 && matchInfo.live === false) ? ('LIVE') : (moment.duration(duration).format(' D [days], H [hrs], m [mins], s [secs]'))),
						'**Format:** ' + matchInfo.format,
						'**Rating:** ' + ((majorMatches[i].stars <= 0) ? ('0 Stars') : ('⭐'.repeat(majorMatches[i].stars))),
						'**' + ((matchInfo.maps.length === 1) ? ('Map') : ('Maps')) + ':** ' + matchInfo.maps.map((map) => Enums[map.name]).join(', '),
						'**Streams:** ' + matchInfo.streams.map((stream) => {
							if (stream.name === 'HLTV Live') stream.link = 'https://hltv.org' + stream.link;
							else if (stream.name === 'GOTV') return 'GOTV';

							return '[' + stream.name + '](' + stream.link + ')';
						}).join(', ')
					];

					embed.addField(majorMatches[i].team1.name + ' **VS** ' + majorMatches[i].team2.name, description.join('\n') + '\n' + String.fromCodePoint(0x200B));
				}

				embed.setFooter('Fetching data took ' + (new Date().getTime() - startDate) + 'ms');
				m.edit({ embed: embed });
			}).catch((err) => {
				console.error(err);
				m.edit({ embed: { title: 'Error while getting data' } });
			});
		}).catch((err) => {
			console.error(err);
			m.edit({ embed: { title: 'Error while getting data' } });
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);

process.on('uncaughtException', (e) => console.error(e));
process.on('unhandledRejection', (e) => console.error(e));
