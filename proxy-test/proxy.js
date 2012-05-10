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
         '                                                           \\|___|   v0.0.1                      '].join('\n');


  if (!endpoint)
    return res.end(msg);

  proxy.proxyRequest(req, res, {
    port: endpoint.port,
    host: endpoint.host
  });

}).listen(9999);



var workers = { };
function getConfig(appDir, callback) {
  var config;
  // avoid using `require`, we don't want the config to be cached
  try {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, appDir, '.oort.json')));
    return callback(null, config);
  } catch (ex) {
    return callback(ex);
  }
}

var app = simple.createServer();

/**
 * Start a server for an app
 *
 * @param {String} appDir the application directory
 */

app.command('start {appDir}', function startApp(client, appDir) {
  if (workers[appDir]) {
    return client.send(appDir.bold + ' is already started');
  }

  getConfig(appDir, function (err, config) {
    var worker, message;

    if (err)
      return client.send('some sort of error reading config for', appDir.bold);

    // set up the message
    message = config;
    message.appDir = appDir;
    message.command = 'start';

    // fork a new worker
    worker = fork(__dirname + '/worker.js');

    // save it so we can reference it later
    workers[appDir] = {
      worker: worker,
      config: config
    }

    // send the command to start the server
    worker.send(message);

    // store new entry in routing table when we get the response
    // containing what port the server started on
    worker.once('message', function (m) {
      routes[config.host] = {
        port: m.port,
        host: config.host
      }
      client.send('route for', config.host.bold, 'is set up', m);
    });

    worker.once('exit', function (code) {
      // remove worker entry & routing table entry if the worker is dead.
      workers[appDir] = null;
      routes[config.host] = null;

      // if it's clean, just report that the worker is gone
      if (code === 0)
        return client.send('worker for', appDir.bold, 'died expectedly');

      // restart if the configuration says that we should be restarting.
      if (config.restart) {
        client.send('worker for', appDir.bold, 'died unexpectedly, restarting');
        startApp(client, appDir);
      }
    });

  });
});

/**
 * Stop a server.
 *
 * Will wait for a while to let connections finish unless `now` is passed.
 *
 * @param {String} appDir the application directory
 * @param {Integer|String} when
 */

app.command('stop {appDir}', function (client, appDir, when) {
  var worker = workers[appDir];

  if (!worker)
    return client.send(appDir.bold, 'is not running');

  // stop routing immediately
  client.send('shutting down route for', appDir.bold, 'to', worker.config.host);
  routes[worker.config.host] = null;

  // remove from app list
  workers[appDir] = null;

  worker.worker.send({command: 'stop'})

});
app.startRepl();
