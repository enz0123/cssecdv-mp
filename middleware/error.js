// 404 handler
function notFoundHandler(req, res, next) {
    const statusCode = 404;
    const message = 'The page you requested could not be found.';

    if (req.accepts('html')) {
        return res.status(statusCode).render('error', {
            layout: 'index',   
            status: statusCode,
            message: message
        });
    }

    if (req.accepts('json')) {
        return res.status(statusCode).json({ error: message });
    }

    res.status(statusCode).type('txt').send(message);
}

// General error handler
function errorHandler(err, req, res, next) {
    // Log details on the server only
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
}

module.exports = {
    notFoundHandler,
    errorHandler
};
