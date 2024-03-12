module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);
  var pkgJson = require('./package.json');
  var archive = 'dist/chrome/fasterize_status' + pkgJson.version + '.zip';

  grunt.initConfig({
    compress: {
      main: {
        options: {
          archive: archive,
          pretty: true
        },
        expand: true,
        cwd: 'app/',
        src: ['**/*'],
        dest: 'dist/chrome/'
      }
    }
  });

  grunt.registerTask('publish_chrome', ['compress']);
  grunt.registerTask('default', ['publish_chrome']);
};
