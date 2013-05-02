# Airbrake for [Minilog](https://github.com/mixu/minilog/)

A consumer of Minilog events that sends event data of a minimum threshold to Airbrake.

Other options include:
  - enable/disable global uncaught exception handling (defaults to
enabled)
  - set the minimum threshold of Minilog events that will be sent to
Airbrake
  - adjust the stack trace length
  - allow Airbrake notification errors to be thrown and potentially halt
current process

## Example

    require('minilog').pipe(require('minilog-airbrake')({ api_key: 'xxxxxx' })); 
