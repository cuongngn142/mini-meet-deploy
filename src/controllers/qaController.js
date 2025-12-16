const Question = require('../models/Question');
const Meeting = require('../models/Meeting');

// Ask a question
const askQuestion = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { question } = req.body;
        const userId = req.user._id;

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        const isHost = meeting.host.toString() === userId.toString();
        const isCoHost = meeting.coHosts.some(ch => ch.toString() === userId.toString());
        const isParticipant = meeting.participants.some(p => p.user.toString() === userId.toString());

        if (!isHost && !isCoHost && !isParticipant) {
            return res.status(403).json({ error: 'You are not a participant in this meeting' });
        }

        if (!question || question.trim().length === 0) {
            return res.status(400).json({ error: 'Question cannot be empty' });
        }

        if (question.length > 1000) {
            return res.status(400).json({ error: 'Question is too long (max 1000 characters)' });
        }

        const q = await Question.create({
            meeting: meetingId,
            user: userId,
            question: question.trim()
        });

        await q.populate('user', 'name email');

        const io = req.app.get('io');
        if (io) {
            io.to(meetingId).emit('question-asked', {
                id: q._id,
                user: q.user,
                question: q.question,
                upvotes: [],
                isAnswered: false,
                createdAt: q.createdAt
            });
        }

        res.status(201).json({
            success: true,
            question: {
                id: q._id,
                user: q.user,
                question: q.question,
                upvotes: [],
                isAnswered: false,
                createdAt: q.createdAt
            }
        });
    } catch (error) {
        console.error('Error asking question:', error);
        res.status(500).json({ error: 'Failed to ask question' });
    }
};

// Answer a question
const answerQuestion = async (req, res) => {
    try {
        const { questionId } = req.params;
        const { answer } = req.body;
        const userId = req.user._id;

        const question = await Question.findById(questionId).populate('meeting');
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }

        const meeting = question.meeting;

        const isHost = meeting.host.toString() === userId.toString();
        const isCoHost = meeting.coHosts.some(ch => ch.toString() === userId.toString());

        if (!isHost && !isCoHost) {
            return res.status(403).json({ error: 'Only host or co-host can answer questions' });
        }

        if (!answer || answer.trim().length === 0) {
            return res.status(400).json({ error: 'Answer cannot be empty' });
        }

        if (answer.length > 2000) {
            return res.status(400).json({ error: 'Answer is too long (max 2000 characters)' });
        }

        question.answer = answer.trim();
        question.answeredBy = userId;
        question.answeredAt = new Date();
        question.isAnswered = true;
        await question.save();

        const io = req.app.get('io');
        if (io) {
            io.to(meeting._id.toString()).emit('question-answered', {
                id: question._id,
                answer: question.answer,
                answeredBy: userId,
                answeredAt: question.answeredAt
            });
        }

        res.json({
            success: true,
            question: {
                id: question._id,
                answer: question.answer,
                answeredBy: userId,
                answeredAt: question.answeredAt,
                isAnswered: true
            }
        });
    } catch (error) {
        console.error('Error answering question:', error);
        res.status(500).json({ error: 'Failed to answer question' });
    }
};

// Upvote a question
const upvoteQuestion = async (req, res) => {
    try {
        const { questionId } = req.params;
        const userId = req.user._id;

        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }

        const hasUpvoted = question.upvotes.some(id => id.toString() === userId.toString());

        if (hasUpvoted) {
            question.upvotes = question.upvotes.filter(id => id.toString() !== userId.toString());
        } else {
            question.upvotes.push(userId);
        }

        await question.save();

        const io = req.app.get('io');
        if (io) {
            const meeting = await Meeting.findById(question.meeting);
            if (meeting) {
                io.to(meeting._id.toString()).emit('question-upvoted', {
                    id: question._id,
                    upvotes: question.upvotes.length
                });
            }
        }

        res.json({
            success: true,
            upvotes: question.upvotes.length,
            hasUpvoted: !hasUpvoted
        });
    } catch (error) {
        console.error('Error upvoting question:', error);
        res.status(500).json({ error: 'Failed to upvote question' });
    }
};

// Get all questions for a meeting
const getQuestions = async (req, res) => {
    try {
        const { meetingId } = req.params;

        const questions = await Question.find({ meeting: meetingId })
            .populate('user', 'name email')
            .populate('answeredBy', 'name email')
            .sort({ upvotes: -1, createdAt: -1 });

        res.json({
            success: true,
            questions: questions.map(q => ({
                id: q._id,
                user: q.user,
                question: q.question,
                answer: q.answer,
                answeredBy: q.answeredBy,
                answeredAt: q.answeredAt,
                upvotes: q.upvotes.length,
                isAnswered: q.isAnswered,
                createdAt: q.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
};

module.exports = {
    askQuestion,
    answerQuestion,
    upvoteQuestion,
    getQuestions
}
