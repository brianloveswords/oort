var http = require('http');
var root = process.argv[2];
var connect = require('connect');

var app = connect()
  .use(connect.favicon())
  .use(connect.logger('dev'))
  .use(connect.static(process.cwd()))
  .use(connect.directory(process.cwd()))
  .use(function (request, response, next) {
    console.log('well fuck');
    next();
  });

console.log('starting a shitty static server on port 3000');
http.createServer(app).listen(3000);

