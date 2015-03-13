var expect = require('chai').expect;

var validateKey = require('../local_modules/validate-key');

describe.only('validateKey', function() {
  it('should exist', function() {
    expect(validateKey).to.exist;
  });

  it('should behave like a promise', function() {
    expect(validateKey().then).to.be.a('Function');
    expect(validateKey().fail).to.be.a('Function');
  });

  it('should throw and error if there are no options passed', function(done) {
    //no options passed
    validateKey()
      .then(function() {
        done(new Error('func should have failed - bad info passed'))
      }, function() {
        done();
      });
  });

  it('should throw and error if there is no srcKey passed', function(done) {
    var options = {}
    validateKey(options)
      .then(function() {
        done(new Error('func should have failed - bad info passed'))
      }, function() {
        done();
      });
  })

});
