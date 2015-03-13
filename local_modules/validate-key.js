q = require('q');

module.exports = function(options) {
  return q.Promise(function(resolve, reject) {

    if (!options || !options.srcKey) {
      reject()
    }

  })
}
