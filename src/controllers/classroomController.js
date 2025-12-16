/**
 * Classroom Controller
 * Quản lý lớp học: tạo, tham gia, xem danh sách
 * Quản lý học sinh trong lớp
 */
const Class = require('../models/Class');
const User = require('../models/User');
const { generateMeetingCode } = require('../utils/generateMeetingCode');

/**
 * Tạo lớp học mới
 * Tự động generate mã lớp unique và thêm giáo viên vào lớp
 */
const createClass = async (req, res) => {
  try {
    const { name, description } = req.body;

    let code = generateMeetingCode();
    while (await Class.findOne({ code })) {
      code = generateMeetingCode();
    }

    const newClass = await Class.create({
      name,
      description,
      teacher: req.user._id,
      code
    });

    await User.findByIdAndUpdate(req.user._id, {
      $push: { classes: newClass._id }
    });

    res.redirect(`/classroom/${newClass._id}`);
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

/**
 * Tham gia lớp học bằng mã lớp
 * Kiểm tra mã lớp và thêm học sinh vào danh sách
 */
const joinClass = async (req, res) => {
  try {
    const { code } = req.body;
    const classRoom = await Class.findOne({ code: code.toUpperCase() });

    if (!classRoom) {
      return res.render('classroom/join', {
        error: 'Class not found',
        user: req.user
      });
    }

    if (classRoom.students.includes(req.user._id)) {
      return res.redirect(`/classroom/${classRoom._id}`);
    }

    classRoom.students.push(req.user._id);
    await classRoom.save();

    await User.findByIdAndUpdate(req.user._id, {
      $push: { classes: classRoom._id }
    });

    res.redirect(`/classroom/${classRoom._id}`);
  } catch (error) {
    res.render('classroom/join', {
      error: error.message,
      user: req.user
    });
  }
};

/**
 * Xem chi tiết lớp học
 * Hiển thị thông tin lớp, học sinh, tài liệu, bài tập, quiz, meeting
 */
const getClass = async (req, res) => {
  try {
    const classRoom = await Class.findById(req.params.id)
      .populate('teacher', 'name email')
      .populate('students', 'name email avatar')
      .populate('materials')
      .populate('homeworks')
      .populate('quizzes')
      .populate({
        path: 'meetings',
        populate: { path: 'host', select: 'name email' },
        options: { sort: { createdAt: -1 } }
      });

    if (!classRoom) {
      return res.render('error', {
        error: 'Class not found',
        user: req.user
      });
    }

    const isTeacher = classRoom.teacher._id.toString() === req.user._id.toString();
    const isStudent = classRoom.students.some(s => s._id.toString() === req.user._id.toString());

    if (!isTeacher && !isStudent && req.user.role !== 'admin') {
      return res.render('error', {
        error: 'Access denied',
        user: req.user
      });
    }

    res.render('classroom/view', {
      classRoom,
      user: req.user,
      isTeacher,
      isStudent
    });
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

const getAllClasses = async (req, res, user) => {
  try {
    let classes = [];
    if (req.user.role = 'admin') {
      classes = await Class.find()
        .populate('teacher', 'name email')
        .populate('students', 'name email')
    }
    else if (req.user.role === 'teacher') {
      classes = await Class.find({ teacher: req.user._id })
        .populate('teacher', 'name email')
        .populate('students', 'name email');
    }
    else if (req.user.role === 'student') {
      classes = await Class.find({ students: req.user._id })
        .populate('teacher', 'name email');
    }
    else {
      return res.render("error", {
        error: "Role không hợp lệ!",
        user: req.user
      });
    }
  } catch (err) {
    console.log(err);
  }
}

const listClasses = async (req, res) => {
  try {
    let classes;
    if (req.user.role === 'admin') {
      classes = await Class.find().populate('teacher', 'name email');
    } else if (req.user.role === 'teacher') {
      classes = await Class.find({ teacher: req.user._id }).populate('teacher', 'name email');
    } else {
      classes = await Class.find({ students: req.user._id }).populate('teacher', 'name email');
    }

    res.render('classroom/list', {
      classes,
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
  res.render('classroom/join', { error: null, user: req.user });
};

const addStudent = async (req, res) => {
  try {
    const classRoom = await Class.findById(req.params.id);
    if (classRoom.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { studentId } = req.body;
    if (!classRoom.students.includes(studentId)) {
      classRoom.students.push(studentId);
      await classRoom.save();

      await User.findByIdAndUpdate(studentId, {
        $push: { classes: classRoom._id }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const removeStudent = async (req, res) => {
  try {
    const classRoom = await Class.findById(req.params.id);
    if (classRoom.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { studentId } = req.body;
    classRoom.students = classRoom.students.filter(s => s.toString() !== studentId);
    await classRoom.save();

    await User.findByIdAndUpdate(studentId, {
      $pull: { classes: classRoom._id }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createClass,
  joinClass,
  getClass,
  getAllClasses,
  listClasses,
  showJoin,
  addStudent,
  removeStudent
}
