/**
 * Created by drouar_b on 27/04/2017.
 */

const debug = require('debug')('download');
const path = require('path');
const request = require('request');
const config = require('../config');
const universal = require('./universal');

let download = {};

download.serve = function (req, res) {
    request(config.api_url + config.endpoints.path + req.params.id1 + '/' + req.params.id2 + '/', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            let result = JSON.parse(body);
            if (result.status == 0) {
                debug(config.mount_point + result.link);
                universal.downloads++;
                res.download(config.mount_point + result.link, path.basename(config.mount_point + result.link), () => {
                    universal.downloads--;
                })
            } else {
                res.status(404).send('404 file not found in database')
            }
        } else {
            res.status(500).send('500 Internal server error')
        }
    })
};

module.exports = download;