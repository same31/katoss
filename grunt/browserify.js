var rekuiConf = {
    ignore : [ 'dist', 'grunt' ],
    ignoreMask : '(^[_].*)|(.*spec$)',
    importNotModule : true,
    extensions : [ '.js', '.jsx' ]
},
    transforms = function(config) {
    config = config || {};

    var transformsList = [
    /*
        // React transform
        [ 'reactify', {
            'es6' : true
        } ],
        // Rekuirify (@s)
        [ 'rekuirify', rekuiConf ],*/
        // Babel (ES5)
        'babelify' ];

    return transformsList;
};

module.exports = {
    options: {
        watch: true
    },

    // App build
    app: {
        options: {
            transform: transforms()
        },
        //~ src : './src/jsx/app/main.jsx',
        //~ dest : './dist/js/app.js'
        src : './ui/js/app.js',
        dest : './dist/js/app.js'
    }
};
