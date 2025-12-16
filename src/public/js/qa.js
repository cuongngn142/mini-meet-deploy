/**
 * Q&A Client Script
 * Xử lý giao diện Q&A (Questions & Answers) trong meeting
 * - Học sinh đặt câu hỏi
 * - Giáo viên trả lời và upvote câu hỏi
 * - Real-time updates qua Socket.IO
 */

// Q&A UI Layer - Pure presentation logic
// Dependencies: socket, meetingId, userId, isHost, isCoHost from room.ejs

// Danh sách các câu hỏi trong meeting
let questions = [];

if (typeof socket === 'undefined') {
    console.error('Socket.io not loaded');
}

// ============================================
// API Communication Layer
// ============================================

async function apiAskQuestion(question) {
    try {
        const response = await fetch(`/api/meeting/${meetingId}/question`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ question })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to ask question');
        }

        return await response.json();
    } catch (error) {
        console.error('Error asking question:', error);
        alert('Failed to ask question: ' + error.message);
        throw error;
    }
}

async function apiAnswerQuestion(questionId, answer) {
    try {
        const response = await fetch(`/api/question/${questionId}/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ answer })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to answer question');
        }

        return await response.json();
    } catch (error) {
        console.error('Error answering question:', error);
        alert('Failed to answer question: ' + error.message);
        throw error;
    }
}

async function apiUpvoteQuestion(questionId) {
    try {
        const response = await fetch(`/api/question/${questionId}/upvote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upvote question');
        }

        return await response.json();
    } catch (error) {
        console.error('Error upvoting question:', error);
        alert('Failed to upvote question: ' + error.message);
        throw error;
    }
}

async function apiGetQuestions() {
    try {
        const response = await fetch(`/api/meeting/${meetingId}/questions`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch questions');
        }

        const data = await response.json();
        return data.questions || [];
    } catch (error) {
        console.error('Error fetching questions:', error);
        return [];
    }
}

// ============================================
// UI Functions
// ============================================

function addQuestion(question) {
    const index = questions.findIndex(q => q.id === question.id);
    if (index > -1) {
        questions[index] = question;
    } else {
        questions.push(question);
    }
    updateQAUI();
}

function updateQAUI() {
    const qaContent = document.getElementById('qa-content');
    if (!qaContent) return;

    qaContent.innerHTML = `
        <button class="btn btn-sm btn-primary mb-3" id="ask-question-btn">Ask Question</button>
        <div id="questions-list">
            ${questions.length === 0 ? '<p class="text-muted">No questions yet.</p>' : ''}
            ${questions.map(q => `
                <div class="card mb-2">
                    <div class="card-body">
                        <h6 class="mb-1">${q.user.name}</h6>
                        <p class="mb-2">${q.question}</p>
                        ${q.isAnswered ? `
                            <div class="alert alert-success py-2">
                                <strong>Answer:</strong> ${q.answer}
                            </div>
                        ` : ''}
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary upvote-question-btn" data-question-id="${q.id}">
                                <i class="bi bi-arrow-up"></i> ${q.upvotes || 0}
                            </button>
                            ${(isHost || isCoHost) && !q.isAnswered ? `
                                <button class="btn btn-sm btn-primary answer-question-btn" data-question-id="${q.id}">Answer</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Attach event handlers
    document.getElementById('ask-question-btn')?.addEventListener('click', showAskQuestionModal);

    document.querySelectorAll('.upvote-question-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const questionId = btn.dataset.questionId;
            try {
                await apiUpvoteQuestion(questionId);
            } catch (error) {
                // Error already shown
            }
        });
    });

    document.querySelectorAll('.answer-question-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const questionId = btn.dataset.questionId;
            showAnswerModal(questionId);
        });
    });
}

function showAskQuestionModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Ask Question</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Question</label>
                        <textarea class="form-control" id="question-text" rows="3" maxlength="1000"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="submit-question-btn">Submit</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Attach submit handler
    const submitBtn = modal.querySelector('#submit-question-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const questionText = document.getElementById('question-text').value;
            if (questionText.trim()) {
                try {
                    await apiAskQuestion(questionText.trim());
                    const instance = bootstrap.Modal.getInstance(modal);
                    if (instance) instance.hide();
                } catch (error) {
                    // Error already shown
                }
            } else {
                alert('Please enter a question');
            }
        });
    }

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function showAnswerModal(questionId) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Answer Question</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Answer</label>
                        <textarea class="form-control" id="answer-text" rows="3" maxlength="2000"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="submit-answer-btn">Submit</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Attach submit handler
    const submitBtn = modal.querySelector('#submit-answer-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const answerText = document.getElementById('answer-text').value;
            if (answerText.trim()) {
                try {
                    await apiAnswerQuestion(questionId, answerText.trim());
                    const instance = bootstrap.Modal.getInstance(modal);
                    if (instance) instance.hide();
                } catch (error) {
                    // Error already shown
                }
            } else {
                alert('Please enter an answer');
            }
        });
    }

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// ============================================
// Event Handlers
// ============================================

document.getElementById('show-qa')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const qaPanel = document.getElementById('qa-panel');
    const chatPanel = document.getElementById('chat-panel');
    const participantsPanel = document.getElementById('participants-panel');

    if (!sidebar || !qaPanel || !chatPanel || !participantsPanel) {
        return;
    }

    if (sidebar.style.display === 'none' || sidebar.style.display === '') {
        sidebar.style.display = 'block';
        qaPanel.classList.remove('d-none');
        chatPanel.classList.add('d-none');
        participantsPanel.classList.add('d-none');
    } else if (!qaPanel.classList.contains('d-none')) {
        sidebar.style.display = 'none';
    } else {
        qaPanel.classList.remove('d-none');
        chatPanel.classList.add('d-none');
        participantsPanel.classList.add('d-none');
    }

    updateQAUI();
});

document.getElementById('close-qa-panel')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const qaPanel = document.getElementById('qa-panel');
    if (sidebar && qaPanel) {
        sidebar.style.display = 'none';
        qaPanel.classList.add('d-none');
    }
});

// ============================================
// Socket Event Listeners (Real-time Updates)
// ============================================

if (typeof socket !== 'undefined') {
    socket.on('question-asked', (question) => {
        console.log('Received question-asked:', question);
        addQuestion(question);
    });

    socket.on('question-answered', ({ id, answer, answeredBy, answeredAt }) => {
        console.log('Received question-answered:', id);
        const question = questions.find(q => q.id === id);
        if (question) {
            question.answer = answer;
            question.answeredBy = answeredBy;
            question.answeredAt = answeredAt;
            question.isAnswered = true;
            updateQAUI();
        }
    });

    socket.on('question-upvoted', ({ id, upvotes }) => {
        console.log('Received question-upvoted:', id, upvotes);
        const question = questions.find(q => q.id === id);
        if (question) {
            question.upvotes = upvotes;
            updateQAUI();
        }
    });
}
