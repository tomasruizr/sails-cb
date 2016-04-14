var path = require('path');
var chalk = require('chalk');
Object.defineProperty(global, '__stack', {
  get: function(){
    var orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack){ return stack; };
    var err = new Error;
    Error.captureStackTrace(err, arguments.callee);
    var stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  }
});

Object.defineProperty(global, '__line', {
  get: function(){
    return __stack[2].getLineNumber();
  }
});
Object.defineProperty(global, '__file', {
  get: function(){
    return path.basename(__stack[2].getFileName());
  }
});


global.debug = function() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(chalk.blue(__file));
  args.unshift(chalk.blue(__line));
  console.log.apply(this, args);
};