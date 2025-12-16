/**
 * Meeting Controller
 * Quản lý cuộc họp trực tuyến (video conference)
 * Xử lý tạo meeting, tham gia, lock/unlock, approve participants
 */
const Meeting = require('../models/Meeting');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const { generateMeetingCode, generateMeetingLink } = require('../utils/generateMeetingCode');

/**
 * Tạo cuộc họp mới
 * Generate mã meeting và link unique, liên kết với lớp nếu có
 */
const createMeeting = async (req, res) => {
  try {
    const { title, description, classId, requiresApproval } = req.body;

    const meetingCode = generateMeetingCode();
    const meetingLink = generateMeetingLink();

    const meeting = await Meeting.create({
      title: title || 'New Meeting',
      description,
      host: req.user._id,
      meetingCode,
      meetingLink,
      requiresApproval: requiresApproval === 'true',
      class: classId || null
    });

    if (classId) {
      await Class.findByIdAndUpdate(classId, {
        $push: { meetings: meeting._id }
      });
    }

    res.redirect(`/meeting/${meeting._id}`);
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

/**
 * Tham gia meeting bằng mã meeting
 * Kiểm tra mã, trạng thái lock và chuyển hướng vào phòng
 */
const joinByCode = async (req, res) => {
  try {
    const { code } = req.body;
    const meeting = await Meeting.findOne({ meetingCode: code.toUpperCase() });

    if (!meeting) {
      return res.render('meeting/join', {
        error: 'Meeting not found',
        user: req.user
      });
    }

    if (meeting.isLocked && meeting.host.toString() !== req.user._id.toString()) {
      return res.render('meeting/join', {
        error: 'Meeting is locked',
        user: req.user
      });
    }

    res.redirect(`/meeting/${meeting._id}`);
  } catch (error) {
    res.render('meeting/join', {
      error: error.message,
      user: req.user
    });
  }
};

const joinByLink = async (req, res) => {
  try {
    const { link } = req.params;
    const meeting = await Meeting.findOne({ meetingLink: link });

    if (!meeting) {
      return res.render('error', {
        error: 'Meeting not found',
        user: req.user
      });
    }

    if (meeting.isLocked && meeting.host.toString() !== req.user._id.toString()) {
      return res.render('error', {
        error: 'Meeting is locked',
        user: req.user
      });
    }

    res.redirect(`/meeting/${meeting._id}`);
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

/**
 * Vào phòng meeting
 * Kiểm tra quyền truy cập, xử lý approval nếu cần, ghi nhận attendance
 */
const getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('host', 'name email')
      .populate('coHosts', 'name email')
      .populate('participants.user', 'name email avatar');

    if (!meeting) {
      return res.render('error', {
        error: 'Meeting not found',
        user: req.user
      });
    }

    const isHost = meeting.host._id.toString() === req.user._id.toString();
    const isCoHost = meeting.coHosts.some(ch => ch._id.toString() === req.user._id.toString());
    const isParticipant = meeting.participants.some(p => p.user._id.toString() === req.user._id.toString());

    // If meeting requires approval and user is NOT host/co-host
    if (meeting.requiresApproval && !isHost && !isCoHost) {
      // Check if already approved (in participants list)
      const alreadyApproved = meeting.participants.some(p =>
        p.user._id.toString() === req.user._id.toString()
      );

      if (!alreadyApproved) {
        // Add to pending if not already there
        if (!meeting.pendingParticipants.some(p => p.user.toString() === req.user._id.toString())) {
          meeting.pendingParticipants.push({ user: req.user._id });
          await meeting.save();
        }
        return res.render('meeting/pending', {
          meeting,
          user: req.user
        });
      }
    }

    // Add to participants if not already there (for host/co-host or approved users)
    if (!isParticipant && !isHost && !isCoHost) {
      meeting.participants.push({ user: req.user._id });
      await meeting.save();
    }

    await Attendance.create({
      meeting: meeting._id,
      user: req.user._id,
      joinedAt: new Date(),
      class: meeting.class || null
    });

    res.render('meeting/room', {
      meeting,
      user: req.user,
      isHost,
      isCoHost
    });
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

const listMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [
        { host: req.user._id },
        { 'participants.user': req.user._id }
      ],
      isActive: true,
      class: null
    })
      .populate('host', 'name email')
      .sort({ createdAt: -1 });

    res.render('meeting/list', {
      meetings,
      user: req.user
    });
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

const showJoin = (req, res) => {
  res.render('meeting/join', { error: null, user: req.user });
};

/**
 * Khóa/mở khóa meeting (chỉ host mới được)
 */
const lockMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can lock meeting' });
    }

    meeting.isLocked = !meeting.isLocked;
    await meeting.save();

    res.json({ isLocked: meeting.isLocked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const approveParticipant = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (meeting.host.toString() !== req.user._id.toString() &&
      !meeting.coHosts.some(ch => ch.toString() === req.user._id.toString())) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { userId } = req.body;

    // Get user info to emit in socket event
    const User = require('../models/User');
    const user = await User.findById(userId);

    meeting.pendingParticipants = meeting.pendingParticipants.filter(
      p => p.user.toString() !== userId
    );
    meeting.participants.push({ user: userId });
    await meeting.save();

    // Emit socket event to notify all participants
    const io = req.app.get('io');
    io.to(req.params.id).emit('participant-approved', {
      userId,
      user: { _id: user._id, name: user.name, email: user.email }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const denyParticipant = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (meeting.host.toString() !== req.user._id.toString() &&
      !meeting.coHosts.some(ch => ch.toString() === req.user._id.toString())) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { userId } = req.body;

    // Get user info to emit in socket event
    const User = require('../models/User');
    const user = await User.findById(userId);

    meeting.pendingParticipants = meeting.pendingParticipants.filter(
      p => p.user.toString() !== userId
    );
    await meeting.save();

    // Emit socket event to notify the denied user
    const io = req.app.get('io');
    io.to(req.params.id).emit('participant-denied', {
      userId,
      user: { _id: user._id, name: user.name, email: user.email }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Kết thúc cuộc họp
 * Chỉ host mới được end, cập nhật attendance và duration
 */
const endMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can end meeting' });
    }

    meeting.isActive = false;
    meeting.endedAt = new Date();
    await meeting.save();

    const attendances = await Attendance.find({ meeting: meeting._id, leftAt: null });
    for (let att of attendances) {
      att.leftAt = new Date();
      att.duration = Math.floor((att.leftAt - att.joinedAt) / 1000);
      await att.save();
    }

    // Emit socket event to kick everyone out
    const io = req.app.get('io');
    if (io) {
      io.to(meeting._id.toString()).emit('meeting-ended', {
        message: 'The meeting has been ended by the host.'
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createMeeting,
  joinByCode,
  joinByLink,
  getMeeting,
  listMeetings,
  showJoin,
  lockMeeting,
  approveParticipant,
  denyParticipant,
  endMeeting
}
