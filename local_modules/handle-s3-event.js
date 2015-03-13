q = require('q')

module.exports = function(event) {
  var s3Event = event;
  return function() {
    console.log('handling s3 event');

    var def = q.defer()

    if (s3Event &&
        s3Event.Records &&
        s3Event.Records[0] &&
        s3Event.Records[0].s3 &&
        s3Event.Records[0].s3.bucket &&
        s3Event.Records[0].s3.bucket.name &&
        s3Event.Records[0].s3.object &&
        s3Event.Records[0].s3.object.key) {

      def.resolve({
        srcBucket: s3Event.Records[0].s3.bucket.name,
        srcKey: s3Event.Records[0].s3.object.key,
      });

    } else {
      def.reject(new Error('Passed event could not be handled: ', s3Event))
    }

    return def.promise;
  }
}
