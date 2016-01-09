var queue = {
    jobList:     [],
    concurrency: 5,
    activeJobs:  0,
    push:        function () {
        var jobs = Array.prototype.slice.call(arguments);
        Array.prototype.push.apply(this.jobList, jobs);
    },
    start:       function () {
        var jobs = this.jobList.splice(0, this.concurrency);
        this.activeJobs = this.concurrency;

        jobs.forEach(function (job) {
            setTimeout(function () {
                job(this.next.bind(this));
            }.bind(this), 0);

        }.bind(this));
    },
    next:        function () {
        var jobs = this.jobList.splice(0, 1),
            job  = jobs[0];
        if (job) {
            setTimeout(function () {
                job(this.next.bind(this));
            }.bind(this), 0);
        }
        else {
            this.activeJobs--;
            if (this.activeJobs <= 0) {
                console.log('All jobs done.');
            }
        }
    }
};

function katoss (searchJSON, notifyManager) {
    var debugInfo  = ~process.argv.indexOf('--debug'),
        config     = require('./config.json'),
        subtitles  = require('./subtitles'),
        Torrent    = require('./torrent'),
        utils      = require('./utils'),
        mkdirp     = require('mkdirp'),
        fs         = require('fs'),
        path       = require('path'),
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
            showLanguages = config.showLanguages || {},
            q             = queue;

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
                    var currentQuality = currentQualityList && currentQualityList[index];

                    // Search available subtitles for TV show episode
                    // ----------------------------------------------
                    (function (tvdbid, show, season, episode, languages, currentQuality) {
                        q.push(function (cb) {
                            subtitles.search(show, season, episode, languages).then(function (subtitleList) {
                                var subs,
                                    torrents;

                                debugInfo && console.log('Valid subtitles name list', subtitleList);

                                subs = subtitleList.reduce(function (subs, subInfo) {
                                    var lang         = subInfo.langId,
                                        distribution = subInfo.distribution;

                                    subs[lang] || (subs[lang] = {});
                                    subs[lang][distribution] || (subs[lang][distribution] = []);

                                    subs[lang][distribution].push(subInfo);

                                    return subs;
                                }, {});

                                if (subtitleList.length <= 0) {
                                    console.log(show, 'S' + season + 'E' + episode);
                                    cb();
                                    return console.log('No subtitles found.\n');
                                }

                                Torrent.searchEpisode(show, season, episode).catch(function (err) {
                                    console.log(err);
                                    cb();
                                }).then(function (torrentList) {
                                    var filteredTorrents = torrentList.filter(function (torrentInfo) {
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

                                    if (filteredTorrents.length <= 0) {
                                        console.log(show, 'S' + season + 'E' + episode);
                                        console.log('No torrents found.\n');
                                        return cb();
                                    }

                                    debugInfo && console.log(filteredTorrents);

                                    torrents = filteredTorrents.reduce(function (torrents, torrentInfo) {
                                        var quality      = utils.getReleaseQualityFromAllowed(torrentInfo.title, config.qualityOrder),
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
                                                var subDistributionList,
                                                    eligibleTorrents;
                                                if (!subs[lang] ||
                                                    (subDistributionList = (subs[lang][distribution] || []).concat(distribution !== 'UNKNOWN' && subs[lang]['UNKNOWN'] ||
                                                        [])).length <= 0) {
                                                    return false;
                                                }

                                                eligibleTorrents = torrents[quality][distribution];

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
                                                            filteredSubDistributionList = subDistributionList.filter(function (subInfo) {
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
                                                            filteredSubDistributionList = subs[lang][distribution] || [];
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
                                                            subtitles.download(subInfo, subtitleFilename).then(function () {
                                                                var hasToNotifyManager = notifyManager && tvdbid;

                                                                fs.writeFile(torrentFilename +
                                                                    (hasToNotifyManager ? '.tmp' : ''), torrentContent, 'binary', hasToNotifyManager ?
                                                                    function () {
                                                                        notifyManager(tvdbid, season, episode, function () {
                                                                            fs.rename(torrentFilename + '.tmp', torrentFilename);
                                                                            cb();
                                                                        });
                                                                    } : cb);
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
                                        cb();
                                    }
                                });
                            });
                        });
                    })(showInfo.tvdbid, show, season, episode, languages, currentQuality);

                });
            }
        }

        console.log('Queue started');
        q.start();
    });
}

module.exports = katoss;
