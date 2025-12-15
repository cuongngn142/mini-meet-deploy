# miniMeet - Full-Stack Meeting & Learning Management System

Ứng dụng Node.js toàn diện kết hợp video conferencing (phong cách Google Meet) và hệ thống quản lý học tập (LMS) được xây dựng với Express.js, MongoDB, Socket.io, và WebRTC.

## Tính năng chính

### 🎥 Meeting Features (Phong cách Google Meet)
- ✅ Tạo meeting với mã và link unique
- ✅ Tham gia bằng link hoặc mã meeting
- ✅ Hệ thống phân quyền Host/Co-host
- ✅ Khóa meeting
- ✅ Phê duyệt/từ chối người tham gia
- ✅ Video/audio call qua WebRTC
- ✅ Bật/tắt camera và microphone
- ✅ Chuyển đổi thiết bị audio/video
- ✅ Điều chỉnh chất lượng video
- ✅ Screen sharing (chia sẻ màn hình)
  - Hỗ trợ share toàn màn hình, cửa sổ, tab trình duyệt
  - Layout tự động chuyển đổi (main video + sidebar thumbnails)
  - Tự động dừng screen share khi mở whiteboard
- ✅ Video Grid Layout theo thuật toán Google Meet
  - Tự động tính toán số cột/hàng tối ưu
  - Responsive và adaptive
- ✅ Whiteboard collaboration (bảng trắng)
  - Chỉ Host/Co-host được vẽ
  - Real-time sync qua Socket.IO
  - Pen, eraser tools với color picker
- ✅ Chat real-time (Socket.io)
- ✅ Giơ tay (raise hand)
- ✅ Emoji reactions
- ✅ Polls (giáo viên tạo thăm dò ý kiến)
- ✅ Q&A module (hỏi đáp trong meeting)
- ✅ Host có thể tắt camera/mic người khác
- ✅ Host có thể tắt chat, screen share
- ✅ Attendance tracking (điểm danh tự động)
- ✅ Preview modal (kiểm tra camera/mic trước khi join)
- ✅ Live captions (phụ đề trực tiếp)
- ✅ Virtual background (nền ảo - chưa implement đầy đủ)

### 📚 Learning Management System Features
- ✅ **Quản lý lớp học (Classroom)**
  - Tạo lớp với mã lớp unique
  - Học sinh tham gia bằng mã lớp
  - Quản lý danh sách học sinh
  - Gán giáo viên phụ trách
  
- ✅ **Tài liệu học tập (Materials)**
  - Upload PDF, PPT, video, documents (max 100MB)
  - Xem và download tài liệu
  - Tự động phân loại file theo mimetype
  
- ✅ **Bài tập về nhà (Homework)**
  - Giáo viên tạo đề bài và đính kèm file
  - Học sinh nộp bài (upload file)
  - Giáo viên chấm điểm và nhận xét
  - Tracking trạng thái nộp bài
  
- ✅ **Hệ thống Quiz**
  - Tạo quiz với multiple choice, true/false
  - Tự động chấm điểm (hỗ trợ cả index và text answer)
  - Giới hạn thời gian làm bài
  - Hiển thị kết quả ngay lập tức
  
- ✅ **Diễn đàn thảo luận (Forum)**
  - Tạo thread và bình luận
  - Filter theo lớp/bài học
  - Like/unlike posts
  
- ✅ **Thông báo (Notifications)**
  - Thông báo homework sắp đến hạn (6 mốc: 24h, 1h, 30min, 10min, 5min, 1min)
  - Thông báo homework quá hạn
  - Cron job chạy mỗi phút để kiểm tra
  - Badge hiển thị số thông báo chưa đọc
  - Đánh dấu đã đọc/chưa đọc
  
- ✅ **AI Placeholders** (sẵn sàng tích hợp AI)
  - Tự động tóm tắt bài học
  - Tự động tạo quiz từ nội dung
  - Tự động chấm và đánh giá bài tập
  - Tạo summary meeting với action items

## Tech Stack

