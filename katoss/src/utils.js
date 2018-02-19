function allSettled (promiseList) {
    return new Promise(resolve => {
        var responseList = [],
            promiseCount = promiseList.length,
            promiseDone  = (response, error, index) => {
                responseList[index] = { response: response, error: error };
                responseList.filter(response => typeof response !== 'undefined').length === promiseCount && resolve(responseList);
            };

        promiseList.forEach((promise, index) => promise
            .then(response => promiseDone(response, null, index))
            .catch(error => promiseDone(null, error, index)));
    });
}

function someSeries (list, validator) {
    return new Promise(resolve => {
        var i = 0,
            l = list.length;
        (function _validator () {
            i < l ? validator(list[i++]).then(found => found ? resolve(true) : _validator()).catch(_validator) : resolve(false);
        })();
    });
}

function promisify (result) {
    if (result instanceof Promise) {
        return result;
    }
    return Promise.resolve(result);
}

function escapeRegExpPattern (string) {
    return string.replace(/[()<>[{\\|^$.*+?]/g, '\\$&');
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
    return extension && ~['avi', 'm4v', 'mkv', 'mp4', 'mpg', 'mpeg'].indexOf(extension);
}

function formatShowTitle (show) {
    return show.trim().replace(/ ?\(\d{4}\)$/g, '').replace(/'|&|,|:/g, '').replace(/\./g, ' ').replace(/ +/g, ' ').trim();
}

function formatShowNumber (number) {
    number = parseInt(number);
    return number < 10 ? '0' + number : number;
}

function getDistribution (title) {
    var match = title.match(/\b(HDTV|BRRIP|BDRIP|BLURAY|WEB.DL|WEB.?RIP|WEB)\b/i);
    return match
        ? match[0].toUpperCase()
        .replace(/\b(WEB.DL|WEB.?RIP|WEB)\b/, 'WEB-DL')
        .replace(/\b(BRRIP|BDRIP|BLURAY)\b/, 'BLURAY')
        : 'UNKNOWN';
}

function getRipTeam (title) {
    var match,
        regexp;

    title = title.trim().toUpperCase().replace(/WEB(-(DL|RIP))/, ' $2');

    regexp = fileExtensionIsMovie(title) || getFileExtension(title) === 'srt'
        ? /-([^-]+?)( ?(\[.+?])+)?-?\.[A-Z0-9]+?$/
        : /-([^-]+?)( ?(\[.+?])+)?$/;

    match = title.match(regexp);
    return match ? match[1].trim().replace(/[^a-zA-Z0-9]/g, '') : 'UNKNOWN';
}

function formatRipTeam (ripTeam) {
    return ripTeam.replace(/0/g, 'O');
}

function ripTeamMatchFoundInList (ripTeamList, searchedRipTeam) {
    var sameTeamList = [
        ['DIMENSION', 'LOL', 'SYS', 'BAJSKORV'],
        ['ASAP', 'XII', 'IMMERSE', 'FLEET', 'AVS', 'SVA', 'AVSSVA', 'AVS_SVA', 'AVS/SVA', 'SVAAVS', 'SVA_AVS', 'SVA/AVS', 'SKGTV', 'RBB', 'RMTEAM', 'AFG', 'PSA'],
        ['FQM', 'ORENJI'],
		['VISUM', 'ION1O', 'VISUMION1O', 'BAMBOOZLE', 'CONVOY', 'CASSTUDIO']
    ];
    return ripTeamList.some(ripTeam => {
        if (ripTeam === searchedRipTeam) {
            return true;
        }

        var i = 0,
            l = sameTeamList.length,
            sameTeams;
        for (; i < l; i++) {
            sameTeams = sameTeamList[i];
            if (~sameTeams.indexOf(ripTeam)) {
                return ~sameTeams.indexOf(searchedRipTeam);
            }
        }

        return false;
    });
}

function getReleaseQuality (releaseName) {
    var matches = releaseName.match(/\b(2160|1080|720|480)p\b/i);
    return matches ? matches[0].toLowerCase() : 'UNKNOWN';
}

function getReleaseQualityFromAllowed (releaseName, allowedQualityList) {
    var qualityPattern = allowedQualityList.filter(quality => quality.toUpperCase() !== 'UNKNOWN').join('|'),
        match          = releaseName.match(new RegExp(qualityPattern, 'i'));

    return match ? match[0].toLowerCase() : 'UNKNOWN';
}

function releaseNameIsValid (releaseName, show, season, episode) {
    show = show.trim()
        .replace(/ ?\(\d{4}\)$/g, '')
        .replace(/([^A-Za-z0-9 &.])/g, '$1?')
        .replace(/ ?& ?/g, '.+')
        .replace(/ +/g, '.')
        .replace(/\.+/g, '.')
        .replace(/\.$/, '');

    var reg = new RegExp('^' + show + '[^A-Za-z]+(S' + season + 'E' + episode + '|' + season + 'x' + episode + '|' +
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

function isHEVC (title) {
    return /\b((h|x).?265|HEVC)\b/i.test(title);
}

var queue = {
    jobList:     [],
    concurrency: 5,
    activeJobs:  0,
    push:        function () {
        var jobs = Array.prototype.slice.call(arguments);
        Array.prototype.push.apply(this.jobList, jobs);
    },
    start:       function () {
        var jobs        = this.jobList.splice(0, this.concurrency);
        this.activeJobs = Math.min(this.concurrency, jobs.length);

        jobs.forEach(job => setTimeout(() => job(this.next.bind(this)), 0));
    },
    next:        function () {
        var jobs = this.jobList.splice(0, 1),
            job  = jobs[0];
        if (job) {
            setTimeout(() => job(this.next.bind(this)), 0);
        }
        else {
            this.activeJobs--;
            if (this.activeJobs <= 0) {
                console.log('All jobs done.');
            }
        }
    }
};

module.exports = {
    allSettled:                   allSettled,
    someSeries:                   someSeries,
    promisify:                    promisify,
    escapeRegExpPattern:          escapeRegExpPattern,
    getLocationOrigin:            getLocationOrigin,
    getFileExtension:             getFileExtension,
    fileExtensionIsMovie:         fileExtensionIsMovie,
    formatShowTitle:              formatShowTitle,
    formatShowNumber:             formatShowNumber,
    getDistribution:              getDistribution,
    getRipTeam:                   getRipTeam,
    formatRipTeam:                formatRipTeam,
    ripTeamMatchFoundInList:      ripTeamMatchFoundInList,
    getReleaseQuality:            getReleaseQuality,
    getReleaseQualityFromAllowed: getReleaseQualityFromAllowed,
    releaseNameIsValid:           releaseNameIsValid,
    qualityIsHigherThanCurrent:   qualityIsHigherThanCurrent,
    isHEVC:                       isHEVC,
    queue:                        queue
};
