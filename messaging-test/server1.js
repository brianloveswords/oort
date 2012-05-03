var simple = require('./simpleserver.js');

var app = simple.createServer();

app.command('pi', function (client) {
  client.send(Math.PI);
});

app.command('broccoli', function (client) {
  client.send('is delicious!');
});

app.command('ham', function (client) {
  client.send('is gross');
}).alias('pig')
  .alias('pork');

app.command('bye', function (client) {
  client.send('later gator');
  client.destroy();
}).alias(['later', 'see-ya', 'peace']);



app.listen(process.argv[2] || 0);