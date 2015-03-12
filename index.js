var AWS = require('aws-sdk');
var ffmpeg = require('fluent-ffmpeg');
var q = require('q');
var fs = require('fs');
var path = require('path');
var mime = require('mime');
var gm = require('gm')
          .subClass({imageMagick: true})
var mkdirp = require('mkdirp')

var proc = require('child_process');

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT']

var tmpPrefix;
var pathToBash;

if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
  //production
  tmpPrefix = '/tmp/';
  pathToBash = '/tmp/bash-scrap';
} else {
  //local
  tmpPrefix = './';
  pathToBash = './bin/bash-scrap';
}

var s3 = new AWS.S3();

exports.handler = function(event, context) {
  process.env['FFMPEG_PATH'] = '/tmp/ffmpeg';
  process.env['FFPROBE_PATH'] = '/tmp/ffprobe';

  var promises = [];

  if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
    promises.push(function() {
      var def = q.defer()

      proc.exec(
        'cp /var/task/ffmpeg /tmp/.; chmod 755 /tmp/ffmpeg; cp /var/task/bash-scrap /tmp/.; chmod 755 /tmp/bash-scrap',
        function (error, stdout, stderr) {
          if (error) {
            console.log('error setting up bins');
            def.reject(error)
          } else {
            console.log("moved, updated binaries");
            def.resolve()
          }
        }
      )

      return def.promise;
    })
  }

  promises.push(function() {
    var def = q.defer()

    console.log('launching bash script');

    var child = proc.spawn(pathToBash);
    child.stdout.on('data', function (data) {
      console.log("stdout:\n"+data);
    });
    child.stderr.on('data', function (data) {
      console.log("stderr:\n"+data);
      def.reject(data);
    });
    child.on('close', function (code) {
      console.log(code);
      def.resolve();

      context.done()
    });

    return def.promise;
  });

  promises.reduce(q.when, q())
    .fail(function(err){
      console.log('promise rejected with err');
      console.log(err);
      context.done(err);
    });
};
