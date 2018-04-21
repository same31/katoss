var Katoss     = require('./Katoss'),
    config     = require('./config.json'),
    utils      = require('./src/utils'),
    mkdirp     = require('mkdirp'),
    outputPath = config.outputPath || '.';

module.exports = function search (searchJSON, notifyManager) {
    mkdirp(outputPath, err => {
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
            queue         = utils.queue;

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

                episodeList        = flattenEpisodeList(showInfo.seasons[season]);
                currentQualityList = showInfo.currentQualities && showInfo.currentQualities[season];
                episodeList.forEach((episode, index) => {
                    var currentQuality = currentQualityList && currentQualityList[index],
                        search         = new Katoss(showInfo.tvdbid, show, season, episode, languages, currentQuality, notifyManager);

                    queue.push(cb => search.run(cb));
                });
            }
        }

        console.log('Queue started');
        queue.start();
    });
};

function flattenEpisodeList (episodeList) {
    return episodeList.reduce((episodeList, episodeRange) => {
        episodeRange     = episodeRange.toString().split('-').map(episodeNumber => parseInt(episodeNumber, 10));
        const rangeStart = episodeRange[0];
        const rangeEnd   = episodeRange[episodeRange.length - 1];
        episodeRange     = Array
            .apply(null, { length: rangeEnd - rangeStart + 1 })
            .map((value, index) => {
                const episodeNumber = index + rangeStart;
                const episodeNumberString = episodeNumber.toString();
                return episodeNumber < 10 ? '0' + episodeNumberString : episodeNumberString;
            });
        return episodeList.concat(episodeRange);
    }, []);
}
