var express = require('express')
var app = express()
var port = process.env.PORT || 1337;

app.get('/', function (req, res) {
  res.send('Hello World!');
});
app.get('/test', function (req, res) {
  res.send('Hello!\n');
  res.send(req);
});
app.listen(port, function () {
  console.log('Example app listening on port ' + port);
});
