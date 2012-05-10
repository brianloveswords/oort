var http = require('http');
var app = http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('localbloke!\n');
  res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();

  setTimeout(function () {
    throw new Error('lol');
  }, 1000)
})
module.exports = app;

