process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var hasToReplaceLowQuality = ~process.argv.indexOf('--replace-low-quality'),
    config                 = require('../katoss/config.json'),
    search                 = require('../katoss/search'),
    formatShowNumber       = require('../katoss/src/utils').formatShowNumber,
    sendSickBeardAPICmd    = require('./sendSickBeardAPICmd'),
    hasToSearchEpisode,
    addEpisodeToSearch,
    maxQuality,
    minDate;

if (hasToReplaceLowQuality) {
    maxQuality = config.qualityOrder[0].toLowerCase();
    // Do not search every episode in 2160p or it would search for practically the entire base
    // ---------------------------------------------------------------------------------------
    maxQuality === '2160p' && (maxQuality = config.qualityOrder[1].toLowerCase());
    minDate = new Date();
    minDate.setMonth(minDate.getMonth() - 6);
}

hasToSearchEpisode = hasToReplaceLowQuality
    ?
    function (episodeInfo) {
        return episodeInfo.status === 'Downloaded' &&
            episodeInfo.quality.indexOf(maxQuality) === -1 &&
            (new Date(episodeInfo.airdate)) > minDate;
    }
    :
    function (episodeInfo) {
        return episodeInfo.status === 'Wanted';
    };

addEpisodeToSearch = function (searchJSONShow, seasonNumber, episodeNumber) {
    searchJSONShow.seasons[seasonNumber] || (searchJSONShow.seasons[seasonNumber] = []);
    searchJSONShow.seasons[seasonNumber].push(episodeNumber);
};

if (hasToReplaceLowQuality) {
    var originalAddEpisodeToSearch = addEpisodeToSearch;
    addEpisodeToSearch             = function (searchJSONShow, seasonNumber, episodeNumber, currentQuality) {
        originalAddEpisodeToSearch(searchJSONShow, seasonNumber, episodeNumber);

        searchJSONShow.currentQualities || (searchJSONShow.currentQualities = {});
        searchJSONShow.currentQualities[seasonNumber] || (searchJSONShow.currentQualities[seasonNumber] = []);
        searchJSONShow.currentQualities[seasonNumber].push(currentQuality);
    };
}

function notifySickBeard (tvdbid, season, episode, callback) {
    sendSickBeardAPICmd(
        'episode.setstatus',
        {
            'tvdbid':  tvdbid,
            'season':  parseInt(season),
            'episode': parseInt(episode),
            'status':  'skipped'
        },
        callback
    );
}

// Get show id list
// ----------------
sendSickBeardAPICmd('shows', { 'sort': 'name', 'paused': 0 }, function (showList) {
    var searchJSON = {};
    for (var showName in showList) {
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
                        episodeList = seasonList[seasonNumber];
                    for (var episodeNumber in episodeList) {
                        if (!episodeList.hasOwnProperty(episodeNumber)) {
                            continue;
                        }
                        var episodeInfo     = episodeList[episodeNumber];
                        episodeInfo.quality = episodeInfo.quality.replace('4K UHD', maxQuality); // Pretend it is the desired max quality
                        if (hasToSearchEpisode(episodeInfo)) {
                            searchJSON[showName] || (searchJSON[showName] = { seasons: {}, tvdbid: tvdbid });
                            addEpisodeToSearch(searchJSON[showName], season, formatShowNumber(episodeNumber), episodeInfo.quality);
                        }
                    }
                }
            });
        })(show.tvdbid);
    }
    console.log(searchJSON);
    console.log('\n');
    search(searchJSON, notifySickBeard);
});
