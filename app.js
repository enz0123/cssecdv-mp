//Install Command:
//npm init
//npm i express express-handlebars body-parser mongoose multer bcrypt express-session connect-mongodb-session

const express = require('express');
const server = express();

const bodyParser = require('body-parser');
server.use(express.json()); 
server.use(express.urlencoded({ extended: true }));


// SESSION HANDLER
const session = require('express-session');
const mongoStore = require('connect-mongodb-session')(session);
const mongoURI = "mongodb://localhost:27017/condodb";

server.use(session({
    secret: 'penguin-banana-jazz-1234',
    saveUninitialized: false, 
    resave: false,
    store: new mongoStore({
        uri: mongoURI, // MongoDB connection URI
        collection: 'mySession', // Collection where sessions are stored
        expires: 24 * 60 * 60 * 1000 // Default session expiration: 1 day in milliseconds
    })
}));


const handlebars = require('express-handlebars');
server.set('view engine', 'hbs');
server.engine('hbs', handlebars.engine({
    extname: 'hbs',
    helpers: {
        // Define your custom helper functions here
        if_eq: function(a, b, opts) {
            if (a === b) {
                return opts.fn(this);
            } else {
                return opts.inverse(this);
            }
        },
        star2: function(num, options) {
            if (num >= 2) {
                return options.fn(this);
            } else {
                return options.inverse(this);
            }
        },
        star3: function(num, options) {
            if (num >= 3) {
                return options.fn(this);
            } else {
                return options.inverse(this);
            }
        },
        star4: function(num, options) {
            if (num >= 4) {
                return options.fn(this);
            } else {
                return options.inverse(this);
            }
        },
        star5: function(num, options) {
            if (num >= 5) {
                return options.fn(this);
            } else {
                return options.inverse(this);
            }
        }
    }
}));

server.use(express.static('public'));


const mongoose = require('mongoose');
mongoose.connect(mongoURI);

const controllers = ['routeUser', 'routeCondo', 'routeReview'];

for(i = 0; i < controllers.length; i++){
    const ctrl = require('./controllers/' + controllers[i]); 
    ctrl.add(server);
}

// 404 handler – runs if no route matched
server.use((req, res, next) => {
    const statusCode = 404;
    const message = 'The page you requested could not be found.';

    if (req.accepts('html')) {
        return res.status(statusCode).render('error', {
            layout: 'index',      // or remove if your error page is standalone
            status: statusCode,
            message: message
        });
    }

    if (req.accepts('json')) {
        return res.status(statusCode).json({ error: message });
    }

    res.status(statusCode).type('txt').send(message);
});

// General error handler
server.use((err, req, res, next) => {
    // Log details on the server ONLY
    console.error('Unexpected error:', err);

    const statusCode = err.status || 500;
    const genericMessage = statusCode === 500
        ? 'An unexpected error occurred. Please try again later.'
        : 'A request error occurred. Please try again.';

    if (req.accepts('html')) {
        return res.status(statusCode).render('error', {
            layout: 'index',
            status: statusCode,
            message: genericMessage
        });
    }

    if (req.accepts('json')) {
        return res.status(statusCode).json({ error: genericMessage });
    }

    res.status(statusCode).type('txt').send(genericMessage);
});


//Only at the very end should the database be closed.
function finalClose(){
    console.log('Close connection at the end!');
    mongoose.connection.close();
    process.exit();
}

process.on('SIGTERM',finalClose);  //general termination signal
process.on('SIGINT',finalClose);   //catches when ctrl + c is used
process.on('SIGQUIT', finalClose); //catches other termination commands

const port = process.env.PORT || 3000;
server.listen(port, function(){
    console.log('Listening at port '+ port);
});