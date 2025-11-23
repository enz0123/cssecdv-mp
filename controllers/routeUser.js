const userModel = require('../models/User');
const condoModel = require('../models/Condo');
const reviewModel = require('../models/Review');
const userFunctions = require('../models/userFunctions');

function add(server){
    server.get('/loggedInStatus', function(req, resp){
        // Check if user is authenticated by verifying the presence of user details in session
        if (req.session && req.session.isAuthenticated) {
            resp.send({
                isAuthenticated: req.session.isAuthenticated,
                username: req.session.username,
                picture: req.session.picture,
                role: req.session.role
            });
        } else {
            resp.send({
                isAuthenticated: false // Set isAuthenticated to false
            });
        }
    });

    server.get('/', function(req,resp){
        condoModel.find().lean().then(function(condos){
            for(const condo of condos) {
                condo.description = condo.description.slice(0, 150) + "...";
            }
            
            resp.render('home',{
                layout: 'index',
                title: 'Home Page',
                isHome: true,
                condos: condos
            });
        });
    });
    
    // create account POST
    server.post('/create-account', async (req, resp) => {
        let createSuccess, createStatus, createMessage;

       [createSuccess, createStatus, createMessage] = await userFunctions.createAccount(req.body.username, req.body.password, req.body.picture, req.body.bio, req.body.securityQn1, req.body.securityQn2, req.body.securityAnswer1, req.body.securityAnswer2);

        resp.status(createStatus).send({success: createSuccess, message: createMessage});
    });

    // Logout POST
    server.post('/logout', function(req, resp){
        req.session.destroy(function(err) {
            resp.send({});
        });
    });

    // Login POST 
    server.post('/login', async (req, res) => {
        const { username, password, rememberMe } = req.body;   

        let findStatus, findMessage;

        [findStatus, findMessage, user] = await userFunctions.findUser(username, password);
        
        if(user){
            const isBlocked = await userFunctions.isUserBlocked(user._id);
            if(isBlocked.blocked){
                findStatus = 403;
                findMessage = "Your account is temporarily blocked due to multiple failed login attempts. Please try again in " + isBlocked.minutesLeft + " minutes.";
                user = null;
                
                userFunctions.recordLoginAttempt(user._id, false);
                res.status(findStatus).json({message: findMessage, picture: user ? user.picture : null});
                return;
            }


        }

        if (findStatus === 200) {
            const loginReport = await userFunctions.getLastLoginAttempt(user._id)

            findMessage = findMessage + loginReport

            userFunctions.recordLoginAttempt(user._id, true);

            if (rememberMe === 'true') 
                req.session.cookie.expires = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000); // 21 days 

            req.session.username = user.user;
            req.session.picture = user.picture;
            req.session.role = user.role;
            req.session.isAuthenticated = true;
            req.session._id = user._id;
        } else if (user){
            userFunctions.recordLoginAttempt(user._id, false);
        }

        res.status(findStatus).json({message: findMessage, picture: user ? user.picture : null});
    });

    server.post('/change-password', async (req, resp) => {
        const username = req.session.username;
        const currentPassword = req.body.currentPassword;
        const newPassword = req.body.newPassword;

        let changeStatus, changeMessage;

        console.log("Changing password for user:", username);

        [changeStatus, changeMessage, user] = await userFunctions.findUser(username, currentPassword);

        if (changeStatus !== 200) {
            resp.status(changeStatus).json({message: "Invalid current password"}); 
            console.log("Invalid current password for user:", username);
            return;  
        }

        [changeStatus, changeMessage, user] = await userFunctions.changePassword(username, newPassword);
        
        resp.status(changeStatus).json({message: changeMessage});
    });


    // get profile GET
    server.get('/profile/:username', async (req, resp) => {
        const username = req.params.username; // Retrieve the username from the URL
        var processedReviews;

        try {
            // Query MongoDB to get data
            var data = await userModel.findOne({ user: username }).populate('reviews').lean();

            processedReviews = data.reviews ? await userFunctions.processReviews(data.reviews, req.session._id) : [];

            const reviews = await reviewModel.find().populate('comments.user').lean();

            const commentsByUser = [];
    
            // Iterate over the comments array
            reviews.forEach(review => {
                review.comments.forEach(comment => {
                    // Access the comment author's user information
                    const commentUser = comment.user.user;
    
                    // Check if the comment author is the user we're interested in
                    if (commentUser && commentUser === username) {
                        // Format date without time component
                        comment.date = comment.date.toLocaleDateString(); // Assuming date is a JavaScript Date object
                        // Append the comment to the list
                        commentsByUser.push(comment);
                    }
                });
            });

            resp.render('viewprofile', {
                layout: 'index',
                title: data.user,
                'data': data,
                'reviews': processedReviews.reverse(),
                'comments': commentsByUser,
                isProfile: true
            });
        } catch (err) {
            // Handle errors
            console.error('Error fetching data from MongoDB', err);
            resp.status(500).json({ error: 'Failed to fetch data' });
        }
    });

    // get edit profile GET
    server.get('/edit-profile/', function(req, resp) {
        if (req.session && req.session.isAuthenticated) {
            resp.render('editprofile',{
                layout: 'index',
                title: 'Edit Profile',
                isEditProfile: true
        });
        } else {
            condoModel.find().lean().then(function(condos){
                for(const condo of condos) {
                    condo.description = condo.description.slice(0, 150) + "...";
                }
                
                resp.render('home',{
                    layout: 'index',
                    title: 'Home Page',
                    isHome: true,
                    condos: condos
                });
            });
        }

    });

    server.patch('/edit-profile-submit', async (req, resp) => {
        const newData = userFunctions.filterEditData(req.body);

        // Use updateOne to update specific fields of the user document
        userModel.updateOne({ "user": req.session.username }, { $set: newData })
            .then(result => {
                // Handle successful update
                console.log("Update successful:", result);

                if (newData.user !== undefined) req.session.username = newData.user;
                if (newData.picture !== undefined) req.session.picture = newData.picture.replace('public/', '');

                resp.json({message: 'Profile updated successfully!', user: req.session.username });
            })
            .catch(err => {
                // Handle error
                console.error("Error updating document:", err);
                resp.json({message: 'Error. That username is already taken.', user: req.session.username });
                return false;
            });

    });

}

module.exports.add = add;