var AWS = require('aws-sdk');
var ffmpeg = require('fluent-ffmpeg');
var q = require('q');
var fs = require('fs');
var path = require('path');
var mime = require('mime');
var gm = require('gm')
          .subClass({imageMagick: true});
var mkdirp = require('mkdirp');
var zlib = require('zlib');

var proc = require('child_process');

process.env['PATH'] = process.env['PATH'] + ':/tmp/:' + process.env['LAMBDA_TASK_ROOT']

var tmpPrefix;
var pathToBash;
var handleS3Event;

if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
  //production
  tmpPrefix = '/tmp/';
  pathToBash = '/tmp/gif2mp4';
  handleS3Event = require('handle-s3-event');
} else {
  //local
  tmpPrefix = './';
  pathToBash = './bin/gif2mp4';
  handleS3Event = require('./local_modules/handle-s3-event');
}

var s3 = new AWS.S3();

exports.handler = function(event, context) {
  process.env['FFMPEG_PATH'] = '/tmp/ffmpeg';
  process.env['FFPROBE_PATH'] = '/tmp/ffprobe';

  var promises = [];

  if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
    promises.push(function() {
      return q.Promise(function(resolve, reject, notify) {
        console.log('manipulating binaries');
        proc.exec(
          'rm /tmp/*; cp /var/task/ffmpeg /tmp/.; chmod 755 /tmp/ffmpeg; cp /var/task/gif2mp4 /tmp/.; chmod 755 /tmp/gif2mp4;',
          function (error, stdout, stderr) {
            if (error) {
              reject(error)
            } else {
              resolve()
            }
          }
        )
      });

    })
  }

  promises.push(handleS3Event(event))

  promises.push(function(options) {
    return q.Promise(function(resolve, reject) {
      console.log('pulling from s3');
      options.gifPath = '/tmp/' + options.srcKey;
      var params = {Bucket: options.srcBucket, Key: options.srcKey};
      var file = require('fs').createWriteStream(options.gifPath);
      var s3Req = s3.getObject(params)
      s3Req.on('complete', function() {
        resolve(options);
      })
      s3Req.on('error', function(err) {
        reject(err);
      });
      s3Req.createReadStream().pipe(file)
    })
  });

  promises.push(function(options) {
    return q.Promise(function(resolve, reject) {
      console.log('launching my baby-back script');

      var child = proc.spawn(pathToBash, [options.gifPath]);
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
    var def = q.defer();
    console.log('ready for upload');
    options.mp4Path = '/tmp/' + path.basename(options.gifPath, '.gif') + '-final.mp4';

    var params = {
      Bucket: options.srcBucket + "-resized",
      Key: path.basename(options.mp4Path),
      ContentType: mime.lookup(options.mp4Path)
    }

    var body = fs.createReadStream(options.mp4Path)
    var s3obj = new AWS.S3({params: params});
    s3obj.upload({Body: body})
      .on('httpUploadProgress', function(evt) {
        console.log('upload progress: ' + (100 * evt.loaded / evt.total));
      })
      .send(function(err, data) {
        if (err) {
          console.log('error');
          def.reject(err);
        } else {
          console.log('successful conversion and upload');
          def.resolve(options);
        }
      });
    return def.promise;
  });

  promises.push(function(options) {
    var def = q.defer();
    console.log('finished');
    context.done();
    def.resolve();
    return def.promise;
  });

  promises.reduce(q.when, q())
    .fail(function(err){
      console.log('promise rejected with err');
      context.done(err);
    });
};
