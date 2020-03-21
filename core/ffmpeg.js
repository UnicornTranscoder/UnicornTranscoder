/**
 * Created by drouar_b on 08/09/2017.
 */

const xml2js = require('xml2js');
const SessionManager = require('./session-manager');

class FFMPEG {
    static seglistParser(req, res) {
        if (typeof req.body !== 'string')
            return res.end();

        let regex;
        let last = -1;
        let streamId = '0';
        let saveTimecodes = false;
        let transcoder = SessionManager.getSession(req.params.sessionId);
        if (transcoder === null || transcoder.uuid !== req.params.uuid) {
            res.end();
            return;
        }
        let cs = transcoder.chunkStore;

        if (req.body.match(/^chunk-[0-9]{5}/)) {
            regex = /chunk-([0-9]{5})/;
            saveTimecodes = true;
        } else if (req.body.match(/^sub-chunk-[0-9]{5}/)) {
            regex = /sub-chunk-([0-9]{5})/;
            streamId = 'sub';
        } else if (req.body.match(/^media-[0-9]{5}\.ts/)) {
            regex = /media-([0-9]{5})\.ts/;
        } else if (req.body.match(/^media-[0-9]{5}\.vtt/)) {
            regex = /media-([0-9]{5})\.vtt/;
            streamId = 'sub';
        } else {
            return res.end();
        }

        //Parse first chunkId and skip the n-first chunks
        let chunkList = req.body.split(/\r?\n/);
        let firstChunkId = parseInt(req.body.replace(regex, '$1'));
        let toRemove = cs.getLast(streamId) - firstChunkId;
        if (toRemove >= 0)
            chunkList.splice(0, toRemove);

        chunkList.forEach((itm) => {
            if (itm.startsWith('#'))
                return;

            itm = itm.split(',');
            if (itm.length <= 1)
                return;
            let chk = itm.shift();

            //Parse chunkId
            let chunkId = chk.replace(regex, '$1');

            //If we should save timecodes
            if (saveTimecodes && cs.getChunk('0', chunkId) === null) {

                //Create the table timecode->ChunkID for LongPolling
                let beginning = Math.ceil(parseFloat(itm[0]));
                let end = Math.floor(parseFloat(itm[1]));

                //First chunk is alway 0-timecode
                if (beginning < end - 10)
                    beginning = end - 10;

                for (let i = beginning; i < end + 1; i++)
                    cs.saveChunk('timecode', i, parseInt(chunkId))
            }

            //Save chunks and parse last
            cs.saveChunk(streamId, chunkId, itm.toString());
            last = parseInt(chunkId);
        });

        if (last !== -1)
            cs.setLast(streamId, last);

        res.end();
    }

    static manifestParser(req, res) {
        //Find the transcoder session
        let transcoder = SessionManager.getSession(req.params.sessionId);
        if (transcoder === null || transcoder.uuid !== req.params.uuid) {
            res.end();
            return;
        }
        let cs = transcoder.chunkStore;

        //Parse arguments to find the segment duration
        let prev = null;
        let segmentTime = 5;
        for (let i = 0; i < transcoder.transcoderArgs.length; i++) {
            if (prev === "-min_seg_duration") {
                segmentTime = transcoder.transcoderArgs[i] / 1000000;
                break;
            }
            if (prev === "-seg_duration") {
                segmentTime = transcoder.transcoderArgs[i];
                break;
            }
            prev = transcoder.transcoderArgs[i];
        }

        //Parse the MPD returned by FFMPEG
        xml2js.parseString(req.body, (err, mpd) => {
            if (err)
                return;

            try {
                let last = -1;

                //For each adapatation set (audio/video)
                let offset = 1;
                mpd.MPD.Period[0].AdaptationSet.forEach((adaptationSet) => {
                    let c = 0;
                    let i = 0;
                    let streamId = parseInt(adaptationSet.Representation[0]["$"].id);
                    let timeScale = adaptationSet.Representation[0].SegmentTemplate[0]["$"].timescale;

                    //For each segment (chunk of audio/video)
                    adaptationSet.Representation[0].SegmentTemplate[0].SegmentTimeline[0].S.forEach((s) => {
                        //Calculate the offset of the first segment (if FFmpeg don't start from the beginning)
                        if (typeof s["$"].t !== 'undefined' && streamId === 0) {
                            offset = Math.round((s["$"].t / timeScale) / segmentTime);
                        }

                        //Sometimes multiple chunks are in the same MPD segement
                        // c = number of the first chunk
                        // s["$"].r = number of chunks in the segment
                        for (i = c; i < c + (typeof s["$"].r !== 'undefined' ? parseInt(s["$"].r) + 1 : 1); i++) {

                            cs.saveChunk(streamId, i + offset, s["$"].d);

                            if (i + offset > last)
                                last = i + offset;
                        }
                        c = i;
                    });

                    if (last !== -1) {
                        //Store chunkId 0 (MPD init chunk)
                        cs.saveChunk(streamId, 0, 0);
                        cs.setLast(streamId, last);
                    }
                });
            } catch (e) {
            }
            res.end();
        });
    }
}

module.exports = FFMPEG;