### Backend
- **Framework**: Node.js với Express.js
- **Database**: MongoDB với Mongoose ODM
- **Real-time Communication**: Socket.io
- **Video/Audio**: WebRTC (peer-to-peer)
- **Authentication**: JWT (lưu trong cookie)
- **Session Management**: express-session với MongoStore
- **File Upload**: Multer
- **File Storage**: Local filesystem (uploads/) + MongoDB GridFS (sẵn sàng)

### Frontend
- **Template Engine**: EJS (Server-Side Rendering)
- **UI Framework**: Bootstrap 5
- **Icons**: Bootstrap Icons
- **Client JavaScript**: Vanilla JS (ES6+)
- **WebRTC**: Native browser APIs
- **Canvas API**: Whiteboard drawing

### Dependencies chính
```json
{
  "express": "^4.18.2",
  "ejs": "^3.1.9",
  "mongoose": "^7.5.0",
  "socket.io": "^4.6.1",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3",
  "cookie-parser": "^1.4.6",
  "express-validator": "^7.0.1",
  "multer": "^1.4.5-lts.1",
  "gridfs-stream": "^1.1.1",
  "method-override": "^3.0.0",
  "dotenv": "^16.3.1",
  "express-session": "^1.17.3",
  "connect-mongo": "^5.1.0",
  "uuid": "^9.0.0"
}
```

## Project Structure

```
miniMeet/
├── server.js                 # Main server file
├── package.json              # Dependencies
├── .env.example             # Environment variables template
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.js      # MongoDB connection
│   │   └── gridfs.js        # GridFS setup (sẵn sàng sử dụng)
│   ├── controllers/         # Route controllers
│   │   ├── authController.js
│   │   ├── meetingController.js
│   │   ├── classroomController.js
│   │   ├── homeworkController.js
│   │   ├── quizController.js
│   │   ├── forumController.js
│   │   ├── materialController.js
│   │   ├── notificationController.js
│   │   ├── pollController.js
│   │   └── qaController.js
│   ├── middleware/          # Custom middleware
│   │   ├── auth.js          # Authentication middleware
│   │   └── roleCheck.js     # Role-based access control
│   ├── models/              # Mongoose models
│   │   ├── User.js
│   │   ├── Meeting.js
│   │   ├── Class.js
│   │   ├── Homework.js
│   │   ├── Quiz.js
│   │   ├── Material.js
│   │   ├── Chat.js
│   │   ├── Poll.js
│   │   ├── Attendance.js
│   │   ├── Forum.js
│   │   ├── Notification.js
│   │   └── Question.js
│   ├── routes/              # Express routes
│   │   ├── authRoutes.js
│   │   ├── meetingRoutes.js
│   │   ├── classroomRoutes.js
│   │   ├── homeworkRoutes.js
│   │   ├── quizRoutes.js
│   │   ├── forumRoutes.js
│   │   ├── materialRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── pollRoutes.js       # API routes cho polls
│   │   └── qaRoutes.js         # API routes cho Q&A
│   ├── utils/               # Utility functions
│   │   ├── socketHandler.js           # Socket.io event handlers
│   │   ├── generateToken.js           # JWT token generation
│   │   ├── generateMeetingCode.js     # Random meeting code/link
│   │   ├── antiCheat.js               # Anti-cheat utilities cho quiz
│   │   ├── aiPlaceholders.js          # AI placeholder functions
│   │   └── homeworkNotificationCron.js # Cron job kiểm tra deadline homework
│   ├── views/               # EJS templates
│   │   ├── layout.ejs       # Main layout
│   │   ├── partials/       # Partial templates
│   │   ├── auth/           # Authentication views
│   │   ├── meeting/        # Meeting views
│   │   ├── classroom/      # Classroom views
│   │   ├── homework/       # Homework views
│   │   ├── quiz/           # Quiz views
│   │   ├── forum/          # Forum views
│   │   └── material/       # Material views
│   └── public/             # Static files
│       ├── css/            # Stylesheets
│       │   ├── style.css   # Global styles
│       │   └── meeting.css # Meeting room styles
│       └── js/             # Client-side JavaScript
│           ├── meeting.js        # Meeting logic (video, WebRTC, whiteboard)
│           ├── webrtc.js         # WebRTC utility functions
│           ├── polls.js          # Poll UI và logic
│           ├── qa.js             # Q&A UI và logic
│           ├── captions.js       # Live captions
│           ├── virtualBackground.js # Virtual background (placeholder)
│           └── videoLayoutManager.js # Video layout manager (không dùng)
└── uploads/                # Uploaded files directory
    ├── homework/           # Homework submissions
    └── materials/          # Learning materials
```

