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
app.get('/_server', function(req, res) {
    console.log(serverStat);
  	res.send(serverStat);
});

app.get('/_server/stats', function(req, res) {
    var stats = "Apps:" + JSON.stringify(apps);
    console.log(stats);
  	res.send(stats);
});

//
var apps = new Array();

var numUsers = 0;
var numApps = 0;

io.on('connection', function (socket) {
    console.log("New connection from: " + socket.id);

    // apps join automatically a random room to prevent them from sending
    // or receiving messages to / from other apps
	socket.appName = Math.random().toString(36);
	socket.join(socket.appName);



	// when a client connects
	socket.on('enter', function (appName) {
        console.log(socket.id + ": enter " + appName);
        // when app registers it leaves the random room and enters a new one
		socket.leave(socket.appName);
    	socket.appName = appName;
    	socket.join(socket.appName);


        // check if app already exists
    	for ( var i = 0; i < apps.length; i++ ) {
    		if ( apps[i].name === appName ) {
    			return;
    		}
    	}

        // app does not exist, so add it to our list of apps
   		apps.push({name: appName});


        // tell everyone about this client
        socket.to(socket.appName).broadcast.emit('entered', {'client': socket.id});

  	});

 // when the client emits 'new message', this listens and executes
  socket.on('event', function (data) {
      console.log(socket.appName + " -> " + socket.id + ": event " + data);
     
    // we tell the client to execute 'new message'
    socket.to(socket.appName).broadcast.emit('event', data);

    socket.broadcast.emit('event', data);
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
      //socket.to(socket.appName).broadcast.emit('disconnect');

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
