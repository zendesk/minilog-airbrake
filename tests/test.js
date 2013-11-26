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
    it('should notify Airbrake when there is a formatted error', function() {
      spyOn(instance.airbrake, 'notify', function(error, fn) {
        expect(error).to.deep.equal({ message: 'Hello' });
        expect(fn).to.be.a('function');
      });
      instance.errors.push({ message: 'Hello' });
      instance.write();
      expect(instance.airbrake.notify).to.have.been.called.once;
    });

    it('should notify Airbrake when there is an error object', function() {
      spyOn(instance.airbrake, 'notify', function(error, fn) {
        expect(error instanceof Error).to.be.true;
        expect(error.message).to.equal('bad bad error');
        expect(fn).to.be.a('function');
      });
      instance.errors.push(new Error('bad bad error'));
      instance.write();
      expect(instance.airbrake.notify).to.have.been.called.once;
    });

    it('should not notify Airbrake when there is not a formatted error', function() {
      spyOn(instance.airbrake, 'notify', function(){});
      instance.errors = [];
      instance.write();
      expect(instance.airbrake.notify).not.to.have.been.called.once;
    });

    it('should not pass a callback function when the allowDeliveryToFail option is true', function() {
      spyOn(instance.airbrake, 'notify', function(error, fn) {
        expect(error).to.deep.equal({ message: 'Hello' });
        expect(fn).not.to.be.a('function');
      });
      instance.options.allowDeliveryToFail = true;
      instance.errors.push({ message: 'Hello' });
      instance.write();
      expect(instance.airbrake.notify).to.have.been.called.once;
    });
  });

  describe('#end', function() {
    it('should call #write while there are errors that have not been sent to Airbrake', function() {
      var called = 0;
      spyOn(instance, 'write', function() {
        expect(instance.errors.length).to.be.greaterThan(0);
        called++;
        instance.errors.shift();
      });
      instance.errors = [ { message: 'First' }, { message: 'Second' }, { message: 'Third' } ];
      instance.end();
      expect(called).to.equal(3);
    });
  });

  describe('#format', function() {
    it('should return false if the level argument is lower than the errorThreshold', function() {
      instance.options.errorThreshold = MinilogAirbrake.errorLevels.warn;
      expect(instance.format('name', 'info', [ 'message', { data: 1 } ])).to.be.false;
      expect(instance.errors.length).to.equal(0);
    });

    it('should return the name if the level argument is greater than the errorThreshold', function() {
      instance.options.errorThreshold = MinilogAirbrake.errorLevels.warn;
      expect(instance.format('name', 'error', [ 'message', { data: 1 } ])).to.equal('name');
      expect(instance.errors.length).to.equal(1);
    });

    it('should return the name if the level argument is equal to the errorThreshold', function() {
      instance.options.errorThreshold = MinilogAirbrake.errorLevels.warn;
      expect(instance.format('name', 'warn', [ 'message', { data: 1 } ])).to.equal('name');
      expect(instance.errors.length).to.equal(1);
    });

    it('should add an object to the errors list with the appropriate properties', function() {
      instance.options.errorThreshold = MinilogAirbrake.errorLevels.warn;
      expect(instance.format('name', 'warn', [ 'message', { data: new Buffer('test') } ])).to.equal('name');
      expect(instance.errors.length).to.equal(1);
      expect(instance.errors[0]).to.have.property('message', 'message');
      expect(instance.errors[0]).to.have.property('type', 'warn');
      expect(instance.errors[0]).to.have.property('component', 'name');
      expect(instance.errors[0]).to.have.property('params').to.have.property('data', '[{"data":"test"}]');
      expect(instance.errors[0]).to.have.property('stack');
    });

    it('should add an object to the errors list with the appropriate properties', function() {
      instance.options.errorThreshold = MinilogAirbrake.errorLevels.warn;

      expect(instance.format('name', 'warn', [ 'message', new Error('foo') ])).to.equal('name');
      expect(instance.errors.length).to.equal(1);
      expect(instance.errors[0]).to.have.property('message', 'message');
      expect(instance.errors[0]).to.have.property('type', 'warn');
      expect(instance.errors[0]).to.have.property('component', 'name');
      expect(instance.errors[0]).to.have.property('params').to.have.property('data', '["foo"]');
      expect(instance.errors[0]).to.have.property('stack');
    });
  });
});
