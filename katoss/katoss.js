function getDistribution(title) {
    var match = title.match(/HDTV|WEB.DL|BRRIP|BDRIP|BluRay/i);
    return match
        ? match[0].toUpperCase()
        .replace(/WEB.DL/, 'WEB-DL')
        .replace(/BRRIP|BDRIP|BluRay/, 'BLURAY')
        : 'UNKNOWN';
}

function releaseNameIsValid(releaseName, show, season, episode) {
    var reg = new RegExp('^' + show.replace(/ +/g, '.') + '.+(S' + season + 'E' + episode + '|' + season + 'x' + episode + '|' +
        parseInt(season) + 'x' + episode + '|' + season + 'x' + parseInt(episode) + '|' +
        parseInt(season) + 'x' + parseInt(episode) + ')', 'i');
    return reg.test(releaseName.trim());
}

function katoss(searchJSON) {
    var config = require('./config.json'),
        mkdirp = require('mkdirp'),
        outputPath = config.outputPath || '.',
        Torrent = require('./torrent'),
        fs = require('fs'),
        opensubtitles = require('./opensubtitles'),
        url = require('url'),
        show,
        season,
        episodeList;

    mkdirp(outputPath, function (err) {
        if (err) {
            return console.log('Cannot create directory ' + outputPath, err);
        }

        // Login to opensubtitles api
        // --------------------------
        opensubtitles.login(function () {
            var showInfo,
                languages;

            for (show in searchJSON) {
                if (!searchJSON.hasOwnProperty(show)) {
                    continue;
                }
                showInfo = searchJSON[show];
                languages = showInfo.languages || config.languages;

                for (season in showInfo.seasons) {
                    if (!showInfo.seasons.hasOwnProperty(season)) {
                        continue;
                    }
                    episodeList = showInfo.seasons[season];
                    episodeList.forEach(function (episode) {
                        // Search available subtitles for TV show episode
                        // ----------------------------------------------
                        (function (season, show, episode, languages) {
                            opensubtitles.search(show, season, episode, languages, function (subtitleList) {
                                var filteredSubs = subtitleList.filter(function (subInfo) {
                                        return releaseNameIsValid(subInfo.MovieReleaseName, show, season, episode);
                                    }),
                                    subs = {},
                                    torrents = {};

                                filteredSubs.forEach(function (subInfo) {
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

                                    var filteredTorrents = response.list.filter(function (torrentInfo) {
                                        var title = torrentInfo.title.trim(),
                                            regIgnoredWords = new RegExp(config.ignoredWords.join('|'), 'i');

                                        return releaseNameIsValid(title, show, season, episode) && !regIgnoredWords.test(title);
                                    });

                                    filteredTorrents.forEach(function (torrentInfo) {
                                        var match = torrentInfo.title.match(/480p|720p|1080p/i),
                                            quality = match ? match[0].toLowerCase() : 'UNKNOWN',
                                            distribution = getDistribution(torrentInfo.title);

                                        torrents[quality] || (torrents[quality] = {});
                                        torrents[quality][distribution] || (torrents[quality][distribution] = []);

                                        torrents[quality][distribution].push(torrentInfo);
                                    });

                                    console.log(show, 'S' + season + 'E' + episode);

                                    var found = config.qualityOrder.some(function (quality) {
                                        if (!torrents[quality]) {
                                            return false;
                                        }
                                        return config.distributionOrder.some(function (distribution) {
                                            if (!torrents[quality][distribution]) {
                                                return false;
                                            }
                                            // Check sub compatibility
                                            // -----------------------
                                            return languages.some(function (lang) {
                                                if (!subs[lang] || !subs[lang][distribution]) {
                                                    return false;
                                                }

                                                var eligibleTorrents = torrents[quality][distribution];

                                                return eligibleTorrents.some(function (torrentInfo, index) {
                                                    var torrentFile = Torrent.extractTorrentFilenameAndUrl(torrentInfo.torrentLink),
                                                        torrentContent = Torrent.downloadTorrentFileContent(torrentFile.url),
                                                        episodeFilename,
                                                        subtitleFilename,
                                                        subInfo;

                                                    if (Torrent.checkEpisodeTorrentContent(torrentContent)) {
                                                        episodeFilename = Torrent.getEpisodeFilename(torrentContent);

                                                        fs.writeFile(outputPath + '/' + torrentFile.filename, torrentContent, 'binary');

                                                        subInfo = subs[lang][distribution][0];

                                                        console.log(' ' + quality, distribution, lang);
                                                        console.log(' Torrent:', torrents[quality][distribution][index].title);
                                                        console.log(' Episode filename:', episodeFilename);
                                                        console.log(' Sub:', subInfo.MovieReleaseName);

                                                        subtitleFilename = outputPath + '/' + episodeFilename + '.' + lang.substr(0, 2) + '.srt';

                                                        opensubtitles.download(subInfo.IDSubtitleFile, subtitleFilename);

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
                        })(season, show, episode, languages);
                    });
                }
            }
        });
    });
}

module.exports = katoss;
