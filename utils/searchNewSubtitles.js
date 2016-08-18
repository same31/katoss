var path                = require('path'),
    find                = require('find'),
    config              = require('../katoss/config.json'),
    utils               = require('../katoss/src/utils'),
    subtitles           = require('../katoss/src/subtitles'),
    sendSickBeardAPICmd = require('./include/sendSickBeardAPICmd'),
    sendKodiAPICmd      = require('./include/sendKodiAPICmd'),
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
        sendSickBeardAPICmd('shows', { 'sort': 'name', 'paused': 0 }).then(showList => {
            var showName;
            for (showName in showList) {
                if (!showList.hasOwnProperty(showName) || !kodiEpisodes[showName]) {
                    continue;
                }

                (show => {
                    var languages = config.showLanguages && config.showLanguages[show.show_name] || config.languages;
                    sendSickBeardAPICmd('show.seasons', { tvdbid: show.tvdbid }).then(seasonList => {
                        var seasonNumber;
                        for (seasonNumber in seasonList) {
                            if (!seasonList.hasOwnProperty(seasonNumber) || !kodiEpisodes[show.show_name][seasonNumber]) {
                                continue;
                            }

                            var episodeList = seasonList[seasonNumber],
                                episodeNumber,
                                episodeInfo;
                            for (episodeNumber in episodeList) {
                                if (!episodeList.hasOwnProperty(episodeNumber) || !~kodiEpisodes[show.show_name][seasonNumber].indexOf(parseInt(episodeNumber))) {
                                    continue;
                                }
                                episodeInfo = episodeList[episodeNumber];

                                if (episodeInfo.location && (new Date(episodeInfo.airdate)) > minDate) {
                                    // Check if downloaded subtitles match preferred language
                                    // ======================================================

                                    // Get episode available sub known lang list
                                    // -----------------------------------------
                                    ((episodeInfo, seasonNumber, episodeNumber) => {
                                        var releaseName = episodeInfo.location.substr(0, episodeInfo.location.lastIndexOf('.'))
                                            .substr(episodeInfo.location.lastIndexOf(path.sep) + 1);
                                        find.file(
                                            new RegExp('^' + utils.escapeRegExpPattern(releaseName) + '\.[a-z]{2}\.srt$'),
                                            path.resolve(episodeInfo.location.substr(0, episodeInfo.location.lastIndexOf(path.sep))),
                                            files => {
                                                var subLangList    = files && files.length > 0
                                                        ? files.map(file => file.match(/(..)\.srt$/)[1])
                                                        : [],
                                                    neededLangList = [];

                                                for (var i = 0, l = languages.length; i < l; i++) {
                                                    var lang = languages[i];
                                                    if (subLangList.indexOf(lang.substr(0, 2)) === -1) {
                                                        neededLangList.push(lang);
                                                    }
                                                    else {
                                                        break;
                                                    }
                                                }

                                                if (neededLangList.length > 0) {
                                                    console.log(show.show_name, seasonNumber, episodeNumber, neededLangList);
                                                    var distribution = utils.getDistribution(releaseName),
                                                        team         = utils.formatRipTeam(utils.getRipTeam(releaseName))
                                                            .replace(/^SICK(BEARD|RAGE)$/, 'UNKNOWN');
                                                    // Search subtitles for this release
                                                    // ---------------------------------
                                                    subtitles.search(show.show_name, seasonNumber, episodeNumber, neededLangList)
                                                        .then(subtitleList => {
                                                            subtitleList = subtitleList.sort(
                                                                (a, b) => neededLangList.indexOf(a.langId) - neededLangList.indexOf(b.langId)
                                                            );

                                                            function downloadSubs (subInfo) {
                                                                subtitles.download(
                                                                    subInfo,
                                                                    episodeInfo.location.substr(0, episodeInfo.location.lastIndexOf('.') + 1) +
                                                                    subInfo.langId.substr(0, 2) + '.srt'
                                                                ).then(() => console.log('Subtitles file downloaded :', show.show_name, seasonNumber, episodeNumber,
                                                                    subInfo.langId, subInfo.provider));
                                                                return true;
                                                            }

                                                            team === 'UNKNOWN'
                                                                ?
                                                                subtitleList.some(subInfo => subInfo.distribution === distribution && downloadSubs(subInfo))
                                                                : (
                                                                subtitleList.some(
                                                                    subInfo => subInfo.distribution === distribution &&
                                                                    utils.ripTeamMatchFoundInList([subInfo.team], team) &&
                                                                    downloadSubs(subInfo)
                                                                )
                                                                ||
                                                                subtitleList.some(subInfo => utils.ripTeamMatchFoundInList([subInfo.team], team) && downloadSubs(subInfo))
                                                            );
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
