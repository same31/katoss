function getDistribution(title) {
    var match = title.match(/HDTV|WEB.DL|BRRIP|BDRIP|BluRay/i);
    return match
        ? match[0].toUpperCase()
        .replace(/WEB.DL/, 'WEB-DL')
        .replace(/BRRIP|BDRIP|BluRay/, 'BLURAY')
        : 'UNKNOWN';
}

function releaseNameIsValid(releaseName, show, season, episode) {
    var reg = new RegExp('^' + show + '.+(S' + season + 'E' + episode + '|' + season + 'x' + episode + '|' +
        parseInt(season) + 'x' + episode + '|' + season + 'x' + parseInt(episode) + '|' +
        parseInt(season) + 'x' + parseInt(episode) + ')', 'i');
    return reg.test(releaseName.trim());
}

function katoss(searchJSON) {
    var config = require('./config.json'),
        Torrent = require('./torrent'),
        fs = require('fs'),
        zlib = require('zlib'),
        opensubtitles = require('./opensubtitles'),
        xmlrpc = require('xmlrpc'),
        client = xmlrpc.createClient({
            host: 'api.opensubtitles.org',
            port: 80,
            path: '/xml-rpc'
        }),
        url = require('url'),
        show, season, episodeList;

    // Login to opensubtitles api
    // --------------------------
    opensubtitles.login(function (token) {
        var showInfo;

        for (show in searchJSON) {
            if (!searchJSON.hasOwnProperty(show)) {
                continue;
            }
            showInfo = searchJSON[show];

            for (season in showInfo.Seasons) {
                if (!showInfo.Seasons.hasOwnProperty(season)) {
                    continue;
                }
                episodeList = showInfo.Seasons[season];
                episodeList.forEach(episode => {
                    // Search available subtitles for TV show episode
                    // ----------------------------------------------
                    client.methodCall('SearchSubtitles', [token, [{
                        'sublanguageid': showInfo.Languages.join(),
                        'query': show,
                        'season': season,
                        'episode': episode
                    }]], function (err, response) {
                        if (err || !response.data) {
                            return console.log('OpenSubtitles connection problem', err, response);
                        }

                        var filteredSubs = response.data.filter(subInfo => {
                                return releaseNameIsValid(subInfo.MovieReleaseName, show, season, episode);
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

                        Torrent.searchEpisode(show, season, episode, function (err, response) {
                            if (err) {
                                return console.log('KickAssTorrent connection problem', err);
                            }

                            var filteredTorrents = response.list.filter(torrentInfo => {
                                var title = torrentInfo.title.trim(),
                                    regIgnoredWords = new RegExp(config.ignoredWords.join('|'), 'i');

                                return releaseNameIsValid(title, show, season, episode) && !regIgnoredWords.test(title);
                            });

                            filteredTorrents.forEach(torrentInfo => {
                                var match = torrentInfo.title.match(/480p|720p|1080p/i),
                                    quality = match ? match[0].toLowerCase() : 'UNKNOWN',
                                    distribution = getDistribution(torrentInfo.title);

                                torrents[quality] || (torrents[quality] = {});
                                torrents[quality][distribution] || (torrents[quality][distribution] = []);

                                torrents[quality][distribution].push(torrentInfo);
                            });

                            console.log(show, 'S' + season + 'E' + episode);

                            var found = config.qualityOrder.some(quality => {
                                if (!torrents[quality]) {
                                    return false;
                                }
                                return config.distributionOrder.some(distribution => {
                                    if (!torrents[quality][distribution]) {
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
                                                torrentContent = Torrent.downloadTorrentFileContent(torrentFile.url),
                                                episodeFilename,
                                                subInfo;

                                            if (Torrent.checkEpisodeTorrentContent(torrentContent)) {
                                                episodeFilename = Torrent.getEpisodeFilename(torrentContent);

                                                fs.writeFile(torrentFile.filename, torrentContent, 'binary');

                                                subInfo = subs[lang][distribution][0];

                                                console.log(' ' + quality, distribution, lang);
                                                console.log(' Torrent:', torrents[quality][distribution][index].title);
                                                console.log(' Episode filename:', episodeFilename);
                                                console.log(' Sub:', subInfo.MovieReleaseName);

                                                client.methodCall('DownloadSubtitles', [token, [subInfo.IDSubtitleFile]], function (err, response) {
                                                    if (!response.data || !response.data[0] || !response.data[0].data) {
                                                        return console.log('Error while downloading subtitles');
                                                    }

                                                    zlib.unzip(new Buffer(response.data[0].data, 'base64'), function (err, buffer) {
                                                        if (err) {
                                                            return console.log('Error with subtitles unzip');
                                                        }
                                                        fs.writeFile(episodeFilename + '.' + lang.substr(0, 2) + '.srt', buffer);
                                                    });
                                                });

                                                return true;
                                            }
                                        });
                                    });

                                });
                            });

                            if (!found) {
                                console.log('Not found.');
                            }
                            console.log("\n");
                        })
                    });
                });
            }
        }
    });
}

module.exports = katoss;
