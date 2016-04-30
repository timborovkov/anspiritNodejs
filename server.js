var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser')
var mysql = require('mysql');
var request = require('ajax-request');
const crypto = require('crypto');

var port = process.env.PORT || 3000;

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

//Get secret data for user
app.get('/user/:id', function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  var userId = req.params.id;
  var password = req.query.password;
  password = crypto.createHash('md5').update(password).digest('hex');
  db.connect();
  db.query("SELECT * FROM `users` WHERE `id`="+userId+" AND `password`='"+password+"'", function(err, rows, fields) {
    if (err) throw err;
    if(rows[0] !== null){
      res.send(rows[0]);
      console.log('Request from ' + rows[0].fullname);
    }else{
      res.send(JSON.stringify({error:true, type:"no access granted"}));
      console.error("No access for used: " + userId + ", with password: " + password);
    }
  });
});

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

     res.send(JSON.stringify(responseToSend));
   }else{
     res.send(JSON.stringify({error: true, type: 'bad request'}));
   }
});

app.get('/hubDevices', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  var user = req.query.user;
  var secret = req.query.secret;
  var hubId = req.query.hub;

  //TODO security check
  //Validate if user id and secret are valid
  //Validate if hub is owned by the user

  if(user != null && secret != null && hubId != null){
      db.connect();
      db.query("SELECT * FROM `device_list` WHERE `hub`="+hubId, function(err, rows, fields) {
        if (err) throw err;
        if(rows != null){
          res.send(JSON.stringify({error:false, type:"done", request: req.query, devices: rows}));
        }else{
          res.send(JSON.stringify({error:true, type:"no hub found"}));
        }
      });

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
  if(secret == null || hubName == null || latitude == null || longitude == null){
    //No input from user
    res.send(JSON.stringify({done: false, error: 'no input data from user'}));
  }else{
    db.connect();
    db.query("SELECT * FROM `hub_list` WHERE `ip`='" + ip + "'", function(err, rows, fields) {
      if (err) throw err;
      console.log(rows);
      if(rows.length === 0){
        var query =
        "INSERT INTO `hub_list` (`ip`, `secret`, `name`, `latitude`, `longitude`) VALUES ('" + ip + "', " + secret + ", '" + hubName + "', " + latitude + ", " + longitude + ")";
        console.log(query);
        db.query(query, function(err, rows, fields) {
          if (err) throw err;
          //Done
          res.send(JSON.stringify({done: true}))
        });
      }else{
        //Already exist
        res.send(JSON.stringify({done: false, error: 'Hub already exist'}));
      }
    });
  }
});

//Setup new QHUB on server and database
app.get('/newDevice', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  var hubSecret = req.query.hubSecret;
  var hubId = req.query.hubId;
  var type = req.query.type;
  var name = req.query.name;
  var connectionType = req.query.connectionType;
  var state = "off";
  if(type != null && hubId != null && connectionType != null && hubSecret != null && name != null){
    db.connect();
    db.query("SELECT * FROM `hub_list` WHERE `id`='" + hubId + "'", function(err, rows, fields) {
      if (err) throw err;
      if(rows[0].secret == hubSecret){
        //Authorized
        //Now insert into database new device
        var query =
        "INSERT INTO `device_list` (`state`, `connectionType`, `name`, `type`, `hubId`) VALUES ('" + state + "', " + connectionType + ", '" + name + "', " + type + ", " + hubId + ")";
        db.query(query, function(err, rows, fields){
          if (err) throw err;
          //Done
          //TODO: Tell hub to connect new device
        });
      }else{
        //Wrong hub data
        res.send(JSON.stringify({done: false, error: 'wrong hub data'}));
      }
    });
  }else{
    //No input data
    res.send(JSON.stringify({done: false, error: 'missing input data'}));
  }
});

// Database:
// TABLE 'hub_tasks'
// COLUMN 'task' = {action, parameters};
// COLUMN 'hub' = INT
// COLUMN 'done' = true/false
app.get('/tasksForHub', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  var hubId = req.query.hub;
  var result = {tasks: {}, status: "done"};
  db.connect();
  db.query("SELECT * FROM `hub_tasks` WHERE `hub`=" + hubId, function(err, rows, fields){
    if(err){
      result.status = "error: " + err;
    }else{
      var taskActions = {};
      var taskIds = {};
      for (var i = 0; i < rows.length; i++) {//TODO
        var row = rows[i];
        if(row.done === false){
          taskActions += row.taskAction;
        }
      }
      result.tasks.taskActions = taskActions;
      result.tasks.taskIds = taskIds;
    }
    res.send(result);
  });
});

