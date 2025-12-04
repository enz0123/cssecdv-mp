const userModel = require('../models/User');
const reviewModel = require('../models/Review');
const likeModel = require('../models/Like');
const condoModel = require('../models/Condo');
const passwordModel = require('../models/Password');
const loginModel = require('./LoginAttempt');
const blockedUserModel = require('./blockedUser');
const securityQuestionModel = require('./SecurityQuestion');

// can be added to hash the password for confidentiality
const bcrypt = require('bcrypt'); 
const saltRounds = 10;

const securityQuestionsObj = {
    1: "What was the name of your first pet?",
    2: "What street did you grow up on?",
    3: "What was your childhood nickname?",
    4: "What was your first concert?",
    5: "What was the first movie you saw in a theatre?",
    6: "What was the first car you rode in?"
};

async function isUserBlocked(userId){
    try {
        const blockedEntry = await blockedUserModel.findOne({userId: userId, validDate: { $gt: new Date() }});
        if(blockedEntry){
            const minutesLeft = Math.ceil((blockedEntry.validDate - new Date()) / (60 * 1000));
            return {blocked: true, minutesLeft: minutesLeft};
        }

        return {blocked: false, minutesLeft: null}
    } catch(error){
        console.error('Error checking blocked user status:', error);
        return false;
    }
}

async function getSecurityQuestions(userId){
    try{   
        if(userId){
            const securityQuestions = await securityQuestionModel.findOne({userId: userId})

            return {securityQn1: securityQuestionsObj[securityQuestions.securityQuestion1], securityQn2: securityQuestionsObj[securityQuestions.securityQuestion2]}
        } else {
            return {securityQn1: securityQuestionsObj[1], securityQn2: securityQuestionsObj[2]}
        }
    } catch (error) {
        console.log('Error occurred fetching security questions. ' + error)
    }
}

async function recordLoginAttempt(userId, success){
    try {
        const loginAttempt = loginModel({
            userId: userId,
            success: success
        });

        await loginAttempt.save();

        //Check if max attempts reached within 15 minutes, block user if necessary
        if(!success){
            var fifteenMinutesAgo = new Date(Date.now() - 15*60*1000);
            var loginAttempts = await loginModel.find({
                userId: userId,
                success: false,
                loginAt: { $gte: fifteenMinutesAgo }
            });
            if(loginAttempts.length >= 5){
                var validDate = new Date(Date.now() + 15*60*1000);
                const blockedUser = blockedUserModel({
                    userId: userId,
                    validDate: validDate
                });
                await blockedUser.save();
            }
        }
    } catch (error){
        console.error('Error recording login attempt:', error);
    }
}

async function updateAverageRating(condoId){
    let total = 0;
    let averageRating;
    console.log('condoId: ' + condoId);
    reviewModel.find({condoId: condoId}).then(function(condos){
        if(condos.length !== 0){
            console.log('defined');
            console.log('length of reviews: ' + condos.length);
            for(const item of condos){
                total += item.rating;
                console.log('Total: ' + total);
            }

            averageRating = parseFloat(total/condos.length).toFixed(1);
            console.log('Average rating: ' + averageRating);
            console.log('Type of average: ' + typeof averageRating);          
        } else {
            console.log('no reviews found');
            averageRating = 0;
        } 

        condoModel.findOne({id: condoId}).then(function(condo){
            condo.rating = averageRating;
            condo.save();
        });  

    });
}

async function addPasswordToHistory(username, newPassword){
    try{
        const user = await userModel.findOne({user: username})
        if(!user) return [404, 'User not found', null];

        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        const passwordEntry = passwordModel({
            userId: user._id,
            password: hashedPassword,
            changedAt: new Date()
        });

        await passwordEntry.save();
        return [200, 'Password added to history', null];
    } catch (error){
        console.error('Error adding password to history:', error);
        return[500, 'Internal Server Error', null];
    }
}