## Cài đặt & Chạy ứng dụng

### Yêu cầu hệ thống
- Node.js (v14 trở lên)
- MongoDB (v4.4 trở lên)
- npm hoặc yarn
- Trình duyệt hỗ trợ WebRTC (Chrome, Firefox, Edge, Safari)

### Bước 1: Clone và cài đặt dependencies

```bash
# Di chuyển vào thư mục project
cd miniMeet

# Cài đặt dependencies
npm install
```

### Bước 2: Cấu hình Environment Variables

Tạo file `.env` trong thư mục root:

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/minimeet
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d
SESSION_SECRET=your-session-secret-key-change-this
```

### Bước 3: Khởi động MongoDB

Đảm bảo MongoDB đang chạy:

```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
# hoặc
mongod
```

### Bước 4: Chạy ứng dụng

```bash
# Development mode (với nodemon auto-reload)
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại `http://localhost:3000`

Server sẽ chạy tại `http://localhost:3000`

## Hướng dẫn sử dụng

### 1. Đăng ký / Đăng nhập
- Truy cập `/auth/register` để tạo tài khoản
- Chọn vai trò: Student (Học sinh), Teacher (Giáo viên), hoặc Admin
- Đăng nhập tại `/auth/login`

### 2. Tạo Meeting
- Click "New Meeting" từ trang meetings
- Nhập tiêu đề và mô tả meeting
- Tùy chọn: Yêu cầu phê duyệt cho người tham gia
- Chia sẻ mã meeting hoặc link với người khác

### 3. Tham gia Meeting
- Nhập mã meeting tại trang join
- Hoặc click vào link meeting trực tiếp
- Kiểm tra camera/mic trong preview modal
- Đợi phê duyệt nếu meeting yêu cầu

### 4. Quản lý lớp học
- **Giáo viên**:
  - Tạo lớp học mới
  - Chia sẻ mã lớp với học sinh
  - Upload tài liệu, tạo homework, quiz
  - Quản lý học sinh trong lớp
- **Học sinh**:
  - Tham gia lớp bằng mã lớp
  - Xem tài liệu, nộp homework
  - Làm quiz và xem điểm

### 5. Tính năng trong Meeting
- **Video/Audio Controls**: Bật/tắt camera và microphone
- **Screen Share**: Chia sẻ màn hình với mọi người
- **Whiteboard**: Host/Co-host vẽ trên bảng trắng (real-time)
- **Chat**: Nhắn tin real-time với mọi người
- **Raise Hand**: Giơ tay để thu hút sự chú ý
- **Polls**: Host tạo thăm dò ý kiến
- **Q&A**: Đặt câu hỏi và trả lời trong meeting
- **Live Captions**: Phụ đề trực tiếp

### 6. Thông báo Homework
- Thông báo tự động được gửi ở các mốc: 24h, 1h, 30min, 10min, 5min, 1min trước deadline
- Thông báo khi homework quá hạn
- Badge hiển thị số thông báo chưa đọc trên navbar
- Click vào thông báo để đánh dấu đã đọc

## API Routes

### Authentication Routes
- `GET /auth/login` - Trang đăng nhập
- `GET /auth/register` - Trang đăng ký
- `POST /auth/login` - Xử lý đăng nhập
- `POST /auth/register` - Xử lý đăng ký
- `GET /auth/logout` - Đăng xuất
- `GET /auth/forgot-password` - Trang quên mật khẩu

### Meeting Routes
- `GET /meeting` - Danh sách meetings
- `GET /meeting/create` - Form tạo meeting
- `POST /meeting/create` - Tạo meeting mới
- `GET /meeting/join` - Form join meeting
- `POST /meeting/join` - Join bằng mã
- `GET /meeting/:id` - Vào phòng meeting
- `GET /meeting/link/:link` - Join bằng link
- `POST /meeting/:id/lock` - Khóa/mở khóa meeting
- `POST /meeting/:id/approve` - Phê duyệt participant
- `POST /meeting/:id/deny` - Từ chối participant
- `POST /meeting/:id/end` - Kết thúc meeting

