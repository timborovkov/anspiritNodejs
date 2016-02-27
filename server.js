var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser')
var mysql = require('mysql');
var request = require('ajax-request');
const crypto = require('crypto');

var db = mysql.createConnection({
  host     : 'eu-cdbr-azure-north-d.cloudapp.net',
  user     : 'b2a32c755154bf',
  password : 'c0b4e78d',
  database : 'anspiritMain'
});

app.use(bodyParser.json());
app.get('/', function(req, res){
  res.send('<h1>Sorry, you don\'t have access here.</h1><br><br><br>Anspirit Company Official Server');
});

//Send task to hub
app.get('/hub', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  var hubId = req.query.hubId;
  var user = req.query.user;
  var secret = req.query.secret;
  var task = req.query.task;
  if(hubId != null && user != null && secret != null && task != null){
    var responseToSend = {hubId: hubId, user: user};
    hubIP(hubId, function(ip){
      request({
          method: "post",
          url: 'http://'+ ip +':8080/hub',
          data: {'user': user, 'secret': secret, 'task': task}
        }, function(err, res, body){
          if(err){
            console.error(err);
          }else{
            console.log("Sent data to hub with anwser: ");
            console.log(body);
          }
       });
     });
     res.send(JSON.stringify(responseToSend));
   }else{
     console.log("Bad req");
     res.send(JSON.stringify({error: true, type: 'bad request'}));
   }
});

//Get secret data for user
app.get('/user/:id', function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  var userId = req.params.id;
  var password = req.query.password;
  password = crypto.createHash('md5').update(password).digest('hex');
  db.connect();
  db.query("SELECT * FROM `users` WHERE `id`="+userId+" AND `password`='"+password+"'", function(err, rows, fields) {
    if (err) throw err;
    if(rows[0] != null){
      res.send(rows[0]);
      console.log('Request from ' + rows[0].fullname);
    }else{
      res.send(JSON.stringify({error:true, type:"no access granted"}));
      console.error("No access for used: " + userId + ", with password: " + password);
    }
  });
  db.end();
});

//Get list of all devices for user
app.get('/devices', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  var user = req.query.user;
  var secret = req.query.secret;
  var device = req.query.task;
  var state = req.query.state;
  if(user != null && secret != null && device != null && state != null){
      db.connect();
      db.query("SELECT * FROM `device_list` WHERE `id`="+device, function(err, rows, fields) {
        if (err) throw err;
        if(rows[0] != null){
          device = rows[0];
          var hub = device.hub;
          hubIP(ip, function(ip){
            console.log(ip);
            request({
                method: "post",
                url: 'http://'+ ip +':8080/deviceSet',
                data: {'user': user, 'secret': secret, 'device': device, 'state': state}
              }, function(err, res, body){
                if(err){
                  console.error(err);
                  res.send(JSON.stringify({error:true, type:"failed to send data to hub"}));
                }else{
                  console.log("Sent state for device with anwser: ");
                  console.log(body);
                  res.send(JSON.stringify({done:true}));
                }
             });
          });
        }else{
          res.send(JSON.stringify({error:true, type:"no device found"}));
        }
      });
      db.end();

     res.send(JSON.stringify(responseToSend));
   }else{
     res.send(JSON.stringify({error: true, type: 'bad request'}));
   }
});

//Setup new QHUB on server and database
app.get('/newHub', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  var ip = getClientAddress(req);
  var secret = req.query.secret;
  var hubName = req.query.hubName;
  var latitude = req.query.latitude;
  var longitude = req.query.longitude;
  db.connect();
  db.query("SELECT * FROM `hub_list` WHERE `ip`=" + ip, function(err, rows, fields) {
    if (err) throw err;
    if(rows.length == 0){
      var query =
      "INSERT INTO `hub_list` (`ip`, `secret`, `HubName`, `latitude`, `longitude`) VALUES ('" + ip + "', '" + secret + "', '" + hubName + "', '" + latitude + "', '" + longitude + "')";
      db.query(query, function(err, rows, fields) {
        if (err) throw err;
        //Done
        res.send(JSON.stringify({done: true}))
      });
    }else{
      //Already exist
      res.send(JSON.stringify({done: false, error: 'hub already exist'}));
    }
  });
  db.end();
});

//Update field for hub in database
app.get('/update/hub/:field', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  var field = req.params.field;
  var value = req.query.value;
  var hub = req.query.hub;
  var user = req.query.hub;
  var password = req.query.password;
  password = crypto.createHash('md5').update(password).digest('hex');

  db.connect();
  db.query("SELECT * FROM `hub_list` WHERE `id`=" + hub, function(err, rows, fields) {
    if (err) throw err;
    if(rows.length != 0){
      //Hub found
      //Get owner of hub
      var owner = rows[0];
      db.query("SELECT * FROM `users` WHERE `id`=" + owner, function(err, userRows, fields) {
        if(rows.length != 0){
          //Owner found
          owner = userRows[0];
          //Validate user
          if(owner == user){
            if(owner['password'] == password){
              //User is correct
              //Update field
              db.query("UPDATE `hub_list` SET `"+ field +"`='" + value + "' WHERE `id`='" + hub + "'", function(err, userRows, fields) {
                //Field updated
              });
            }else{
              //User not valid
              res.send(JSON.stringify({done: false, error: 'user not valid'}));
            }
          }else{
            //Owner is not user
            res.send(JSON.stringify({done: false, error: 'owner is not user'}));
          }
        }else{
          //User not found
          res.send(JSON.stringify({done: false, error: 'user not found'}));
        }
      });
    }else{
      //No hub found
      res.send(JSON.stringify({done: false, error: 'hub not found'}));
    }
  });
  db.end();
});

io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});

http.listen(process.env.PORT || 3000, function(){
  console.log('listening...');
});

//Get hub ip
function hubIP(id, callback){
  db.connect();
  db.query("SELECT * FROM `hub_list` WHERE `id`="+hub, function(err, rows, fields) {
    if (err) throw err;
    hub = rows[0];
    callback(hub.ip);
  });
  db.end();
}
// Get client IP address from request object
function getClientAddress(req) {
  var ip = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
  return ip;
};