async function changePassword(username, newPassword){
    try{
        const user = await userModel.findOne({user: username})
        if(!user) {
            console.log("1")
            return [404, 'User not found', null];
        }

        const history = await passwordModel.find({userId: user._id}).sort({changedAt: -1});

        //return if latest date is 1 day earlier, return if password is same as before
        if(history.length > 0){
            const latestPassword = history[0];

            if((new Date() - latestPassword.changedAt) < 24*60*60*1000){
                console.log("2")
                return [400, 'Error. Password was changed less than 24 hours ago', user];
            }

            for(const entry of history){
                const isSame = await bcrypt.compare(newPassword, entry.password);
                if(isSame){
                    return [400, 'Error. New password cannot be the same as any of the previous passwords', user];
                }
            }
        }

        
        
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        user.pass = hashedPassword;
        await user.save();
        await addPasswordToHistory(username, newPassword);

        return [200, 'Password changed successfully', user];
    }catch(error){
        console.error('Error changing password:', error);
        return[500, 'Internal Server Error', null];
    }
}

async function getLastLoginAttempt(userId){
    try{
        const lastLoginAttempt = await loginModel.findOne({userId: userId}).sort({loginAt: -1})

        if(lastLoginAttempt){
            const date = lastLoginAttempt.loginAt
            const datePart = date.toLocaleDateString("en-PH", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "long",
            day: "numeric"
            });

            const timePart = date.toLocaleTimeString("en-PH", {
            timeZone: "Asia/Manila",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
            });

            var status

            if(lastLoginAttempt.success){
                status = 'Successful'
            } else {
                status = 'Failed'
            }

            // Combine them
            const readable = `Last login attempt: ${datePart} at ${timePart} (${status})`;

            console.log(readable);
            return readable
        }

        return "Last login attempt N/A"
    } catch (error) {
        console.log("Error trying to get last login attempt.")
    }
}

async function findUser(username, password){
    
    try {
        // Find user by username
        
        const user = await userModel.findOne({ user: username });
        if (!user) {
            return [401, 'Invalid Username or Password', null];
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, user.pass);

        if (!passwordMatch) {
            return [401, 'Invalid Username or Password', user];
        }

        // Authentication successful
        console.log('User password match:', username);
        return [200, 'Login successful. \n', user];
        //res.status(200).json({ message: 'Login successful', user: user });
    } catch (error) {
        console.error('Error during login:', error);
        return [500, 'Internal Server Error', null];
        //res.status(500).json({ message: 'Internal server error' });
    }
}

async function resetPassword(userId){
    try{
        const hashedPassword = await bcrypt.hash("#Dummy123", saltRounds);
        const user = await userModel.findOne({_id: userId})

        user.pass = hashedPassword;
        await user.save();
        console.log("User's password was reset successfully.");
        
    } catch(error){
        console.log("Error setting to dummy password. " + error)
    }
}

async function checkSecurityQuestions(userId, answer1, answer2){
    try{
        const securityQuestions = await securityQuestionModel.findOne({userId: userId})

        if(securityQuestions.securityAnswer1 != answer1 || securityQuestions.securityAnswer2 != answer2)
            return [401, "Error. Invalid details."]

        return [200, "Password reset success. Please use #Dummy123 as your password in your next login."]

    } catch(error){
        console.log("Error in checkSecurityQuestions " + error)
    }
}

async function addSecurityQuestions(userId, securityQn1, securityQn2, securityAnswer1, securityAnswer2){
    try{
        const securityQuestion = securityQuestionModel({
                userId: userId,
                securityQuestion1: securityQn1,
                securityQuestion2: securityQn2,
                securityAnswer1: securityAnswer1,
                securityAnswer2: securityAnswer2
            })

        await securityQuestion.save()
        return
    } catch (error){
        console.log("Error saving security questions.")
    }



}

