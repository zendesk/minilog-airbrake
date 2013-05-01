var airbrake = require('airbrake');

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
};

MinilogAirbrake.prototype.write = function(str) {
  if (this.errors.length) {
    this.airbrake.notify(this.errors.shift(), this.options.allowDeliveryToFail ? null : function(err) {});
  }
};

MinilogAirbrake.prototype.end = function() {
  while (this.errors.length) {
    this.write();
  }
};

MinilogAirbrake.prototype._isFormatted = true;

MinilogAirbrake.prototype.format = function(name, level, args) {
  if (this.options.errorThreshold > MinilogAirbrake.errorLevels[level]) return false;

  // initiate a backtrace
  Error.stackTraceLimit = this.options.stackTraceLimit || 20;
  var error = new Error;
  error.name = 'Trace';
  Error.captureStackTrace(error, arguments.callee);

  this.errors.push({
    message: args[0],
    type: level,
    component: name,
    params: { data: JSON.stringify(args.slice(1))},
    stack: error.stack,
  });

  return name;
};

module.exports = exports = MinilogAirbrake
