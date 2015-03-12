var expect = require('chai').expect;

var handleS3Event = require('../local_modules/handle-s3-event');

describe('handleS3Event', function() {
  it('should exist', function() {
    expect(handleS3Event).to.exist
  });

  it('should return a function', function() {
    expect(handleS3Event()).to.be.a('Function');
  });

  it('should return a promise', function(done) {
    handleS3Event()().then(function() {
      done()
    }, function() {
      done()
    })
  });

  it('should throw an error if the input event is not as expected', function(done) {
    var event = {}
    var promise = handleS3Event(event)

    promise().then(function() {
      done(new Error('func should have failed in this test'))
    }, function(err) {
      expect(err).to.exist
      done()
    });
  });

  it('should return s3 data for the uploaded object', function(done) {
    var event = require('./test-input')
    var promise = handleS3Event(event)

    promise().then(function(s3Data) {
      if (!s3Data || !s3Data.srcBucket || !s3Data.srcKey) {
        done(new Error("expected Bucket and Key to exist"))
      } else {
        done()
      }
    }, function(err) {
      done(err)
    });
  });

});
