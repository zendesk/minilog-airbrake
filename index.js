var airbrake = require('airbrake');
var Transform  = require('minilog').Transform;

require('buffer').Buffer.prototype.toJSON = function() {
  return this.toString();
};

/*
 * Possible options:
 *    *api_key: your airbrake API key
 *    api_env: the airbrake logging environment
 *    errorThreshold: minimum error level for logging, one of the keys or values in MinilogAirbrake.errorLevels, defaults to error
 *    allowDeliveryToFail: boolean that allows errors from airbrake to be thrown, potentially causing the process to exit
 *    handleExceptions: set to false if you do not want
 *    stackTraceLimit: the number of lines to show in a stackTrace
 */
function MinilogAirbrake(options) {
  if (!(this instanceof MinilogAirbrake)) return new MinilogAirbrake(options);
  this.setup(options);
  return this;
}

Transform.mixin(MinilogAirbrake);

MinilogAirbrake.errorLevels = { debug: 1, info: 2, warn: 3, error: 4 };

MinilogAirbrake.prototype.setup = function(options) {
  this.options = options || {};
  this.errors = [];

  if (options.errorThreshold) {
    if (options.errorThreshold in MinilogAirbrake.errorLevels) {
      this.options.errorThreshold = MinilogAirbrake.errorLevels[options.errorThreshold];
    } else {
      this.options.errorThreshold = options.errorThreshold;
    }
  }

  this.options.errorThreshold = this.options.errorThreshold || MinilogAirbrake.errorLevels.error;

  if (!this.options.api_key) {
    throw new Error("MinilogAirbrake requires an api_key for Airbrake");
  }

  this.airbrake = airbrake.createClient(this.options.api_key, this.options.api_env);

  if (this.options.handleExceptions !== false) {
    this.airbrake.handleExceptions();
  }

  // initiate a backtrace
  if(this.options.stackTraceLimit) {
    Error.stackTraceLimit = this.options.stackTraceLimit;
  }
};

MinilogAirbrake.prototype.write = function(name, level, args) {
  if (this.options.errorThreshold > MinilogAirbrake.errorLevels[level]) {
    this.emit(name, level, args); //pass-through
    return;
  }

  var error, notification;
  for(var i = 0 ; i < args.length ; i++) {
    if(args[i] instanceof Error) {
      error = args.splice(i, 1, args[i].message)[0];
      break;
    }
  }

  if(error) {

    notification = {
      message: args[0],
      type: level,
      component: name,
      params: { data: JSON.stringify(args.slice(1)) },
      stack: error.stack,
    };

  } else {

    error = new Error();
    error.name = 'Trace';
    Error.captureStackTrace(error, arguments.callee);

    notification = {
      message: args[0],
      type: level,
      component: name,
      params: { data: JSON.stringify(args.slice(1)) },
      stack: error.stack,
    };
  }

  if (notification) {
    this.airbrake.notify(notification, this.options.allowDeliveryToFail ? null : function(err) {});
  }

  this.emit(name, level, args);
};

module.exports = exports = MinilogAirbrake;
