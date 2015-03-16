var gulp = require('gulp');
var gutil = require('gulp-util');
var zip = require('gulp-zip');
var del = require('del');
var install = require('gulp-install');
var runSequence = require('run-sequence');
var AWS = require('aws-sdk');
var fs = require('fs');
var mocha = require('gulp-mocha');
var env = require('gulp-env');

gulp.task('clean', function(cb) {
  del(['./dist', './dist.zip'], cb);
});

gulp.task('js', function() {
  return gulp.src('index.js')
    .pipe(gulp.dest('dist/'));
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

gulp.task('zip', function() {
  return gulp.src(['dist/**/*', '!dist/package.json'])
    .pipe(zip('dist.zip'))
    .pipe(gulp.dest('./'));
});

gulp.task('lambda-zip', function(callback) {
  return runSequence(
    ['clean'],
    ['js', 'copy-binaries', 'package-npm-mods'],
    ['zip'],
    callback
  );
});

gulp.task('zipload', function(callback) {
  return runSequence(
    ['lambda-zip'],
    ['upload'],
    callback
  );
});

gulp.task('upload', function(callback) {
  env({ file: "lambda-config.js" });

  AWS.config.region = process.env.region;
  var lambda = new AWS.Lambda();

  var params = {
    FunctionName: process.env.functionName,
    Handler: process.env.handler,
    Mode: "event",
    Role: process.env.role,
    Runtime: "nodejs",
    Timeout: process.env.timeout
  };

  return fs.readFile('./dist.zip', function(err, data) {
    params['FunctionZip'] = data;
    lambda.uploadFunction(params, function(err, data) {
      if (err) {
        var warning = 'Package upload failed. '
        warning += 'Check your iam:PassRole permissions.'
        gutil.log(warning);
        callback(err)
      }
      callback()
    });
  });
});

gulp.task('watch', function() {
  gulp.watch(
    ['*.js', 'test/*.js'],
    ['mocha']
  );
});

gulp.task('mocha', function() {
  process.env.NODE_ENV = 'testing'
  return gulp.src('test/*.spec.js')
    .pipe(mocha())
});

gulp.task('default', ['mocha', 'watch']);
