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
    },
    webstore_upload: {
      "accounts": {
        "default": { //account under this section will be used by default
          publish: true, //publish item right after uploading. default false
          client_id: process.env.CHROME_WEBSTORE_ID,
          client_secret: process.env.CHROME_WEBSTORE_SECRET,
          refresh_token: process.env.CHROME_WEBSTORE_REFRESH,
        }
      },
      "extensions": {
        "extension1": {
          //required
          appID: "pophpmnchlcddhhilmnopbahlaohdfig",
          //required, we can use dir name and upload most recent zip file
          zip: archive
        }
      }
    }
  });

  grunt.registerTask('publish_chrome', ['compress', 'webstore_upload']);
  grunt.registerTask('default', ['publish_chrome']);
};
