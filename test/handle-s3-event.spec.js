var expect = require('chai').expect;

var handleS3Event = require('../handle-s3-event');

describe('handleS3Event', function() {
  it('should exist', function() {
    expect(handleS3Event).to.exist
  });

  it('should return a function', function() {
    expect(handleS3Event()).to.be.a('Function');
  });

});
