const Meeting = require('../models/Meeting');

// Create breakout rooms
const createBreakoutRooms = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { numRooms } = req.body;
        const userId = req.user._id;

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        var isHost = meeting.host.toString() === userId.toString();
        const isCoHost = meeting.coHosts.some(ch => ch.toString() === userId.toString());

        if (!isHost && !isCoHost) {
            return res.status(403).json({ error: 'Only host or co-host can create breakout rooms' });
        }

        if (!numRooms || numRooms < 2 || numRooms > 20) {
            return res.status(400).json({ error: 'Number of rooms must be between 2 and 20' });
        }

        const rooms = Array.from({ length: numRooms }, (_, i) => ({
            id: `${meetingId}-breakout-${i + 1}`,
            name: `Room ${i + 1}`,
            participants: []
        }));

        const io = req.app.get('io');
        if (io) {
            io.to(meetingId).emit('breakout-created', { rooms });
        }

        res.status(201).json({
            success: true,
            rooms
        });
    } catch (error) {
        console.error('Error creating breakout rooms:', error);
        res.status(500).json({ error: 'Failed to create breakout rooms' });
    }
};

// Join breakout room
const joinBreakoutRoom = async (req, res) => {
    try {
        const { meetingId, roomId } = req.params;
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

        const io = req.app.get('io');
        if (io) {
            io.to(meetingId).emit('user-joined-breakout', {
                userId,
                roomId
            });
        }

        res.json({
            success: true,
            roomId
        });
    } catch (error) {
        console.error('Error joining breakout room:', error);
        res.status(500).json({ error: 'Failed to join breakout room' });
    }
};

// Leave breakout room
const leaveBreakoutRoom = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const userId = req.user._id;

        const io = req.app.get('io');
        if (io) {
            io.to(meetingId).emit('user-left-breakout', { userId });
        }

        res.json({
            success: true,
            message: 'Left breakout room'
        });
    } catch (error) {
        console.error('Error leaving breakout room:', error);
        res.status(500).json({ error: 'Failed to leave breakout room' });
    }
};

module.exports = {
    createBreakoutRooms,
    joinBreakoutRoom,
    leaveBreakoutRoom
}