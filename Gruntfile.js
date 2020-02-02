const path = require('path');
const config = require('./config');
const PlexDirectories = require('./utils/plex-directories');
const helpers = require('./grunt/helpers');

const overwrite = false;

module.exports = (grunt) => {
    //TODO Multi-platform installer
    let codecsFolder = PlexDirectories.getCodecFolder();
    let plexFolder = PlexDirectories.getPlexBuildFolder();
    let eaeFolder = PlexDirectories.getEAEFolder();

    let gruntConfig = {
        'mkdir': {
            codecs: {
                options: {
                    create: [codecsFolder]
                },
            },
            plex: {
                options: {
                    create: [plexFolder]
                }
            },
            eae: {
                options: {
                    create: [eaeFolder]
                }
            },
            cache: {
                options: {
                    create: [path.resolve(config.transcoder.temp_folder)]
                }
            }
        },
        'request-progress': {
            plex: {
                options: {
                    allowOverwrite: overwrite,
                    dst: plexFolder + 'plex.deb',
                    src: helpers.getPlexDownloadUrl()
                }
            },
            eae: {
                options: {
                    allowOverwrite: overwrite,
                    dst: eaeFolder + 'eae.zip',
                    src: helpers.getEaeDownloadUrl()
                }
            }
        },
        'arx': {
            plex: {
                src: plexFolder + "plex.deb",
                dst: plexFolder
            }
        },
        'untar': {
            plex: {
                files: {
                    [plexFolder]: plexFolder + 'data.tar' + helpers.getPlexDataExt(),
                }
            }
        },
        'unzip': {
            eae: {
                src: eaeFolder + 'eae.zip',
                dest: eaeFolder
            }
        },
        'run': {
            'geoip': {
            cmd: 'node',
            args: [
                './node_modules/geoip-lite/scripts/updatedb.js', `license_key=${config.maxmind_key}`
            ]
        }}
    };

    const [codecTasks, codecRunners] = helpers.getCodecsTasks(overwrite);
    gruntConfig["request-progress"] = { ...gruntConfig["request-progress"], ...codecTasks };

    grunt.initConfig(gruntConfig);
    grunt.loadTasks('grunt/tasks');
    grunt.loadNpmTasks('grunt-request-progress');
    grunt.loadNpmTasks('grunt-mkdir');
    grunt.loadNpmTasks('grunt-zip');
    grunt.loadNpmTasks('grunt-run');

    grunt.registerTask('plex', ['mkdir:plex', 'request-progress:plex', 'arx:plex', 'untar:plex']);
    grunt.registerTask('codecs', codecRunners);
    grunt.registerTask('eae', ['mkdir:eae', 'request-progress:eae', 'unzip:eae']);
    grunt.registerTask('cache', ['mkdir:cache']);
    if (config.maxmind_key) {
        grunt.registerTask('geoip', ['run:geoip']);
    }
    grunt.registerTask('default', ['plex', 'codecs', 'eae', 'cache', ...((config.maxmind_key) ? ['geoip'] : [])]);
};
