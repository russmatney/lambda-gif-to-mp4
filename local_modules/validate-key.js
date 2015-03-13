q = require('q');

module.exports = function(options) {
  return q.Promise(function(resolve, reject) {

    function endsWith(string, suffixPattern) {
      return suffixPattern.test(string);
    }

    function pathIs(str, prefix) {
      return str.indexOf(prefix) == 0;
    }

    if (!options || !options.srcKey) {
      reject(new Error("Options with .srcKey expected in validateKey"))
    } else if(!pathIs(options.srcKey, 'events/')) {
      reject(new Error("Uploaded file is not in events/ folder"))
    } else if(!endsWith(options.srcKey, /\.gif$/)) {
      reject(new Error("Uploaded file is not a .gif, exiting"))
    } else if(endsWith(options.srcKey, /_\d+\.gif$/)) {
      reject(new Error("Uploaded file is a _*.gif, exiting"))
    } else {
      resolve(options)
    }
  })
}
