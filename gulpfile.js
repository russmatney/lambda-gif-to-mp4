var gulp = require('gulp');
var gutil = require('gulp-util');
var zip = require('gulp-zip');
var del = require('del');
var install = require('gulp-install');
var runSequence = require('run-sequence');
var AWS = require('aws-sdk');
var fs = require('fs');
var mocha = require('gulp-mocha');

gulp.task('clean', function(cb) {
  del(['./dist', './dist.zip'], cb);
});

gulp.task('js', function() {
  return gulp.src('index.js')
    .pipe(gulp.dest('dist/'));
});

gulp.task('local-modules', function() {
  return gulp.src(['local_modules/*.js'])
    .pipe(gulp.dest('dist/node_modules/'));
});

gulp.task('copy-binaries', function() {
  return gulp.src('./bin/*')
    .pipe(gulp.dest('dist/'));
});

gulp.task('package-npm-mods', function() {
  return gulp.src('./package.json')
    .pipe(gulp.dest('dist/'))
    .pipe(install({production: true}));
});

gulp.task('zip-it-up', function() {
  return gulp.src(['dist/**/*', '!dist/package.json'])
    .pipe(zip('dist.zip'))
    .pipe(gulp.dest('./'));
});

gulp.task('zip', function(callback) {
  return runSequence(
    ['clean'],
    ['js', 'copy-binaries', 'package-npm-mods', 'local-modules'],
    ['zip-it-up'],
    callback
  );
});

gulp.task('zip-and-upload', function(callback) {
  return runSequence(
    ['clean'],
    ['js', 'copy-binaries', 'package-npm-mods', 'local-modules'],
    ['zip-it-up'],
    ['upload'],
    callback
  );
});


var config = {
  region: 'us-east-1',
  handler: 'index.handler',
  role: 'arn:aws:iam::106586740595:role/executionrole',
  functionName: 'gif-to-mp4-russbosco3',
  timeout: 45
}

//this func exits earlier than its process
gulp.task('upload-new', function() {

  AWS.config.region = config.region;
  var lambda = new AWS.Lambda();

  var params = {
    FunctionName: config.functionName,
    Handler: config.handler,
    Mode: "event",
    Role: config.role,
    Runtime: "nodejs",
    Timeout: config.timeout
  };

  fs.readFile('./dist.zip', function(err, data) {
    params['FunctionZip'] = data;
    lambda.uploadFunction(params, function(err, data) {
      if (err) {
        var warning = 'Package upload failed. '
        warning += 'Check your iam:PassRole permissions.'
        gutil.log(warning);
      }
    });
  });
});

//this func exits earlier than its process
gulp.task('upload', function() {

  //TODO: pull from gulp-env
  AWS.config.region = config.region;
  var functionName = config.functionName;
  var lambda = new AWS.Lambda();

  lambda.getFunction({FunctionName: functionName}, function(err, data) {
    if (err) {
      if (err.statusCode === 404) {
        var warning = 'Unable to find lambda function ' + functionName + '. '
        warning += 'Verify the lambda function name and AWS region are correct.'
        gutil.log(warning);
      } else {
        var warning = 'AWS API request failed. '
        warning += 'Check your AWS credentials and permissions.'
        gutil.log(warning);
      }
    }

    var current = data.Configuration;
    var params = {
      FunctionName: functionName,
      Handler: current.Handler,
      Mode: current.Mode,
      Role: current.Role,
      Runtime: current.Runtime,
      Timeout: config.timeout
    };

    fs.readFile('./dist.zip', function(err, data) {
      params['FunctionZip'] = data;
      lambda.uploadFunction(params, function(err, data) {
        if (err) {
          var warning = 'Package upload failed. '
          warning += 'Check your iam:PassRole permissions.'
          gutil.log(warning);
        }
      });
    });
  });
});

gulp.task('watch', function() {
  gulp.watch(
    ['*.js', 'test/*.js', 'fixtures/*.js'],
    ['mocha']
  );
});

gulp.task('mocha', function() {
  process.env.NODE_ENV = 'testing'
  return gulp.src('test/*.spec.js')
    .pipe(mocha())
});

gulp.task('default', ['mocha', 'watch']);
