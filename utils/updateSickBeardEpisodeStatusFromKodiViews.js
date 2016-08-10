var sendSickBeardAPICmd = require('./include/sendSickBeardAPICmd'),
    sendKodiAPICmd      = require('./include/sendKodiAPICmd');

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
            if (episode.playcount > 0) {
                kodiEpisodes[episode.showtitle] || (kodiEpisodes[episode.showtitle] = {});
                kodiEpisodes[episode.showtitle][episode.season] || (kodiEpisodes[episode.showtitle][episode.season] = []);
                kodiEpisodes[episode.showtitle][episode.season].push(episode.episode);
            }
            return kodiEpisodes;
        }, {});

        // Retrieve all 'downloaded' episodes from SickBeard and check whether they were viewed in Kodi
        // ============================================================================================
        sendSickBeardAPICmd('shows', { 'sort': 'name', 'paused': 0 }, showList => {
            var showName;
            for (showName in showList) {
                if (!showList.hasOwnProperty(showName) || !kodiEpisodes[showName]) {
                    continue;
                }

                var show = showList[showName],
                    showLogged = false;
                (tvdbid => {
                    sendSickBeardAPICmd('show.seasons', { tvdbid: tvdbid }, seasonList => {
                        var seasonNumber;
                        for (seasonNumber in seasonList) {
                            if (!seasonList.hasOwnProperty(seasonNumber) || !kodiEpisodes[showName][seasonNumber]) {
                                continue;
                            }

                            var seasonLogged = false,
                                episodeList = seasonList[seasonNumber],
                                episodeNumber,
                                episodeInfo;
                            for (episodeNumber in episodeList) {
                                if (!episodeList.hasOwnProperty(episodeNumber) || !~kodiEpisodes[showName][seasonNumber].indexOf(parseInt(episodeNumber))) {
                                    continue;
                                }
                                episodeInfo = episodeList[episodeNumber];

                                if (episodeInfo.status === 'Downloaded') {
                                    showLogged || (showLogged = true) && console.log(show.show_name);
                                    seasonLogged || (seasonLogged = true) && console.log(seasonNumber + ':');
                                    console.log(episodeNumber);
                                    // 'archived' status is not available in the API anymore...
                                    sendSickBeardAPICmd(
                                        'episode.setstatus',
                                        {
                                            'tvdbid':  tvdbid,
                                            'season':  parseInt(seasonNumber),
                                            'episode': parseInt(episodeNumber),
                                            'status':  'skipped',
                                            'force':   1
                                        }
                                    );
                                }
                                else if (!episodeInfo.status) {
                                    console.log(show, seasonNumber, episodeNumber, 'status not retrieved');
                                }
                            }
                        }
                    });
                })(show.tvdbid);
            }
        });
    });
