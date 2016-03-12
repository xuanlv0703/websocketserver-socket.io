#!/bin/env node

// Setup basic express server
var express = require('express');
var app = express();

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', false);

    // Pass to next layer of middleware
    next();
});

var server = require('http').createServer(app);
var io = require('socket.io')(server);

var ipaddress = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var serverStat;

server.listen( port, ipaddress, function() {
    serverStat = new Date() + ' Server is listening on port ' + port;
    console.log(serverStat);
});


// Routing
app.use(express.static(__dirname + '/public'));


// respond with "hello world" when a GET request is made to the homepage
app.get('/', function(req, res) {
  	res.redirect("/_server");
});


// respond with "hello world" when a GET request is made to the homepage
app.get('/_server', function(req, res) {
  	res.send(serverStat);
});

app.get('/_server/stats', function(req, res) {
  	res.send("Apps:" + JSON.stringify(apps));
});

//
var apps = new Array();

var numUsers = 0;
var numApps = 0;

io.on('connection', function (socket) {
	socket.appName = Math.random().toString(36);
	socket.join(socket.appName);

	// when an app registers
	socket.on('registerApp', function (appName) {
		socket.leave(socket.appName);
    	socket.appName = appName;
    	socket.join(socket.appName);

    	for ( var i = 0; i < apps.length; i++ ) {
    		if ( apps[i].name === appName ) {
    			return;
    		}
    	}

   		apps.push({name: appName});

  	});

 // when the client emits 'new message', this listens and executes
  socket.on('event', function (data) {
    // we tell the client to execute 'new message'
    socket.to(socket.appName).broadcast.emit('event', data);
  });


  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
