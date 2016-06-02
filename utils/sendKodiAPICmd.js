var request     = require('request'),
    kodiConfig  = require('../katoss/config.json').kodi || {},
    protocol    = kodiConfig.protocol || 'http',
    host        = kodiConfig.host || '127.0.0.1',
    port        = kodiConfig.port || 8080,
    url         = protocol + '://' + host + ':' + port + '/jsonrpc',
    requestBody = {
        jsonrpc: '2.0',
        id:      1
    };

module.exports = function sendKodiAPICmd (cmd, params, callback) {
    requestBody.method = cmd;
    requestBody.params = params;
    request(url, { method: 'POST', json: true, body: requestBody }, callback);
};
