var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser')
var mysql = require('mysql');
var request = require('ajax-request');
var crypto = require('crypto');

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
  var password = req.query.password; //User's password
  var hubId = req.query.hub;

  //Validate if user is valid
  //Get md5 hash from password
  password = crypto.createHash('md5').update(password).digest('hex');
  //Get user from database
  db.query("SELECT * FROM `users` WHERE `id`=" + user, function(err, rows, fields){
    if(err !== null){
      //Throw an error
      console.error(err);
      res.send({error:true, type:"ERROR: " + err});
    };
    //Check if password is valid
    if(rows[0].password === password){
      //User is valid
      //TODO: Validate if hub is owned by the user

      if(user != null && secret != null && hubId != null){

          db.query("SELECT * FROM `device_list` WHERE `hub`="+hubId, function(err, rows, fields) {
            if (err) throw err;
            if(rows != null){
              res.send({error:false, type:"done", request: req.query, devices: rows});
            }else{
              res.send({error:true, type:"no hub found"});
            }
          });


         res.send(responseToSend);
       }else{
         res.send({error: true, type: 'bad request'});
       }
    }else{
      //Invalid user
      res.send({error: true, type: 'invalid user'});
    }
  });//end of db.query
});//end of app.get

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

//Setup new device (lamp, socket etc.) on server and database
app.get('/newDevice', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  var hubSecret = req.query.hubSecret;
  var hubId = req.query.hubId;
  var type = req.query.type;
  var name = req.query.name;
  var connectionType = req.query.connectionType;
  var state = "off";
  if(type != null && hubId != null && connectionType != null && hubSecret != null && name != null){

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
//Hub will ask for task every 2 seconds from here
app.get('/tasksForHub', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  var hubId = req.query.hub;
  var result = {tasks: {}, status: "done"};
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
//Must add new task for hub in database
app.get('/hub', function(req, res){
  res.setHeader('Content-Type', 'application/json');
  var hubId = req.query.hubId;
  var user = req.query.user;
  var secret = req.query.secret;
  var task = req.query.task;
  //TODO
  //Task contains {action: action, parameters: parameters}
  //Task must be converted to standart

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

    //Get user from database

    db.query("SELECT * FROM `users` WHERE `id`=" + userId, function(err, rows, fields){
      if(err){
        //Throw an error
        res.send(JSON.stringify({"error": true, "type": "failed to contact DB"}))
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
              res.send(JSON.stringify({"error": false, "type": "success"}))
            });
          }else{
            //No such hub
            //throw an error
            res.send(JSON.stringify({"error": true, "type": "Wrong hub token"}))
          }
        });
      }else{
        //User not valid
        //throw an error
        res.send(JSON.stringify({"error": true, "type": "user login data is not valid"}))
      }
    });

  }else{
    //Invalid request
    //throw an error
    res.send(JSON.stringify({"erorr": true, "type": "invalid request"}))
  }
});

//Hub will ask if it is paired or not
app.get('/hub/isPaired', function(req, res){
  //Set headers
  res.setHeader('Content-Type', 'application/json');
  //Get request
    var hubSecret = req.query.token;
  //Check if request is valid
  if(hubSecret !== null){
    //valid request
    //Ask hub data for hub with this token
    //Connect to database
    //Execute query
    db.query("SELECT * FROM `hub_list` WHERE `secret`=" + hubSecret, function(err, rows, fields){
      if(err === null){
        if(rows.length > 0){
          var connected = false;
          console.log(rows[0].ownerId);
          if(rows[0].ownerId !== null){
            connected = true;
          }
          res.send({error: false, paired: connected});
        }else{
          res.send({error: true, errorType: "Hub with token " + hubSecret + ", was not found"});
        }
      }else{
        console.error(err);
        res.send({error: true, errorType: "failed to send query: " + "SELECT * FROM `hub_list` WHERE `secret`=" + hubSecret});
      }
    });
  }else{
    //not valid request
    res.send({error: true, errorType: "invalid request"});
  }
});

//Get list of QHubs paired with user account
app.get('/listUserHubs', function(req, res){
  //Set headers
  res.setHeader('Content-Type', 'application/json');
  //Create response sample
  var response = {error: true, details: "", hubs: {}};
  //Get request
  var user = req.query.user;
  var password = req.query.password;
  //Check if request is valid
  if(user !== null && password !== null){
    //Valid request
    //security check
    //Get md5 hash from password
    password = crypto.createHash('md5').update(password).digest('hex');
    //Get user from database
    db.query("SELECT * FROM `users` WHERE `id`=" + user, function(err, rows, fields){
      if(err !== null){
        //Throw an error
        console.error(err);
        response.details = "ERROR: " + err;
        res.send(response);
      };
      //Check if password is valid
      if(rows[0].password === password){
        //Valid user
        //Ask from database
        db.query("SELECT * FROM `hub_list` WHERE `ownerId`=" + user, function(err, rows, fields){
          if(err === null){
            if(rows.length > 0){
              response.error = false;
              response.details = "search done!";
              response.hubs = rows;
              res.send(response);
            }else{
              //User doesn't have anything connected
              response.details = "no hubs been paired yet";
              response.error = false;
              res.send(response)
            }
          }else{
            console.error(err);
            response.details = "ERROR: " + err;
            res.send(response);
          }
        }); //End of db.query
      }else{
        //Invalid user
        response.details = "invalid password or user id";
        res.send(response)
      }
    });
  }else{
    //Not valid request
    response.details = "not valid request";
    res.send(response)
  }
}); //End of app.post

io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});

http.listen(port, function(){
  console.log('listening on: ' + port);
});

//Get hub ip
function hubIP(id, callback){

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
