var sendSickBeardAPICmd = require('./sendSickBeardAPICmd'),
    formatShowNumber    = require('../katoss/src/utils').formatShowNumber;

// Retrieve all 'downloaded' episodes from SickBeard and check whether they were viewed in Kodi
// ============================================================================================
sendSickBeardAPICmd('shows', { 'sort': 'name', 'paused': 0 }, function (showList) {
    var searchJSON = {},
        showName;
    for (showName in showList) {
        if (!showList.hasOwnProperty(showName)) {
            continue;
        }
        var show = showList[showName];
        (function (tvdbid) {
            sendSickBeardAPICmd('show.seasons', { tvdbid: tvdbid }, function (seasonList) {
                for (var seasonNumber in seasonList) {
                    if (!seasonList.hasOwnProperty(seasonNumber)) {
                        continue;
                    }
                    var season      = formatShowNumber(seasonNumber),
                        episodeList = seasonList[seasonNumber],
                        episodeNumber;
                    for (episodeNumber in episodeList) {
                        if (!episodeList.hasOwnProperty(episodeNumber)) {
                            continue;
                        }
                        var episodeInfo = episodeList[episodeNumber];
                        if (episodeInfo.status === 'Downloaded') {
                            searchJSON[showName] || (searchJSON[showName] = { seasons: {}, tvdbid: tvdbid });

                            searchJSON[showName].seasons[season] || (searchJSON[showName].seasons[season] = []);
                            searchJSON[showName].seasons[season].push(formatShowNumber(episodeNumber));
                        }
                    }
                }
            });
        })(show.tvdbid);
    }
    console.log(searchJSON);
    console.log('\n');

});
