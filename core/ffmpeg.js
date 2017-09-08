/**
 * Created by drouar_b on 08/09/2017.
 */

const debug = require('debug')('ffmpeg');
const xml2js = require('xml2js');
const redis = require('../utils/redis');
const utils = require('../utils/utils');

class FFMPEG {
    static seglistParser(req, res) {
        let last = -1;
        let rc = redis.getClient();

        req.body.split(/\r?\n/).forEach((itm) => {
            itm = itm.split(',');
            let chk = itm.shift();

            //Long polling
            if (chk.match(/chunk-[0-9]{5}/)) {
                rc.set(req.params.sessionId + ":0:" + chk.replace(/chunk-([0-9]{5})/, '$1'), itm.toString());
                last = parseInt(chk.replace(/chunk-([0-9]{5})/, '$1'));
            }
            if (chk.match(/sub-chunk-[0-9]{5}/)) {
                rc.set(req.params.sessionId + ":sub:" + chk.replace(/sub-chunk-([0-9]{5})/, '$1'), itm.toString())
            }

            //M3U8
            if (chk.match(/media-[0-9]{5}\.ts/)) {
                rc.set(req.params.sessionId + ":0:" + chk.replace(/media-([0-9]{5})\.ts/, '$1'), itm.toString());
                last = parseInt(chk.replace(/media-([0-9]{5})\.ts/, '$1'));
            }
            if (chk.match(/media-[0-9]{5}\.vtt/)) {
                rc.set(req.params.sessionId + ":sub:" + chk.replace(/media-([0-9]{5})\.vtt/, '$1'), itm.toString())
            }
        });

        if (last != -1) {
            rc.set(req.params.sessionId + ":last", last);
        }

        rc.quit();
        res.end();
    }

    static manifestParser(req, res) {
        let rc = redis.getClient();

        rc.get(req.params.sessionId, (err, reply) => {
            if (typeof reply == 'undefined') {
                rc.quit();
                res.end();
                return;
            }

            let parsed = JSON.parse(reply);
            if (parsed == null) {
                rc.quit();
                res.end();
                return;
            }

            let prev = null;
            let segmentTime = 5;
            for (let i = 0; i < parsed.args.length; i++) {
                if (prev == "-min_seg_duration") {
                    segmentTime = parsed.args[i] / 1000000;
                    break;
                }
                prev = parsed.args[i];
            }

            xml2js.parseString(req.body, (err, mpd) => {
                if (err)
                    return;

                try {
                    let last = -1;

                    mpd.MPD.Period[0].AdaptationSet.forEach((adaptationSet) => {
                        let c = 0;
                        let i = 0;
                        let offset = 1;
                        let streamId = adaptationSet.Representation[0]["$"].id;
                        let timeScale = adaptationSet.Representation[0].SegmentTemplate[0]["$"].timescale;

                        adaptationSet.Representation[0].SegmentTemplate[0].SegmentTimeline[0].S.forEach((s) => {
                            if (typeof s["$"].t != 'undefined') {
                                offset = Math.round((s["$"].t / timeScale) / segmentTime) + 1;
                            }

                            for (i = c; i < c + (typeof s["$"].r != 'undefined' ? parseInt(s["$"].r) + 1 : 1); i++) {
                                rc.set(req.params.sessionId + ":" + streamId + ":" + utils.pad(i + offset, 5), s["$"].d);
                                if (i + offset > last)
                                    last = i + offset;
                            }
                            c = i;
                        });

                        if (last != -1) {
                            rc.set(req.params.sessionId + ":" + streamId + ":00000", 0);
                            if (streamId == 0) {
                                rc.set(req.params.sessionId + ":last", last);
                            }
                        }
                    });

                    rc.quit();
                } catch (e) {
                    rc.quit();
                }
                res.end();
            });
        });
    }
}

module.exports = FFMPEG;