module.exports.run = function(userData){
  db.query("SELECT * FROM `users` WHERE `email` = '" + userData['email'] + "'", function(err, rows, fields){
    if (err) throw err;
    
  });
  return false;
}
