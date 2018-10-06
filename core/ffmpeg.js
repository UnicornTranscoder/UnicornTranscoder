/**
 * Created by drouar_b on 08/09/2017.
 */

const debug = require('debug')('ffmpeg');
const xml2js = require('xml2js');
const LeakyBucket = require('leaky-bucket');
const universal = require('./universal');

let buckets = {};

class FFMPEG {
    static seglistParser(req, res) {
        if (typeof buckets[req.params.sessionId] === "undefined")
            buckets[req.params.sessionId] = new LeakyBucket(1, 1, 1);

        buckets[req.params.sessionId].reAdd(1, (err) => {
            if (err) {
                res.end();
                return;
            }

            let cs;
            let last = -1;
            if (req.params.sessionId in universal.cache) {
                cs = universal.cache[req.params.sessionId].chunkStore;
            } else {
                res.end();
                return;
            }

            req.body.split(/\r?\n/).forEach((itm) => {
                itm = itm.split(',');
                let chk = itm.shift();

                //Long polling
                if (chk.match(/^chunk-[0-9]{5}/)) {
                    let chunkId = chk.replace(/chunk-([0-9]{5})/, '$1');

                    if (!cs.hasChunk('0', chunkId)) {
                        cs.saveChunk('0', chunkId, itm.toString());

                        //Create the table timecode->ChunkID for LongPolling
                        let beginning = Math.ceil(parseFloat(itm[0]));
                        let end = Math.floor(parseFloat(itm[1]));

                        //First chunk is alway 0-timecode
                        if (beginning < end - 10)
                            beginning = end - 10;

                        for (let i = beginning; i < end + 1; i++)
                            cs.saveChunk('timecode', i, parseInt(chunkId))
                    }
                    last = parseInt(chunkId);
                }

                //Subtitles chunks for LongPolling
                if (chk.match(/^sub-chunk-[0-9]{5}/)) {
                    let chunkId = chk.replace(/sub-chunk-([0-9]{5})/, '$1');
                    cs.saveChunk('sub', chunkId, itm.toString());
                }

                //M3U8
                if (chk.match(/^media-[0-9]{5}\.ts/)) {
                    let chunkId = chk.replace(/media-([0-9]{5})\.ts/, '$1');
                    cs.saveChunk('0', chunkId, itm.toString());
                    last = parseInt(chunkId);
                }
                //VTT Subtitles (M3U8)
                if (chk.match(/^media-[0-9]{5}\.vtt/)) {
                    let chunkId = chk.replace(/media-([0-9]{5})\.vtt/, '$1');
                    cs.saveChunk('sub', chunkId, itm.toString());
                }
            });

            if (last !== -1) {
                cs.setLast(last);
            }

            res.end();
        });
    }

    static manifestParser(req, res) {
        if (typeof buckets[req.params.sessionId] === "undefined")
            buckets[req.params.sessionId] = new LeakyBucket(1, 1, 1);

        buckets[req.params.sessionId].reAdd(1, (err) => {
            if (err) {
                res.end();
                return;
            }

            let cs;
            let transcoder;
            if (req.params.sessionId in universal.cache) {
                transcoder = universal.cache[req.params.sessionId];
                cs = universal.cache[req.params.sessionId].chunkStore;
            } else {
                res.end();
                return;
            }


            let prev = null;
            let segmentTime = 5;
            for (let i = 0; i < transcoder.transcoderArgs.length; i++) {
                if (prev === "-min_seg_duration") {
                    segmentTime = transcoder.transcoderArgs[i] / 1000000;
                    break;
                }
                prev = transcoder.transcoderArgs[i];
            }


            xml2js.parseString(req.body, (err, mpd) => {
                if (err)
                    return;

                try {
                    let last = -1;

                    let offset = 1;
                    mpd.MPD.Period[0].AdaptationSet.forEach((adaptationSet) => {
                        let c = 0;
                        let i = 0;
                        let streamId = parseInt(adaptationSet.Representation[0]["$"].id);
                        let timeScale = adaptationSet.Representation[0].SegmentTemplate[0]["$"].timescale;

                        adaptationSet.Representation[0].SegmentTemplate[0].SegmentTimeline[0].S.forEach((s) => {
                            if (typeof s["$"].t !== 'undefined' && streamId === 0) {
                                offset = Math.round((s["$"].t / timeScale) / segmentTime);
                            }

                            for (i = c; i < c + (typeof s["$"].r !== 'undefined' ? parseInt(s["$"].r) + 1 : 1); i++) {

                                cs.saveChunk(streamId, i + offset, s["$"].d);

                                if (i + offset > last)
                                    last = i + offset;
                            }
                            c = i;
                        });

                        if (last !== -1) {
                            cs.saveChunk(streamId, 0, 0);
                            if (streamId === 0) {
                                cs.setLast(last);
                            }
                        }
                    });
                } catch (e) { }
                res.end();
            });
        });
    }
}

module.exports = FFMPEG;