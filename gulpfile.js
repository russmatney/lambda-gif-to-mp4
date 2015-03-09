var gulp = require('gulp');
var gutil = require('gulp-util');
var zip = require('gulp-zip');
var del = require('del');
var install = require('gulp-install');
var runSequence = require('run-sequence');
var AWS = require('aws-sdk');
var fs = require('fs');

gulp.task('clean', function(cb) {
  del(['./dist', './dist.zip'], cb);
});

gulp.task('js', function() {
  return gulp.src('index.js')
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
    ['js', 'package-npm-mods'],
    ['zip-it-up'],
    callback
  );
});

gulp.task('upload', function() {

  //TODO: pull from gulp-env
  AWS.config.region = 'us-east-1';
  var lambda = new AWS.Lambda();
  var functionName = 'resizeImage';

  lambda.getFunction({FunctionName: functionName}, function(err, data) {
    if (err) {
      if (err.statusCode === 404) {
        var warning = 'Unable to find lambda function ' + deploy_function + '. '
        warning += 'Verify the lambda function name and AWS region are correct.'
        gutil.log(warning);
      } else {
        var warning = 'AWS API request failed. '
        warning += 'Check your AWS credentials and permissions.'
        gutil.log(warning);
      }
    }

    var current = data.Configuration;
    //TODO: pull from config/gulp-env
    var params = {
      FunctionName: functionName,
      Handler: current.Handler,
      Mode: current.Mode,
      Role: current.Role,
      Runtime: current.Runtime
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

gulp.task('default', function() {
  console.log('sup, default task');
});
