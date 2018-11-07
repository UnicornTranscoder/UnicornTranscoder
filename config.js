/**
 * Created by drouar_b on 27/04/2017.
 */

const env = require('getenv');

module.exports = {
    port:                  env.int   ('SERVER_PORT',           3000),
    host:                  env.string('SERVER_LISTEN',         '127.0.0.1'),
    mount_point:           env.string('MOUNT_POINT',           '/media'),
    transcoder_decay_time: env.int   ('TRANSCODER_DECAY_TIME', 120),
    loadbalancer_address:  env.url   ('LOADBALANCER_ADDRESS',  'https://unicornloadbalancer.myplex.com'),

    transcoder: {
        plex_build:        env.string('PLEX_BUILD',            '1.13.8.5395-10d48da0d'),
        codecs_build:      env.string('CODECS_BUILD',          'e7828f1-1324'),
        plex_resources:    env.string('PLEX_RESOURCES',        'plexmediaserver/'),
        temp_folder:       env.string('TEMP_FOLDER',           'cache/'),
        codecs_folder:     env.string('CODECS_FOLDER',         'codecs/')
    }
};
