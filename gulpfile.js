var gulp = require('gulp');
var zip = require('gulp-zip');
var del = require('del');
var install = require('gulp-install');
var runSequence = require('run-sequence');

gulp.task('clean', function(cb) {
  del('./dist',
    del('./archive.zip', cb)
  );
});

gulp.task('js', function() {
  gulp.src('index.js')
    .pipe(gulp.dest('dist/'));
});

gulp.task('package-npm-mods', function() {
  gulp.src('./package.json')
    .pipe(gulp.dest('./dist/'))
    .pipe(install({production: true}));
});

gulp.task('zip-it-up', function() {
  gulp.src(['dist/**/*', '!dist/package.json'])
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


gulp.task('default', function() {
  console.log('sup, default task');
});
