/**
 * Created by drouar_b on 26/05/2017.
 */

let utils = {};

utils.pad = function (n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n
};

module.exports = utils;