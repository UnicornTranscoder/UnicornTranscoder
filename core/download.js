/**
 * Created by drouar_b on 27/04/2017.
 */

const debug = require('debug')('download');
const path = require('path');
const request = require('request');
const config = require('../config');
const universal = require('./universal');

let download = {};

download.serve = (req, res) => {
    request(config.base_url + '/api/pathname/' + req.params.id1 + '/', (error, response, body) => {
        if (!error && response.statusCode == 200) {
            let result = JSON.parse(body);
            debug(result.file);
            universal.downloads++;
            res.download(result.file, path.basename(result.file), () => {
                universal.downloads--;
            });
        } else {
            res.status(404).send('404 File not found')
        }
    })
};

module.exports = download;