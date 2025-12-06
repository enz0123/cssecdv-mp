const userFunctions = require('../models/userFunctions');

const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }

    // If it's an API call/AJAX, return 401 JSON
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }

    // Otherwise redirect to home/login, or show error
    // For this app, it seems redirection to home is common for unauth access
    res.redirect('/');
};

const isAuthorized = (roles = []) => {
    return async (req, res, next) => {
        if (!req.session || !req.session.isAuthenticated) {
            // Fallback if isAuthenticated wasn't called before
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.status(401).json({ message: 'Unauthorized. Please log in.' });
            }
            return res.redirect('/');
        }

        if (roles.includes(req.session.role)) {
            return next();
        }

        // Log access control failure
        await userFunctions.logAccessControlFailure(
            req.session._id,
            req.session.username,
            req.originalUrl,
            req.method,
            `User with role '${req.session.role}' attempted to access protected route. Required roles: ${roles.join(', ')}`
        );

        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(403).json({ message: 'Forbidden. You do not have permission to access this resource.' });
        }

        // Render error page
        res.status(403).render('error', {
            layout: 'index',
            message: 'You do not have permission to access this page.',
            status: 403
        });
    };
};

module.exports = { isAuthenticated, isAuthorized };
