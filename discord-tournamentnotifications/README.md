# Discord Tournament Notifications
Checks HLTV for results and writes a message in a specific channel when a new result of a specific event appears.

Also provides a "info" command to show the upcoming matches of the event.

*This is untested, I am using the current CSGO Major to test it*

### Config Explanation

`eventID`: Integer of your event. In this example we use the ID of [this event](https://www.hltv.org/events/3885/faceit-major-2018-main-qualifier). You can get the ID just from the URL.

`embedColor`: HEX Code of the color you want to use in the embed

`channelID`: Channel ID where to write results to

`loopDelay`: Delay in milliseconds how long to wait between checks
