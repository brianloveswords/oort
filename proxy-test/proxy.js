var fs = require('fs');
var simple = require('simpleserver');
var fork = require('child_process').fork;
var util = require('util');
var http = require('http');
var httpProxy = require('http-proxy');
var path = require('path');

var routes = { }

var proxy = httpProxy.createServer(function (req, res, proxy) {
  var host, endpoint, msg;

  host = req.headers['host'].split(':')[0];
  endpoint = routes[host];
  msg = ['         _______                  _______                   _____                _____                     ',
         '        /::\\    \\                /::\\    \\                 /\\    \\              /\\    \\            ',
         '       /::::\\    \\              /::::\\    \\               /::\\    \\            /::\\    \\           ',
         '      /::::::\\    \\            /::::::\\    \\             /::::\\    \\           \\:::\\    \\         ',
         '     /::::::::\\    \\          /::::::::\\    \\           /::::::\\    \\           \\:::\\    \\        ',
         '    /:::/~~\\:::\\    \\        /:::/~~\\:::\\    \\         /:::/\\:::\\    \\           \\:::\\    \\    ',
         '   /:::/    \\:::\\    \\      /:::/    \\:::\\    \\       /:::/__\\:::\\    \\           \\:::\\    \\   ',
         '  /:::/    / \\:::\\    \\    /:::/    / \\:::\\    \\     /::::\\   \\:::\\    \\          /::::\\    \\  ',
         ' /:::/____/   \\:::\\____\\  /:::/____/   \\:::\\____\\   /::::::\\   \\:::\\    \\        /::::::\\    \\ ',
         '|:::|    |     |:::|    ||:::|    |     |:::|    | /:::/\\:::\\   \\:::\\____\\      /:::/\\:::\\    \\    ',
         '|:::|____|     |:::|    ||:::|____|     |:::|    |/:::/  \\:::\\   \\:::|    |    /:::/  \\:::\\____\\     ',
         ' \\:::\\    \\   /:::/    /  \\:::\\    \\   /:::/    / \\::/   |::::\\  /:::|____|   /:::/    \\::/    /  ',
         '  \\:::\\    \\ /:::/    /    \\:::\\    \\ /:::/    /   \\/____|:::::\\/:::/    /   /:::/    / \\/____/   ',
         '   \\:::\\    /:::/    /      \\:::\\    /:::/    /          |:::::::::/    /   /:::/    /                 ',
         '    \\:::\\__/:::/    /        \\:::\\__/:::/    /           |::|\\::::/    /   /:::/    /                 ',
         '     \\::::::::/    /          \\::::::::/    /            |::| \\::/____/    \\::/    /                   ',
         '      \\::::::/    /            \\::::::/    /             |::|  ~|           \\/____/                     ',
         '       \\::::/    /              \\::::/    /              |::|   |                                        ',
         '        \\::/____/                \\::/____/               \\::|   |                                       ',
         '                                                          \\:|   |                                         ',
         '                                                           \\|___|   v0.0.1                    '].join('\n');


  if (!endpoint)
    return res.end(msg);

  proxy.proxyRequest(req, res, {
    port: endpoint.port,
    host: endpoint.host
  });

}).listen(9999);


// keep a reference to all applications
var apps = { };

function getConfig(appDir, callback) {
  var config, pathToConfig;
  pathToConfig = path.join(__dirname, appDir, '.oort.json');

  // avoid using `require`, we don't want the config to be cached
  fs.readFile(pathToConfig, function (err, rawConfigData) {
    if (err) return callback(err);
    try {
      config = JSON.parse(rawConfigData).app;
      return callback(null, config);

    } catch (ex) {
      console.dir(ex);
      return callback(ex);
    }
  });
}

var app = simple.createServer();

/**
 * Start a server for an app
 *
 * @param {String} appDir the application directory
 */

app.command('start {appName}', startApp);
function startApp(client, appName) {
  getConfig(appName, function (err, config) {
    var worker, message, appEntry, exitCode, lastErrorTime;

    if (err)
      return client.send('some sort of error reading config for', appName.bold);

    if (apps[appName]) {
      appEntry = apps[appName];
      exitCode = appEntry.worker.exitCode;

      // if the exit code isn't a number, it's still running.
      if (exitCode === null)
        return client.send(appName.bold + 'is already started');

      // the server is trying to recover from a crash if the exitCode is
      // anything other than 0
      if (exitCode !== 0) {
        lastErrorTime = appEntry.errors[0].timestamp;

        // if the last error is within 200ms of the lastStarted date, it's a
        // faulty server. Don't try to restart it.
        if ((lastErrorTime - appEntry.lastStart) < 200)
          return client.send(appName.bold, 'crashed immediately, not trying to restart'.red);
      }
    }

    // set up the message
    message = config;
    message.appName = appName;
    message.command = 'start';

    // fork a new worker
    worker = fork(__dirname + '/worker.js');

    // save an entry for the app
    appEntry = apps[appName] = (apps[appName] || { })
    appEntry.worker = worker;
    appEntry.config = config;
    appEntry.errors = appEntry.errors || [];
    appEntry.lastStart = Date.now();

    // send the command to start the server
    worker.send(message);

    // store new entry in routing table when we get the response
    // containing what port the server started on
    worker.on('message', function (m) {
      if (m.type === 'started') {
        routes[config.host] = { port: m.address.port, host: config.host }
        return client.send('route for', config.host.bold, 'is set up on port', (m.address.port).toString().cyan);
      }

      // the british are coming! this happens right before a crash
      if (m.type === 'error') {
        return appEntry.errors.unshift(m.error);
      }
    });

    worker.once('exit', function (code) {
      // remove all listeners, this one's dead johnny
      worker.removeAllListeners();

      // remove routing table entry if the worker is dead.
      routes[config.host] = null;

      // if it's clean, just report that the worker is gone
      if (code === 0)
        return client.send('worker for', appName.bold, 'died expectedly');

      // restart if the configuration says that we should be restarting.
      if (config.restart) {
        client.send('worker for', appName.bold, 'died unexpectedly, restarting');
        return startApp(client, appName);
      }

      // otherwise let it die
      else {
        return client.send('worker for', appName.bold, 'died unexpectedly');
      }
    });

  });
}

/**
 * Stop a server.
 *
 * Will wait for a while to let connections finish unless `now` is passed.
 *
 * @param {String} appName the application directory
 * @param {Integer|String} when
 */

app.command('stop {appName}', stopApp);
function stopApp(client, appName, when) {
  var worker = apps[appName];

  if (!worker)
    return client.send(appName.bold, 'is not running');

  // stop routing immediately
  client.send('shutting down route for', appName.bold, 'to', worker.config.host);
  routes[worker.config.host] = null;

  // remove from app list
  apps[appName] = null;
  worker.worker.send({command: 'stop'})
}

/**
 * Show errors for a particular application.
 *
 * @param {String} appName the application directory
 */

app.command('show {appName} errors', showAppErrors);
function showAppErrors(client, appName) {
  var entry = apps[appName];
  if (!entry)
    return client.send(appName.bold, 'has never been started');
  client.send(entry.errors);
}


/**
 * Restart an app.
 *
 * @param {String} appName the application directory
 */

app.command('restart {appName}', restartApp)
function restartApp(client, appName) {
  stopApp(client, appName);
  startApp(client, appName);
}

app.startRepl();