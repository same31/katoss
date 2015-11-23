var fs = require('fs'),
    url = require('url'),
    proxyMiddleware = require('http-proxy-middleware'),
// The default file if the file/path is not found
    defaultFile = 'index.html',
    folder = './dist/',
    proxyKAT = proxyMiddleware('/kat', {
        target: 'https://kat.cr',
        pathRewrite: {
            '^/kat': ''      // rewrite paths
        },
        changeOrigin: true   // for vhosted sites, changes host header to match to target's host
    }),
    /*download = require('tamper')(function (req, res) {
        var match = req.url.match(/^\/download\?url=(.+)/);
        if (match) {
            var torrentContent = require('sync-request')('GET', match[1], {
                followAllRedirects: true,
                encoding: 'binary',
                gzip: true
            }).getBody('binary').toString();

            // FIXME: Error 500
            return function () {
                return torrentContent;
            };
        }
        return false;
    }),*/
    indexRedirect = function (req, res, next) {
        console.log('red', req.url);
        var location = url.parse(req.url),
            fileName,
            fileExists;

        fileName = location.href.split(location.search).join('');
        fileExists = fs.existsSync(folder + fileName);

        if (/*!req.url.match(/^\/download\?url=(.+)/) && */
        !fileExists && fileName.indexOf('fonts') === -1 && fileName.indexOf('browser-sync-client') === -1) {
            req.url = '/' + defaultFile;
        }
        return next();
    };

module.exports = {
    bsFiles: {
        src: ['./dist/index.html', './dist/js/app.js'/*, './dist/css/app/blessed/*.css'*/]
    },
    options: {
        notify: true,
        watchTask: true,
        port: '<%= port %>',
        ui: {
            port: '<%= bsPort %>'
        },
        ghostMode: false,
        server: {
            baseDir: './dist/',
            // Middleware to redirect all reqs on the Node server to index.html
            middleware: [proxyKAT, indexRedirect]
        }
    }
};
