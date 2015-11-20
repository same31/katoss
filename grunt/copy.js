module.exports = function(grunt) {
    var suffix = grunt.option('env') === 'prod' ? '.min' : '';

    return {
        options: {
            cwd: './',
            expand: true
        },

        all: {
            files: [ {
                src: 'node_modules/js-polyfills/polyfill' + suffix + '.js',
                dest: '<%= dir.dist %>/js/polyfill.js'
            },
            {
                src: 'node_modules/bootstrap/dist/css/bootstrap' + suffix + '.js',
                dest: '<%= dir.dist %>/css/bootstrap.css'
            },
			{
				src: '**/*',
                expand : true,
                cwd : 'ui',
                dest : '<%= dir.dist %>'
            }]
        },
        
        html: {
			files: [ {
                src: 'ui/index.html',
                dest: '<%= dir.dist %>/index.html'
            } ]
		}
    };
};
