#!/bin/env node

// Setup basic express server
var express = require('express');
var app = express();

// Add headers
app.use(function(req, res, next) {

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

var ipaddress = process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
var port = process.env.OPENSHIFT_NODEJS_PORT || 8000;
var serverStat;

server.listen(port, ipaddress, function() {
    serverStat = new Date() + ' Server is listening on ' + ipaddress + " : " + port;
    console.log(serverStat);
});
console.log(server);

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


io.on('connection', function(socket) {
    console.log(socket.id + ": connected.");

    // when a client connects
    socket.on('enter', function(appName, clientDescription) {
        console.log(socket.id + ": enter " + appName + ",  description " + JSON.stringify(clientDescription));

        // if had alread entered in an app, it cannot enter again without disconnecting first
        if (socket.appName) {
            console.log(socket.id + ": is already on app room ´" + socket.appName + "´");
            return;
        }
        socket.appName = appName;
        socket.join(socket.appName);

        // add app if not created yet
        if (!apps[appName]) {
            // app does not exist, so add it to our list of apps
            apps[appName] = Array();
        }

        var client = {
            "id": socket.id,
            "description": clientDescription
        };
        socket.myClient = client;

        // check if client already exists
        var exists = false;
        for (var i = 0; i < apps[appName].length; i++) {
            if (apps[appName][i].id === client.id) {
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
        for (var i = 0; i < apps[appName].length; i++) {
            if (apps[appName][i].id !== client.id) {
                socket.emit('entered', apps[appName][i]);
            }
        }

    });


    // when the client emits 'leave'
    socket.on('leave', function(data) {
        console.log(socket.id + " (" + socket.appName + "): leave, data: " + JSON.stringify(data));

        removeSocketAndBroadcastExit(socket);
    });

    // when the client emits 'new message', this listens and executes
    socket.on('message', function(to, data) {
        console.log(socket.id + " (" + socket.appName + "): message,  to:" + to + ", data: " + JSON.stringify(data));


        if (arguments.length < 2) return;


        if (to.toString() === '*' || to.toString().toLowerCase() === 'all') {
            // broadcast
            socket.to(socket.appName).broadcast.emit('message', socket.myClient, data);
        } else {
            //p2p
            if (io.to(to)) {
                io.to(to).emit('message', socket.myClient, data);
            }
        }
    });


    // when the user disconnects.. perform this
    socket.on('disconnect', function() {
        console.log(socket.id + " (" + socket.appName + "): disconnected");
        removeSocketAndBroadcastExit(socket);
    });

    function removeSocketAndBroadcastExit(socket) {
        console.log(socket.id + " (" + socket.appName + "): broadcasting exit.");
        if (apps[socket.appName]) {
            // get client
            var client;
            for (var i = 0; i < apps[socket.appName].length; i++) {
                if (apps[socket.appName][i].id === socket.id) {
                    client = apps[socket.appName][i];
                    apps[socket.appName].splice(i, 1);
                    break;
                }
            }
            if (!client) {
                client = {id: socket.id};
            }

            socket.to(socket.appName).broadcast.emit('exited', client);

        }
        socket.appName = undefined;
    }

});
