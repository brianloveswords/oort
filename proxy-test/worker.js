// load module -> process.argv[2]
// listen on a random port
// broadcast port to parent process

var path = require('path');

var app;
process.on('message', function (m) {
  if (m.command === 'start') {
    return startApp(m);
  }
  if (m.command === 'stop') {
    return stopApp(m);
  }
});

process.on('uncaughtException', function (err) {
  process.send({
    type: 'error',
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      timestamp: Date.now()
    }
  });
  process.exit(1);
});

function startApp(opts) {
  app = require(path.join(__dirname, opts.appName, opts.server));
  app.listen(0, '127.0.0.1');

  app.on('listening', function () {
    process.send({ type: 'started', address: app.address() })
  });

  app.on('close', function () {
    process.exit(0);
  })
}

function stopApp(opts) { app.close() }