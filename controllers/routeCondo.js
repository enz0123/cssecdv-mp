const condoModel = require('../models/Condo');
const reviewModel = require('../models/Review');
const userFunctions = require('../models/userFunctions');
const ownerCondoModel = require('../models/OwnerCondo');
const auth = require('../middleware/auth');

function add(server) {
    server.post('/filter-condo', async function (req, resp) {
        const rating = Number(req.body.rating);
        const listOfCondos = [];

        if (Number.isNaN(rating) || rating < 1 || rating > 5) {
            await userFunctions.logValidationFailure(
                req.session ? req.session._id : null,
                req.session ? req.session.username : null,
                '/filter-condo',
                'POST',
                `Invalid rating filter value: ${req.body.rating}`
            );
            return resp.status(400).json({ message: 'Error. Invalid filter value.' });
        }

        const searchQuery = { rating: { $gte: rating } };

        try {
            const condos = await condoModel.find(searchQuery);

            for (const item of condos) {
                item.description = item.description.slice(0, 150) + "...";
                listOfCondos.push(item);
            }

            resp.send({ condos: listOfCondos });
        } catch (err) {
            console.error('Error filtering condos:', err);
            err.status = 500;
            next(err);
        }
    });

    server.post('/search-condo', async (req, resp, next) => {
        try {
            const text = req.body.text;
            const listOfCondos = [];

            const condos = await condoModel.find();

            let condoName;
            let condoText;
            let condoAddress;

            for (const item of condos) {
                condoName = item.name.toUpperCase();
                condoText = item.description.toUpperCase();
                condoAddress = item.address.toUpperCase();

                if (condoName.includes(text) || condoText.includes(text) || condoAddress.includes(text)) {
                    item.description = item.description.slice(0, 150) + '...';
                    listOfCondos.push(item);
                }
            }

            resp.send({ condos: listOfCondos });
        } catch (err) {
            console.error('Error searching condos:', err);
            err.status = 500;
            next(err);
        }
    });

    // get condo from the db GET
    server.get('/condo/:condoId', async (req, resp, next) => {
        const condoId = req.params.condoId; // Retrieve the condo ID from the URL
        const formattedCondoId = condoId.replace('-', ' ').toUpperCase(); // Format the condo ID

        try {
            // Query MongoDB to get data
            const data = await condoModel.findOne({ id: condoId }).lean();

            // Find all reviews for the specified condo
            const reviews = await reviewModel
                .find({ condoId: condoId })
                .populate('author comments.user')
                .lean();

            const processedReviews = await userFunctions.processReviews(reviews, req.session._id);

            // Check if current user is the owner of this condo
            let isOwner = false;
            if (req.session.role === 'Owner') {
                const ownership = await ownerCondoModel.findOne({
                    userId: req.session._id,
                    condoId: condoId
                });
                if (ownership) {
                    isOwner = true;
                }
            }

            resp.render('condo', {
                layout: 'index',
                title: formattedCondoId,
                data: data,
                reviews: processedReviews.reverse(),
                isCondo: true,
                isOwner: isOwner
            });
        } catch (err) {
            // Handle errors
            console.error('Error fetching data from MongoDB', err);
            err.status = 500;
            next(err);
        }
    });

    server.patch('/update-condo/:id', auth.isAuthenticated('update-condo'), async (req, resp, next) => {
        try {
            const condoId = req.params.id;
            const { name, description } = req.body;

            // Verify ownership
            const ownership = await ownerCondoModel.findOne({
                userId: req.session._id,
                condoId: condoId
            });

            if (!ownership) {
                await userFunctions.logAccessControlFailure(
                    req.session ? req.session._id : null,
                    req.session ? req.session.username : null,
                    '/update-condo',
                    'PATCH',
                    'Unauthenticated user attempted to update a condo they do not own.'
                );
                return resp.status(403).json({ message: 'Unauthorized. You do not own this condo.' });
            }

            if (!name || !description) {
                return resp.status(400).json({ message: 'Name and description are required.' });
            }

            if (name.length > 100) {
                return resp.status(400).json({ message: 'Name cannot exceed 100 characters.' });
            }

            if (description.length > 1000) {
                return resp.status(400).json({ message: 'Description cannot exceed 1000 characters.' });
            }

            const updatedCondo = await condoModel.findOneAndUpdate(
                { id: condoId },
                { name, description },
                { new: true }
            );

            if (!updatedCondo) {
                return resp.status(404).json({ message: 'Condo not found.' });
            }

            resp.json({
                success: true,
                message: 'Condo updated successfully.',
                condo: updatedCondo
            });
        } catch (err) {
            console.error('Error updating condo:', err);
            err.status = 500;
            next(err);
        }
    });
}

module.exports.add = add;