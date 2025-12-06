const userModel = require('../models/User');
const reviewModel = require('../models/Review');
const likeModel = require('../models/Like');
const userFunctions = require('../models/userFunctions');
const { ObjectId } = require('mongodb');

// saving uploaded image
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Define storage for uploaded files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/client-uploaded-files'); // Set destination folder
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Use original filename
    }
});

const upload = multer({ storage: storage }); // Store uploaded files in the 'uploads' directory

function add(server) {
    server.post('/delete-review', async function (req, resp, next) {
        const condoId = req.body.condoId;
        const reviewId = req.body.reviewId;

        try {
            console.log('Review to be Deleted: ' + reviewId);

            const review = await reviewModel.findById(reviewId);
            if (!review) {
                return resp.status(404).send({ deleted: 0, message: 'Review not found' });
            }

            const reviewTitle = review.title;
            const reviewAuthor = review.author;
            console.log('Title of deleted review: ' + reviewTitle);
            console.log('ID of author: ' + reviewAuthor);

            const author = await userModel.findById(reviewAuthor);
            if (author) {
                const compareId = new ObjectId(reviewId);
                const listOfReviews = [];

                console.log('Name of author: ' + author.user);
                console.log('Old list');
                for (const item of author.reviews) {
                    console.log(item);
                    if (!compareId.equals(item)) {
                        listOfReviews.push(item);
                    }
                }

                console.log('new list');
                for (const newItem of listOfReviews) {
                    console.log(newItem);
                }

                author.reviews = listOfReviews;
                await author.save();
            }

            await likeModel.deleteMany({ reviewId: reviewId });
            await reviewModel.deleteMany({ _id: reviewId });
            await userFunctions.updateAverageRating(condoId);

            console.log('deleted');
            resp.send({ deleted: 1 });
        } catch (err) {
            console.error('Error deleting review:', err);
            err.status = 500;
            next(err);
        }
    });

    server.post('/search-review', async function (req, resp, next) {
        const text = req.body.text;
        const condoId = req.body.condoId;

        if (text && text.length > 500) {
            return resp.status(400).send({ message: 'Search text too long! (max 500 characters)' });
        }

        let listOfReviews = [];

        const searchQuery = { condoId: condoId };

        try {
            let reviews = await reviewModel.find(searchQuery).populate('author comments.user').lean();
            let content;
            let title;
            for (const item of reviews) {
                content = item.content.toUpperCase();
                title = item.title.toUpperCase();

                if (content.includes(text) || title.includes(text)) {
                    listOfReviews.push(item);
                }
            }

            reviews = await userFunctions.processReviews(listOfReviews, req.session._id);
            resp.send({ reviews: reviews });
        } catch (err) {
            console.error('Error searching reviews:', err);
            err.status = 500;
            next(err);
        }
    });

    server.patch('/create-review', async (req, resp, next) => {
        const { condoId, title, content, rating, image, date } = req.body;

        if (!title || !content || !rating || rating === 0) {
            return resp.status(400).send({ message: 'Please fill in the title, content, and select a star rating.' });
        }
        if (title.length > 100) {
            return resp.status(400).send({ message: 'Title too long! (max 100 characters)' });
        }
        if (content.length > 500) {
            return resp.status(400).send({ message: 'Content too long! (max 500 characters)' });
        }

        try {
            await userFunctions.createReview(condoId, title, content, rating, image, date, req.session.username);
            await userFunctions.updateAverageRating(condoId);
            resp
                .status(200)
                .send({
                    success: true,
                    message: 'Review published successfully',
                    user: req.session.username,
                    role: req.session.role,
                    icon: req.session.picture
                });
        } catch (err) {
            console.error('Error creating review:', err);
            err.status = 500;
            next(err);
        }
    });

    // create comment POST
    server.post('/create-comment', async (req, resp, next) => {
        try {
            const content = req.body.content;
            if (!content) {
                return resp.status(400).send({ message: 'Please put a comment first.' });
            }
            if (content.length > 500) {
                return resp.status(400).send({ message: 'Comment too long! (max 500 characters)' });
            }

            const [createSuccess, createStatus, createMessage] =
                await userFunctions.createComment(req.session._id, content, req.body.date, req.body.reviewId);

            resp.status(createStatus).send({ success: createSuccess, message: createMessage, user: req.session });
        } catch (err) {
            console.error('Error creating comment:', err);
            err.status = 500;
            next(err);
        }
    });

    server.post('/upload-image', upload.single('image'), (req, res, next) => {
        // Get the temporary file path of the uploaded image
        const tempFilePath = req.file && req.file.path;

        try {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                const destinationPath = path.join(__dirname, '..', 'public', 'images', 'client-uploaded-files', req.file.originalname);
                // Move the uploaded file to the destination path
                fs.rename(tempFilePath, destinationPath, err => {
                    if (err) {
                        console.error('Error saving image:', err);
                        err.status = 500;
                        return next(err);
                    } else {
                        console.log('Image saved successfully');
                        return res.status(200).send('Image uploaded successfully');
                    }
                });
            } else {
                return res.status(400).send('Uploaded file not found');
            }
        } catch (err) {
            console.error('Error handling uploaded image:', err);
            err.status = 500;
            next(err);
        }
    });

    server.get('/edit-review/:id', async (req, resp, next) => {
        try {
            const reviewId = req.params.id;
            const review = await reviewModel.findOne({ _id: reviewId }).lean();
            if (!review) {
                return resp.status(404).send({ message: 'Review not found' });
            }
            resp.send({ review: review });
        } catch (error) {
            console.error('Error fetching review:', error);
            error.status = 500;
            next(error);
        }
    });

    server.patch('/update-review/:id', async (req, resp, next) => {
        try {
            const reviewId = req.params.id;
            const { title, content, rating } = req.body;

            if (!title || !content || !rating || rating === 0) {
                return resp.status(400).send({ message: 'Please fill in the title, content, and select a star rating.' });
            }
            if (title.length > 100) {
                return resp.status(400).send({ message: 'Title too long! (max 100 characters)' });
            }
            if (content.length > 500) {
                return resp.status(400).send({ message: 'Content too long! (max 500 characters)' });
            }

            const result = await reviewModel.findByIdAndUpdate(reviewId, req.body);
            if (result && result.condoId) {
                await userFunctions.updateAverageRating(result.condoId);
            }
            resp.status(200).send({ username: req.session.username });
        } catch (error) {
            console.error('Error updating review:', error);
            error.status = 500;
            next(error);
        }
    });

    server.patch('/update-comment/:id', async (req, resp, next) => {
        try {
            const commentId = req.params.id;
            const reviews = await reviewModel.find();
            const { content, date, isEdited } = req.body;

            if (!content) {
                return resp.status(400).send({ message: 'Please fill in the content.' });
            }
            if (content.length > 500) {
                return resp.status(400).send({ message: 'Content too long! (max 500 characters)' });
            }

            let updated = false;

            for (const review of reviews) {
                const index = review.comments.findIndex(comment => comment._id == commentId);

                if (index !== -1) {
                    review.comments[index].content = content;
                    review.comments[index].date = date;
                    review.comments[index].isEdited = isEdited;
                    await review.save();
                    updated = true;
                    break;
                }
            }

            if (!updated) {
                return resp.status(404).send('Comment not found');
            }

            resp.status(200).send({ username: req.session.username });
        } catch (error) {
            console.error('Error updating comment:', error);
            error.status = 500;
            next(error);
        }
    });

    server.post('/delete-comment', async (req, resp, next) => {
        try {
            const commentId = req.body.commentId;
            const reviews = await reviewModel.find();

            let deleted = false;

            for (const review of reviews) {
                const index = review.comments.findIndex(comment => comment._id == commentId);
                if (index !== -1) {
                    review.comments.splice(index, 1);
                    await review.save();
                    deleted = true;
                    break;
                }
            }

            if (!deleted) {
                return resp.status(404).send({ deleted: 0, message: 'Comment not found' });
            }

            resp.send({ deleted: 1 });
        } catch (error) {
            console.error('Error deleting comment:', error);
            error.status = 500;
            next(error);
        }
    });

    server.post('/like', async (req, resp, next) => {
        let { reviewId, isClicked, isLike } = req.body;
        const userId = req.session._id;

        try {
            // Find the review by ID
            const review = await reviewModel.findById(reviewId);
            if (!review) {
                return resp.status(404).send({ success: false, message: 'Review not found' });
            }

            isLike = (isLike === "true");

            if (isClicked === "true") {
                await likeModel.findOneAndDelete({ userId: userId, reviewId: reviewId });
                isLike ? review.likes-- : review.dislikes--;
            } else {
                const like = likeModel({
                    reviewId: reviewId,
                    userId: userId,
                    isLike: isLike
                });

                await like.save();
                isLike ? review.likes++ : review.dislikes++;
            }

            // Save the updated review
            await review.save();

            resp.status(200).send({ success: true, totalLikes: review.likes - review.dislikes });
        } catch (error) {
            console.error("Error creating liking:", error);
            error.status = 500;
            next(error);
        }
    });
}

module.exports.add = add;
