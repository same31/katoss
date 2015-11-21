var xmlrpc = require('xmlrpc'),
    client = xmlrpc.createClient({
        host: 'api.opensubtitles.org',
        port: 80,
        path: '/xml-rpc'
    }),
    config = require('./config.json'),
    token;

function login(callback) {
    client.methodCall('LogIn', ['', '', 'fr', config.opensubtitlesAPIKey], function (err, response) {
        if (err) {
            return console.log('OpenSubtitles connection problem', err);
        }
        token = response.token;

        callback(token);
    });
}

function search(callback) {

}

module.exports = {
    login: login,
    search: search
};
