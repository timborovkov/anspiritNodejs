var express = require('express');
var app = express();
var port = process.env.PORT || 1337;

app.get('/', function (req, res) {
  res.send('Hello World!');
});
/*
app.get('/login', function (req, res) {
  var login = require('/api/login.js').run();
  if(login){
    res.send('Done login');
  }else{
    res.send('Failed to login');
  }
});
*/
app.listen(port, function () {
  console.log('Example app listening on port ' + port);
});

//database
var mysql = require('mysql');
var db = mysql.createConnection({
  host     : 'eu-cdbr-azure-north-d.cloudapp.net',
  user     : 'b2a32c755154bf',
  password : 'c0b4e78d',
  database : 'anspiritMain'
});
db.connect();
