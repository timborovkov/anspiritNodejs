var express = require('express')
var app = express()
var port = process.env.PORT || 1337;

app.use('/static.html', express.static('public'));

app.get('/', function (req, res) {
  res.send('Hello World!');
});
app.post('/', function(req, res)){

}
app.get('/login', function (req, res) {
  res.send('Hello!\n');
  res.send(req);
});
app.listen(port, function () {
  console.log('Example app listening on port ' + port);
});
