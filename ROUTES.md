# API Routes Documentation

## Authentication Routes (`/auth`)

| Method | Route                   | Description               | Auth Required |
| ------ | ----------------------- | ------------------------- | ------------- |
| GET    | `/auth/login`           | Show login page           | No            |
| GET    | `/auth/register`        | Show register page        | No            |
| GET    | `/auth/forgot-password` | Show forgot password page | No            |
| GET    | `/auth/logout`          | Logout user               | Yes           |
| POST   | `/auth/login`           | Login user                | No            |
| POST   | `/auth/register`        | Register new user         | No            |

## Meeting Routes (`/meeting`)

| Method | Route                  | Description              | Auth Required      |
| ------ | ---------------------- | ------------------------ | ------------------ |
| GET    | `/meeting`             | List all meetings        | Yes                |
| GET    | `/meeting/create`      | Show create meeting form | Yes                |
| GET    | `/meeting/join`        | Show join meeting form   | Yes                |
| GET    | `/meeting/:id`         | Join/view meeting room   | Yes                |
| GET    | `/meeting/link/:link`  | Join meeting by link     | Yes                |
| POST   | `/meeting/create`      | Create new meeting       | Yes                |
| POST   | `/meeting/join`        | Join meeting by code     | Yes                |
| POST   | `/meeting/:id/lock`    | Lock/unlock meeting      | Yes (Host)         |
| POST   | `/meeting/:id/approve` | Approve participant      | Yes (Host/Co-host) |
| POST   | `/meeting/:id/deny`    | Deny participant         | Yes (Host/Co-host) |
| POST   | `/meeting/:id/end`     | End meeting              | Yes (Host)         |

## Classroom Routes (`/classroom`)

| Method | Route                           | Description               | Auth Required |
| ------ | ------------------------------- | ------------------------- | ------------- |
| GET    | `/classroom`                    | List all classes          | Yes           |
| GET    | `/classroom/create`             | Show create class form    | Yes (Teacher) |
| GET    | `/classroom/join`               | Show join class form      | Yes           |
| GET    | `/classroom/:id`                | View class details        | Yes           |
| POST   | `/classroom/create`             | Create new class          | Yes (Teacher) |
| POST   | `/classroom/join`               | Join class by code        | Yes           |
| POST   | `/classroom/:id/add-student`    | Add student to class      | Yes (Teacher) |
| POST   | `/classroom/:id/remove-student` | Remove student from class | Yes (Teacher) |

## Homework Routes (`/homework`)

| Method | Route                       | Description               | Auth Required |
| ------ | --------------------------- | ------------------------- | ------------- |
| GET    | `/homework`                 | List all homework         | Yes           |
| GET    | `/homework/create`          | Show create homework form | Yes (Teacher) |
| GET    | `/homework/:id`             | View homework details     | Yes           |
| POST   | `/homework/create`          | Create new homework       | Yes (Teacher) |
| POST   | `/homework/:id/submit`      | Submit homework           | Yes (Student) |
| POST   | `/homework/:id/grade`       | Grade homework            | Yes (Teacher) |
| POST   | `/homework/:id/attachments` | Upload attachments        | Yes (Teacher) |

## Quiz Routes (`/quiz`)

| Method | Route              | Description           | Auth Required |
| ------ | ------------------ | --------------------- | ------------- |
| GET    | `/quiz`            | List all quizzes      | Yes           |
| GET    | `/quiz/create`     | Show create quiz form | Yes (Teacher) |
| GET    | `/quiz/:id`        | View/take quiz        | Yes           |
| POST   | `/quiz/create`     | Create new quiz       | Yes (Teacher) |
| POST   | `/quiz/:id/submit` | Submit quiz           | Yes (Student) |

## Forum Routes (`/forum`)

| Method | Route                | Description           | Auth Required |
| ------ | -------------------- | --------------------- | ------------- |
| GET    | `/forum`             | List all forum posts  | Yes           |
| GET    | `/forum/create`      | Show create post form | Yes           |
| GET    | `/forum/:id`         | View forum post       | Yes           |
| POST   | `/forum/create`      | Create new post       | Yes           |
| POST   | `/forum/:id/comment` | Add comment           | Yes           |
| POST   | `/forum/:id/like`    | Like/unlike post      | Yes           |

## Material Routes (`/material`)

| Method | Route                    | Description               | Auth Required |
| ------ | ------------------------ | ------------------------- | ------------- |
| GET    | `/material`              | List all materials        | Yes           |
| GET    | `/material/create`       | Show upload material form | Yes (Teacher) |
| GET    | `/material/:id`          | View material             | Yes           |
| GET    | `/material/:id/download` | Download material         | Yes           |
| POST   | `/material/create`       | Upload material           | Yes (Teacher) |

## Notification Routes (`/notification`)

| Method | Route                    | Description               | Auth Required |
| ------ | ------------------------ | ------------------------- | ------------- |
| GET    | `/notification`          | Get all notifications     | Yes           |
| POST   | `/notification/:id/read` | Mark notification as read | Yes           |
| POST   | `/notification/read-all` | Mark all as read          | Yes           |

## Socket.io Events

### Client → Server Events

- `join-meeting` - Join a meeting room
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate
- `toggle-camera` - Toggle camera on/off
- `toggle-microphone` - Toggle microphone on/off
- `start-screen-share` - Start screen sharing
- `stop-screen-share` - Stop screen sharing
- `chat-message` - Send chat message
- `raise-hand` - Raise hand
- `lower-hand` - Lower hand
- `emoji-reaction` - Send emoji reaction
- `create-poll` - Create poll (Host/Co-host)
- `vote-poll` - Vote on poll
- `end-poll` - End poll (Host/Co-host)
- `ask-question` - Ask question in Q&A
- `answer-question` - Answer question (Host/Co-host)
- `upvote-question` - Upvote question
- `create-breakout` - Create breakout rooms (Host/Co-host)
- `join-breakout` - Join breakout room
- `leave-breakout` - Leave breakout room
- `mute-user` - Mute user (Host/Co-host)
- `disable-chat` - Disable chat (Host/Co-host)
- `enable-chat` - Enable chat (Host/Co-host)
- `disable-screen-share` - Disable screen share (Host/Co-host)
- `spotlight-user` - Spotlight user (Host/Co-host)
- `leave-meeting` - Leave meeting

### Server → Client Events

- `user-joined` - User joined meeting
- `user-left` - User left meeting
- `offer` - WebRTC offer received
- `answer` - WebRTC answer received
- `ice-candidate` - ICE candidate received
- `camera-toggled` - Camera state changed
- `microphone-toggled` - Microphone state changed
- `screen-share-started` - Screen share started
- `screen-share-stopped` - Screen share stopped
- `chat-message` - New chat message
- `hand-raised` - Hand raised
- `hand-lowered` - Hand lowered
- `emoji-reaction` - Emoji reaction
- `poll-created` - Poll created
- `poll-updated` - Poll votes updated
- `poll-ended` - Poll ended
- `question-asked` - Question asked
- `question-answered` - Question answered
- `question-upvoted` - Question upvoted
- `breakout-created` - Breakout rooms created
- `user-muted` - User muted by host
- `chat-disabled` - Chat disabled
- `chat-enabled` - Chat enabled
- `screen-share-disabled` - Screen share disabled
- `user-spotlighted` - User spotlighted
- `participants-list` - List of participants

