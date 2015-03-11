// dependencies
var AWS = require('aws-sdk');
var gm = require('gm')
            .subClass({ imageMagick: true }); // Enable ImageMagick integration.
var ffmpeg = require('fluent-ffmpeg');
var q = require('q');

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT']

var s3 = new AWS.S3();

exports.handler = function(event, context) {

  process.env['FFMPEG_PATH'] = '/tmp/ffmpeg';
  process.env['FFPROBE_PATH'] = '/tmp/ffprobe';

  var moveAndChmodFfmpegBinary = function() {
    var def = q.defer()

    require('child_process').exec(
      'cp /var/task/ffmpeg /tmp/.; chmod 755 /tmp/ffmpeg',
      function (error, stdout, stderr) {
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);
        if (error !== null) {
          console.log('exec error: ' + error);
          def.reject(error)
        } else {
          def.resolve()
        }
      }
    )

    return def.promise;
  }

  var printFormats = function() {
    var def = q.defer()

    ffmpeg.getAvailableFormats(function(err, formats) {
      if (err) {
        console.log('error getting formats');
        console.log(err);
        def.reject(err);
      } else {
        console.log('Available formats:');
        console.dir(formats.wtv);
        def.resolve()
      }
    });

    return def.promise;
  }

  var promises = [];

  if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
    promises.push(moveAndChmodFfmpegBinary);
  }

  promises.push(printFormats);

  console.log('promises');
  console.log(promises);

  promises.reduce(q.when, q());

};
