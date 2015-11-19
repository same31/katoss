var search = require('./search.json'),
	config = require('./config.json'),
	Torrent = require('./torrent'),
	fs = require('fs'),
	xmlrpc = require('xmlrpc'),
	client = xmlrpc.createClient({ host: 'api.opensubtitles.org', port: 80, path: '/xml-rpc'}),
	kickass = require('kickass-torrent'),
	show, season, episodeList;
	
function getDistribution (title) {
	var match = title.match(/HDTV|WEB.DL|BRRIP|BDRIP|BluRay/i);
	return match
		? match[0].toUpperCase()
				.replace(/WEB.DL/, 'WEB-DL')
				.replace(/BRRIP|BDRIP|BluRay/, 'BLURAY')
		: 'UNKNOWN';
}

// Login to opensubtitles api
client.methodCall('LogIn', ['', '', 'fr', 'webcoreTv v1'], function (err, response) {
	if (err) {
		return console.log('OpenSubtitles connection problem', err);
	}
	var token = response.token,
		showInfo;
	
	for (show in search) {
		showInfo = search[show];
		for (season in showInfo.Seasons) {
			episodeList = showInfo.Seasons[season];
			episodeList.forEach(episode => {
				client.methodCall('SearchSubtitles', [token, [{'sublanguageid': showInfo.Languages.join(), 'query': show, 'season': season, 'episode': episode}]], function (err, response) {
					if (err || ! response.data) {
						return console.log('OpenSubtitles connection problem', err, response);
					}
					
					var filteredSubs = response.data.filter(subInfo => {
						var reg = new RegExp('^' + show + '.+(S' + season + 'E' + episode + '|' + season + 'x' + episode + '|' + parseInt(season) + 'x' + episode + '|' + season + 'x' + parseInt(episode) + '|' + parseInt(season) + 'x' + parseInt(episode) + ')', 'i');
						return reg.test(subInfo.MovieReleaseName.trim());
					}),
						subs = {},
						torrents = {};

					filteredSubs.forEach(subInfo => {
						var lang = subInfo.SubLanguageID,
							distribution = getDistribution(subInfo.MovieReleaseName);
						
						subs[lang] || (subs[lang] = {});
						subs[lang][distribution] || (subs[lang][distribution] = []);

						subs[lang][distribution].push(subInfo);
					});

					kickass({q: show + ' S' + season + 'E' + episode}, function (err, response) {
						if (err) {
							return console.log('KickAss Torrent connection problem', err);
						}
						
						var filteredTorrents = response.list.filter(torrentInfo => {
							var reg = new RegExp('^' + show + '.+(S' + season + 'E' + episode + '|' + season + 'x' + episode + ')', 'i');
							return reg.test(torrentInfo.title.trim());
						});
						
						filteredTorrents.forEach(torrentInfo => {
							var match = torrentInfo.title.match(/480p|720p|1080p/i),
								quality = match ? match[0].toLowerCase() : 'UNKNOWN',
								distribution = getDistribution(torrentInfo.title);
							
							torrents[quality] || (torrents[quality] = {});
							torrents[quality][distribution] || (torrents[quality][distribution] = []);
							
							torrents[quality][distribution].push(torrentInfo);
						});
						
						console.log("\n\n" + show, 'S' + season + 'E' + episode);
						
						var found = config.qualityOrder.some(quality => {
							if (! torrents[quality]) {
								return false;
							}
							return config.distributionOrder.some(distribution => {
								if (! torrents[quality][distribution]) {
									return false;
								}
								// Check sub compatibility
								// -----------------------
								return showInfo.Languages.some(lang => {
									if (!subs[lang] || !subs[lang][distribution]) {
										return false;
									}
									
									var eligibleTorrents = torrents[quality][distribution];
									
									return eligibleTorrents.some((torrentInfo, index) => {
										var torrentFile = Torrent.extractTorrentFilenameAndUrl(torrentInfo.torrentLink),
										torrentContent = Torrent.downloadTorrentFileContent(torrentFile.url);
										if (Torrent.checkEpisodeTorrentContent(torrentContent)) {
											fs.writeFileSync(torrentFile.filename, torrentContent, 'binary');
											
											console.log(quality, distribution, lang);
											console.log(' Torrent:', torrents[quality][distribution][index].title);
											console.log(' Sub:', subs[lang][distribution][0].MovieReleaseName);
											
											return true;
										}
									});						
								});
								
							});
						});
						
						if (! found) {
							console.log('Not found.');
						}
					})
				});
			});
		}
	}
	
	client.methodCall('LogOut', [token], function () {});
});


