/**
 * Created by drouar_b on 26/05/2017.
 */

let utils = {};

utils.pad = function (n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n
};

utils.toJSON = function (obj) {
    let cache = [];

    return JSON.stringify(obj, function(key, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                return;
            }
            cache.push(value);
        }
        return value;
    })
};

utils.replaceAll = (input, search, replace) => {
    let str = input;
    while (str.indexOf(search) !== -1)
        str = str.replace(search, replace);
    return str
};

module.exports = utils;