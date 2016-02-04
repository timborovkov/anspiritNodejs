var http = require('http')
var port = process.env.PORT || 1337;
http.createServer(function(req, res) {
    var body = [];
    req.on('data', function(chunk) {
      body.push(chunk);
    }).on('end', function() {
      body = Buffer.concat(body).toString();
      response.end(body);
    });
}).listen(port);
