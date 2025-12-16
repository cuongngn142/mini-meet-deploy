/**
 * Quiz Controller
 * Quản lý bài kiểm tra trắc nghiệm
 * Xử lý tạo quiz, làm bài, chấm điểm tự động
 */
const Quiz = require('../models/Quiz');

/**
 * Tạo quiz mới
 * Parse câu hỏi từ JSON và lưu vào database, thêm vào lớp
 */
const createQuiz = async (req, res) => {
  try {
    const { title, description, classId, timeLimit, startDate, endDate, questions } = req.body;

    const parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;

    const quiz = await Quiz.create({
      title,
      description,
      class: classId,
      teacher: req.user._id,
      timeLimit: parseInt(timeLimit),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      questions: parsedQuestions
    });

    // Add quiz to class
    const Class = require('../models/Class');
    await Class.findByIdAndUpdate(classId, {
      $push: { quizzes: quiz._id }
    });

    res.redirect(`/quiz/${quiz._id}`);
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

const getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('class', 'name code')
      .populate('teacher', 'name email')
      .populate('attempts.student', 'name email');

    if (!quiz) {
      return res.render('error', {
        error: 'Quiz not found',
        user: req.user
      });
    }

    const isTeacher = quiz.teacher._id.toString() === req.user._id.toString();
    const attempt = quiz.attempts.find(
      a => a.student._id.toString() === req.user._id.toString()
    );

    res.render('quiz/view', {
      quiz,
      user: req.user,
      isTeacher,
      attempt
    });
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

const listQuizzes = async (req, res) => {
  try {
    let quizzes;
    if (req.user.role === 'teacher') {
      quizzes = await Quiz.find({ teacher: req.user._id })
        .populate('class', 'name')
        .sort({ createdAt: -1 });
    } else {
      quizzes = await Quiz.find({ 'class.students': req.user._id })
        .populate('class', 'name')
        .populate('teacher', 'name')
        .sort({ createdAt: -1 });
    }

    res.render('quiz/list', {
      quizzes,
      user: req.user
    });
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

/**
 * Nộp bài quiz
 * Tự động chấm điểm bằng cách so sánh đáp án với correctAnswer
 */
const submitQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    const existingAttempt = quiz.attempts.find(
      a => a.student.toString() === req.user._id.toString()
    );

    if (existingAttempt) {
      return res.status(400).json({ error: 'You have already submitted this quiz' });
    }

    const { answers, suspiciousActivities } = req.body;

    console.log('=== QUIZ SUBMISSION DEBUG ===');
    console.log('Quiz ID:', req.params.id);
    console.log('Total questions:', quiz.questions.length);
    console.log('Answers received:', JSON.stringify(answers, null, 2));

    let score = 0;
    let totalPoints = 0;
    const debugInfo = [];

    answers.forEach((answer) => {
      // Tìm question theo questionId thay vì dùng index
      const question = quiz.questions.find(q => q._id.toString() === answer.questionId);
      if (!question) {
        console.log('❌ Question not found for ID:', answer.questionId);
        debugInfo.push({ error: 'Question not found', questionId: answer.questionId });
        return;
      }

      totalPoints += question.points;

      console.log('\n--- Question:', question.question);
      console.log('Type:', question.type);
      console.log('Student answer:', answer.answer, '(type:', typeof answer.answer + ')');
      console.log('Correct answer:', question.correctAnswer, '(type:', typeof question.correctAnswer + ')');

      if (question.type === 'multiple-choice' && question.options) {
        console.log('Options:', question.options);
      }

      let isCorrect = false;

      if (question.type === 'multiple-choice') {
        // Với multiple choice, answer là index của option được chọn
        const studentAnswerIndex = parseInt(answer.answer);

        // Kiểm tra nếu correctAnswer là số (index) hay text (option value)
        const correctAnswerNum = parseInt(question.correctAnswer);

        if (!isNaN(correctAnswerNum)) {
          // correctAnswer là index
          console.log('Multiple choice (index) - Student:', studentAnswerIndex, 'Correct:', correctAnswerNum);
          isCorrect = studentAnswerIndex === correctAnswerNum;
        } else {
          // correctAnswer là text - tìm index của text đó trong options
          const correctIndex = question.options.indexOf(question.correctAnswer);
          console.log('Multiple choice (text) - Student index:', studentAnswerIndex, 'Correct text:', question.correctAnswer, 'Correct index:', correctIndex);
          isCorrect = studentAnswerIndex === correctIndex;
        }
      } else if (question.type === 'true-false') {
        // Với true/false, so sánh trực tiếp
        const studentAnswer = String(answer.answer).toLowerCase();
        const correctAnswer = String(question.correctAnswer).toLowerCase();

        console.log('True/False - Student:', studentAnswer, 'Correct:', correctAnswer);

        isCorrect = studentAnswer === correctAnswer;
      } else {
        // Short answer - so sánh string (case insensitive)
        const studentAnswer = String(answer.answer).trim().toLowerCase();
        const correctAnswer = String(question.correctAnswer).trim().toLowerCase();

        console.log('Short answer - Student:', studentAnswer, 'Correct:', correctAnswer);

        isCorrect = studentAnswer === correctAnswer;
      }

      if (isCorrect) {
        score += question.points;
        console.log('✅ CORRECT! Points:', question.points, 'Total score:', score);
        debugInfo.push({ question: question.question, correct: true, points: question.points });
      } else {
        console.log('❌ WRONG!');
        debugInfo.push({
          question: question.question,
          correct: false,
          studentAnswer: answer.answer,
          correctAnswer: question.correctAnswer
        });
      }
    });

    console.log('\n=== FINAL RESULTS ===');
    console.log('Score:', score, '/', totalPoints);
    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
    console.log('========================\n');

    quiz.attempts.push({
      student: req.user._id,
      answers: answers.map(a => ({
        questionId: a.questionId,
        answer: a.answer
      })),
      score,
      suspiciousActivities: suspiciousActivities || []
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
  submitQuiz
}
