var debugInfo  = ~process.argv.indexOf('--debug'),
    config     = require('./config.json'),
    Subtitles  = require('./src/subtitles'),
    Torrent    = require('./src/torrent'),
    utils      = require('./src/utils'),
    fs         = require('fs'),
    path       = require('path'),
    sortBy     = require('lodash.sortby'),
    outputPath = config.outputPath || '.';

module.exports = function Katoss (tvdbid, show, season, episode, languages, currentQuality, notifyManager) {
    this.handleError = error => {
        console.log(show, 'S' + season + 'E' + episode);
        console.log(error, '\n');
        this.callback && this.callback();
        return Promise.reject(error);
    };

    this.searchSubtitles = () => {
        return Subtitles.search(show, season, episode, languages).then(subtitleList => {
            if (debugInfo) {
                subtitleList.forEach(sub => console.log(`[${sub.provider}][${sub.langId}][${sub.distribution}][${sub.team}]`));
            }
            this.subtitles = {};

            /*if (subtitleList.length <= 0) {
                return this.handleError('No subtitles found.');
            }*/

            this.subtitles = subtitleList.reduce((subs, subInfo) => {
                var lang         = subInfo.langId,
                    distribution = subInfo.distribution;

                subs[lang] || (subs[lang] = {});
                subs[lang][distribution] || (subs[lang][distribution] = []);

                subs[lang][distribution].push(subInfo);

                return subs;
            }, this.subtitles);
        });
    };

    this.searchTorrents = () => {
        return Torrent.searchEpisode(show, season, episode).catch(this.handleError).then(torrentList => {
            var priority      = config.priority || ['quality', 'language', 'distribution'],
                isHevcAllowed = priority.some(criteria => criteria.toLowerCase() === 'hevc');

            this.torrentList = torrentList.filter(torrentInfo => {
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
                        debugInfo && console.log('[IGNORED TORRENT]', title, ' => got ignored word');
                        return false;
                    }
                }

                if (!isHevcAllowed && utils.isHEVC(title)) {
                    debugInfo && console.log('[IGNORED TORRENT]', title, ' => is HEVC');
                    return false;
                }

                if (!utils.releaseNameIsValid(title, show, season, episode)) {
                    debugInfo && console.log('[IGNORED TORRENT]', title, ' => has invalid release name');
                    return false;
                }

                quality = utils.getReleaseQuality(title);
                if (!~config.qualityOrder.indexOf(quality) || !utils.qualityIsHigherThanCurrent(quality, currentQuality, config.qualityOrder)) {
                    debugInfo && console.log('[IGNORED TORRENT]', title, ' => quality', quality, 'is not good enough');
                    return false;
                }

                distribution = utils.getDistribution(title);
                if (!~config.distributionOrder.indexOf(distribution)) {
                    debugInfo && console.log('[IGNORED TORRENT]', title, ' => distribution', distribution, 'not found');
                    return false;
                }

                // Check potential language matches
                // --------------------------------
                potentialSubLanguages = [];
                if (!torrentInfo.subtitles || torrentInfo.subtitles.length <= 0) {
                    for (lang in this.subtitles) {
                        if (!this.subtitles.hasOwnProperty(lang)) {
                            continue;
                        }
                        if (((this.subtitles[lang][distribution] || []).concat(distribution !== 'UNKNOWN' && this.subtitles[lang]['UNKNOWN'] || [])).length > 0) {
                            potentialSubLanguages.push(lang);
                        }
                    }

                    if (potentialSubLanguages.length <= 0) {
                        debugInfo && console.log('[IGNORED TORRENT]', title, ' => cannot find a potential language match');
                        return false;
                    }
                    torrentInfo.subtitles = [];
                }
                torrentInfo.potentialSubLanguages = potentialSubLanguages;

                torrentInfo.title        = title;
                torrentInfo.quality      = quality;
                torrentInfo.distribution = distribution;
                torrentInfo.ripTeam      = utils.getRipTeam(title);

                return true;
            });

            if (this.torrentList.length <= 0) {
                return this.handleError('No torrents found.');
            }

            this.torrentList = priority.slice().reverse().reduce((torrentList, criteria) => {
                criteria = criteria.toLowerCase();

                if (criteria === 'quality') {
                    return sortBy(torrentList, o => config.qualityOrder.indexOf(o.quality));
                }

                if (criteria === 'distribution') {
                    return sortBy(torrentList, o => config.distributionOrder.indexOf(o.distribution));
                }

                if (criteria === 'language') {
                    return sortBy(torrentList, o => o.subtitles.length > 0 ? -1 : o.potentialSubLanguages.reduce((prevLang, lang) => Math.min(languages.indexOf(prevLang), languages.indexOf(lang))));
                }

                if (criteria === 'hevc') {
                    return sortBy(torrentList, o => !utils.isHEVC(o.title));
                }

                // Unknown criteria
                // ----------------
                return torrentList;
            }, this.torrentList);

            if (debugInfo) {
                this.torrentList.forEach(torrentInfo => {
                    console.log('[' + torrentInfo.provider + ']', torrentInfo.title, '[' + torrentInfo.quality + '][' + torrentInfo.distribution +
                        '][' + torrentInfo.ripTeam + ']', torrentInfo.potentialSubLanguages, utils.isHEVC(torrentInfo.title) ? '[HEVC]' : '');
                });
            }
        });
    };

    this.downloadMatchingTorrentAndSubtitles = () => {
        return utils.someSeries(this.torrentList, torrentInfo => utils.someSeries(languages, lang => {
            if (torrentInfo.subtitles.length <= 0 && !~torrentInfo.potentialSubLanguages.indexOf(lang)) {
                return Promise.resolve(false);
            }

            return utils.promisify(Torrent.extractTorrentFilenameAndUrl(torrentInfo)).then(torrentFile => {
                return Torrent.downloadTorrentFileContent(torrentFile.url).then(torrentContent => {
                    var decodedTorrentContent,
                        filteredSubDistributionList = [],
                        episodeFilename,
                        torrentFilename,
                        torrentRipTeam,
                        torrentInfoRipTeam,
                        torrentRipTeamList          = [],
                        subtitleFilename,
                        subInfo;

                    if (!torrentContent || !(decodedTorrentContent = Torrent.decodeTorrentContent(torrentContent))) {
                        return false;
                    }

                    if (Torrent.checkEpisodeTorrentContent(decodedTorrentContent)) {
                        episodeFilename = Torrent.getEpisodeFilename(decodedTorrentContent);
                        torrentFilename = path.join(outputPath, torrentFile.filename.trim());

                        // Prefer to get the rip team from episode filename
                        // ------------------------------------------------
                        torrentRipTeam = utils.getRipTeam(episodeFilename);
                        torrentRipTeam !== 'UNKNOWN' && torrentRipTeamList.push(torrentRipTeam = utils.formatRipTeam(torrentRipTeam));
                        torrentInfo.ripTeam !== 'UNKNOWN' && (torrentInfoRipTeam = utils.formatRipTeam(torrentInfo.ripTeam)) !== torrentRipTeam &&
                        torrentRipTeamList.push(torrentInfoRipTeam);

                        if (torrentInfo.subtitles.length <= 0) {
                            if (torrentRipTeamList.length > 0) {
                                filteredSubDistributionList = (this.subtitles[lang][torrentInfo.distribution] || []);
                                if (torrentInfo.distribution !== 'UNKNOWN' && this.subtitles[lang]['UNKNOWN']) {
                                    filteredSubDistributionList = filteredSubDistributionList.concat(this.subtitles[lang]['UNKNOWN']);
                                }

                                filteredSubDistributionList = filteredSubDistributionList.filter(subInfo => {
                                    var ripTeamList = [].concat(torrentRipTeamList);
                                    subInfo.distribution !== 'UNKNOWN' && ripTeamList.push('UNKNOWN');
                                    return utils.ripTeamMatchFoundInList(ripTeamList, subInfo.team);
                                }).sort((a, b) => {
                                    if (a.team === b.team) {
                                        return 0;
                                    }
                                    if (a.team === 'UNKNOWN') {
                                        return 1;
                                    }
                                    return -1;
                                });
                            }
                            else if (torrentInfo.distribution !== 'UNKNOWN') {
                                filteredSubDistributionList = this.subtitles[lang][torrentInfo.distribution] || [];
                            }

                            if (filteredSubDistributionList.length <= 0) {
                                debugInfo && console.log(show, 'S' + season + 'E' + episode);
                                debugInfo && console.log('"' + lang +
                                    '" subtitles for', torrentInfo.distribution, 'distribution', torrentRipTeamList.join() || 'UNKNOWN', 'team not found.');
                                return false;
                            }

                            subInfo = filteredSubDistributionList[0];
                        }
                        else {
                            subInfo = {};
                        }
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
                        ((torrentFilename, torrentContent) => {
                            (torrentInfo.subtitles.length > 0 ? Promise.resolve() : Subtitles.download(subInfo, subtitleFilename)).then(() => {
                                var hasToNotifyManager = notifyManager && tvdbid;

                                fs.writeFile(torrentFilename +
                                    (hasToNotifyManager ? '.tmp' : ''), torrentContent, 'binary', hasToNotifyManager ?
                                    () => {
                                        notifyManager(tvdbid, season, episode).then(() => {
                                            fs.rename(torrentFilename + '.tmp', torrentFilename);
                                            this.callback();
                                        });
                                    } : this.callback);
                            });
                        })(torrentFilename, torrentContent);

                        return true;
                    }
                });
            });
        }));
    };

    this.run = callback => {
        this.callback = callback;

        this.searchSubtitles()
            .then(this.searchTorrents)
            .then(() => this.downloadMatchingTorrentAndSubtitles().then(found => !found && this.handleError('No match found between subtitles and torrents.')));
    };
};
