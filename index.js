console.log("loading event");

exports.handler = function(event, context) {
  console.log("Hello, Lambda logs");
  console.log("Hello, Lambda logs");

  context.done(null, "Context done, son");
}
