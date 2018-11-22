const ar = require('ar');
const fs = require('fs');
const path = require('path');
const util = require('util');
const config = require('./config');
const PlexDirectories = require('./utils/plex-directories');

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
                    src: `https://downloads.plex.tv/plex-media-server/${config.transcoder.plex_build}/plexmediaserver_${config.transcoder.plex_build}_amd64.deb`
                }
            },
            eae: {
                options: {
                    allowOverwrite: overwrite,
                    dst: eaeFolder + 'eae.zip',
                    src: `https://downloads.plex.tv/codecs/${config.transcoder.eae_version}/${config.transcoder.plex_arch}/EasyAudioEncoder-${config.transcoder.plex_arch}.zip`
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
                options: {
                    mode: 'tgz'
                },
                files: {
                    [plexFolder]: plexFolder + 'data.tar.gz',
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
                './node_modules/geoip-lite/scripts/updatedb.js'
            ]
        }}
    };

    //Generate codecs downloads
    // for f in *; do sed "s/\(.*\).so/'\1',/" <<< "$f"; done
    //TODO Maybe use https://plex.tv/api/codecs/easyaudioencoder?build=linux-ubuntu-x86_64&deviceId=<UUID>&version=141
    // https://plex.tv/api/codecs/h264_decoder?build=linux-ubuntu-x86_64&deviceId=<UUID>&version=e7828f1-1324
    const codecs = [
        'libaac_decoder',
        'libaac_encoder',
        'libac3_decoder',
        'libac3_encoder',
        'libcook_decoder',
        'libdca_decoder',
        'libflv_decoder',
        'libh264_decoder',
        'libhevc_decoder',
        'liblibmp3lame_encoder',
        'liblibx264_encoder',
        'libmp2_decoder',
        'libmp3_decoder',
        'libmpeg2video_decoder',
        'libmpeg4_decoder',
        'libmsmpeg4v3_decoder',
        'librv30_decoder',
        'librv40_decoder',
        'libvc1_decoder',
        'libvp8_decoder',
        'libvp9_decoder',
        'libwmav2_decoder',
        'libwmv2_decoder',
    ];
    const codecTaskSample = {
            dst: codecsFolder,
            src: 'https://downloads.plex.tv/codecs/%s/linux-ubuntu-x86_64/%s.so',
            allowOverwrite: overwrite
    };
    codecs.forEach((codec) => {
        let codecTask = { options: {...codecTaskSample}, };
        codecTask.options.src = util.format(codecTask.options.src, config.transcoder.codecs_build, codec);
        codecTask.options.dst = codecTask.options.dst + codec + ".so";
        gruntConfig["request-progress"][codec] = codecTask;
    });
    let codecsTask = codecs.map(c => 'request-progress:' + c);
    codecsTask.unshift('mkdir:codecs');

    //The deb extraction task
    grunt.registerMultiTask('arx', 'Extract a GNU ar archive', function() {
        let archive = new ar.Archive(fs.readFileSync(this.data.src));
        let files = archive.getFiles();
        files.forEach((file) => {
            grunt.file.write(path.resolve(this.data.dst, file.name()), file.fileData());
        });
    });

    grunt.initConfig(gruntConfig);
    grunt.loadNpmTasks('grunt-request-progress');
    grunt.loadNpmTasks('grunt-mkdir');
    grunt.loadNpmTasks('grunt-untar');
    grunt.loadNpmTasks('grunt-zip');
    grunt.loadNpmTasks('grunt-run');

    grunt.registerTask('plex', ['mkdir:plex', 'request-progress:plex', 'arx:plex', 'untar:plex']);
    grunt.registerTask('codecs', codecsTask);
    grunt.registerTask('eae', ['mkdir:eae', 'request-progress:eae', 'unzip:eae']);
    grunt.registerTask('cache', ['mkdir:cache']);
    grunt.registerTask('geoip', ['run:geoip']);
    grunt.registerTask('default', ['plex', 'codecs', 'eae', 'cache', 'geoip']);
};