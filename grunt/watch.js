module.exports = {
    options: {
        livereload: '<%= livereloadPort %>'
    },

    sass: {
        options: {
            livereload: false
        },
        files: [/*'<%= files.resources.sass %>'*/],
        tasks: [  ]
    },
    
    html: {
		options: {
            livereload: false
        },
        files: ['ui/index.html'],
        tasks: [ 'copy:html' ]
	}
};
