var Q = require('q');
var path = require('path');

var transformS3Event = require('lambduh-transform-s3-event');
var validate = require('lambduh-validate');
var execute = require('lambduh-execute');
var s3Download = require('lambduh-get-s3-object');
var s3Upload = require('lambduh-put-s3-object');

process.env.PATH = process.env.PATH + ':/tmp/:' + process.env.LAMBDA_TASK_ROOT;

var pathToBash;
if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
  //production
  pathToBash = '/var/task/gif2mp4.sh';
} else {
  //local
  pathToBash = './bin/gif2mp4.sh';
}

exports.handler = function(event, context) {

  var result = {};
  console.log('Transforming S3 event');
  transformS3Event(result, event)

  .then(function(result) {
    console.log('Validating S3 event.');
    console.log(result);
    return validate(result, {
      "srcKey": {
        endsWith: "\\.gif",
        endsWithout: "_\\d+\\.gif",
        startsWith: "events/"
      }
    });
  })

  .then(function(result) {
    console.log('Downloading file from S3');
    var safeTempFilepath = path.basename(result.srcKey)
      .replace(/^[^a-zA-Z0-9]+/, "");
    return s3Download(result, {
      srcKey: result.srcKey,
      srcBucket: result.srcBucket,
      downloadFilepath: '/tmp/' + safeTempFilepath
    });
  })

  .then(function(result) {
    var def = Q.defer();
    var timeout = 500;
    setTimeout(function(){
      console.log('' + timeout + ' milliseconds later....');
      def.resolve(result);
    }, timeout);
    return def.promise;
  })

  .then(function(result) {
    console.log('Processing file.');
    console.log(result);
    return execute(result, {
      bashScript: pathToBash,
      bashParams: [result.downloadFilepath]
    });
  })

  .then(function(result) {
    console.log('Uploading file to s3.');
    console.log(result);
    return s3Upload(result, {
      dstBucket: result.srcBucket,
      dstKey: path.dirname(result.srcKey) + "/" + path.basename(result.srcKey, '.gif') + '.mp4',
      uploadFilepath: '/tmp/' + path.basename(result.downloadFilepath, '.gif') + '-final.mp4'
    });
  })

  .then(function(result) {
    console.log('Removing file that was uploaded.');
    console.log(result);
    return execute(result, {
      shell: "rm " + result.uploadFilepath
    });
  })

  .then(function(result) {
    console.log('Finished.');
    context.done();
  })

  .fail(function(err){
    console.log('Promise rejected with err:');
    console.log(err);
    context.done(null, err);
  });
};

