// controllers/routeAdmin.js

const userModel = require('../models/User');
const loginAttemptModel = require('../models/LoginAttempt');
const securityLogModel = require('../models/SecurityLog');
const userFunctions = require('../models/userFunctions');
const auth = require('../middleware/auth');
const condoModel = require('../models/Condo');
const ownerCondoModel = require('../models/OwnerCondo');

const ALLOWED_ROLES = ['Admin', 'Owner', 'Condo Bro'];

// Middleware: only allow Admins
// Replaced by auth.isAuthorized(['Admin'])

function add(server) {
    // 2.4.3: Admin dashboard main page (view only for Admin)
    server.get('/admin', auth.isAuthorized(['Admin']), async (req, res, next) => {
        try {
            const [totalUsers, adminCount, ownerCount, condos] = await Promise.all([
                userModel.countDocuments({}),
                userModel.countDocuments({ role: 'Admin' }),
                userModel.countDocuments({ role: 'Owner' }),
                condoModel.find().lean()
            ]);

            const clientCount = totalUsers - adminCount - ownerCount;

            res.render('adminDashboard', {
                layout: 'index',
                title: 'Admin Dashboard',
                isAdminDashboard: true,
                stats: {
                    totalUsers,
                    adminCount,
                    ownerCount,
                    clientCount
                },
                condos: condos
            });
        } catch (err) {
            console.error('Error loading admin dashboard:', err);
            err.status = 500;
            next(err);
        }
    });

    // --- USER MANAGEMENT ---

    server.get('/admin/users', auth.isAuthorized(['Admin']), async (req, res, next) => {
        try {
            const { role, search } = req.query;
            const query = {};

            if (role && ALLOWED_ROLES.includes(role)) {
                query.role = role;
            }
            if (search) {
                const regex = new RegExp(search, 'i');
                query.$or = [
                    { user: regex },
                    { email: regex },
                    { city: regex }
                ];
            }

            const users = await userModel.find(query)
                .select('user email role city education createdAt')
                .sort({ createdAt: -1 })
                .lean();

            res.json({ users });
        } catch (err) {
            console.error('Error fetching users for admin:', err);
            err.status = 500;
            next(err);
        }
    });

    server.post('/admin/users', auth.isAuthorized(['Admin']), async (req, res, next) => {
        try {
            const {
                username,
                password,
                role,
                picture,
                bio,
                securityQn1,
                securityQn2,
                securityAnswer1,
                securityAnswer2,
                condoId
            } = req.body;

            if (!username || !password || !role) {
                if (userFunctions.logValidationFailure) {
                    await userFunctions.logValidationFailure(
                        req.session._id,
                        req.session.username,
                        '/admin/users',
                        'POST',
                        'Missing required fields when creating user via admin.'
                    );
                }
                return res.status(400).json({ success: false, message: 'Error. Invalid details.' });
            }

            if (!ALLOWED_ROLES.includes(role)) {
                if (userFunctions.logValidationFailure) {
                    await userFunctions.logValidationFailure(
                        req.session._id,
                        req.session.username,
                        '/admin/users',
                        'POST',
                        `Invalid role specified: ${role}`
                    );
                }
                return res.status(400).json({ success: false, message: 'Error. Invalid role.' });
            }

            let createSuccess, createStatus, createMessage;
            [createSuccess, createStatus, createMessage] =
                await userFunctions.createAccount(
                    username,
                    password,
                    picture,
                    bio,
                    securityQn1,
                    securityQn2,
                    securityAnswer1,
                    securityAnswer2
                );

            if (!createSuccess) {
                return res.status(createStatus).json({
                    success: false,
                    message: createMessage
                });
            }

            await userModel.updateOne(
                { user: username },
                { $set: { role } }
            );

            // Handle Owner-Condo assignment
            if (role === 'Owner' && condoId) {
                const newUser = await userModel.findOne({ user: username });
                if (newUser) {
                    await ownerCondoModel.create({
                        userId: newUser._id,
                        condoId: condoId
                    });
                }
            }

            try {
                await securityLogModel.create({
                    eventType: 'ADMIN_ACTION',
                    userId: req.session._id,
                    username: req.session.username,
                    route: '/admin/users',
                    method: 'POST',
                    message: `Admin created new user with role ${role}.`,
                    metadata: {
                        targetUsername: username,
                        targetRole: role,
                        assignedCondoId: condoId || null
                    }
                });
            } catch (logErr) {
                console.error('Error logging admin user creation:', logErr);
            }

            return res.status(201).json({
                success: true,
                message: `User ${username} created with role ${role}.`
            });
        } catch (err) {
            console.error('Error creating user via admin:', err);
            err.status = 500;
            next(err);
        }
    });

    server.patch('/admin/users/:id/role', auth.isAuthorized(['Admin']), async (req, res, next) => {
        try {
            const targetUserId = req.params.id;
            const { newRole } = req.body;

            if (!ALLOWED_ROLES.includes(newRole)) {
                if (userFunctions.logValidationFailure) {
                    await userFunctions.logValidationFailure(
                        req.session._id,
                        req.session.username,
                        '/admin/users/:id/role',
                        'PATCH',
                        `Invalid role specified: ${newRole}`
                    );
                }
                return res.status(400).json({ success: false, message: 'Error. Invalid role.' });
            }

            if (String(targetUserId) === String(req.session._id) && newRole !== 'Admin') {
                return res.status(400).json({
                    success: false,
                    message: 'You cannot remove your own Admin role.'
                });
            }

            const user = await userModel.findById(targetUserId);

            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found.' });
            }

            const oldRole = user.role || 'Client';
            user.role = newRole;
            await user.save();

            try {
                await securityLogModel.create({
                    eventType: 'ADMIN_ACTION',
                    userId: req.session._id,
                    username: req.session.username,
                    route: '/admin/users/:id/role',
                    method: 'PATCH',
                    message: `Admin changed user role from ${oldRole} to ${newRole}.`,
                    metadata: {
                        targetUserId: targetUserId,
                        targetUsername: user.user,
                        oldRole,
                        newRole
                    }
                });
            } catch (logErr) {
                console.error('Error logging role change:', logErr);
            }

            res.json({
                success: true,
                message: `User ${user.user}'s role updated from ${oldRole} to ${newRole}.`
            });
        } catch (err) {
            console.error('Error updating user role:', err);
            err.status = 500;
            next(err);
        }
    });

    // --- LOG VIEWING / AUDIT TRAILS ---

    server.get('/admin/logs/security', auth.isAuthorized(['Admin']), async (req, res, next) => {
        try {
            const { eventType, username, route, fromDate, toDate } = req.query;
            const query = {};

            if (eventType) {
                query.eventType = eventType;
            }
            if (username) {
                query.username = username;
            }
            if (route) {
                query.route = route;
            }

            if (fromDate || toDate) {
                query.createdAt = {};
                if (fromDate) {
                    query.createdAt.$gte = new Date(fromDate);
                }
                if (toDate) {
                    query.createdAt.$lte = new Date(toDate);
                }
            }

            const logs = await securityLogModel
                .find(query)
                .sort({ createdAt: -1 })
                .limit(200)
                .lean();

            res.json({ logs });
        } catch (err) {
            console.error('Error fetching security logs:', err);
            err.status = 500;
            next(err);
        }
    });

    server.get('/admin/logs/auth', auth.isAuthorized(['Admin']), async (req, res, next) => {
        try {
            const { username, success } = req.query;
            const query = {};

            if (success === 'true') query.success = true;
            if (success === 'false') query.success = false;

            if (username) {
                const user = await userModel.findOne({ user: username }).select('_id').lean();
                if (user) {
                    query.userId = user._id;
                } else {
                    // no such user -> return empty
                    return res.json({ attempts: [] });
                }
            }

            const attempts = await loginAttemptModel
                .find(query)
                .sort({ loginAt: -1 })
                .limit(200)
                .populate('userId', 'user role')
                .lean();

            res.json({ attempts });
        } catch (err) {
            console.error('Error fetching auth logs:', err);
            err.status = 500;
            next(err);
        }
    });
}

module.exports.add = add;