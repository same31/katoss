module.exports = function (grunt) {

    var config = {
        dir: {
			dist: './dist',
			nodeModules: './node_modules',
			ui: './ui'
		},
        port: grunt.option('port') || 5000,
        bsPort: grunt.option('bsPort') || 8432,
        livereloadPort: grunt.option('livereloadPort') || 35678
    };

    require('load-grunt-config')(grunt, {
        init: true,
        data: config
    });

    grunt.registerTask('default', ['clean:build', 'copy:all', 'browserify:app', 'browserSync', 'watch']);
};
