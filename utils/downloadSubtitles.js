var movieFile    = process.argv[2],
    config       = require('../katoss/config.json'),
    subtitles    = require('../katoss/src/subtitles'),
    utils        = require('../katoss/src/utils'),

    matches      = movieFile.match(/\/([^\/]+)\/Season \d+\/(.+?S(\d+)E(\d+).+)$/),
    show         = matches[1],
    filename     = matches[2],
    season       = matches[3],
    episode      = matches[4],
    distribution = utils.getDistribution(filename),
    team         = utils.getRipTeam(filename),

    languages    = process.argv[3] && [process.argv[3]] || config.showLanguages && config.showLanguages[show] || config.languages;

console.log(show, season, episode, distribution, team, languages);

subtitles.search(show, season, episode, languages)
    .then(function (subtitleList) {
        subtitleList = subtitleList.sort(function (a, b) {
            return languages.indexOf(a.langId) - languages.indexOf(b.langId);
        });

        var downloadIfFound = function downloadIfFound (subInfo, search) {
            if (search) {
                console.log(subInfo);
                subtitles.download(
                    subInfo,
                    movieFile.substr(0, movieFile.lastIndexOf('.') + 1) + subInfo.langId.substr(0, 2) + '.srt'
                ).then(function () {
                    console.log('Subtitles file downloaded.');
                });
                return true;
            }
        };

        subtitleList.some(function (subInfo) {
            return downloadIfFound(subInfo, subInfo.distribution === distribution && utils.ripTeamMatchFoundInList([subInfo.team], team));
        })
        ||
        subtitleList.some(function (subInfo) {
            return downloadIfFound(subInfo, utils.ripTeamMatchFoundInList([subInfo.team], team));
        })
        ||
        subtitleList.some(function (subInfo) {
            return downloadIfFound(subInfo, subInfo.distribution === distribution && ~[subInfo.team, team].indexOf('UNKNOWN'));
        })
        ||
        subtitleList.some(function (subInfo) {
            return downloadIfFound(subInfo, subInfo.distribution === distribution);
        });
    });
