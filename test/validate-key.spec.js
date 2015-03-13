var expect = require('chai').expect;

var validateKey = require('../local_modules/validate-key');

describe('validateKey', function() {
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

  it('should throw an error for non- "events/" keys', function(done) {
    var options = {
      srcKey: "jeff-goldblum.gif"
    }

    validateKey(options)
      .then(function() {
        done(new Error("validateKey should have rejected this key: " + options.srcKey))
      }, function() {
        done()
      })
  })

  it('should throw an error for non .gifs', function(done) {
    var options = {
      srcKey: "events/jeff-goldblum.mp4"
    }

    validateKey(options)
      .then(function() {
        done(new Error("validateKey should have errored on an .mp4"))
      }, function() {
        done()
      })

  })

  it('should throw an error for _*.gif files', function(done) {
    var options = {
      srcKey: "events/jeff-goldblum_180.gif"
    }

    validateKey(options)
      .then(function() {
        done(new Error("validateKey should have errored on an _180.gif"))
      }, function() {
        done()
      })
  });

  it('should return the options object with solid keys', function(done) {
    var options = {
      srcKey: "events/jeff-goldblum.gif"
    }
    validateKey(options)
      .then(function(resolved) {
        if (!resolved || resolved !== options) {
          done(new Error('ValidateKey should resolve options as handed in'))
        } else {
          done()
        }
      }, function() {
        done(new Error("ValidateKey should have allowed this key: " + options.srcKey));
      });
  });

});
