var request    = require('request'),
    kodiConfig = require('../katoss/config.json').kodi || {},
    protocol   = kodiConfig.protocol || 'http',
    host       = kodiConfig.host || '127.0.0.1',
    port       = kodiConfig.port || 8080,
    url        = protocol + '://' + host + ':' + port + '/jsonrpc',
    body       = {
        jsonrpc: '2.0',
        id:      1,
        method:  'VideoLibrary.Clean',
        params:  { showdialogs: false }
    };

module.exports = function cleanKodiVideoLibrary (debug) {
    request(url, { method: 'POST', json: true, body: body });
    debug && console.log('Clean Kodi video library request sent.');
};
