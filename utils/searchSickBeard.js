process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var hasToReplaceLowQuality = ~process.argv.indexOf('--replace-low-quality'),
    config                 = require('../katoss/config.json'),
    katoss                 = require('../katoss/katoss'),
    request                = require('sync-request'),
    hasToSearchEpisode,
    addEpisodeToSearch,
    maxQuality,
    minDate;

if (hasToReplaceLowQuality) {
    maxQuality = config.qualityOrder[0].toLowerCase();
    minDate    = new Date();
    minDate.setMonth(minDate.getMonth() - 6);
}

function sendAPICmd (cmd, params, callback) {
    var apiKey    = config.sickBeard.apiKey,
        protocol  = config.sickBeard.protocol || 'http',
        host      = config.sickBeard.host || '127.0.0.1',
        port      = config.sickBeard.port || 80,
        apiCmdUrl = protocol + '://' + host + ':' + port + '/api/' + apiKey + '/?cmd=',
        url       = apiCmdUrl + cmd,
        response,
        responseData;

    if (params) {
        for (var key in params) {
            if (!params.hasOwnProperty(key)) {
                continue;
            }
            url += '&' + key + '=' + params[key];
        }
    }

    response = request('GET', url, { retry: true });

    if (response.statusCode >= 300) {
        console.log('[' + cmd + '] Sick Beard server responded with status code', response.statusCode);
        console.log(params);
        return false;
    }

    if (typeof callback === 'function') {
        try {
            responseData = JSON.parse(response.getBody().toString()).data;
        }
        catch (err) {
            console.log('[' + cmd + '] Error while parsing Sick Beard response', err);
            console.log(params);
            return false;
        }

        callback(responseData);
    }
}

function formatShowNumber (number) {
    number = parseInt(number);
    return number < 10 ? '0' + number : number;
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
    sendAPICmd(
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
sendAPICmd('shows', { 'sort': 'name', 'pause': 0 }, function (showList) {
    var searchJSON = {};
    for (var showName in showList) {
        if (!showList.hasOwnProperty(showName)) {
            continue;
        }
        var show = showList[showName];
        (function (tvdbid) {
            sendAPICmd('show.seasons', { tvdbid: tvdbid }, function (seasonList) {
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
                        var episodeInfo = episodeList[episodeNumber];
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
    katoss(searchJSON, notifySickBeard);
});