### Classroom Routes
- `GET /classroom` - Danh sách lớp học
- `GET /classroom/create` - Form tạo lớp
- `POST /classroom/create` - Tạo lớp mới
- `GET /classroom/join` - Form join lớp
- `POST /classroom/join` - Join bằng mã lớp
- `GET /classroom/:id` - Xem chi tiết lớp
- `POST /classroom/:id/add-student` - Thêm học sinh
- `POST /classroom/:id/remove-student` - Xóa học sinh

### Homework Routes
- `GET /homework` - Danh sách homework
- `GET /homework/create` - Form tạo homework
- `POST /homework/create` - Tạo homework mới
- `GET /homework/:id` - Xem chi tiết homework
- `POST /homework/:id/submit` - Nộp bài (học sinh)
- `POST /homework/:id/grade` - Chấm điểm (giáo viên)

### Quiz Routes
- `GET /quiz` - Danh sách quizzes
- `GET /quiz/create` - Form tạo quiz
- `POST /quiz/create` - Tạo quiz mới
- `GET /quiz/:id` - Làm bài/xem quiz
- `POST /quiz/:id/submit` - Nộp bài quiz

### Material Routes
- `GET /material` - Danh sách tài liệu
- `GET /material/create` - Form upload tài liệu
- `POST /material/create` - Upload tài liệu
- `GET /material/:id` - Xem tài liệu
- `GET /material/:id/download` - Download tài liệu

### Forum Routes
- `GET /forum` - Danh sách bài viết
- `GET /forum/create` - Form tạo bài viết
- `POST /forum/create` - Tạo bài viết mới
- `GET /forum/:id` - Xem bài viết
- `POST /forum/:id/comment` - Thêm bình luận
- `POST /forum/:id/like` - Like/unlike bài viết

### API Routes (JSON responses)
- `POST /api/meeting/:meetingId/poll` - Tạo poll
- `POST /api/poll/:pollId/vote` - Vote poll
- `GET /api/meeting/:meetingId/polls` - Lấy danh sách polls
- `POST /api/meeting/:meetingId/question` - Đặt câu hỏi
- `POST /api/question/:questionId/answer` - Trả lời câu hỏi
- `POST /api/question/:questionId/upvote` - Upvote câu hỏi

### Notification Routes
- `GET /notification` - Danh sách thông báo
- `POST /notification/:id/read` - Đánh dấu đã đọc
- `POST /notification/read-all` - Đánh dấu tất cả đã đọc

## Socket.IO Events

### Client → Server Events
- `join-meeting` - Tham gia meeting room
- `leave-meeting` - Rời meeting
- `offer` - WebRTC offer (signaling)
- `answer` - WebRTC answer (signaling)
- `ice-candidate` - ICE candidate (WebRTC)
- `toggle-camera` - Bật/tắt camera
- `toggle-microphone` - Bật/tắt microphone
- `start-screen-share` - Bắt đầu chia sẻ màn hình
- `stop-screen-share` - Dừng chia sẻ màn hình
- `chat-message` - Gửi tin nhắn chat
- `raise-hand` - Giơ tay
- `lower-hand` - Ha tay
- `emoji-reaction` - Gửi emoji reaction
- `whiteboard-draw` - Vẽ trên whiteboard
- `whiteboard-clear` - Xóa whiteboard
- `whiteboard-undo` - Undo stroke
- `create-poll` - Tạo poll (API)
- `vote-poll` - Vote poll (API)
- `ask-question` - Đặt câu hỏi (API)
- `answer-question` - Trả lời câu hỏi (API)
- `upvote-question` - Upvote câu hỏi
- `caption-text` - Gửi phụ đề (live captions)

