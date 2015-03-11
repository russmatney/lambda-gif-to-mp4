var index = require('./index');

var sampleEvent = require('./fixtures/sample-input');
var context = {
  done: function() {
    console.log('context.done() called');
  }
}

index.handler(sampleEvent, context);
