var app = require('express')();
var http = require('http').Server(app);

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});
app.get('/login', function(req, res){
  res.send('<h1>Login</h1>');
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
