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

function startApp(opts) {
  app = require(path.join(__dirname, opts.appDir, opts.server));
  app.listen(0, '127.0.0.1');

  app.on('listening', function () {
    process.send(app.address())
  });

  app.on('close', function () {
    process.exit(0);
  })
}

function stopApp(opts) { app.close() }