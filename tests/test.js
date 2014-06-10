var MinilogAirbrake = require('../index.js'),
    Airbrake = require('airbrake'),
    Buffer = require('buffer').Buffer,
    chai = require('chai'),
    spies = require('chai-spies'),
    expect = chai.expect,
    spyOn = function(object, method, preventCallThrough) {
      var fn = preventCallThrough || object[method],
          spy = chai.spy(fn);
      spy.__spy.original = object[method];
      object[method] = spy;
      spy.restore = function() {
        object[method] = spy.__spy.original;
      };

      return spy;
    };

chai.use(spies);

describe('MinilogAirbrake', function() {
  var instance;

  beforeEach(function() {
    instance = MinilogAirbrake({ api_key: 'test', handleExceptions: false });
  });

  describe('#setup', function() {
    it('should throw an error if there is no api_key', function() {
      expect(function() { instance.setup({ api_key: '' }); }).to.throw("MinilogAirbrake requires an api_key for Airbrake");
    });

    it('should create an Airbrake client', function() {
      var spy = spyOn(Airbrake, 'createClient');
      instance.setup({ api_key: 'test' });
      expect(Airbrake.createClient).to.have.been.called.once;
      expect(Airbrake.createClient).to.have.been.called.with('test');
      spy.restore();
    });

    it('should not handleExceptions if the option is set to false', function() {
      var spy = spyOn(Airbrake.prototype, 'handleExceptions');
      instance.setup({ api_key: 'test', handleExceptions: false });
      expect(instance.airbrake.handleExceptions).not.to.have.been.called.once;
      spy.restore();
    });

    it('should handleExceptions if the option is not set to false', function() {
      var spy = spyOn(Airbrake.prototype, 'handleExceptions');
      instance.setup({ api_key: 'test' });
      expect(instance.airbrake.handleExceptions).to.have.been.called.once;
      spy.restore();
    });
  });

  describe('#write', function() {
    it('should notify Airbrake when there is a unformatted error', function() {
      var spy = spyOn(instance.airbrake, 'notify', function(error, fn) {
        expect(error.message).to.deep.equal('Hello');
        expect(fn).to.be.a('function');
      });
      instance.write('name','error', ['Hello']);
      expect(instance.airbrake.notify).to.have.been.called.once;
      spy.restore();
    });

    it('should notify Airbrake when there is an error object', function() {
      var spy = spyOn(instance.airbrake, 'notify', function(error, fn) {
        expect(error.message).to.equal('bad bad error');
        expect(fn).to.be.a('function');
      });
      instance.write('name', 'error',[ new Error('bad bad error') ]);
      expect(instance.airbrake.notify).to.have.been.called.once;
      spy.restore();
    });

    it('should not pass a callback function when the allowDeliveryToFail option is true', function() {
      var spy = spyOn(instance.airbrake, 'notify', function(error, fn) {
        expect(error.message).to.deep.equal('Hello');
        expect(fn).not.to.be.a('function');
      });
      instance.options.allowDeliveryToFail = true;
      instance.write('name','error', ['Hello']);
      expect(instance.airbrake.notify).to.have.been.called.once;
      spy.restore();
    });

    it('should return without notifying if the level argument is lower than the errorThreshold', function() {
      var spy = spyOn(instance.airbrake, 'notify');
      instance.options.errorThreshold = MinilogAirbrake.errorLevels.warn;
      instance.write('name', 'info', [ 'message', { data: 1 } ]);
      expect(instance.airbrake.notify).not.to.have.been.called.once;
      spy.restore();
    });

    it('should notify if the level argument is greater than the errorThreshold', function() {
      var spy = spyOn(instance.airbrake, 'notify');
      instance.options.errorThreshold = MinilogAirbrake.errorLevels.warn;
      instance.write('name', 'error', [ 'message', { data: 1 } ]);
      expect(instance.airbrake.notify).to.have.been.called.once;
      spy.restore();
    });

    it('should notify if the level argument is equal to the errorThreshold', function() {
      var spy = spyOn(instance.airbrake, 'notify');
      instance.options.errorThreshold = MinilogAirbrake.errorLevels.warn;
      instance.write('name', 'warn', [ 'message', { data: 1 } ]);
      expect(instance.airbrake.notify).to.have.been.called.once;
      spy.restore();
    });

    it('should notify with the appropriate info', function() {
      instance.options.errorThreshold = MinilogAirbrake.errorLevels.warn;
      var data = new Buffer('test');
      var spy = spyOn(instance.airbrake, 'notify', function(error, fn) {
        expect(error.message).to.equal('message');
        expect(error.type).to.equal('warn');
        expect(error.component).to.equal('name');
        expect(error.params).to.have.property('data', JSON.stringify([data]));
        expect(error).to.have.property('stack');
        expect(fn).to.be.a('function');
      });
      instance.write('name', 'warn', [ 'message', data ]);
      spy.restore();
    });

    it('should add an object to the errors list with the appropriate properties', function() {
      instance.options.errorThreshold = MinilogAirbrake.errorLevels.warn;
      var spy = spyOn(instance.airbrake, 'notify', function(error, fn) {
        expect(error.message).to.equal('message');
        expect(error.type).to.equal('warn');
        expect(error.component).to.equal('name');
        expect(error).to.have.property('params').to.have.property('data', '["foo"]');
        expect(error).to.have.property('stack');
        expect(fn).to.be.a('function');
      });

      instance.write('name', 'warn', [ 'message', new Error('foo') ]);
      spy.restore();
    });
  });
});
