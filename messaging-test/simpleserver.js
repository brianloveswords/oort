var util = require('util');
var net = require('net');
var colors = require('colors');

var SIGNALS = ( 'sigabrt sigalrm sigbus sigchld sigcont sigfpe sighup sigill sigint sigkill '
              + 'sigpipe sigquit sigsegv sigstop sigtstp sigttin sigttou sigusr1 sigusr2 '
              + 'sigpoll sigprof sigsys sigtrap sigurg sigvtalrm sigxcpu sigxfsz')
  .toUpperCase()
  .split(' ');

function debug() {
  var args = [].slice.call(arguments);
  args.unshift('debug'.grey);
  console.log.apply(console, args);
}

function inspect (thing) { return util.inspect(thing, undefined, undefined, true) }
var sprintf = util.format;

var SimpleServer = function () {
  if (!(this instanceof SimpleServer)) return new SimpleServer();
  net.Server.call(this);
  this.routes = { };

  // setup handlers
  this.on('listening', this.beginListening);
  this.on('connection', this.handleConnection);
  
  debug('pid', process.pid.toString().blue);
};
util.inherits(SimpleServer, net.Server);

/** public */
SimpleServer.prototype.command = function (name, callback) {
  debug('adding route', name.magenta);
  this.lastAddedRoute = name;
  this.routes[name] = callback;
  this.signal(name, callback);
  return this;
};

SimpleServer.prototype.alias = function (alias, endpoint) {
  if (util.isArray(alias)) {
    var createAlias = this.alias.bind(this);
    alias.map(function (a) { createAlias(a, endpoint); });
    return this;
  }
  if (!endpoint) endpoint = this.lastAddedRoute;
  debug('adding alias', alias.yellow, '->', endpoint.magenta);
  this.routes[alias] = this.routes[endpoint];
  this.signal(alias, this.routes[endpoint]);
  return this;
};

SimpleServer.prototype.signal = function (signal, callback) {
  signal = signal.toUpperCase();
  if (!~SIGNALS.indexOf(signal)) return;
  debug('adding signal handler', signal.cyan);
  process.on(signal, function () {
    var res = { send: console.log, write: console.log };
    callback(res);
  });
};

/** private */
SimpleServer.prototype.createRouter = function (client) {
  return function router (command) {
    // normalize
    command = command.toString().toLowerCase().trim();
    var route = this.routes[command];
    debug('recieved command:', command.bold);
    
    if (!route)
      return client.write(sprintf('command `%s` not recognized', command));
    
    route.call(this, client);
  }.bind(this);
};
SimpleServer.prototype.handleConnection = function (client) {
  debug('client connected:', inspect(client));
  client.send = function (o) { client.write(o.toString()) }

  // handle client events
  client.on('end', this.clientDisconnect);
  client.on('data', this.createRouter(client));
};

SimpleServer.prototype.beginListening = function () {
  debug('listening:', inspect(this.address()));
  
  process.on('SIGTERM', function () {
    debug('received', 'SIGTERM'.cyan, 'shutting down.');
    this.close();
  }.bind(this));
};
SimpleServer.prototype.clientDisconnect = function () {
  debug('client disconnecting');
};

module.exports = {
  createServer: function createServer() {
    return new SimpleServer();
  }
}