async function createAccount(username, password, picture, bio, securityQn1, securityQn2, securityAnswer1, securityAnswer2) {
    // encrypt password
    let encryptedPass = "";

    await new Promise((resolve, reject) => {
        bcrypt.hash(password, saltRounds, function(err, hash) { 
            encryptedPass = hash;
            resolve(); // Resolve the promise when hashing is complete
        });
    });

    const user = userModel({
        user: username,
        pass: encryptedPass,
        picture: picture,
        email: "none",
        role: "Condo Bro",
        school: "not specified",
        city: "not specified",
        bio: bio
        });
        
        return user.save().then(async function(login) {
            console.log('Account created');

            const newUser = await userModel.findOne({user: username})

            await addSecurityQuestions(newUser._id, securityQn1, securityQn2, securityAnswer1, securityAnswer2)
            
            await addPasswordToHistory(username, password);
            return [true, 200, 'Account created successfully'];
           // resp.status(200).send({ success: true, message: 'Account created successfully' });
        }).catch(function(error) {
            // Check if the error indicates a duplicate key violation
            if (error.code === 11000 && error.name === 'MongoServerError') {
                console.error('Duplicate key error:', error.keyPattern);
                // Handle duplicate key error
                return [false, 500, 'Username already exists. Error creating account.'];
                //resp.status(500).send({ success: false, message: 'Username already exists. Error creating account.' });
                
            } else {
                console.error('Error creating account:', error);

                return [false, 500, 'Error creating account'];
                //resp.status(500).send({ success: false, message: 'Error creating account' });
            }
        });
}

async function createComment(userId, content, date, reviewId) {
    try {
        // Find the review by ID
        const review = await reviewModel.findById(reviewId);
        // Add the new comment at the beginning of the comments array
        review.comments.unshift({ content, date, user: userId });

        // Save the updated review
        await review.save();

        return [true, 200, 'Comment was published!'];
    } catch (error) {
        console.error("Error creating comment:", error);
        throw error; // Throw the error for handling elsewhere
    }
}

function filterEditData(userData){
    const { name, email, bio, education, city, imagePath } = userData;
    // Filter out null values
    const newData = {};
    if (name !== undefined) newData.user = name;
    if (email !== undefined) newData.email = email;
    if (bio !== undefined) newData.bio = bio;
    if (education !== undefined) newData.education = education;
    if (city !== undefined) newData.city = city;
    if (imagePath !== null && imagePath !== undefined) newData.picture = imagePath;

    return newData;
}

async function createReview(condoId, title, content, rating, image, date, logUsername){
    // Find the user by username
    const user = await userModel.findOne( {user: logUsername} );

    // Create a review
    const newReview = reviewModel({
        title: title,
        content: content,
        rating: rating,
        image: image,
        date: date,
        condoId: condoId,
        likes: 0,
        dislikes: 0,
        author: user._id // Set the author field to the ObjectId of the user
    });
    
    // Save the new review instance to the database
    const savedReview = await newReview.save();

    // If needed, you can access the _id of the saved review document
    const savedReviewId = savedReview._id;

    // Update the user's reviews array
    user.reviews.push(savedReviewId);

    // Save the user to the database
    await user.save();
}

async function processReviews(reviews, userId){
    if (reviews) {
        // Preprocess date field
        processedReviews = await Promise.all(reviews.map(async review => {
            // Create a new object to avoid mutating the original object
            const processedReview = { ...review };

            // Format date without time component
            processedReview.date = review.date.toLocaleDateString(); // Assuming date is a JavaScript Date object

            // Format dates of comments
            processedReview.comments = review.comments.map(comment => {
                const processedComment = { ...comment };
                processedComment.date = comment.date.toLocaleDateString();
                return processedComment;
            });

            // Transform the integer rating into an array of boolean values representing filled stars
            processedReview.rating = Array.from({ length: 5 }, (_, index) => index < review.rating);

            processedReview.totalLikes = processedReview.likes - processedReview.dislikes;

            const like = await likeModel.findOne({ reviewId: review._id, userId: userId }).lean();
            
            if (like) 
                processedReview.userLike = like;

            return processedReview;
        }));

        return processedReviews;
    }

    return reviews;
}

module.exports.processReviews = processReviews;
module.exports.findUser = findUser;
module.exports.createAccount = createAccount;
module.exports.filterEditData = filterEditData;
module.exports.createReview = createReview;
module.exports.createComment = createComment;
module.exports.updateAverageRating = updateAverageRating;
module.exports.changePassword = changePassword;
module.exports.addPasswordToHistory = addPasswordToHistory;
module.exports.recordLoginAttempt = recordLoginAttempt;
module.exports.isUserBlocked = isUserBlocked;
module.exports.getLastLoginAttempt = getLastLoginAttempt;
module.exports.getSecurityQuestions = getSecurityQuestions;
module.exports.checkSecurityQuestions = checkSecurityQuestions;
module.exports.resetPassword = resetPassword;