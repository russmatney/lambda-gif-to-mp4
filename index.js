// dependencies
var AWS = require('aws-sdk');
var ffmpeg = require('fluent-ffmpeg');
var q = require('q');
var fs = require('fs');
var path = require('path');
var mime = require('mime');

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT']

if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
  //production
  var handleS3Event = require('handle-s3-event');
  var tmpPrefix = '/tmp/';
} else {
  //local
  var handleS3Event = require('./local_modules/handle-s3-event');
  var tmpPrefix = './';
}

var s3 = new AWS.S3();

var moveAndChmodFfmpegBinary = function() {
  var def = q.defer()

  require('child_process').exec(
    'cp /var/task/ffmpeg /tmp/.; chmod 755 /tmp/ffmpeg',
    function (error, stdout, stderr) {
      if (error) {
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
        def.reject(err);
      } else {
        def.resolve()
      }
    });

    return def.promise;
}

//TODO: unit test
var isValidKey = function(key) {
  function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  }

  return endsWith(key, '.gif')
}

exports.handler = function(event, context) {
  //assign these for prod – if ffmpeg-fluent doesn't find them,
  //it falls back to the machine's local `ffmpeg`
  process.env['FFMPEG_PATH'] = '/tmp/ffmpeg';
  process.env['FFPROBE_PATH'] = '/tmp/ffprobe';

  var promises = [];

  if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
    promises.push(moveAndChmodFfmpegBinary);
  }

  promises.push(printFormats);
  promises.push(handleS3Event(event));

  promises.push(function(s3Data) {
    var def = q.defer()

    if (isValidKey(s3Data.srcKey)) {
      def.resolve(s3Data);
    } else {
      def.reject("Uploaded file does not end in `.gif`: " + s3Data.srcKey)
    }

    return def.promise
  });

  promises.push(function(s3Data) {
    //TODO: unit tests
    var def = q.defer();

    var params = {Bucket: s3Data.srcBucket, Key: s3Data.srcKey};
    var filePath = tmpPrefix + s3Data.srcKey
    var file = fs.createWriteStream(filePath);

    s3.getObject(params)
      .on('httpData', function(chunk) {
        file.write(chunk)
      })
      .on('httpDone', function() {
        file.end()
        def.resolve({
          s3Data: s3Data,
          file: file
        });
      })
      .send();

    return def.promise;
  });

  promises.push(function(options) {
    var def = q.defer()

    var basename = path.basename(options.file.path, '.gif')
    var mp4Path = tmpPrefix + basename + '.mp4';

    ffmpeg(options.file.path)
      .inputOptions([
        '-y',
        '-f gif',
      ])
      .outputOptions([
        '-pix_fmt yuv420p'
      ])
      .videoCodec('libx264')
      .on('error', function(err) {
        console.log('mp4 save error')
        def.reject(err);
      })
      .on('end', function(data) {
        options.mp4Path = mp4Path;
        def.resolve(options);
      })
      .save(mp4Path)

    return def.promise;
  });

  promises.push(function(options) {
    //needs dstBucket, dstKey, file.path
    var def = q.defer();

    var stream = fs.createReadStream(options.mp4Path);

    var newBase = path.basename(options.mp4Path);
    var dstKey = path.normalize(options.s3Data.srcKey) + newBase;
    //TODO: needs work
    console.log(dstKey);

    var params = {
      Bucket: options.s3Data.srcBucket + "-resized",
      Key: newBase,
      Body: stream,
      ContentType: mime.lookup(options.mp4Path)
    };

    s3.upload(params).send(function(err, data) {
      if (err) {
        def.reject(err);
      } else {
        def.resolve()
      }
    });

    return def.promise;
  });

  promises.push(function() {
    var def = q.defer()
    console.log('successful conversion and upload');
    def.resolve()
    context.done()
    return def.promise
  })

  promises.reduce(q.when, q())
    .fail(function(err){
      console.log('promise rejected with err');
      console.log(err);
      context.done(err);
    });

};
