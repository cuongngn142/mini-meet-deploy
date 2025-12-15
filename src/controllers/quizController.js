const Quiz = require("../models/Quiz");

/**
 * Tạo quiz mới
 * Parse câu hỏi từ JSON và lưu vào database, thêm vào lớp
 */
const createQuiz = async (req, res) => {
  try {
    const {
      title,
      description,
      classId,
      timeLimit,
      startDate,
      endDate,
      questions,
    } = req.body;

    const parsedQuestions =
      typeof questions === "string" ? JSON.parse(questions) : questions;

    const quiz = await Quiz.create({
      title,
      description,
      class: classId,
      teacher: req.user._id,
      timeLimit: parseInt(timeLimit),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      questions: parsedQuestions,
    });

    // Add quiz to class
    const Class = require("../models/Class");
    await Class.findByIdAndUpdate(classId, {
      $push: { quizzes: quiz._id },
    });

    res.redirect(`/quiz/${quiz._id}`);
  } catch (error) {
    res.render("error", {
      error: error.message,
      user: req.user,
    });
  }
};

const getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate("class", "name code")
      .populate("teacher", "name email")
      .populate("attempts.student", "name email");

    if (!quiz) {
      return res.render("error", {
        error: "Quiz not found",
        user: req.user,
      });
    }

    const isTeacher = quiz.teacher._id.toString() === req.user._id.toString();
    const attempt = quiz.attempts.find(
      (a) => a.student._id.toString() === req.user._id.toString()
    );

    res.render("quiz/view", {
      quiz,
      user: req.user,
      isTeacher,
      attempt,
    });
  } catch (error) {
    res.render("error", {
      error: error.message,
      user: req.user,
    });
  }
};

const listQuizzes = async (req, res) => {
  try {
    let quizzes;
    if (req.user.role === "teacher") {
      quizzes = await Quiz.find({ teacher: req.user._id })
        .populate("class", "name")
        .sort({ createdAt: -1 });
    } else {
      quizzes = await Quiz.find({ "class.students": req.user._id })
        .populate("class", "name")
        .populate("teacher", "name")
        .sort({ createdAt: -1 });
    }

    res.render("quiz/list", {
      quizzes,
      user: req.user,
    });
  } catch (error) {
    res.render("error", {
      error: error.message,
      user: req.user,
    });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Kiểm tra học sinh đã nộp chưa
    const existingAttempt = quiz.attempts.find(
      (a) => a.student.toString() === req.user._id.toString()
    );
    if (existingAttempt) {
      return res
        .status(400)
        .json({ error: "You have already submitted this quiz" });
    }

    const { answers, suspiciousActivities } = req.body;

    let score = 0;
    let totalPoints = 0;

    answers.forEach((answer) => {
      const question = quiz.questions.find(
        (q) => q._id.toString() === answer.questionId
      );

      if (!question) return;

      totalPoints += question.points;
      let isCorrect = false;

      switch (question.type) {
        case "multiple-choice": {
          const studentIndex = parseInt(answer.answer);
          const correctAsNumber = parseInt(question.correctAnswer);

          if (!isNaN(correctAsNumber)) {
            // correctAnswer là index
            isCorrect = studentIndex === correctAsNumber;
          } else {
            // correctAnswer là text → tìm index tương ứng
            const correctIndex = question.options.indexOf(
              question.correctAnswer
            );
            isCorrect = studentIndex === correctIndex;
          }
          break;
        }

        case "true-false": {
          const studentAns = String(answer.answer).toLowerCase();
          const correctAns = String(question.correctAnswer).toLowerCase();
          isCorrect = studentAns === correctAns;
          break;
        }

        default: {
          // Short answer
          const studentAns = String(answer.answer).trim().toLowerCase();
          const correctAns = String(question.correctAnswer)
            .trim()
            .toLowerCase();
          isCorrect = studentAns === correctAns;
        }
      }

      if (isCorrect) {
        score += question.points;
      }
    });

    // Lưu kết quả bài làm
    quiz.attempts.push({
      student: req.user._id,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        answer: a.answer,
      })),
      score,
      suspiciousActivities: suspiciousActivities || [],
    });

    await quiz.save();

    res.json({ success: true, score, totalPoints });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createQuiz,
  getQuiz,
  listQuizzes,
  submitQuiz,
};
