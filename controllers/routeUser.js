const userModel = require('../models/User');
const condoModel = require('../models/Condo');
const reviewModel = require('../models/Review');
const userFunctions = require('../models/userFunctions');
const loginAttemptModel = require('../models/LoginAttempt');

function add(server) {

    // Logged-in status
    server.get('/loggedInStatus', (req, resp) => {
        if (req.session && req.session.isAuthenticated) {
            return resp.send({
                isAuthenticated: req.session.isAuthenticated,
                username: req.session.username,
                picture: req.session.picture,
                role: req.session.role
            });
        } else {
            return resp.send({
                isAuthenticated: false
            });
        }
    });

    // Home page
    server.get('/', async (req, resp, next) => {
        try {
            const condos = await condoModel.find().lean();

            for (const condo of condos) {
                condo.description = condo.description.slice(0, 150) + '...';
            }

            resp.render('home', {
                layout: 'index',
                title: 'Home Page',
                isHome: true,
                condos: condos
            });
        } catch (err) {
            console.error('Error loading home page condos:', err);
            err.status = 500;
            next(err);
        }
    });

    // Create account
    server.post('/create-account', async (req, resp, next) => {
        try {
            let createSuccess, createStatus, createMessage;

            [createSuccess, createStatus, createMessage] =
                await userFunctions.createAccount(
                    req.body.username,
                    req.body.password,
                    req.body.picture,
                    req.body.bio,
                    req.body.securityQn1,
                    req.body.securityQn2,
                    req.body.securityAnswer1,
                    req.body.securityAnswer2
                );

            resp.status(createStatus).send({ success: createSuccess, message: createMessage });
        } catch (err) {
            console.error('Error creating account:', err);
            err.status = 500;
            next(err);
        }
    });

    // Logout
    server.post('/logout', (req, resp, next) => {
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session during logout:', err);
                err.status = 500;
                return next(err);
            }
            resp.send({});
        });
    });

    // Login POST 
    server.post('/login', async (req, res) => {
        const { username, password, rememberMe } = req.body;

        let findStatus, findMessage, user;

        console.log('LOGIN ATTEMPT body:', req.body); // debug

        // Case 1: Missing username or password
        if (!username || !password) {
            await userFunctions.logValidationFailure(
                req.session ? req.session._id : null,
                req.session ? req.session.username : null,
                '/login',
                'POST',
                'Missing username or password.'
            );

            // log the auth attempt even if userId is unknown
            await userFunctions.recordLoginAttempt(
                null,                 // userId
                username || null,     // username attempted
                false,                // success
                '/login',
                'POST'
            );

            return res.status(400).json({ message: 'Error. Invalid details.' });
        }

        [findStatus, findMessage, user] = await userFunctions.findUser(username, password);

        // Case 2: User exists but account is blocked
        if (user) {
            const isBlocked = await userFunctions.isUserBlocked(user._id);
            if (isBlocked.blocked) {
                findStatus = 403;
                findMessage =
                    'Your account is temporarily locked due to multiple failed login attempts. ' +
                    'Please try again after a short period of time.';

                await userFunctions.recordLoginAttempt(
                    user._id,
                    user.user,
                    false,
                    '/login',
                    'POST'
                );

                return res.status(findStatus).json({
                    message: findMessage,
                    picture: null
                });
            }
        }

        // Case 3: Successful login
        if (findStatus === 200 && user) {
            const loginReport = await userFunctions.getLastLoginAttempt(user._id);

            findMessage = 'Login successful.' + loginReport;

            await userFunctions.recordLoginAttempt(
                user._id,
                user.user,
                true,
                '/login',
                'POST'
            );

            if (rememberMe === 'true' || rememberMe === true) {
                // 21 days
                req.session.cookie.expires = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
            }

            req.session.username = user.user;
            req.session.picture = user.picture;
            req.session.role = user.role;
            req.session.isAuthenticated = true;
            req.session._id = user._id;

            return res.status(200).json({
                message: findMessage,
                picture: user.picture
            });
        }

        // Case 4: Failed login (wrong password OR non-existent username)

        if (user) {
            // wrong password
            await userFunctions.recordLoginAttempt(
                user._id,
                user.user,
                false,
                '/login',
                'POST'
            );
        } else {
            // user does NOT exist
            await userFunctions.recordLoginAttempt(
                null,
                username,
                false,
                '/login',
                'POST'
            );
        }

        findStatus = findStatus || 401;
        findMessage = 'Error. Invalid username or password.';

        return res.status(findStatus).json({
            message: findMessage,
            picture: user ? user.picture : null
        });
    });

    // Reset password via security questions
    server.post('/resetpassword', async (req, resp, next) => {
        console.log('Resetting password...');
        const username = req.body.username;
        const answer1 = req.body.answer1;
        const answer2 = req.body.answer2;
        const newPassword = req.body.newPassword;

        try {
            const user = await userModel.findOne({ user: username });

            if (user) {
                const [status, message] =
                    await userFunctions.checkSecurityQuestions(user._id, answer1, answer2);

                if (status === 200) {
                    if (!newPassword) {
                        return resp.status(400).json({ message: 'New password is required.' });
                    }
                    await userFunctions.resetPassword(user._id, newPassword);
                }

                return resp.status(status).json({ message: message });
            } else {
                return resp.status(401).json({ message: 'Error. Invalid details.' });
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            error.status = 500;
            next(error);
        }
    });

    // Change password
    server.post('/change-password', async (req, resp) => {
        const username = req.session.username;
        const currentPassword = req.body.currentPassword;
        const newPassword = req.body.newPassword;

        let changeStatus, changeMessage, user;

        console.log("Changing password for user:", username);

        if (!newPassword || newPassword.length < 8) {
            await userFunctions.logValidationFailure(
                req.session ? req.session._id : null,
                username,
                '/change-password',
                'POST',
                'New password does not meet minimum length requirement.'
            );
            return resp.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return resp.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
        }

        [changeStatus, changeMessage, user] =
            await userFunctions.findUser(username, currentPassword);

        if (changeStatus !== 200) {
            await userFunctions.logValidationFailure(
                req.session ? req.session._id : null,
                username,
                '/change-password',
                'POST',
                'Current password did not match.'
            );

            console.log("Invalid current password for user:", username);
            return resp.status(changeStatus).json({ message: 'Error. Invalid details.' });
        }

        [changeStatus, changeMessage, user] =
            await userFunctions.changePassword(username, newPassword);

        resp.status(changeStatus).json({ message: changeMessage });
    });



    // Forgot password – show security questions page
    server.get('/forgot-password', async (req, resp, next) => {
        const username = req.query.username;

        console.log('Forgot password for:', username);

        try {
            const user = await userModel.findOne({ user: username });

            let securityQuestions;

            if (user) {
                console.log('User found.');
                securityQuestions = await userFunctions.getSecurityQuestions(user._id);
            } else {
                console.log('User not found.');
                securityQuestions = await userFunctions.getSecurityQuestions(null);
            }

            resp.render('resetpassword', {
                layout: 'index',
                title: 'Reset Password',
                securityQuestions: securityQuestions,
                username: username,
                isResetPassword: true
            });
        } catch (error) {
            console.error('Error occurred during forgot password steps:', error);
            error.status = 500;
            next(error);
        }
    });

    // View profile
    server.get('/profile/:username', async (req, resp, next) => {
        const username = req.params.username;
        let processedReviews;

        try {
            const data = await userModel
                .findOne({ user: username })
                .populate('reviews')
                .lean();

            if (!data) {
                return resp.status(404).render('error', {
                    layout: 'index',
                    status: 404,
                    message: 'User not found.'
                });
            }

            processedReviews = data.reviews
                ? await userFunctions.processReviews(data.reviews, req.session._id)
                : [];

            const reviews = await reviewModel.find().populate('comments.user').lean();
            const commentsByUser = [];

            reviews.forEach(review => {
                review.comments.forEach(comment => {
                    const commentUser = comment.user && comment.user.user;

                    if (commentUser && commentUser === username) {
                        comment.date = comment.date.toLocaleDateString();
                        commentsByUser.push(comment);
                    }
                });
            });

            resp.render('viewprofile', {
                layout: 'index',
                title: data.user,
                data: data,
                reviews: processedReviews.reverse(),
                comments: commentsByUser,
                isProfile: true
            });
        } catch (err) {
            console.error('Error fetching profile data from MongoDB:', err);
            err.status = 500;
            next(err);
        }
    });

    // Edit profile page
    server.get('/edit-profile/', async function (req, resp) {
        if (req.session && req.session.isAuthenticated) {
            return resp.render('editprofile', {
                layout: 'index',
                title: 'Edit Profile',
                isEditProfile: true
            });
        } else {
            // Access control failure: not logged in but tried to access edit profile
            await userFunctions.logAccessControlFailure(
                req.session ? req.session._id : null,
                req.session ? req.session.username : null,
                '/edit-profile',
                'GET',
                'Unauthenticated user attempted to access edit profile page.'
            );

            // Fallback: show home page
            condoModel.find().lean().then(function (condos) {
                for (const condo of condos) {
                    condo.description = condo.description.slice(0, 150) + "...";
                }

                resp.render('home', {
                    layout: 'index',
                    title: 'Home Page',
                    isHome: true,
                    condos: condos
                });
            });
        }
    });

    server.post('/log-access-control-failure', async (req, resp) => {
        if (req.body.area == 'create-comment') {
            await userFunctions.logAccessControlFailure(
                req.session ? req.session._id : null,
                req.session ? req.session.username : null,
                '/create-comment',
                'POST',
                'Unauthenticated user attempted to create a comment.'
            );
            resp.status(200).json({ message: 'Access control failure logged successfully.' });
            return;
        }

        if (req.body.area == 'create-review') {
            await userFunctions.logAccessControlFailure(
                req.session ? req.session._id : null,
                req.session ? req.session.username : null,
                '/create-review',
                'POST',
                'Unauthenticated user attempted to create a review.'
            );
            resp.status(200).json({ message: 'Access control failure logged successfully.' });
            return;
        }

        if (req.body.area == 'like-button') {
            await userFunctions.logAccessControlFailure(
                req.session ? req.session._id : null,
                req.session ? req.session.username : null,
                '/like-button',
                'POST',
                'Unauthenticated user attempted to like a review.'
            );
            resp.status(200).json({ message: 'Access control failure logged successfully.' });
            return;
        }

        resp.status(400).json({ message: 'Invalid area.' });
    });


    // Edit profile submit
    server.patch('/edit-profile-submit', async (req, resp) => {
        // Access control: must be logged in
        if (!req.session || !req.session.isAuthenticated) {
            await userFunctions.logAccessControlFailure(
                null,
                null,
                '/edit-profile-submit',
                'PATCH',
                'Unauthenticated user attempted to submit edit profile changes.'
            );
            return resp.status(401).json({ message: 'You must be logged in to edit your profile.' });
        }

        const newData = userFunctions.filterEditData(req.body);

        if (newData.name) {
            if (newData.name.includes(' ')) {
                return resp.status(400).json({ message: "Username can't have any space" });
            }
            if (newData.name.length > 20) {
                return resp.status(400).json({ message: 'Name too long! (max 20 characters)' });
            }
        }
        if (newData.bio && newData.bio.length > 500) {
            return resp.status(400).json({ message: 'Bio too long! (max 500 characters)' });
        }
        if (newData.education && newData.education.length > 100) {
            return resp.status(400).json({ message: 'Education too long! (max 100 characters)' });
        }
        if (newData.city && newData.city.length > 100) {
            return resp.status(400).json({ message: 'City too long! (max 100 characters)' });
        }
        if (newData.email && newData.email.length > 100) {
            return resp.status(400).json({ message: 'Email too long! (max 100 characters)' });
        }

        userModel.updateOne({ "user": req.session.username }, { $set: newData })
            .then(result => {
                console.log("Update successful:", result);

                if (newData.user !== undefined) req.session.username = newData.user;
                if (newData.picture !== undefined) req.session.picture = newData.picture.replace('public/', '');

                resp.json({ message: 'Profile updated successfully!', user: req.session.username });
            })
            .catch(err => {
                console.error("Error updating document:", err);
                resp.json({ message: 'Error. That username is already taken.', user: req.session.username });
                return false;
            });
    });

}

module.exports.add = add;