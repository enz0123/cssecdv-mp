const userFunctions = require('../models/userFunctions');

// const isAuthenticated = (req, res, next) => {
//     if (req.session && req.session.isAuthenticated) {
//         return next();
//     }

//     // If it's an API call/AJAX, return 401 JSON
//     if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
//         return res.status(401).json({ message: 'Unauthorized. Please log in.' });
//     }

//     // Otherwise redirect to home/login, or show error
//     // For this app, it seems redirection to home is common for unauth access
//     res.redirect('/');
// };

const isAuthenticated = (actionOrReq, res, next) => {
    // Define the core logic in a helper function
    const performCheck = async (req, res, next, actionName) => {
        if (req.session && req.session.isAuthenticated) {
            return next();
        }

        if (actionName) {
            if (actionName == 'delete-review') {
                await userFunctions.logAccessControlFailure(
                    req.session ? req.session._id : null,
                    req.session ? req.session.username : null,
                    '/delete-review',
                    'POST',
                    'Unauthenticated user attempted to delete a review.'
                );
            }

            if (actionName == 'create-comment') { //DONE
                await userFunctions.logAccessControlFailure(
                    req.session ? req.session._id : null,
                    req.session ? req.session.username : null,
                    '/create-comment',
                    'POST',
                    'Unauthenticated user attempted to create a comment.'
                );
            }

            if (actionName == 'update-condo') {
                await userFunctions.logAccessControlFailure(
                    req.session ? req.session._id : null,
                    req.session ? req.session.username : null,
                    '/update-condo',
                    'PATCH',
                    'Unauthenticated user attempted to update a condo.'
                );
            }

            if (actionName == 'create-review') {
                await userFunctions.logAccessControlFailure(
                    req.session ? req.session._id : null,
                    req.session ? req.session.username : null,
                    '/create-review',
                    'POST',
                    'Unauthenticated user attempted to create a review.'
                );
            }

            if (actionName == 'like-button') {
                await userFunctions.logAccessControlFailure(
                    req.session ? req.session._id : null,
                    req.session ? req.session.username : null,
                    '/like-button',
                    'POST',
                    'Unauthenticated user attempted to like a review.'
                );
            }
        }

        // --- You can now use 'actionName' for your logging here ---
        // console.log(`Failed access attempt for: ${actionName}`);


        // If it's an API call/AJAX, return 401 JSON
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        // Otherwise redirect to home
        res.redirect('/');
    };

    // CASE 1: Standard usage -> auth.isAuthenticated
    // The first argument 'actionOrReq' is actually the 'req' object here
    if (actionOrReq && actionOrReq.session) {
        return performCheck(actionOrReq, res, next, 'General Area');
    }

    // CASE 2: Factory usage -> auth.isAuthenticated('Delete Review')
    // The first argument is your string. We return a new middleware function.
    const action = typeof actionOrReq === 'string' ? actionOrReq : 'General Area';

    return (req, res, next) => {
        performCheck(req, res, next, action);
    };
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
