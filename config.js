/**
 * Created by drouar_b on 27/04/2017.
 */

const getenv = require('getenv');

module.exports = getenv.multi({
    // app config
    port:                  ["PORT", 3000, 'int'],
    mount_point:           ['MOUNT_POINT', '/mnt/acd'],
    transcoder_decay_time: ['TRANSCODER_DECAY_TIME', 120, 'int'],

    //plex config
    plex_url: ['PLEX_URL', 'http://myplex.com:32400'],
    base_url: ['BASE_URL', 'https://myplex.com'],

    //redis config
    redis_host: ['REDIS_HOST', '127.0.0.1'],
    redis_port: ['REDIS_PORT', '6379'],
    redis_pass: ['REDIS_PASSWORD', ''],
    redis_db:   ['REDIS_DB', 1, 'int'],

    //Transcoder settings
    video_content_type:       ['VIDEO_CONTENT_TYPE', 'video/x-matroska'],
    subtitles_content_type:   ['SUBTITLES_CONTENT_TYPE', 'text/vtt'],
    ld_library_path:          ['LD_LIBRARY_PATH', '/root/unicorn/UnicornTranscoder/Resources/'],
    transcoder_path:          ['TRANSCODER_PATH', '/root/unicorn/UnicornTranscoder/Resources/Plex Transcoder'],
    ffmpeg_external_libs:     ['FFMPEG_EXTERNAL_LIBS', '/root/unicorn/UnicornTranscoder/Codecs/'],
    eae_root:                 ['EAE_ROOT', '/root/unicorn/UnicornTranscoder/Cache/'],
    xdg_cache_home:           ['XDG_CACHE_HOME', '/root/unicorn/UnicornTranscoder/Cache/'],
    xdg_data_home:            ['XDG_DATA_HOME', '/root/unicorn/UnicornTranscoder/Resources/Resources/'],
    plex_ressources:          ['PLEX_RESSOURCES', '/root/unicorn/UnicornTranscoder/Resources/']
});

// Public configuration
module.exports.public_config = getenv.multi({
	serverName:               ["SERVER_NAME", ''],
	preferredMaxSessions:     ['MAX_SESSIONS', 10, 'int'],
	preferredMaxDownloads:    ['MAX_DOWNLOADS', 10, 'int'],
	preferredMaxTranscodes:   ['MAX_TRANSCODES', 10, 'int']
});

//Allow to reroute via another URL from the country code
module.exports.routing = {
    'FR': 'https://fr.mytranscoder.myplex.com'
};
