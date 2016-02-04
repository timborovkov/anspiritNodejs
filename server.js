var express = require('express');
var mysql = require('mysql');
var app = express();
var port = process.env.PORT || 1337;

app.get('/', function (req, res) {
  res.send('Hello World!');
});
app.post('/', function(req, res){

});
app.get('/login', function (req, res) {
  var login = require('/api/login.js').run();
  if(login){
    res.send('Done login');
  }else{
    res.send('Failed to login');
  }
});
app.listen(port, function () {
  console.log('Example app listening on port ' + port);
});
