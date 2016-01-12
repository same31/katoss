var debugInfo  = ~process.argv.indexOf('--debug'),
    config     = require('./config.json'),
    Subtitles  = require('./src/subtitles'),
    Torrent    = require('./src/torrent'),
    utils      = require('./src/utils'),
    Promise    = require('promise'),
    mkdirp     = require('mkdirp'),
    fs         = require('fs'),
    path       = require('path'),
    outputPath = config.outputPath || '.';

function KatossSearch (tvdbid, show, season, episode, languages, currentQuality, notifyManager) {
    this.handleError = function (error) {
        console.log(show, 'S' + season + 'E' + episode);
        console.log(error, '\n');
        this.callback && this.callback();
        return Promise.reject(error);
    };

    this.searchSubtitles = function () {
        return Subtitles.search(show, season, episode, languages).then(function (subtitleList) {
            debugInfo && console.log('Valid subtitles name list', subtitleList);

            if (subtitleList.length <= 0) {
                return this.handleError('No subtitles found.');
            }

            return subtitleList.reduce(function (subs, subInfo) {
                var lang         = subInfo.langId,
                    distribution = subInfo.distribution;

                subs[lang] || (subs[lang] = {});
                subs[lang][distribution] || (subs[lang][distribution] = []);

                subs[lang][distribution].push(subInfo);

                return subs;
            }, {});
        }.bind(this));
    };

    this.searchTorrents = function () {
        return Torrent.searchEpisode(show, season, episode).catch(this.handleError).then(function (torrentList) {
            torrentList = torrentList.filter(function (torrentInfo) {
                var title        = torrentInfo.title.trim(),
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

            if (torrentList.length <= 0) {
                return this.handleError('No torrents found.');
            }

            debugInfo && console.log(torrentList);

            return torrentList.reduce(function (torrents, torrentInfo) {
                var quality      = utils.getReleaseQualityFromAllowed(torrentInfo.title, config.qualityOrder),
                    distribution = utils.getDistribution(torrentInfo.title);

                if (utils.qualityIsHigherThanCurrent(quality, currentQuality, config.qualityOrder)) {
                    torrents[quality] || (torrents[quality] = {});
                    torrents[quality][distribution] || (torrents[quality][distribution] = []);

                    torrents[quality][distribution].push(torrentInfo);
                }
                return torrents;
            }, {});
        }.bind(this));
    };

    this.downloadMatchingTorrentAndSubtitles = function (quality, distribution) {
        return languages.some(function (lang) {
            var distributionSubList,
                eligibleTorrents;

            if (!this.subtitles[lang] ||
                (distributionSubList = (this.subtitles[lang][distribution] || []).concat(distribution !== 'UNKNOWN' && this.subtitles[lang]['UNKNOWN'] || [])).length <=
                0) {
                return false;
            }

            eligibleTorrents = this.torrents[quality][distribution];

            if (config.preferHEVC) {
                eligibleTorrents = eligibleTorrents.sort(function (a, b) {
                    var regexp   = /(h|x).?265|HEVC/i,
                        foundInA = regexp.test(a.title),
                        foundInB = regexp.test(b.title);
                    if (foundInA) {
                        return foundInB ? 0 : -1;
                    }
                    if (foundInB) {
                        return 1;
                    }
                    return 0;
                });
            }

            return eligibleTorrents.some(function (torrentInfo) {
                var torrentFile    = Torrent.extractTorrentFilenameAndUrl(torrentInfo),
                    torrentContent = Torrent.downloadTorrentFileContent(torrentFile.url),
                    decodedTorrentContent,
                    filteredSubDistributionList,
                    episodeFilename,
                    torrentFilename,
                    torrentRipTeam,
                    subtitleFilename,
                    subInfo;

                if (!torrentContent || !(decodedTorrentContent = Torrent.decodeTorrentContent(torrentContent))) {
                    return false;
                }

                if (Torrent.checkEpisodeTorrentContent(decodedTorrentContent)) {
                    episodeFilename = Torrent.getEpisodeFilename(decodedTorrentContent);
                    torrentFilename = path.join(outputPath, torrentFile.filename.trim());

                    torrentRipTeam = utils.getRipTeam(episodeFilename);
                    torrentRipTeam === 'UNKNOWN' && (torrentRipTeam = utils.getRipTeam(torrentInfo.title));
                    if (torrentRipTeam !== 'UNKNOWN') {
                        torrentRipTeam              = utils.formatRipTeam(torrentRipTeam);
                        filteredSubDistributionList = distributionSubList.filter(function (subInfo) {
                            var ripTeamList = [torrentRipTeam];
                            subInfo.distribution !== 'UNKNOWN' && ripTeamList.push('UNKNOWN');
                            return utils.ripTeamMatchFoundInList(ripTeamList, subInfo.team);
                        }).sort(function (a, b) {
                            if (a.team === b.team) {
                                return 0;
                            }
                            if (a.team === 'UNKNOWN') {
                                return 1;
                            }
                            return -1;
                        });
                    }
                    else {
                        filteredSubDistributionList = this.subtitles[lang][distribution] || [];
                    }

                    if (filteredSubDistributionList.length <= 0) {
                        debugInfo && console.log(show, 'S' + season + 'E' + episode);
                        debugInfo && console.log('"' + lang +
                            '" subtitles for', distribution, 'distribution', torrentRipTeam, 'team not found.');
                        return false;
                    }

                    subInfo = filteredSubDistributionList[0];

                    console.log(show, 'S' + season + 'E' + episode);
                    console.log('>>>', '[' + torrentInfo.provider + ']', quality, distribution, torrentRipTeam);
                    console.log('   ', '[' + subInfo.provider + ']', lang, subInfo.distribution, subInfo.team);
                    console.log(' Torrent:', torrentInfo.title.trim());
                    console.log(' Episode filename:', episodeFilename.trim());
                    console.log(' Sub: %s\n', subInfo.SubFileName &&
                        subInfo.SubFileName.trim() + ' [' + subInfo.MovieReleaseName.trim() + ']' || subInfo.version);

                    subtitleFilename = path.join(outputPath,
                        episodeFilename.substr(0, episodeFilename.lastIndexOf('.') + 1) + lang.substr(0, 2) + '.srt');

                    // 1. Download & write subtitles file
                    // 2. Write torrent file (.torrent.tmp)
                    // 3. Notify manager (Sick Beard)
                    // 4. Rename .torrent.tmp file to .torrent
                    // =======================================
                    (function (torrentFilename, torrentContent) {
                        Subtitles.download(subInfo, subtitleFilename).then(function () {
                            var hasToNotifyManager = notifyManager && tvdbid;

                            fs.writeFile(torrentFilename +
                                (hasToNotifyManager ? '.tmp' : ''), torrentContent, 'binary', hasToNotifyManager ?
                                function () {
                                    notifyManager(tvdbid, season, episode, function () {
                                        fs.rename(torrentFilename + '.tmp', torrentFilename);
                                        this.callback();
                                    }.bind(this));
                                } : this.callback);
                        }.bind(this));
                    }.bind(this))(torrentFilename, torrentContent);

                    return true;
                }
            }, this);
        }, this);
    };

    this.run = function (callback) {
        this.callback = callback;

        this.searchSubtitles()
            .then(function (subtitles) {
                this.subtitles = subtitles;
                return this.searchTorrents();
            }.bind(this))
            .then(function (torrents) {
                this.torrents = torrents;
                var found     = config.qualityOrder.some(function (quality) {
                    if (!torrents[quality]) {
                        return false;
                    }
                    return config.distributionOrder.some(function (distribution) {
                        if (!torrents[quality][distribution]) {
                            return false;
                        }

                        // Find torrent subtitles matching
                        // -------------------------------
                        return this.downloadMatchingTorrentAndSubtitles(quality, distribution);
                    }, this);
                }, this);

                found || this.handleError('No match found between subtitles and torrents.');
            }.bind(this));
    };
}

function search (searchJSON, notifyManager) {
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
            showLanguages = config.showLanguages || {},
            queue         = utils.queue;

        for (show in searchJSON) {
            if (!searchJSON.hasOwnProperty(show)) {
                continue;
            }
            showInfo  = searchJSON[show];
            languages = showLanguages[show] || config.languages;

            for (season in showInfo.seasons) {
                if (!showInfo.seasons.hasOwnProperty(season)) {
                    continue;
                }

                episodeList        = showInfo.seasons[season];
                currentQualityList = showInfo.currentQualities && showInfo.currentQualities[season];
                episodeList.forEach(function (episode, index) {
                    var currentQuality = currentQualityList && currentQualityList[index],
                        search         = new KatossSearch(showInfo.tvdbid, show, season, episode, languages, currentQuality, notifyManager);

                    queue.push(function (cb) {
                        search.run(cb);
                    });
                });
            }
        }

        console.log('Queue started');
        queue.start();
    });
}

module.exports = search;
