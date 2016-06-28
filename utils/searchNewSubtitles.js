var path                = require('path'),
    find                = require('find'),
    config              = require('../katoss/config.json'),
    utils               = require('../katoss/src/utils'),
    subtitles           = require('../katoss/src/subtitles'),
    sendSickBeardAPICmd = require('./sendSickBeardAPICmd'),
    sendKodiAPICmd      = require('./sendKodiAPICmd'),
    minDate             = new Date();

minDate.setMonth(minDate.getMonth() - 6);

sendKodiAPICmd(
    'VideoLibrary.GetEpisodes',
    {
        properties: ['showtitle', 'season', 'episode', 'playcount']
    },
    (err, response, body) => {
        if (err) {
            console.log(err);
            return;
        }

        var kodiEpisodes = body.result.episodes.reduce((kodiEpisodes, episode) => {
            if (episode.playcount <= 0) {
                kodiEpisodes[episode.showtitle] || (kodiEpisodes[episode.showtitle] = {});
                kodiEpisodes[episode.showtitle][episode.season] || (kodiEpisodes[episode.showtitle][episode.season] = []);
                kodiEpisodes[episode.showtitle][episode.season].push(episode.episode);
            }
            return kodiEpisodes;
        }, {});

        // Retrieve all 'downloaded' episodes from SickBeard and check whether they were not viewed in Kodi
        // ================================================================================================
        sendSickBeardAPICmd('shows', { 'sort': 'name', 'paused': 0 }, function (showList) {
            var showName;
            for (showName in showList) {
                if (!showList.hasOwnProperty(showName) || !kodiEpisodes[showName]) {
                    continue;
                }

                (function (show) {
                    var languages  = config.showLanguages && config.showLanguages[show.show_name] || config.languages,
                        showLogged = false;
                    sendSickBeardAPICmd('show.seasons', { tvdbid: show.tvdbid }, function (seasonList) {
                        var seasonNumber;
                        for (seasonNumber in seasonList) {
                            if (!seasonList.hasOwnProperty(seasonNumber) || !kodiEpisodes[show.show_name][seasonNumber]) {
                                continue;
                            }

                            var seasonLogged = false,
                                episodeList  = seasonList[seasonNumber],
                                episodeNumber,
                                episodeInfo;
                            for (episodeNumber in episodeList) {
                                if (!episodeList.hasOwnProperty(episodeNumber) || !~kodiEpisodes[show.show_name][seasonNumber].indexOf(parseInt(episodeNumber))) {
                                    continue;
                                }
                                episodeInfo = episodeList[episodeNumber];

                                if (episodeInfo.location && episodeInfo.release_name && (new Date(episodeInfo.airdate)) > minDate) {
                                    showLogged || (showLogged = true) && console.log(show.show_name);
                                    seasonLogged || (seasonLogged = true) && console.log(seasonNumber + ':');
                                    console.log(episodeNumber);
                                    // Check if downloaded subtitles match preferred language
                                    // ======================================================

                                    // Get episode available sub known lang list
                                    // -----------------------------------------
                                    (function (episodeInfo, seasonNumber, episodeNumber) {
                                        find.file(
                                            new RegExp('^' + utils.escapeRegExpPattern(episodeInfo.release_name) + '\.[a-z]{2}\.srt$'),
                                            path.resolve(episodeInfo.location.substr(0, episodeInfo.location.lastIndexOf(path.sep))),
                                            function (files) {
                                                var subLangList    = files && files.length > 0
                                                        ? files.map(file => file.match(/(..)\.srt$/)[1])
                                                        : [],
                                                    neededLangList = [];

                                                for (var i = 0, l = languages.length; i < l; i++) {
                                                    var lang = languages[l];
                                                    if (subLangList.indexOf(lang.substr(0, 2)) === -1) {
                                                        neededLangList.push(lang);
                                                    }
                                                    else {
                                                        break;
                                                    }
                                                }

                                                if (neededLangList.length > 0) {
                                                    var distribution = utils.getDistribution(episodeInfo.release_name),
                                                        team         = utils.formatRipTeam(utils.getRipTeam(episodeInfo.release_name))
                                                            .replace(/^SICK(BEARD|RAGE)$/, 'UNKNOWN');
                                                    // Search subtitles for this release
                                                    // ---------------------------------
                                                    subtitles.search(show.show_name, seasonNumber, episodeNumber, neededLangList)
                                                        .then(function (subtitleList) {
                                                            subtitleList = subtitleList.sort(function (a, b) {
                                                                return neededLangList.indexOf(a.langId) - neededLangList.indexOf(b.langId);
                                                            });

                                                            function downloadSubs (subInfo) {
                                                                console.log(subInfo);
                                                                subtitles.download(
                                                                    subInfo,
                                                                    episodeInfo.location.substr(0, episodeInfo.location.lastIndexOf('.') + 1) +
                                                                    subInfo.langId.substr(0, 2) + '.srt'
                                                                ).then(function () {
                                                                    console.log('Subtitles file downloaded.');
                                                                });
                                                                return true;
                                                            }

                                                            team === 'UNKNOWN'
                                                                ?
                                                                subtitleList.some(function (subInfo) {
                                                                    return subInfo.distribution === distribution && downloadSubs(subInfo);
                                                                })
                                                                : (
                                                            subtitleList.some(function (subInfo) {
                                                                return subInfo.distribution === distribution && utils.ripTeamMatchFoundInList([subInfo.team], team) &&
                                                                    downloadSubs(subInfo);
                                                            })
                                                            ||
                                                            subtitleList.some(function (subInfo) {
                                                                return utils.ripTeamMatchFoundInList([subInfo.team], team) && downloadSubs(subInfo);
                                                            }));
                                                        });

                                                }
                                            }
                                        );
                                    })(episodeInfo, seasonNumber, episodeNumber);
                                }
                                else if (!episodeInfo.status) {
                                    console.log(show, seasonNumber, episodeNumber, 'status not retrieved');
                                }
                            }
                        }
                    });
                })(showList[showName]);
            }
        });
    });
