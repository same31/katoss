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

function katoss(searchJSON, notifyManager) {
    var config = require('./config.json'),
        mkdirp = require('mkdirp'),
        chmod = require('chmod'),
        path = require('path'),
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
                        (function (tvdbid, show, season, episode, languages) {
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
                                                        decodedTorrentContent = Torrent.decodeTorrentContent(torrentContent),
                                                        torrentName,
                                                        episodeFilename,
                                                        torrentFilename,
                                                        subtitleFilePath,
                                                        subtitleFilename,
                                                        subInfo;

                                                    if (Torrent.checkEpisodeTorrentContent(decodedTorrentContent)) {
                                                        torrentName = Torrent.getTorrentName(decodedTorrentContent);
                                                        subtitleFilePath = path.join(outputPath, torrentName);
                                                        episodeFilename = Torrent.getEpisodeFilename(decodedTorrentContent);
                                                        torrentFilename = path.join(outputPath, torrentFile.filename);

                                                        subInfo = subs[lang][distribution][0];

                                                        console.log(' ' + quality, distribution, lang);
                                                        console.log(' Torrent:', torrents[quality][distribution][index].title);
                                                        console.log(' Episode filename:', episodeFilename);
                                                        console.log(' Sub:', subInfo.MovieReleaseName);

                                                        subtitleFilename = path.join(subtitleFilePath,
                                                            episodeFilename.substr(0, episodeFilename.lastIndexOf('.')) + '.srt');

                                                        // 1. Create directory where to download subtitles,
                                                        //    where the movie file will be downloaded
                                                        // 2. Download subtitles
                                                        // 3. Download torrent file (.torrent.tmp)
                                                        // 4. Notify manager (sick rage)
                                                        // 5. Rename .torrent.tmp file to .torrent
                                                        // ================================================
                                                        (function (torrentFilename, torrentContent) {
                                                            mkdirp(path.join(outputPath, torrentName), function (err, subtitleDir) {
                                                                if (err) {
                                                                    return console.log('Cannot create subtitle dir');
                                                                }
                                                                chmod(subtitleDir, 777);
                                                                opensubtitles.download(subInfo.IDSubtitleFile, subtitleFilename, function () {
                                                                    var hasToNotifyManager = notifyManager && tvdbid;
                                                                    fs.writeFile(torrentFilename + (hasToNotifyManager ? '.tmp' : ''), torrentContent, 'binary', hasToNotifyManager && function () {
                                                                            notifyManager(tvdbid, season, episode, function () {
                                                                                fs.rename(torrentFilename + '.tmp', torrentFilename);
                                                                            });
                                                                        });
                                                                });
                                                            });

                                                        })(torrentFilename, torrentContent);

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
                        })(showInfo.tvdbid, show, season, episode, languages);
                    });
                }
            }
        });
    });
}

module.exports = katoss;
