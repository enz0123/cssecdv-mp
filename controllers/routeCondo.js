const condoModel = require('../models/Condo');
const reviewModel = require('../models/Review');
const userFunctions = require('../models/userFunctions');

function add(server) {
    server.post('/filter-condo', async (req, resp, next) => {
        try {
            const rating = req.body.rating;
            const searchQuery = { rating: { $gte: rating } };
            const listOfCondos = [];

            const condos = await condoModel.find(searchQuery);

            for (const item of condos) {
                // Shorten description for display
                item.description = item.description.slice(0, 150) + '...';
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

            resp.render('condo', {
                layout: 'index',
                title: formattedCondoId,
                data: data,
                reviews: processedReviews.reverse(),
                isCondo: true
            });
        } catch (err) {
            // Handle errors
            console.error('Error fetching data from MongoDB', err);
            err.status = 500;
            next(err);
        }
    });
}

module.exports.add = add;