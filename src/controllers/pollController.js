const Poll = require('../models/Poll');
const Meeting = require('../models/Meeting');

// Create a new poll
const createPoll = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { question, options } = req.body;
        const userId = req.user._id;

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        const isHost = meeting.host.toString() === userId.toString();
        const isCoHost = meeting.coHosts.some(ch => ch.toString() === userId.toString());

        if (!isHost && !isCoHost) {
            return res.status(403).json({ error: 'Only host or co-host can create polls' });
        }

        const poll = await Poll.create({
            meeting: meetingId,
            createdBy: userId,
            question,
            options: options.map(opt => ({ text: opt, votes: [] }))
        });

        const io = req.app.get('io');
        if (io) {
            const pollData = {
                id: poll._id,
                question: poll.question,
                options: poll.options,
                isActive: poll.isActive
            };
            console.log('Emitting poll-created to room:', meetingId, pollData);
            io.to(meetingId).emit('poll-created', pollData);
        }

        res.status(201).json({
            success: true,
            poll: {
                id: poll._id,
                question: poll.question,
                options: poll.options
            }
        });
    } catch (error) {
        console.error('Error creating poll:', error);
        res.status(500).json({ error: 'Failed to create poll' });
    }
};

// Vote on a poll
const votePoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const { optionIndex } = req.body;
        const userId = req.user._id;

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ error: 'Poll not found' });
        }

        if (!poll.isActive) {
            return res.status(400).json({ error: 'Poll is no longer active' });
        }

        poll.options.forEach(opt => {
            opt.votes = opt.votes.filter(v => v.toString() !== userId.toString());
        });

        if (poll.options[optionIndex]) {
            poll.options[optionIndex].votes.push(userId);
        } else {
            return res.status(400).json({ error: 'Invalid option index' });
        }

        await poll.save();

        console.log('Vote saved for poll:', poll._id, 'Option:', optionIndex, 'User:', userId);

        const io = req.app.get('io');
        if (io) {
            const meeting = await Meeting.findById(poll.meeting);
            if (meeting) {
                const updateData = {
                    id: poll._id,
                    question: poll.question,
                    options: poll.options,
                    isActive: poll.isActive
                };
                console.log('Emitting poll-updated to room:', meeting._id.toString(), updateData);
                io.to(meeting._id.toString()).emit('poll-updated', updateData);
            }
        }

        res.json({
            success: true,
            poll: {
                id: poll._id,
                options: poll.options
            }
        });
    } catch (error) {
        console.error('Error voting on poll:', error);
        res.status(500).json({ error: 'Failed to vote on poll' });
    }
};

// Get all polls for a meeting
const getPolls = async (req, res) => {
    try {
        const { meetingId } = req.params;

        const polls = await Poll.find({ meeting: meetingId })
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            polls: polls.map(poll => ({
                id: poll._id,
                question: poll.question,
                options: poll.options,
                isActive: poll.isActive,
                createdBy: poll.createdBy,
                createdAt: poll.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching polls:', error);
        res.status(500).json({ error: 'Failed to fetch polls' });
    }
};

// End a poll
const endPoll = async (req, res) => {
    try {
        const { pollId } = req.params;
        const userId = req.user._id;

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ error: 'Poll not found' });
        }

        const meeting = await Meeting.findById(poll.meeting);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        const isHost = meeting.host.toString() === userId.toString();
        const isCoHost = meeting.coHosts.some(ch => ch.toString() === userId.toString());

        if (!isHost && !isCoHost) {
            return res.status(403).json({ error: 'Only host or co-host can end polls' });
        }

        poll.isActive = false;
        await poll.save();

        const io = req.app.get('io');
        if (io) {
            io.to(poll.meeting.toString()).emit('poll-ended', { id: poll._id });
        }

        res.json({
            success: true,
            poll: {
                id: poll._id,
                isActive: poll.isActive
            }
        });
    } catch (error) {
        console.error('Error ending poll:', error);
        res.status(500).json({ error: 'Failed to end poll' });
    }
};

module.exports = {
    createPoll,
    votePoll,
    getPolls,
    endPoll
}
