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
var handleS3Event;

if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
  //production
  tmpPrefix = '/tmp/';
  pathToBash = '/tmp/bash-scrap';
  handleS3Event = require('handle-s3-event');
} else {
  //local
  tmpPrefix = './';
  pathToBash = './bin/bash-scrap';
  handleS3Event = require('./local_modules/handle-s3-event');
}

var s3 = new AWS.S3();

exports.handler = function(event, context) {
  process.env['FFMPEG_PATH'] = '/tmp/ffmpeg';
  process.env['FFPROBE_PATH'] = '/tmp/ffprobe';

  var promises = [];

  if (!process.env.NODE_ENV || process.env.NODE_ENV != 'testing') {
    promises.push(q.Promise(function(resolve, reject, notify) {

      proc.exec(
        'cp /var/task/ffmpeg /tmp/.; chmod 755 /tmp/ffmpeg; cp /var/task/bash-scrap /tmp/.; chmod 755 /tmp/bash-scrap',
        function (error, stdout, stderr) {
          if (error) {
            console.log('error setting up bins');
            reject(error)
          } else {
            console.log("moved, updated binaries");
            resolve()
          }
        }
      )

    }))
  }

  promises.push(handleS3Event(event))
  promises.push(function(options) {
    return q.Promise(function(resolve, reject) {
      console.log('fetching from s3')
      console.log(options);
      resolve(options);

    })
  });

  promises.push(function(options) {
    return q.Promise(function(resolve, reject) {
      console.log('launching whatever script');

      var child = proc.spawn(pathToBash);
      child.stdout.on('data', function (data) {
        console.log("stdout:\n" + data);
      });
      child.stderr.on('data', function (data) {
        console.log("stderr:\n" + data);
        reject(data);
      });
      child.on('close', function (code) {
        console.log(code);
        resolve();
        context.done()
      });
    });
  });

  promises.reduce(q.when, q())
    .fail(function(err){
      console.log('promise rejected with err');
      console.log(err);
      context.done(err);
    });
};
