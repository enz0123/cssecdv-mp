const userModel = require('../models/User');
const condoModel = require('../models/Condo');
const reviewModel = require('../models/Review');
const userFunctions = require('../models/userFunctions');

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

    // Login
    server.post('/login', async (req, res, next) => {
        const { username, password, rememberMe } = req.body;

        let findStatus, findMessage, user;

        try {
            [findStatus, findMessage, user] = await userFunctions.findUser(username, password);

            if (user) {
                const isBlocked = await userFunctions.isUserBlocked(user._id);

                if (isBlocked.blocked) {
                    const blockedMessage =
                        'Your account is temporarily locked due to multiple failed login attempts. ' +
                        'Please try again in a few minutes.';

                    await userFunctions.recordLoginAttempt(user._id, false);

                    return res
                        .status(403)
                        .json({ message: blockedMessage, picture: null });
                }
            }

            if (findStatus === 200 && user) {
                const loginReport = await userFunctions.getLastLoginAttempt(user._id);
                findMessage = 'Login successful.' + loginReport;

                await userFunctions.recordLoginAttempt(user._id, true);

                if (rememberMe === 'true') {
                    req.session.cookie.expires = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
                }

                req.session.username = user.user;
                req.session.picture = user.picture;
                req.session.role = user.role;
                req.session.isAuthenticated = true;
                req.session._id = user._id;
            } else {
                findStatus = findStatus || 401;
                findMessage = 'Error. Invalid username or password.';
                if (user) {
                    await userFunctions.recordLoginAttempt(user._id, false);
                }
            }

            return res.status(findStatus).json({
                message: findMessage,
                picture: user ? user.picture : null
            });
        } catch (err) {
            console.error('Error during login:', err);
            err.status = 500;
            next(err);
        }
    });


    // Reset password via security questions
    server.post('/resetpassword', async (req, resp, next) => {
        console.log('Resetting password...');
        const username = req.body.username;
        const answer1 = req.body.answer1;
        const answer2 = req.body.answer2;

        try {
            const user = await userModel.findOne({ user: username });

            if (user) {
                const [status, message] =
                    await userFunctions.checkSecurityQuestions(user._id, answer1, answer2);

                if (status === 200) {
                    await userFunctions.resetPassword(user._id);
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

    // Change password (logged-in)
    server.post('/change-password', async (req, resp, next) => {
        const username = req.session.username;
        const currentPassword = req.body.currentPassword;
        const newPassword = req.body.newPassword;

        let changeStatus, changeMessage, user;

        try {
            console.log('Changing password for user:', username);

            [changeStatus, changeMessage, user] =
                await userFunctions.findUser(username, currentPassword);

            if (changeStatus !== 200) {
                console.log('Invalid current password for user:', username);
                return resp.status(400).json({ message: 'Error. Invalid details.' });
            }

            [changeStatus, changeMessage, user] =
                await userFunctions.changePassword(username, newPassword);

            resp.status(changeStatus).json({ message: changeMessage });
        } catch (err) {
            console.error('Error changing password:', err);
            err.status = 500;
            next(err);
        }
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
    server.get('/edit-profile/', async (req, resp, next) => {
        try {
            if (req.session && req.session.isAuthenticated) {
                return resp.render('editprofile', {
                    layout: 'index',
                    title: 'Edit Profile',
                    isEditProfile: true
                });
            }

            // Not authenticated → show home instead
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
            console.error('Error loading edit profile or home:', err);
            err.status = 500;
            next(err);
        }
    });

    // Edit profile submit
    server.patch('/edit-profile-submit', async (req, resp, next) => {
        try {
            const newData = userFunctions.filterEditData(req.body);

            const result = await userModel.updateOne(
                { user: req.session.username },
                { $set: newData }
            );

            console.log('Update successful:', result);

            if (newData.user !== undefined) req.session.username = newData.user;
            if (newData.picture !== undefined)
                req.session.picture = newData.picture.replace('public/', '');

            resp.json({
                message: 'Profile updated successfully!',
                user: req.session.username
            });
        } catch (err) {
            console.error('Error updating profile:', err);

            // If you want to keep the specific username-taken message, you can inspect err.code
            // Otherwise, delegate to centralized error handler:
            err.status = 500;
            next(err);
        }
    });
}

module.exports.add = add;