const RedditStream = require('reddit-stream');
const fetch = require('node-fetch');
const Discord = require('discord.js');
const commentStream = new RedditStream('comments', 'AskOuija');
commentStream.start();

commentStream.on('new', async (comments) => {
	var filteredComments = [];

	for (let i in comments) {
		if (!/(goodbye|good bye)/gi.test(comments[i].data.body)) continue;
		if (comments[i].data.subreddit !== 'AskOuija') continue;

		filteredComments.push(comments[i]);
	}

	if (filteredComments.length < 1) return;

	for (let i in filteredComments) {
		var context = await getContextRecrussive(filteredComments[i].data.name);

		var letters = [];
		for (let x in context) {
			if (context[x].data.body.length > 1) continue;
			letters.push(context[x].data.body);
		}

		var helpers = context.map((c) => '[' + Discord.Util.escapeMarkdown(c.data.author) + '](https://www.reddit.com/user/' + c.data.author + ')');
		helpers = Array.from(new Set(helpers));

		var seperator = '\n' + String.fromCodePoint(0x200B);
		var split = Discord.Util.splitMessage(helpers.join(' '), { maxLength: (1024 - seperator.length), char: ' ' });

		var fields = [];
		if (typeof split === 'string') {
			fields.push({ name: 'Thanks to', value: split });
		} else {
			for (let x in split) {
				if (x === 0) {
					fields.push({ name: 'Thanks to', value: split[x] });
				} else if (x === (split.length - 1)) {
					fields.push({ name: String.fromCodePoint(0x200B), value: split[x] });
				} else {
					fields.push({ name: String.fromCodePoint(0x200B), value: split[x] + seperator });
				}
			}
		}

		if (fields.length > 25) {
			fields.splice(25);
			fields[fields.length - 1] = { name: 'And many more!', value: String.fromCodePoint(0x200B) };
		}

		const wb = new Discord.WebhookClient(config.webhook.id, config.webhook.token);

		const embed = new Discord.MessageEmbed();
		embed.setColor(0);
		embed.setTitle((Discord.Util.escapeMarkdown(filteredComments[i].data.link_title).length > 256) ? (Discord.Util.escapeMarkdown(filteredComments[i].data.link_title).substr(0, (256 - 3)) + '...') : (Discord.Util.escapeMarkdown(filteredComments[i].data.link_title)));
		embed.setURL('https://www.reddit.com' + filteredComments[i].data.permalink + '?context=10000');
		embed.setDescription((Discord.Util.escapeMarkdown((/_+/g.test(filteredComments[i].data.link_title) === true ? (filteredComments[i].data.link_title.replace(/_+/g, letters.join(''))) : (letters.join(''))))).length > 2048 ? Discord.Util.escapeMarkdown((/_+/g.test(filteredComments[i].data.link_title) === true ? (filteredComments[i].data.link_title.replace(/_+/g, letters.join(''))) : (letters.join('')))).substr(0, (2048 - 3)) : Discord.Util.escapeMarkdown((/_+/g.test(filteredComments[i].data.link_title) === true ? (filteredComments[i].data.link_title.replace(/_+/g, letters.join(''))) : (letters.join('')))));
		embed.setTimestamp(new Date(parseInt(filteredComments[i].data.created_utc * 1000)));

		for (let x in fields) {
			embed.addField(fields[x].name, fields[x].value);
		}

		await wb.send({ embeds: [ embed ] });
	}
});

function getContextRecrussive(comment_id) {
	return new Promise(async (resolve, reject) => {
		var context = [];

		async function getComment(commentID) {
			var json = await getFetchJSONResponse('https://www.reddit.com/api/info.json?id=' + commentID);

			if (json.data.children[0].data.parent_id === json.data.children[0].data.link_id) {
				context.push(json.data.children[0]);
				context.reverse();

				resolve(context);
				return;
			}

			context.push(json.data.children[0]);
			getComment(json.data.children[0].data.parent_id);
		}
		getComment(comment_id);
	});
}

function getFetchJSONResponse(url) {
	return new Promise(async (resolve, reject) => {
		var res = await fetch(url);
		var json = await res.json();
		resolve(json);
	});
}
