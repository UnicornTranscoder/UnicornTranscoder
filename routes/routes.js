/**
 * Created by drouar_b on 27/04/2017.
 */

var express = require('express');
var router = express.Router();

var m3u8 = require('../core/m3u8');
var stream = require('../core/stream');
var download = require('../core/download');
var proxy = require('../core/proxy');

//Stream mode
router.get('/video/:/transcode/universal/start', stream.serve);
router.get('/video/:/transcode/universal/subtitles', stream.serveSubtitles);

//m3u8 mode
router.get('/video/:/transcode/universal/session/:sessionId/base/index.m3u8', m3u8.serve);
router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', m3u8.serveParts);

// Download files
router.get('/library/parts/:id1/:id2/file.*', download.serve);

// Reverse all others to plex
router.all('*', proxy);

module.exports = router;