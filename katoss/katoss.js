function getDistribution (title) {
    var match = title.match(/HDTV|WEB.DL|WEB.?RIP|BRRIP|BDRIP|BLURAY/i);
    return match
        ? match[0].toUpperCase()
        .replace(/WEB.DL|WEB.?RIP/, 'WEB-DL')
        .replace(/BRRIP|BDRIP|BLURAY/, 'BLURAY')
        : 'UNKNOWN';
}

function releaseNameIsValid (releaseName, show, season, episode) {
    show = show.trim()
        .replace(/ ?\(\d{4}\)$/g, '')
        .replace(/'/g, '\'?')
        .replace(/ ?& ?/g, '.+')
        .replace(/ +/g, '.')
        .replace(/.+/g, '.');
    var reg = new RegExp('^' + show + '.+(S' + season + 'E' + episode + '|' + season + 'x' + episode + '|' +
        parseInt(season) + 'x' + episode + '|' + season + 'x' + parseInt(episode) + '|' +
        parseInt(season) + 'x' + parseInt(episode) + ')', 'i');
    return reg.test(releaseName.trim());
}

function katoss (searchJSON, notifyManager) {
    var config        = require('./config.json'),
        mkdirp        = require('mkdirp'),
        path          = require('path'),
        outputPath    = config.outputPath || '.',
        Torrent       = require('./torrent'),
        fs            = require('fs'),
        opensubtitles = require('./opensubtitles'),
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
                    episodeList.forEach(function (episode) {
                        // Search available subtitles for TV show episode
                        // ----------------------------------------------
                        (function (tvdbid, show, season, episode, languages) {
                            opensubtitles.search(show, season, episode, languages, function (subtitleList) {
                                var filteredSubs = subtitleList.filter(function (subInfo) {
                                        return releaseNameIsValid(subInfo.SubFileName, show, season, episode);
                                    }),
                                    subs         = {},
                                    torrents     = {};

                                filteredSubs.forEach(function (subInfo) {
                                    var lang         = subInfo.SubLanguageID,
                                        distribution = getDistribution(subInfo.SubFileName);

                                    distribution === 'UNKNOWN' && (distribution = getDistribution(subInfo.MovieReleaseName));

                                    subs[lang] || (subs[lang] = {});
                                    subs[lang][distribution] || (subs[lang][distribution] = []);

                                    subs[lang][distribution].push(subInfo);
                                });

                                if (filteredSubs.length <= 0) {
                                    console.log(show, 'S' + season + 'E' + episode);
                                    return console.log('No subtitles found.\n');
                                }

                                Torrent.searchEpisode(show, season, episode, function (err, response) {
                                    if (err) {
                                        return console.log('KickAssTorrent connection problem', err);
                                    }

                                    var filteredTorrents = response.list.filter(function (torrentInfo) {
                                        var title           = torrentInfo.title.trim(),
                                            regIgnoredWords = new RegExp(config.ignoredWords.join('|'), 'i');

                                        return releaseNameIsValid(title, show, season, episode) && !regIgnoredWords.test(title);
                                    });

                                    filteredTorrents.forEach(function (torrentInfo) {
                                        var match        = torrentInfo.title.match(/480p|720p|1080p/i),
                                            quality      = match ? match[0].toLowerCase() : 'UNKNOWN',
                                            distribution = getDistribution(torrentInfo.title);

                                        torrents[quality] || (torrents[quality] = {});
                                        torrents[quality][distribution] || (torrents[quality][distribution] = []);

                                        torrents[quality][distribution].push(torrentInfo);
                                    });

                                    if (filteredTorrents.length <= 0) {
                                        console.log(show, 'S' + season + 'E' + episode);
                                        return console.log('No torrents found.\n');
                                    }

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
                                                    var torrentFile    = Torrent.extractTorrentFilenameAndUrl(torrentInfo.torrentLink),
                                                        torrentContent = Torrent.downloadTorrentFileContent(torrentFile.url),
                                                        decodedTorrentContent,
                                                        episodeFilename,
                                                        torrentFilename,
                                                        subtitleFilename,
                                                        subInfo;

                                                    if (!torrentContent) {
                                                        return false;
                                                    }

                                                    decodedTorrentContent = Torrent.decodeTorrentContent(torrentContent);

                                                    if (Torrent.checkEpisodeTorrentContent(decodedTorrentContent)) {
                                                        episodeFilename = Torrent.getEpisodeFilename(decodedTorrentContent);
                                                        torrentFilename = path.join(outputPath, torrentFile.filename);

                                                        subInfo = subs[lang][distribution][0];

                                                        console.log(show, 'S' + season + 'E' + episode);
                                                        console.log('>>>', quality, distribution, lang);
                                                        console.log(' Torrent:', torrents[quality][distribution][index].title);
                                                        console.log(' Episode filename:', episodeFilename);
                                                        console.log(' Sub:', subInfo.SubFileName, '[' + subInfo.MovieReleaseName + ']\n');

                                                        subtitleFilename = path.join(outputPath,
                                                            episodeFilename.substr(0, episodeFilename.lastIndexOf('.') + 1) + lang.substr(0, 2) + '.srt');

                                                        // 1. Download & write subtitles file
                                                        // 2. Write torrent file (.torrent.tmp)
                                                        // 3. Notify manager (sick rage)
                                                        // 4. Rename .torrent.tmp file to .torrent
                                                        // =======================================
                                                        (function (torrentFilename, torrentContent) {
                                                            opensubtitles.download(subInfo.IDSubtitleFile, subtitleFilename, function () {
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
                        })(showInfo.tvdbid, show, season, episode, languages);
                    });
                }
            }
        });
    });
}

module.exports = katoss;
