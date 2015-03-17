var AWS = require('aws-sdk');
var q = require('q');
var path = require('path');
var mime = require('mime');
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

var s3 = new AWS.S3();

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

    //not ideal, resolves premature script running issue for now
    return setTimeout(function() {
      return download()(options);
    }, 5000);
  });

  promises.push(function(options) {
    return q.Promise(function(resolve, reject) {
      console.log('Launching script.');

      var child = require('child_process').spawn(pathToBash, [options.downloadFilepath]);
      child.stdout.on('data', function (data) {
        console.log("stdout: " + data);
      });
      child.stderr.on('data', function (data) {
        console.log("stderr: " + data);
      });
      child.on('exit', function (code) {
        if (code != 0) {
          reject(new Error('spawn script err'));
        } else {
          resolve(options);
        }
      });

    });
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
    var def = q.defer();
    console.log('Finished.');
    context.done();
    def.resolve();
    return def.promise;
  });

  promises.reduce(q.when, q())
    .fail(function(err){
      console.log('Promise rejected with err:');
      console.log(err);
      context.done(null, err);
    });
};

