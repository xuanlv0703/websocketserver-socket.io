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
var port = process.env.OPENSHIFT_NODEJS_PORT || 8000;
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
var apps = {};


io.on('connection', function (socket) {
    console.log("New connection from: " + socket.id);

    // apps join automatically a random room to prevent them from sending
    // or receiving messages to / from other apps
	//socket.appName = Math.random().toString(36);
	//socket.join(socket.appName);



	// when a client connects
	socket.on('enter', function (appName, clientDescription) {
        console.log(socket.id + ": enter " + appName + " clientDescription " + clientDescription);

        // if had alread entered, it cannot enter again without disconnecting first
		if (socket.appName) {
            console.log(socket.id + ": is already on " + socket.appName );
            return;
        }
    	socket.appName = appName;
    	socket.join(socket.appName);

        // add app if not created yet
        if (!apps[appName]) {
            // app does not exist, so add it to our list of apps
   	        //apps.push({name: appName});
            apps[appName] = Array();

        }

        var client = {"id" : socket.id, "clientDescription": clientDescription};

        // check if client already exists
        var exists = false;
    	for ( var i = 0; i < apps[appName].length; i++ ) {
    		if ( apps[appName][i].id === client.id ) {
    			exists = true;
    		}
    	}

        // if not add to client list of this app
        if (!exists) {
            apps[appName].push(client);
        }


        // tell everyone about this client
        socket.to(socket.appName).broadcast.emit('entered', client);

        // tell this client about everyone
        for ( var i = 0; i < apps[appName].length; i++ ) {
    		if ( apps[appName][i].id !== client.id ) {
    			socket.emit('entered', apps[appName][i]);
    		}
    	}

  	});

 // when the client emits 'new message', this listens and executes
  socket.on('event', function (data) {
      console.log(socket.appName + " -> " + socket.id + ": event " + data);

    // we tell the client to execute 'new message'
    socket.to(socket.appName).broadcast.emit('event', data);

  });


  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
      console.log(socket.id + ": disconnected");
      //socket.to(socket.appName).broadcast.emit('disconnect');


      // get client
      var client;
      for ( var i = 0; i < apps[socket.appName].length; i++ ) {
          if ( apps[socket.appName][i].id === socket.id ) {
              client = apps[socket.appName][i];
              apps[socket.appName].splice(i, 1);
              break;
          }
      }


      // we tell the client to execute 'new message'
      socket.to(socket.appName).broadcast.emit('exited', client);


  });
});
