var sendKodiAPICmd = require('./include/sendKodiAPICmd');

module.exports = function cleanKodiVideoLibrary (debug) {
    sendKodiAPICmd('VideoLibrary.Clean', { showdialogs: false });
    debug && console.log('Clean Kodi video library request sent.');
};
