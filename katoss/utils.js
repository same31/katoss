function allSettled (promiseList) {
    return new Promise(function (resolve) {
        var promiseDone  = function (response, error, index) {
                responseList[index] = { response: response, error: error };
                responseList.filter(function (response) { return response !== undefined; })
                    .length === promiseCount && resolve(responseList);
            },
            responseList = [],
            promiseCount = promiseList.length;

        promiseList.forEach(function (promise, index) {
            promise.then(function (response) {
                promiseDone(response, null, index);
            }).catch(function (error) {
                promiseDone(null, error, index);
            });
        });
    });
}

function getLocationOrigin () {
    return window.location.origin || window.location.protocol + '//' + window.location.hostname +
        (window.location.port ? ':' + window.location.port : '');
}

function getFileExtension (filename) {
    return filename.trim().substr((~-filename.lastIndexOf('.') >>> 0) + 2).toLowerCase();
}

function fileExtensionIsMovie (filename) {
    var extension = getFileExtension(filename);
    return extension && ~['avi', 'mkv', 'mp4', 'mpg', 'mpeg'].indexOf(extension);
}

function formatShowTitle (show) {
    return show.trim().replace(/ ?\(\d{4}\)$/g, '').replace(/'|&|,|:/g, '').replace(/\./g, ' ').replace(/ +/g, ' ').trim();
}

function getDistribution (title) {
    var match = title.match(/HDTV|WEB.DL|WEB.?RIP|BRRIP|BDRIP|BLURAY/i);
    return match
        ? match[0].toUpperCase()
        .replace(/WEB.DL|WEB.?RIP/, 'WEB-DL')
        .replace(/BRRIP|BDRIP|BLURAY/, 'BLURAY')
        : 'UNKNOWN';
}

function getRipTeam (title) {
    var match,
        regexp;

    title = title.trim();

    regexp = fileExtensionIsMovie(title) || getFileExtension(title) === 'srt'
        ? /-([^-]+?)\.[a-zA-Z]+?$/
        : /-([^-]+?)(\[.+?])?$/;

    match = title.match(regexp);
    return match
        ? match[1].toUpperCase()
        : 'UNKNOWN';
}

function getReleaseQualityFromAllowed (releaseName, allowedQualityList) {
    var qualityPattern = allowedQualityList.filter(function (quality) {
            return quality.toUpperCase() !== 'UNKNOWN';
        }).join('|'),
        match          = releaseName.match(new RegExp(qualityPattern, 'i'));

    return match ? match[0].toLowerCase() : 'UNKNOWN';
}

function releaseNameIsValid (releaseName, show, season, episode) {
    show = show.trim()
        .replace(/ ?\(\d{4}\)$/g, '')
        .replace(/([^A-Za-z0-9 &\.])/g, '$1?')
        .replace(/ ?& ?/g, '.+')
        .replace(/ +/g, '.')
        .replace(/\.+/g, '.');

    var reg = new RegExp('^' + show + '.+(S' + season + 'E' + episode + '|' + season + 'x' + episode + '|' +
        parseInt(season) + 'x' + episode + '|' + season + 'x' + parseInt(episode) + '|' +
        parseInt(season) + 'x' + parseInt(episode) + ')', 'i');
    return reg.test(releaseName.trim());
}

function qualityIsHigherThanCurrent (foundQuality, currentQuality, allowedQualityList) {
    if (!currentQuality) {
        return true;
    }

    currentQuality = getReleaseQualityFromAllowed(currentQuality, allowedQualityList);

    var foundQualityIndex = allowedQualityList.indexOf(foundQuality);

    return foundQualityIndex !== -1 && foundQualityIndex < allowedQualityList.indexOf(currentQuality);
}

module.exports = {
    allSettled:                   allSettled,
    getLocationOrigin:            getLocationOrigin,
    getFileExtension:             getFileExtension,
    fileExtensionIsMovie:         fileExtensionIsMovie,
    formatShowTitle:              formatShowTitle,
    getDistribution:              getDistribution,
    getRipTeam:                   getRipTeam,
    getReleaseQualityFromAllowed: getReleaseQualityFromAllowed,
    releaseNameIsValid:           releaseNameIsValid,
    qualityIsHigherThanCurrent:   qualityIsHigherThanCurrent
};
