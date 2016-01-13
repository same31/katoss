var debugInfo  = ~process.argv.indexOf('--debug'),
    config     = require('./config.json'),
    Subtitles  = require('./src/subtitles'),
    Torrent    = require('./src/torrent'),
    utils      = require('./src/utils'),
    Promise    = require('promise'),
    fs         = require('fs'),
    path       = require('path'),
    outputPath = config.outputPath || '.';

function Katoss (tvdbid, show, season, episode, languages, currentQuality, notifyManager) {
    this.handleError = function (error) {
        console.log(show, 'S' + season + 'E' + episode);
        console.log(error, '\n');
        this.callback && this.callback();
        return Promise.reject(error);
    };

    this.searchSubtitles = function () {
        return Subtitles.search(show, season, episode, languages).then(function (subtitleList) {
            debugInfo && console.log('Valid subtitles name list', subtitleList);

            this.subtitles = {};

            if (subtitleList.length <= 0) {
                return this.handleError('No subtitles found.');
            }

            this.subtitles = subtitleList.reduce(function (subs, subInfo) {
                var lang         = subInfo.langId,
                    distribution = subInfo.distribution;

                subs[lang] || (subs[lang] = {});
                subs[lang][distribution] || (subs[lang][distribution] = []);

                subs[lang][distribution].push(subInfo);

                return subs;
            }, this.subtitles);
        }.bind(this));
    };

    this.searchTorrents = function () {
        return Torrent.searchEpisode(show, season, episode).catch(this.handleError).then(function (torrentList) {
            var priority     = config.priority || ['quality', 'language', 'distribution'];
            this.torrentList = torrentList.filter(function (torrentInfo) {
                var title        = torrentInfo.title.trim(),
                    ignoredWords = config.ignoredWords || [],
                    regIgnoredWords,
                    quality,
                    distribution,
                    potentialSubLanguages,
                    lang;

                if (ignoredWords.length > 0) {
                    regIgnoredWords = new RegExp(ignoredWords.join('|'), 'i');
                    if (regIgnoredWords.test(title)) {
                        return false;
                    }
                }

                if (!utils.releaseNameIsValid(title, show, season, episode)) {
                    return false;
                }

                quality = utils.getReleaseQuality(torrentInfo.title);
                if (!~config.qualityOrder.indexOf(quality) || !utils.qualityIsHigherThanCurrent(quality, currentQuality, config.qualityOrder)) {
                    return false;
                }

                distribution = utils.getDistribution(torrentInfo.title);
                if (!~config.distributionOrder.indexOf(distribution)) {
                    return false;
                }

                // Check potential language matches
                // --------------------------------
                potentialSubLanguages = [];
                for (lang in this.subtitles) {
                    if (!this.subtitles.hasOwnProperty(lang)) {
                        continue;
                    }
                    if (((this.subtitles[lang][distribution] || []).concat(distribution !== 'UNKNOWN' && this.subtitles[lang]['UNKNOWN'] || [])).length > 0) {
                        potentialSubLanguages.push(lang);
                    }
                }

                if (potentialSubLanguages.length <= 0) {
                    return false;
                }

                torrentInfo.quality               = quality;
                torrentInfo.distribution          = utils.getDistribution(torrentInfo.title);
                torrentInfo.potentialSubLanguages = potentialSubLanguages;

                return true;
            }, this);

            if (this.torrentList.length <= 0) {
                return this.handleError('No torrents found.');
            }

            this.torrentList = priority.slice().reverse().reduce(function (torrentList, criteria) {
                criteria = criteria.toLowerCase();

                if (criteria === 'quality') {
                    return torrentList.sort(function (a, b) {
                        return config.qualityOrder.indexOf(a.quality) - config.qualityOrder.indexOf(b.quality);
                    });
                }
                if (criteria === 'distribution') {
                    return torrentList.sort(function (a, b) {
                        return config.qualityOrder.indexOf(a.distribution) - config.qualityOrder.indexOf(b.distribution);
                    });
                }
                if (criteria === 'language') {
                    return torrentList.sort(function (a, b) {
                        var reducer = function (prevLang, lang) {
                            return Math.min(languages.indexOf(prevLang), languages.indexOf(lang));
                        };
                        return a.potentialSubLanguages.reduce(reducer) - b.potentialSubLanguages.reduce(reducer);
                    });
                }
                if (criteria === 'hevc') {
                    return torrentList.sort(function (a, b) {
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

                // Unknown criteria
                // ----------------
                return torrentList;
            }, this.torrentList);

            debugInfo && console.log(this.torrentList);
        }.bind(this));
    };

    this.downloadMatchingTorrentAndSubtitles = function () {
        return this.torrentList.some(function (torrentInfo) {
            return languages.some(function (lang) {
                if (!~torrentInfo.potentialSubLanguages.indexOf(lang)) {
                    return false;
                }
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
                        filteredSubDistributionList = this.subtitles[lang][torrentInfo.distribution].filter(function (subInfo) {
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
                        filteredSubDistributionList = this.subtitles[lang][torrentInfo.distribution] || [];
                    }

                    if (filteredSubDistributionList.length <= 0) {
                        debugInfo && console.log(show, 'S' + season + 'E' + episode);
                        debugInfo && console.log('"' + lang +
                            '" subtitles for', torrentInfo.distribution, 'distribution', torrentRipTeam, 'team not found.');
                        return false;
                    }

                    subInfo = filteredSubDistributionList[0];

                    console.log(show, 'S' + season + 'E' + episode);
                    console.log('>>>', '[' + torrentInfo.provider + ']', torrentInfo.quality, torrentInfo.distribution, torrentRipTeam);
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
            .then(function () {
                return this.searchTorrents();
            }.bind(this))
            .then(function () {
                this.downloadMatchingTorrentAndSubtitles() || this.handleError('No match found between subtitles and torrents.');
            }.bind(this));
    };
}

module.exports = Katoss;
