/**
 * Homework Controller
 * Quản lý bài tập về nhà
 * Xử lý tạo bài tập, nộp bài, chấm điểm và upload file
 */
const Homework = require("../models/Homework");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Class = require("../models/Class");

// Cấu hình Multer để upload file bài tập
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/homework";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/**
 * Tạo bài tập mới
 * Lưu thông tin bài tập và thêm vào lớp học
 */
const createHomework = async (req, res) => {
  try {
    const { title, description, classId, dueDate } = req.body;

    console.log("Creating homework:", {
      title,
      classId,
      teacher: req.user._id,
    });

    const homework = await Homework.create({
      title,
      description,
      class: classId,
      teacher: req.user._id,
      dueDate,
    });

    console.log(
      "Homework created:",
      homework._id,
      "for class:",
      homework.class
    );

    // Thêm homework vào lớp
    await Class.findByIdAndUpdate(classId, {
      $push: { homeworks: homework._id },
    });
    console.log("Homework added to class");

    res.redirect(`/homework/${homework._id}`);
  } catch (error) {
    console.error("Error creating homework:", error);
    res.render("error", {
      error: error.message,
      user: req.user,
    });
  }
};

const uploadAttachment = upload.array("attachments", 10);

const addAttachments = async (req, res) => {
  try {
    const homework = await Homework.findById(req.params.id);
    if (homework.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (req.files) {
      req.files.forEach((file) => {
        homework.attachments.push({
          filename: file.originalname,
          path: file.path,
          mimetype: file.mimetype,
        });
      });
      await homework.save();
    }

    res.redirect(`/homework/${homework._id}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const submitHomework = upload.array("files", 10);

/**
 * Nộp bài tập
 * Học sinh upload file bài làm và thêm vào submissions
 */
const addSubmission = async (req, res) => {
  try {
    const homework = await Homework.findById(req.params.id);
    const existingSubmission = homework.submissions.find(
      (s) => s.student.toString() === req.user._id.toString()
    );

    if (existingSubmission) {
      return res.render("homework/view", {
        error: "You have already submitted this homework",
        homework,
        user: req.user,
      });
    }

    const files = req.files
      ? req.files.map((file) => ({
          filename: file.originalname,
          path: file.path,
          mimetype: file.mimetype,
        }))
      : [];

    homework.submissions.push({
      student: req.user._id,
      files,
    });
    await homework.save();

    res.redirect(`/homework/${homework._id}`);
  } catch (error) {
    res.render("error", {
      error: error.message,
      user: req.user,
    });
  }
};

const getHomework = async (req, res) => {
  try {
    const homework = await Homework.findById(req.params.id)
      .populate("class", "name code")
      .populate("teacher", "name email")
      .populate("submissions.student", "name email");

    if (!homework) {
      return res.render("error", {
        error: "Homework not found",
        user: req.user,
      });
    }

    const isTeacher =
      homework.teacher._id.toString() === req.user._id.toString();
    const submission = homework.submissions.find(
      (s) => s.student._id.toString() === req.user._id.toString()
    );

    res.render("homework/view", {
      homework,
      user: req.user,
      isTeacher,
      submission,
    });
  } catch (error) {
    res.render("error", {
      error: error.message,
      user: req.user,
    });
  }
};

const listHomework = async (req, res) => {
  try {
    let homeworks;
    if (req.user.role === "teacher") {
      homeworks = await Homework.find({ teacher: req.user._id })
        .populate("class", "name")
        .sort({ createdAt: -1 });
      console.log("Teacher homeworks:", homeworks.length);
    } else {
      // Student: find classes they're enrolled in, then find homework for those classes
      const userClasses = await Class.find({ students: req.user._id }).select(
        "_id"
      );
      const classIds = userClasses.map((c) => c._id);

      console.log("Student user ID:", req.user._id);
      console.log("Student enrolled in classes:", classIds);

      homeworks = await Homework.find({ class: { $in: classIds } })
        .populate("class", "name")
        .populate("teacher", "name")
        .sort({ createdAt: -1 });

      console.log("Student homeworks found:", homeworks.length);
      if (homeworks.length > 0) {
        console.log("First homework class:", homeworks[0].class);
      }
    }

    res.render("homework/list", {
      homeworks,
      user: req.user,
    });
  } catch (error) {
    console.error("Error listing homework:", error);
    res.render("error", {
      error: error.message,
      user: req.user,
    });
  }
};

/**
 * Chấm điểm bài tập
 * Giáo viên nhập điểm và nhận xét cho học sinh
 */
const gradeHomework = async (req, res) => {
  try {
    const homework = await Homework.findById(req.params.id);
    if (homework.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { studentId, grade, feedback } = req.body;
    const submission = homework.submissions.find(
      (s) => s.student.toString() === studentId
    );

    if (submission) {
      submission.grade = grade;
      submission.feedback = feedback;
      submission.reviewedAt = new Date();
      await homework.save();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createHomework,
  uploadAttachment,
  addAttachments,
  submitHomework,
  addSubmission,
  getHomework,
  listHomework,
  gradeHomework,
};
