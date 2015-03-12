// dependencies
var AWS = require('aws-sdk');
var ffmpeg = require('fluent-ffmpeg');
var q = require('q');
var fs = require('fs');
var path = require('path');
var mime = require('mime');
var gm = require('gm')
          .subClass({imageMagick: true})
var mkdirp = require('mkdirp')

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

    s3.getObject(params, function(err, data) {
      if (err) { def.reject(err) }
      else {
        def.resolve({
          s3Data: s3Data,
          gifPath: '',
          body: data.Body
        });
      }
    })

    return def.promise;
  });

  promises.push(function(options) {
    var def = q.defer()

    gm(options.body).identify(function(err, data) {
      if (err) { def.reject(err); }
      else {
        console.log('id-ed gif:');
        console.log(data);
        def.resolve(options)
      }
    });

    return def.promise
  });


  promises.push(function(options) {
    var def = q.defer()
    console.log('options');
    console.log(options);

    var basename = path.basename(options.s3Data.srcKey, '.gif');
    var dirPath = tmpPrefix + basename;
    mkdirp(dirPath, function(err) {
      if (err) { def.reject(err) }
      else {
        console.log('created dir: ' + dirPath);

        var pngsPath = dirPath + '/' + basename + '.png';
        gm(options.body).write(pngsPath, function(err) {
          if (err) { def.reject(err) }
          else {
            console.log('pngs written');

            gm(options.body).identify(function(err, data) {
              if (err) { def.reject(err); }
              else {
                console.log('id-ed gif:');

                console.log('delay: ' + data.Delay);
                var speed = data.Delay.substring(0, 2);
                speed = 100 / speed;
                console.log('speed: ' + speed);

                //create 5 loop stack of pngs
                fs.readdir(dirPath, function(err, files) {
                  if (err) { def.reject(err) }
                  else {
                    var frameCount = files.length;
                    var numberOfLoops = 5;

                    var createLoopPromises = [];
                    console.log('readdir files: ', files)

                    var frameNum = 0;
                    files.map(function(file) {
                      return path.join(dirPath, file);
                    }).forEach(function(file) {
                      for(var x = 0; x < numberOfLoops; x++) {

                        createLoopPromises.push(function(file, fileNum) {
                          console.log('fileNum ' + fileNum);
                          return function() {
                            var d = q.defer()

                            function paddy(number, padding) {
                              var pad = new Array(1 + padding).join('0');
                              return (pad + number).slice(-pad.length);
                            }

                            var fileSuffix = '-' + paddy(fileNum, 3) + '.png';
                            var newFileName = file.replace(/-[^-]*$/, fileSuffix)
                            console.log('new file name: ' + newFileName);
                            gm(file).write(newFileName, function(err) {
                              if (err) {
                                console.log(err);
                                d.reject(err);
                              } else {
                                console.log('new png written');
                                d.resolve()
                              }
                            })
                            return d.promise;
                          }
                        }(file, x * frameCount + frameNum))
                      }
                      frameNum++;
                      console.log('frameNum incremented: ' + frameNum)
                    });

                    createLoopPromises.reduce(q.when, q())
                      .then(function(results) {
                        console.log('loop stack of pngs written');

                        var pngsBlurb = dirPath + '/' + basename + '-%03d.png';
                        var mp4Path = dirPath + '/' + basename + '.mp4';

                        ffmpeg(pngsBlurb)
                          .inputOptions([
                          ])
                          .outputOptions([
                            '-r ' + speed,
                            '-pix_fmt yuv420p'
                          ])
                          .videoCodec('libx264')
                          .on('start', function(command) {
                            console.log('started: ' + command);
                          })
                          .on('progress', function(progress) {
                            console.log('progress');
                            console.log(progress);
                          })
                          .on('error', function(err) {
                            console.log('mp4 save error')
                            def.reject(err);
                          })
                          .on('end', function(data) {
                            options.mp4Path = mp4Path;
                            def.resolve(options);
                          })
                          .save(mp4Path)

                      });

                  }
                });

              }
            })

          }

        })

      }
    })
    return def.promise;
  });

  promises.push(function(options) {
    //needs dstBucket, dstKey, file.path
    var def = q.defer();

    console.log('options');
    console.log(options);
    var stream = fs.createReadStream(options.mp4Path);

    var newBase = path.basename(options.mp4Path);
    //TODO: needs work

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
