/**
 * miniMeet Server
 * Entry point của ứng dụng - khởi tạo Express, Socket.IO, MongoDB
 * Cấu hình middleware, routes, error handlers
 * Hỗ trợ video conferencing, classroom management, homework, quiz
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

// Khởi tạo Express app và HTTP server
const app = express();
const server = http.createServer(app);

// Khởi tạo Socket.IO cho real-time communication
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Import các routes
const authRoutes = require('./src/routes/authRoutes');
const meetingRoutes = require('./src/routes/meetingRoutes');
const classroomRoutes = require('./src/routes/classroomRoutes');
const homeworkRoutes = require('./src/routes/homeworkRoutes');
const quizRoutes = require('./src/routes/quizRoutes');
const forumRoutes = require('./src/routes/forumRoutes');
const materialRoutes = require('./src/routes/materialRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const pollRoutes = require('./src/routes/pollRoutes');
const breakoutRoutes = require('./src/routes/breakoutRoutes');
const qaRoutes = require('./src/routes/qaRoutes');

// Import socket handler
const socketHandler = require('./src/utils/socketHandler');

// Import homework notification cron
const { startHomeworkNotificationCron } = require('./src/utils/homeworkNotificationCron');

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/minimeet', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log('MongoDB connected');
        // Khởi động cron job cho thông báo homework deadline
        startHomeworkNotificationCron();
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Cấu hình middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session với MongoStore để lưu session vào MongoDB
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/minimeet'
    }),
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Cấu hình EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Serve static files (CSS, JS, images) và uploaded files
app.use(express.static(path.join(__dirname, 'src/public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make io available to routes
app.set('io', io);

// Xử lý Socket.IO connections cho WebRTC signaling và real-time features
io.on('connection', (socket) => {
    socketHandler(io, socket);
});

// Routes
app.use('/auth', authRoutes);
app.use('/api', pollRoutes);
app.use('/api', breakoutRoutes);
app.use('/api', qaRoutes);
app.use('/meeting', meetingRoutes);
app.use('/classroom', classroomRoutes);
app.use('/homework', homeworkRoutes);
app.use('/quiz', quizRoutes);
app.use('/forum', forumRoutes);
app.use('/material', materialRoutes);
app.use('/notification', notificationRoutes);

// Home route
app.get('/', (req, res) => {
    res.redirect('/auth/login');
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);

    // Check if this is an API request
    if (req.path.startsWith('/api')) {
        return res.status(err.status || 500).json({
            error: err.message || 'Internal Server Error'
        });
    }

    res.status(err.status || 500).render('error', {
        error: err.message || 'Internal Server Error',
        user: req.user || null
    });
});

// 404 Not Found handler
app.use((req, res) => {
    // Check if this is an API request
    if (req.path.startsWith('/api')) {
        return res.status(404).json({
            error: 'API endpoint not found'
        });
    }

    res.status(404).render('error', {
        error: 'Page not found',
        user: req.user || null
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };

