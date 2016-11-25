'use strict';

var express = require('express');
var cfenv = require('cfenv');
var app = express();
var appEnv = cfenv.getAppEnv();
var passport = require('passport');
var LdapStrategy = require('passport-ldapauth');
var bodyParser = require('body-parser');
var session = require('express-session');
var request = require('request');
var NodeCache = require("node-cache");
var bluepageCache = new NodeCache({
    stdTTL: 86400,
    checkperiod: 86400
});
var _ = require('lodash');

var bluepageApi = 'http://bluepages.ibm.com/BpHttpApisv3/slaphapi?*/dept=FV0.list/byjson?callupName&ibmSerialNumber&jobresponsibilities';

var OPTS = {
    server: {
        url: 'ldap://bluepages.ibm.com:389',
        searchBase: 'ou=bluepages,o=ibm.com',
        searchFilter: '(emailAddress={{username}})'
    }
};

passport.use(new LdapStrategy(OPTS));

app.use(bodyParser.urlencoded({
    extended: false,
    keepExtensions: true
}));

app.use(bodyParser.json());

app.use(passport.initialize());

app.use(express.static(__dirname + '/public'));

app.use(errorService);

app.use(session({
    secret: 'DOZGX2C8W6IS',
    cookie: {
        maxAge: 60 * 60 * 1000
    },
    saveUninitialized: true,
    resave: true
}));

app.get('/session', getSession);
app.get('/bluepage', getBluepage);
app.get('/bluepageSearch/:search', searchName);
app.post('/login', authenticateService);

app.get('*', function (req, res) {
    res.sendFile(__dirname + '/public/index.html');
});

cacheRequest(bluepageApi, 'bluepage', bluepageCache);
bluepageCache.on("expired", refreshCacheService);

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function () {
    // print a message when the server starts listening
    console.log("server starting on " + appEnv.url);
});


//////////

function authenticateService(req, res, next) {

    passport.authenticate('ldapauth', {
        session: false,
        failureFlash: true
    }, function (err, user, info) {

        if (err) {
            next(err);
        }

        if (!user) {
            return res.send({
                success: false,
                message: info.message
            });
        } else {

            req.session.regenerate(function () {

                var sessionUser = {
                    callupName: user.callupName,
                    ibmSerialNumber: user.ibmSerialNumber,
                    jobresponsibilities: user.jobresponsibilities
                };

                req.session.user = sessionUser;

                return res.send({
                    success: true,
                    message: 'authentication succeeded',
                    user: sessionUser
                });
            });

        }

    })(req, res, next);

}

function cacheRequest(url, key, cache) {
    request(url,
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                cache.set(key, body, function (err, success) {
                    if (!err && success) {
                        console.log('Bluepage Successfully Cached.');
                    } else {
                        console.log('Problem retrieving Bluepage :' + err.message);
                    }
                });
            } else {
                console.log(error);
            }
        });
}

function getBluepage(req, res, next) {
    bluepageCache.get("bluepage", function (err, value) {
        if (!err) {
            if (value == undefined) {
                res.json({});
            } else {
                res.json(JSON.parse(value));
            }
        } else {
            next(err);
        }
    });
}

function getSession(req, res, next) {
    res.json(req.session.user);
}

function errorService(err, req, res, next) {
    var status = err.statusCode || 500;
    if (err.message) {
        res.send(status, err.message);
    } else {
        res.send(status, err);
    }
    next();
}

function refreshCacheService(key, value) {
    console.log('Refresh Cache!');
    cacheRequest(bluepageApi, key, bluepageCache);
}

function searchName(req, res, next) {
    bluepageCache.get("bluepage", function (err, value) {
        if (!err) {
            if (value == undefined) {
                res.json({});
            } else {

                var collection = JSON.parse(value);
                var searchCollection = _.filter(collection.search.entry, function (o) {
                    return o.attribute[0].value[0].toLowerCase().indexOf(req.params.search.toLowerCase()) != -1;
                });

                res.json(searchCollection.slice(0,5));
            }
        } else {
            next(err);
        }
    });
}