### Server → Client Events
- `user-joined` - User tham gia meeting
- `user-left` - User rời meeting
- `participants-list` - Danh sách participants hiện tại
- `offer` - WebRTC offer từ peer khác
- `answer` - WebRTC answer từ peer khác
- `ice-candidate` - ICE candidate từ peer khác
- `camera-toggled` - Camera được bật/tắt
- `microphone-toggled` - Microphone được bật/tắt
- `screen-share-started` - Screen share bắt đầu
- `screen-share-stopped` - Screen share dừng
- `chat-message` - Tin nhắn chat mới
- `hand-raised` - Ai đó giơ tay
- `hand-lowered` - Ai đó ha tay
- `emoji-reaction` - Emoji reaction mới
- `whiteboard-state` - Trạng thái whiteboard ban đầu
- `whiteboard-draw` - Stroke mới trên whiteboard
- `whiteboard-clear` - Whiteboard bị xóa
- `whiteboard-undo` - Stroke bị undo
- `poll-created` - Poll mới được tạo
- `poll-updated` - Poll được cập nhật
- `question-asked` - Câu hỏi mới
- `question-answered` - Câu hỏi được trả lời
- `user-muted` - User bị tắt mic
- `co-host-added` - User được thêm làm co-host
- `co-host-removed` - User bị xóa khỏi co-host
- `participant-removed` - Participant bị kick
- `meeting-ended` - Meeting kết thúc
- `chat-disabled` / `chat-enabled` - Chat bị tắt/bật
- `screen-share-disabled` / `screen-share-enabled` - Screen share bị tắt/bật
- `caption-text` - Phụ đề mới (live captions)

## Phân quyền (Role-Based Access Control)

### Admin
- Toàn quyền truy cập tất cả chức năng
- Quản lý tất cả lớp học, meetings, users

### Teacher (Giáo viên)
- Tạo và quản lý lớp học
- Tạo meetings, homework, quizzes
- Chấm điểm homework và quizzes
- Upload tài liệu học tập
- Làm host/co-host trong meetings
- Kiểm duyệt bài viết forum

### Student (Học sinh)
- Tham gia lớp học và meetings
- Nộp homework
- Làm quizzes
- Xem tài liệu
- Tham gia forum thảo luận
- Đặt câu hỏi trong Q&A

- Đặt câu hỏi trong Q&A

## Database Models

Tất cả models sử dụng Mongoose. Các models chính:

- **User**: Thông tin người dùng, authentication, role
- **Class**: Lớp học với teacher, students, materials, homeworks, quizzes, meetings
- **Meeting**: Meeting session với host, participants, settings, whiteboard state
- **Homework**: Bài tập với đề bài, submissions, grading
- **Quiz**: Quiz với questions, attempts, auto-grading (hỗ trợ cả correctAnswer dạng index và text)
- **Material**: Tài liệu học tập với file metadata
- **Chat**: Tin nhắn chat trong meeting
- **Poll**: Polls trong meeting với options và votes
- **Question**: Q&A questions với answers và upvotes
- **Attendance**: Điểm danh tự động trong meetings
- **Forum**: Bài viết thảo luận với comments và likes
- **Notification**: Thông báo cho users (homework deadline, overdue, etc.)

## Development

### Thêm tính năng mới

1. Tạo model trong `src/models/`
2. Tạo controller trong `src/controllers/`
3. Tạo routes trong `src/routes/`
4. Tạo views trong `src/views/`
5. Thêm client-side JS nếu cần trong `src/public/js/`
6. Thêm Socket.IO events trong `src/utils/socketHandler.js` nếu cần real-time

### Code Structure Guidelines

- **Controllers**: Xử lý business logic, không nên có HTML
- **Views**: EJS templates, sử dụng partials để tái sử dụng
- **Routes**: Chỉ định tuyến, gọi controllers
- **Models**: Mongoose schemas với validation
- **Middleware**: Authentication, authorization, error handling
- **Utils**: Helper functions, Socket.IO handlers
- **Public**: Static assets, client-side JavaScript

### Coding Conventions

- Tất cả code đã được comment bằng tiếng Việt
- Function names dùng camelCase
- Model names dùng PascalCase
- Route paths dùng kebab-case
- Async/await cho tất cả database operations
- Try-catch error handling
- JWT authentication qua cookies
- Socket.IO events dùng kebab-case

- Socket.IO events dùng kebab-case

## Troubleshooting

### Lỗi kết nối MongoDB
- Đảm bảo MongoDB đang chạy
- Kiểm tra `MONGODB_URI` trong `.env`
- Verify MongoDB port (mặc định: 27017)
- Kiểm tra MongoDB logs

