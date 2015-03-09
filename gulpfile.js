var gulp = require('gulp');
var zip = require('gulp-zip');

gulp.task('zip', function() {
  console.log('zippy');
});

gulp.task('default', ['zip']);