//Send task to hub
app.get('/hub', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  var hubId = req.query.hubId;
  var user = req.query.user;
  var secret = req.query.secret;
  var task = req.query.task;
  //TODO
  //Task contains {action: action, parameters: parameters}
  //Task must be converted to standart of Api.ai

  if(hubId != null && user != null && secret != null && task != null){
    var responseToSend = {hubId: hubId, user: user};
    /*
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
    */
      //TODO
      //add new task to database
     res.send(JSON.stringify(responseToSend));
   }else{
     console.log("Bad req");
     res.send(JSON.stringify({error: true, type: 'bad request'}));
   }
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

  //TODO: check for empty fields
  db.connect();
  db.query("SELECT * FROM `hub_list` WHERE `id`=" + hub, function(err, rows, fields) {
    if (err) throw err;
    if(rows != null){
      //Hub found
      //Get owner of hub
      var owner = rows[0].ownerId;
      db.query("SELECT * FROM `users` WHERE `id`=" + owner, function(err, userRows, fields) {
        if(rows != null){
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
});

app.post('deviceType', function(res, res){
  res.setHeader('Content-Type', 'application/json');
  var device = req.body.device;
  db.connect();
  db.query("SELECT * FROM `device_list` WHERE `id`=" + device, function(err, rows, fields){
    if(err) throw err;
    var type = rows[0].type;
    var connectionType = rows[0].connectionType;
    var result = {deviceType: type, connectionType: connectionType};
    res.send(result);
  });
});

//TODO Pair QHub with existing user account, using hub secret token and user login data
app.post('/hub2user', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  //Get requested variables
  var hubToken = req.body.hubToken;
  var userId = req.body.userId;
  var userPass = req.body.password;

  //check if variables are not null
  if(hubToken != null && userId != null && userPass != null){
    //Get md5 hash from password
    userPass = crypto.createHash('md5').update(userPass).digest('hex');
    db.connect();
    //Get user from database
    db.query("SELECT * FROM `users` WHERE `id`=" + userId, function(err, rows, fields){
      if(err){
        //Throw an error
        res.send(JSON.stringify({"erorr": true, "type": "failed to contact DB"}))
      };
      //Check if password is valid
      if(rows[0].password == userPass){
        //Password is correct
        //User valid
        //Now must validate hubToken
        db.query("SELECT * FROM `hub_list` WHERE `secret`=" + hubToken, function(err, rows, fields){
          //Check if hub with hubToken exist
          if(rows[0] != null){
            //Hub exists
            //Update hub ownerId field
            //Set it to user`s id
            db.query("UPDATE `hub_list` SET `ownerId`='" + userId + "' WHERE `id`='" + rows[0].id + "'", function(err, userRows, fields) {
              //Owner updated
              //return success
              res.send(JSON.stringify({"erorr": false, "type": "success"}))
            });
          }else{
            //No such hub
            //throw an error
            res.send(JSON.stringify({"erorr": true, "type": "Wrong hub token"}))
          }
        });
      }else{
        //User not valid
        //throw an error
        res.send(JSON.stringify({"erorr": true, "type": "user login data is not valid"}))
      }
    });
  }else{
    //Invalid request
    //throw an error
    res.send(JSON.stringify({"erorr": true, "type": "invalid request"}))
  }
});

//Hub will ask if it is paired or not
app.post('/hub/isPaired', function(req, res){
  //Set headers
  res.setHeader('Content-Type', 'application/json');
  //Get request
  var hubSecret = req.body.token;
  //Check if request is valid
  if(hubSecret !== null){
    //valid request
    //Ask hub data for hub with this token
    db.connect();
    db.query("SELECT * FROM `hub_list` WHERE `secret`=" + hubSecret, function(err, rows, fields){
      if(err === null){
        var connected = false;
        if(rows.ownerId !== null){
          connected = true;
        }
        res.send({error: false, paired: connected});
      }else{
        res.send({error: true, errorType: "failed to access database"});
      }
    });
  }else{
    //not valid request
    res.send({error: true, errorType: "invalid request"});
  }
});

io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});

http.listen(port, function(){
  console.log('listening on ' + port);
});

//Get hub ip
function hubIP(id, callback){
  db.connect();
  db.query("SELECT * FROM `hub_list` WHERE `id`=" + id, function(err, rows, fields) {
    if (err) throw err;
    var hub = rows[0];
    callback(hub.ip);
  });
}
// Get client IP address from request object
function getClientAddress(req) {
  var ip = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
  return ip;
};
