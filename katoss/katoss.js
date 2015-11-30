function katoss(searchJSON, notifyManager) {
    var debugInfo = ~process.argv.indexOf('--debug'),
        config = require('./config.json'),
        subtitles = require('./subtitles'),
        Torrent = require('./torrent'),
        utils = require('./utils'),
        mkdirp = require('mkdirp'),
        fs = require('fs'),
        path = require('path'),
        outputPath = config.outputPath || '.';

    mkdirp(outputPath, function (err) {
        if (err) {
            return console.log('Cannot create directory ' + outputPath, err);
        }

        var show,
            season,
            episodeList,
            currentQualityList,
            showInfo,
            languages,
            showLanguages = config.showLanguages || {};

        for (show in searchJSON) {
            if (!searchJSON.hasOwnProperty(show)) {
                continue;
            }
            showInfo = searchJSON[show];
            languages = showLanguages[show] || config.languages;

            for (season in showInfo.seasons) {
                if (!showInfo.seasons.hasOwnProperty(season)) {
                    continue;
                }

                episodeList = showInfo.seasons[season];
                currentQualityList = showInfo.currentQualities && showInfo.currentQualities[season];
                episodeList.forEach(function (episode, index) {
                    var currentQuality = currentQualityList && currentQualityList[index];

                    // Search available subtitles for TV show episode
                    // ----------------------------------------------
                    (function (tvdbid, show, season, episode, languages, currentQuality) {

                        subtitles.search(show, season, episode, languages).then(function (subtitleList) {
                            var subs,
                                torrents;

                            debugInfo && console.log('Valid subtitles name list', subtitleList);

                            subs = subtitleList.reduce(function (subs, subInfo) {
                                var lang = subInfo.langId,
                                    distribution = subInfo.distribution;

                                subs[lang] || (subs[lang] = {});
                                subs[lang][distribution] || (subs[lang][distribution] = []);

                                subs[lang][distribution].push(subInfo);

                                return subs;
                            }, {});

                            if (subtitleList.length <= 0) {
                                console.log(show, 'S' + season + 'E' + episode);
                                return console.log('No subtitles found.\n');
                            }

                            Torrent.searchEpisode(show, season, episode, function (err, response) {
                                if (err) {
                                    return console.log('Kickass Torrents connection problem', err);
                                }

                                var filteredTorrents = response.list.filter(function (torrentInfo) {
                                    var title = torrentInfo.title.trim(),
                                        ignoredWords = config.ignoredWords || [],
                                        regIgnoredWords;

                                    if (ignoredWords.length > 0) {
                                        regIgnoredWords = new RegExp(ignoredWords.join('|'), 'i');
                                        if (regIgnoredWords.test(title)) {
                                            return false;
                                        }
                                    }

                                    return utils.releaseNameIsValid(title, show, season, episode);
                                });

                                if (filteredTorrents.length <= 0) {
                                    console.log(show, 'S' + season + 'E' + episode);
                                    return console.log('No torrents found.\n');
                                }

                                torrents = filteredTorrents.reduce(function (torrents, torrentInfo) {
                                    var quality = utils.getReleaseQualityFromAllowed(torrentInfo.title, config.qualityOrder),
                                        distribution = utils.getDistribution(torrentInfo.title);

                                    if (utils.qualityIsHigherThanCurrent(quality, currentQuality, config.qualityOrder)) {
                                        torrents[quality] || (torrents[quality] = {});
                                        torrents[quality][distribution] || (torrents[quality][distribution] = []);

                                        torrents[quality][distribution].push(torrentInfo);
                                    }
                                    return torrents;
                                }, {});

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
                                                    subDistributionList = subs[lang][distribution],
                                                    decodedTorrentContent,
                                                    episodeFilename,
                                                    torrentFilename,
                                                    torrentRipTeam,
                                                    subtitleFilename,
                                                    subInfo;

                                                if (!torrentContent) {
                                                    return false;
                                                }

                                                decodedTorrentContent = Torrent.decodeTorrentContent(torrentContent);

                                                if (!decodedTorrentContent) {
                                                    return false;
                                                }

                                                if (Torrent.checkEpisodeTorrentContent(decodedTorrentContent)) {
                                                    episodeFilename = Torrent.getEpisodeFilename(decodedTorrentContent);
                                                    torrentFilename = path.join(outputPath, torrentFile.filename.trim());

                                                    if (~['HDTV', 'UNKNOWN'].indexOf(distribution)) {
                                                        torrentRipTeam = utils.getRipTeam(episodeFilename);
                                                        torrentRipTeam === 'UNKNOWN' && (torrentRipTeam = utils.getRipTeam(torrentInfo.title));
                                                        if (torrentRipTeam !== 'UNKNOWN') {
                                                            subDistributionList = subDistributionList.filter(function (subInfo) {
                                                                return subInfo.team === torrentRipTeam;
                                                            });

                                                            if (subDistributionList.length <= 0) {
                                                                debugInfo && console.log(show, 'S' + season + 'E' + episode);
                                                                debugInfo && console.log('"' + lang +
                                                                    '" subtitles for', distribution, 'distribution', torrentRipTeam, 'team not found.');
                                                                return false;
                                                            }
                                                        }
                                                    }

                                                    subInfo = subDistributionList[0];

                                                    console.log(show, 'S' + season + 'E' + episode);
                                                    console.log('>>>', quality, distribution, lang);
                                                    console.log(' Torrent:', torrents[quality][distribution][index].title.trim());
                                                    console.log(' Episode filename:', episodeFilename.trim());
                                                    console.log(' Sub:', subInfo.SubFileName && subInfo.SubFileName.trim(), subInfo.MovieReleaseName && '[' + subInfo.MovieReleaseName.trim() + ']', '\n');

                                                    subtitleFilename = path.join(outputPath,
                                                        episodeFilename.substr(0, episodeFilename.lastIndexOf('.') + 1) + lang.substr(0, 2) + '.srt');

                                                    // 1. Download & write subtitles file
                                                    // 2. Write torrent file (.torrent.tmp)
                                                    // 3. Notify manager (Sick Beard)
                                                    // 4. Rename .torrent.tmp file to .torrent
                                                    // =======================================
                                                    (function (torrentFilename, torrentContent) {
                                                        subtitles.download(subInfo, subtitleFilename).then(function () {
                                                            var hasToNotifyManager = notifyManager && tvdbid;
                                                            fs.writeFile(torrentFilename +
                                                                (hasToNotifyManager ? '.tmp' : ''), torrentContent, 'binary', hasToNotifyManager && function () {
                                                                    notifyManager(tvdbid, season, episode, function () {
                                                                        fs.rename(torrentFilename + '.tmp', torrentFilename);
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
                                    console.log(show, 'S' + season + 'E' + episode);
                                    console.log('No match found between subtitles and torrents.\n');
                                }
                            });
                        });
                    })(showInfo.tvdbid, show, season, episode, languages, currentQuality);
                });
            }
        }
    });
}

module.exports = katoss;