### WebRTC không hoạt động
- Đảm bảo dùng HTTPS trong production (hoặc localhost cho development)
- Kiểm tra quyền truy cập camera/microphone trong browser
- Verify STUN server configuration
- Kiểm tra firewall settings

### Socket.IO connection issues
- Kiểm tra server đang chạy
- Verify Socket.IO client script được load
- Kiểm tra browser console có errors không
- Kiểm tra CORS settings

### Video grid không hiển thị đúng
- Kiểm tra CSS Grid support trong browser
- Verify video tracks được add vào peer connection
- Kiểm tra console logs cho WebRTC errors

### File upload không hoạt động
- Kiểm tra thư mục `uploads/` có quyền write
- Verify Multer configuration
- Kiểm tra file size limits (homework: unlimited, materials: 100MB)
- Đảm bảo static file serving cho `/uploads` được cấu hình

### Quiz không lưu vào database
- Kiểm tra questionCount bắt đầu từ 0 (không phải 1)
- Verify JSON parsing của questions array
- Kiểm tra Class.findByIdAndUpdate có push quiz._id không

### Quiz chấm điểm sai
- Kiểm tra correctAnswer trong database (text hay index)
- Nếu teacher nhập text (như "a", "Option 1"), hệ thống tự động convert sang index
- Student answer luôn là index (0, 1, 2...)

### Thông báo không xuất hiện
- Kiểm tra cron job đã chạy chưa (xem server logs)
- Verify homework có dueDate đúng format
- Kiểm tra students có trong class không

## Production Deployment

### Checklist

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Dùng production MongoDB instance (MongoDB Atlas)
   - Set secure JWT và session secrets (random strings)
   - Configure CORS properly

2. **Security**
   - Enable HTTPS (required cho WebRTC)
   - Set secure cookies (`secure: true`)
   - Use helmet.js cho security headers
   - Rate limiting cho API endpoints

3. **Performance**
   - Use process manager (PM2)
   - Set up reverse proxy (Nginx)
   - Enable gzip compression
   - Configure MongoDB indexes

4. **Monitoring**
   - Set up logging (winston, morgan)
   - Monitor server resources
   - Track WebRTC connection quality
   - Database performance monitoring

### PM2 Deployment

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name minimeet

# Enable auto-restart on system reboot
pm2 startup
pm2 save

# Monitor logs
pm2 logs minimeet
```

### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

}
```

## Known Issues & Limitations

- Video grid layout không dùng `VideoLayoutManager` class, sử dụng CSS Grid thuần với thuật toán Google Meet
- Quiz tự động chấm điểm với logic phức tạp (hỗ trợ cả correctAnswer dạng text và index)
- AI placeholders chỉ là mock functions, cần tích hợp API thực (OpenAI, Claude, etc.)
- GridFS đã setup nhưng hiện tại dùng local filesystem cho file storage
- Meeting recording chưa được implement (placeholder only)
- Virtual background chỉ có placeholder, chưa implement đầy đủ
- Anti-cheat module cho quiz đã có nhưng chưa được tích hợp vào quiz view
- Breakout rooms đã bị xóa do vấn đề WebRTC phức tạp

## Future Enhancements

- [ ] Tích hợp OpenAI/Claude API cho AI features
- [ ] Implement meeting recording với MediaRecorder API
- [ ] Background blur/virtual background đầy đủ với TensorFlow.js
- [ ] Push notifications với Service Workers
- [ ] Mobile responsive improvements
- [ ] Dark mode theme
- [ ] Export homework/quiz reports to PDF
- [ ] Calendar integration
- [ ] Email notifications
- [ ] Advanced analytics dashboard
- [ ] Re-implement breakout rooms với WebRTC architecture tốt hơn
- [ ] Tích hợp anti-cheat vào quiz view
- [ ] Live translation cho captions

## License

ISC

## Support

Để báo lỗi hoặc đặt câu hỏi, vui lòng mở issue trên repository.

## Contributors

Project được phát triển như một learning management system với video conferencing capabilities.

---

**Được xây dựng với ❤️ sử dụng Node.js, Express.js, MongoDB, Socket.io, và WebRTC**

