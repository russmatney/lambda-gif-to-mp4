var Q = require('q');
var path = require('path');
var transformS3Event = require('lambduh-transform-s3-event');
var validate = require('lambduh-validate');
var execute = require('lambduh-execute');
var s3Get = require('lambduh-get-s3-object');
var s3Put = require('lambduh-put-s3-object');

process.env['PATH'] = process.env['PATH'] + ':/tmp/:' + process.env['LAMBDA_TASK_ROOT']

var pathToBash;
if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
  //production
  pathToBash = '/tmp/gif2mp4';
} else {
  //local
  pathToBash = './bin/gif2mp4';
}

exports.handler = function(event, context) {

  var result = {};
  Q.all([
    function() {
      console.log('Transforming S3 event');
      return transformS3Event(result, event)
        .then(function(result) {
          //TODO: re-write: take object then options, return result
          //need to resolve 'result' somehow. perhaps it's the first param
          console.log('Validating S3 event');
          return validate(result, {
            "srcKey": {
              endsWith: "\\.gif",
              endsWithout: "_\\d+\\.gif",
              startsWith: "events/"
            }
          });
        })

        .then(function(results) {
          result = results[0]; //first should be result from first promise
          //TODO: need to resolve `result` in all these promises
          console.log('Downloading file from S3');
          return s3Get(result, {
            srcKey: result.srcKey,
            srcBucket: result.srcBucket,
            downloadFilepath: '/tmp/' + path.basename(result.srcKey);
          });
        })

    }, function(result) {
      if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
        console.log('Prepping ffmpeg binary');
        return execute(result, {
          shell: 'cp /var/task/ffmpeg /tmp/.; chmod 755 /tmp/ffmpeg;'
        });
      } else {
        console.log('No prep necessary for ffmpeg binary');
        return result;
      }
    }, function(result) {
      if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
        console.log('Prepping gif2mp4 binary');
        return execute(result, {
          shell: 'cp /var/task/gif2mp4 /tmp/.; chmod 755 /tmp/gif2mp4;'
        });
      } else {
        console.log('No prep necessary for gif2mp4 binary');
        return result;
      }
    }
  ])

  .then(function(result) {
    //TODO: need to resolve `result` in all these promises
    console.log('Pausing before process file.');
    return Q.delay(5000).done(function() {
      console.log('Processing file.');
      return execute(result, {
        bashScript: pathToBash,
        bashParams: [result.downloadFilepath]
      })
    })
  })

  .then(function(result) {
    console.log('Uploading file to s3.');
    //TODO: need to resolve `result` in all these promises
    //distinguisth filepath from uploadFilepath
    return s3Put(result, {
      dstBucket: result.srcBucket;
      dstKey: path.dirname(result.srcKey) + "/" + path.basename(result.srcKey, '.gif') + '.mp4';
      uploadFilepath: '/tmp/' + path.basename(result.downloadFilepath, '.gif') + '-final.mp4';
    })
  })

  .then(function(result) {
    console.log('Removing file that was uploaded.');
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

