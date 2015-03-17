var Q = require('q');
var path = require('path');
var transformS3Event = require('lambduh-transform-s3-event');
var validate = require('lambduh-validate');
var execute = require('lambduh-execute');
var download = require('lambduh-get-s3-object');
var upload = require('lambduh-put-s3-object');

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
  var promises = [];

  promises.push(transformS3Event(event))
  promises.push(validate({
    "srcKey": {
      endsWith: "\\.gif",
      endsWithout: "_\\d+\\.gif",
      startsWith: "events/"
    }
  }));

  if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
    promises.push(execute({
      shell: 'cp /var/task/ffmpeg /tmp/.; chmod 755 /tmp/ffmpeg;'
    }));
    promises.push(execute({
      shell: 'cp /var/task/gif2mp4 /tmp/.; chmod 755 /tmp/gif2mp4;'
    }));
  }

  promises.push(function(options) {
    //baked assumption: options has srcKey and srcBucket
    console.log('Pulling .gif from S3: ' + options.srcKey);
    options.downloadFilepath = '/tmp/' + path.basename(options.srcKey);
    return download()(options);
  });

  promises.push(function(options) {
    //wait 5 seconds for stream, or some bullshit
    var def = Q.defer();
    Q.delay(5000).done(function() {
      return def.resolve(execute({
        bashScript: pathToBash,
        bashParams: [options.downloadFilepath]
      })(options));
    });
    return def.promise;
  });

  promises.push(function(options) {
    options.dstBucket = options.srcBucket;
    options.dstKey = path.dirname(options.srcKey) + "/" + path.basename(options.srcKey, '.gif') + '.mp4';
    options.uploadFilepath = '/tmp/' + path.basename(options.downloadFilepath, '.gif') + '-final.mp4';
    return upload()(options);
  });

  promises.push(function(options) {
    return execute({
      shell: "rm " + options.uploadFilepath
    })(options);
  });

  promises.push(function(options) {
    var def = Q.defer();
    console.log('Finished.');
    context.done();
    def.resolve();
    return def.promise;
  });

  promises.reduce(Q.when, Q())
    .fail(function(err){
      console.log('Promise rejected with err:');
      console.log(err);
      context.done(null, err);
    });
};

