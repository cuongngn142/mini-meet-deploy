/**
 * Homework Notification Cron Job
 * Tự động kiểm tra và gửi thông báo cho homework sắp đến hạn
 * Chạy mỗi giờ để kiểm tra deadline
 */

const Homework = require('../models/Homework');
const Notification = require('../models/Notification');
const Class = require('../models/Class');

/**
 * Kiểm tra homework sắp đến hạn và tạo thông báo
 * Gửi thông báo cho:
 * - 24 giờ trước deadline
 * - 1 giờ trước deadline
 */
async function checkHomeworkDeadlines() {
    try {
        console.log('[Cron] Checking homework deadlines...');

        const now = new Date();

        // Thời điểm 24 giờ từ bây giờ
        const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Thời điểm 1 giờ từ bây giờ
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        // Tìm homework có deadline trong 24 giờ tới và chưa quá hạn
        const upcomingHomework = await Homework.find({
            dueDate: {
                $gt: now,
                $lte: twentyFourHoursLater
            }
        }).populate('class');

        console.log(`[Cron] Found ${upcomingHomework.length} homework(s) with upcoming deadline`);

        for (const hw of upcomingHomework) {
            const timeUntilDeadline = hw.dueDate - now;
            const minutesUntilDeadline = Math.floor(timeUntilDeadline / (1000 * 60));
            const hoursUntilDeadline = Math.floor(timeUntilDeadline / (1000 * 60 * 60));

            // Gửi thông báo 24h trước (23-24h)
            if (hoursUntilDeadline >= 23 && hoursUntilDeadline < 24) {
                await sendHomeworkDeadlineNotification(hw, '24 hours', minutesUntilDeadline);
            }
            // Gửi thông báo 1h trước (58-62 phút)
            else if (minutesUntilDeadline >= 58 && minutesUntilDeadline <= 62) {
                await sendHomeworkDeadlineNotification(hw, '1 hour', minutesUntilDeadline);
            }
            // Gửi thông báo 30 phút trước (29-31 phút)
            else if (minutesUntilDeadline >= 29 && minutesUntilDeadline <= 31) {
                await sendHomeworkDeadlineNotification(hw, '30 minutes', minutesUntilDeadline);
            }
            // Gửi thông báo 10 phút trước (8-12 phút)
            else if (minutesUntilDeadline >= 8 && minutesUntilDeadline <= 12) {
                await sendHomeworkDeadlineNotification(hw, '10 minutes', minutesUntilDeadline);
            }
            // Gửi thông báo 5 phút trước (3-7 phút)
            else if (minutesUntilDeadline >= 3 && minutesUntilDeadline <= 7) {
                await sendHomeworkDeadlineNotification(hw, '5 minutes', minutesUntilDeadline);
            }
            // Gửi thông báo 1 phút trước (0-2 phút)
            else if (minutesUntilDeadline >= 0 && minutesUntilDeadline <= 2) {
                await sendHomeworkDeadlineNotification(hw, '1 minute', minutesUntilDeadline);
            }
        }

        // Tìm homework quá hạn trong 1 giờ qua (vừa mới quá hạn)
        const justOverdueHomework = await Homework.find({
            dueDate: {
                $gte: new Date(now.getTime() - 60 * 60 * 1000),
                $lt: now
            }
        }).populate('class');

        console.log(`[Cron] Found ${justOverdueHomework.length} homework(s) just overdue`);

        for (const hw of justOverdueHomework) {
            await sendHomeworkOverdueNotification(hw);
        }

        console.log('[Cron] Homework deadline check completed');
    } catch (error) {
        console.error('[Cron] Error checking homework deadlines:', error);
    }
}

/**
 * Gửi thông báo deadline sắp tới
 */
async function sendHomeworkDeadlineNotification(homework, timeframe, minutesUntilDeadline) {
    try {
        // Lấy danh sách students trong class
        const classData = await Class.findById(homework.class).populate('students');
        if (!classData) return;

        const students = classData.students;

        for (const student of students) {
            // Kiểm tra xem đã gửi thông báo này chưa (trong vòng 10 phút gần đây)
            const recentNotif = await Notification.findOne({
                user: student._id,
                type: 'homework-deadline',
                relatedId: homework._id,
                title: { $regex: timeframe },
                createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
            });

            if (recentNotif) {
                console.log(`[Cron] Notification already sent recently to ${student._id} for homework ${homework._id}`);
                continue;
            }

            // Tạo thông báo mới
            await Notification.create({
                user: student._id,
                type: 'homework-deadline',
                title: `Homework deadline in ${timeframe}`,
                message: `Your homework "${homework.title}" is due in ${timeframe} (${minutesUntilDeadline} minutes). Class: ${classData.name}`,
                link: `/homework/${homework._id}`,
                relatedId: homework._id
            });

            console.log(`[Cron] Sent ${timeframe} deadline notification to ${student._id} for homework ${homework._id}`);
        }
    } catch (error) {
        console.error('[Cron] Error sending homework deadline notification:', error);
    }
}

/**
 * Gửi thông báo homework đã quá hạn
 */
async function sendHomeworkOverdueNotification(homework) {
    try {
        // Lấy danh sách students trong class
        const classData = await Class.findById(homework.class).populate('students');
        if (!classData) return;

        const students = classData.students;

        for (const student of students) {
            // Kiểm tra xem student đã nộp bài chưa
            const submission = homework.submissions?.find(
                sub => sub.student.toString() === student._id.toString()
            );

            if (submission) {
                console.log(`[Cron] Student ${student._id} already submitted homework ${homework._id}`);
                continue;
            }

            // Kiểm tra xem đã gửi thông báo overdue chưa
            const existingNotif = await Notification.findOne({
                user: student._id,
                type: 'homework-deadline',
                relatedId: homework._id,
                title: { $regex: 'overdue' }
            });

            if (existingNotif) {
                continue;
            }

            // Tạo thông báo overdue
            await Notification.create({
                user: student._id,
                type: 'homework-deadline',
                title: `Homework overdue!`,
                message: `Your homework "${homework.title}" is now overdue. Class: ${classData.name}`,
                link: `/homework/${homework._id}`,
                relatedId: homework._id
            });

            console.log(`[Cron] Sent overdue notification to ${student._id} for homework ${homework._id}`);
        }
    } catch (error) {
        console.error('[Cron] Error sending homework overdue notification:', error);
    }
}

/**
 * Bắt đầu cron job
 * Chạy mỗi giờ
 */
function startHomeworkNotificationCron() {
    console.log('[Cron] Starting homework notification cron job...');

    // Chạy ngay lần đầu
    checkHomeworkDeadlines();

    // Chạy mỗi phút (60000 ms = 1 minute)
    setInterval(checkHomeworkDeadlines, 60 * 1000);

    console.log('[Cron] Homework notification cron job started (runs every minute)');
}

module.exports = { startHomeworkNotificationCron, checkHomeworkDeadlines };
