/**
 * Polls Client Script
 * Xử lý giao diện và logic cho polls (thăm dò ý kiến) trong meeting
 * - Tạo poll (host/co-host)
 * - Vote và xem kết quả real-time
 * - API communication và Socket.IO events
 */

// Poll UI Layer - Pure presentation logic
// Dependencies: socket, meetingId, userId, isHost, isCoHost from room.ejs

// Biến quản lý trạng thái polls
let currentPoll = null;
let currentPollId = null;
let activePolls = [];

// ============================================
// Utility Functions
// ============================================


//Đếm lượt vote
const formatVoteLabel = (option) => {
    const count = Array.isArray(option?.votes) ? option.votes.length : 0;
    return `${option?.text || ''} (${count} vote${count === 1 ? '' : 's'})`;
};

const removeModalIfExists = (modalId) => {
    const existing = document.getElementById(modalId);
    if (existing) {
        existing.parentElement?.removeChild(existing);
    }
};

const attachAutoCleanup = (modal) => {
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    }, { once: true });
};

const normalizePoll = (poll) => {
    if (!poll) return null;
    return {
        ...poll,
        id: poll.id || poll._id
    };
};

// ============================================
// API Communication Layer
// ============================================

async function apiCreatePoll(question, options) {
    try {
        const response = await fetch(`/api/meeting/${meetingId}/poll`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ question, options })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create poll');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating poll:', error);
        alert('Failed to create poll: ' + error.message);
        throw error;
    }
}

async function apiVotePoll(pollId, optionIndex) {
    try {
        const response = await fetch(`/api/poll/${pollId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ optionIndex })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to vote');
        }

        return await response.json();
    } catch (error) {
        console.error('Error voting:', error);
        alert('Failed to vote: ' + error.message);
        throw error;
    }
}

async function apiEndPoll(pollId) {
    try {
        const response = await fetch(`/api/poll/${pollId}/end`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to end poll');
        }

        return await response.json();
    } catch (error) {
        console.error('Error ending poll:', error);
        alert('Failed to end poll: ' + error.message);
        throw error;
    }
}

async function apiGetPolls() {
    try {
        const response = await fetch(`/api/meeting/${meetingId}/polls`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch polls');
        }

        const data = await response.json();
        return data.polls || [];
    } catch (error) {
        console.error('Error fetching polls:', error);
        return [];
    }
}

// ============================================
// UI Rendering Functions
// ============================================

function showPoll(poll) {
    const normalized = normalizePoll(poll);
    if (!normalized) return;
    currentPoll = normalized;
    currentPollId = normalized.id;

    removeModalIfExists('pollModal');

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'pollModal';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Poll: ${normalized.question}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    ${normalized.options.map((opt, idx) => `
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="radio" name="pollOption" value="${idx}" id="poll-${normalized.id}-opt-${idx}">
                            <label class="form-check-label" for="poll-${normalized.id}-opt-${idx}" data-poll-option-label="${normalized.id}-${idx}">
                                ${formatVoteLabel(opt)}
                            </label>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="vote-poll-btn" data-poll-id="${normalized.id}">Vote</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Attach vote handler
    const voteBtn = modal.querySelector('#vote-poll-btn');
    if (voteBtn) {
        voteBtn.addEventListener('click', () => {
            handleVote(normalized.id);
        });
    }

    attachAutoCleanup(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function updatePoll(poll) {
    const normalized = normalizePoll(poll);
    if (!normalized?.id) return;

    console.log('updatePoll called for poll:', normalized.id);

    // Update main poll modal if open
    if (currentPollId === normalized.id) {
        console.log('Updating main poll modal');
        const modal = document.getElementById('pollModal');
        if (modal) {
            console.log('Modal found, updating', normalized.options.length, 'options');
            normalized.options.forEach((opt, idx) => {
                const label = modal.querySelector(`[data-poll-option-label="${normalized.id}-${idx}"]`);
                const newLabel = formatVoteLabel(opt);
                console.log(`Option ${idx}: "${opt.text}" has ${opt.votes?.length || 0} votes, label:`, newLabel);
                if (label) {
                    label.textContent = newLabel;
                    console.log('Label updated successfully');
                } else {
                    console.warn('Label not found for option', idx);
                }
            });
        } else {
            console.warn('Poll modal not found');
        }
    } else {
        console.log('Current poll ID mismatch:', currentPollId, 'vs', normalized.id);
    }

    // Update active polls list
    updateActivePollCard(normalized);
}

async function handleVote(pollId) {
    const selectedOption = document.querySelector('#pollModal input[name="pollOption"]:checked');

    if (!selectedOption) {
        alert('Please select an option');
        return;
    }

    const actualPollId = pollId || currentPollId;
    if (!actualPollId) {
        console.error('Unable to determine poll ID');
        return;
    }

    try {
        const voteBtn = document.getElementById('vote-poll-btn');
        if (voteBtn) {
            voteBtn.disabled = true;
            voteBtn.textContent = 'Voting...';
        }

        await apiVotePoll(actualPollId, parseInt(selectedOption.value, 10));

        // Show success message and keep modal open to display updated results
        if (voteBtn) {
            voteBtn.textContent = 'Vote Submitted!';
            voteBtn.classList.remove('btn-primary');
            voteBtn.classList.add('btn-success');
        }

        // Disable all radio buttons after voting
        document.querySelectorAll('#pollModal input[name="pollOption"]').forEach(radio => {
            radio.disabled = true;
        });

        console.log('Vote submitted successfully, waiting for poll-updated event');
    } catch (error) {
        // Re-enable button on error
        const voteBtn = document.getElementById('vote-poll-btn');
        if (voteBtn) {
            voteBtn.disabled = false;
            voteBtn.textContent = 'Vote';
        }
    }
}

function showCreatePollModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Create Poll</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Question</label>
                        <input type="text" class="form-control" id="poll-question">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Options (one per line)</label>
                        <textarea class="form-control" id="poll-options" rows="4"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="create-poll-submit">Create</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Attach submit handler
    const submitBtn = modal.querySelector('#create-poll-submit');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const question = document.getElementById('poll-question').value;
            const options = document.getElementById('poll-options').value.split('\n').filter(o => o.trim());

            if (question && options.length >= 2) {
                try {
                    await apiCreatePoll(question, options);
                    const instance = bootstrap.Modal.getInstance(modal);
                    if (instance) instance.hide();
                } catch (error) {
                    // Error already shown by apiCreatePoll
                }
            } else {
                alert('Please enter a question and at least 2 options');
            }
        });
    }

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function renderActivePollsBody() {
    return activePolls.map((poll, index) => `
        <div class="card mb-3" data-poll-id="${poll.id}">
            <div class="card-body">
                <h6>${poll.question}</h6>
                ${poll.options.map((opt, idx) => `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="poll-${index}" value="${idx}" id="poll-${index}-opt-${idx}">
                        <label class="form-check-label" for="poll-${index}-opt-${idx}" data-option-label="${poll.id}-${idx}">
                            ${formatVoteLabel(opt)}
                        </label>
                    </div>
                `).join('')}
                <button class="btn btn-sm btn-primary mt-2 vote-from-list-btn" data-poll-id="${poll.id}" data-poll-index="${index}">Vote</button>
                ${(isHost || isCoHost) ? `<button class="btn btn-sm btn-danger mt-2 end-poll-btn" data-poll-id="${poll.id}">End Poll</button>` : ''}
            </div>
        </div>
    `).join('');
}

function showActivePolls() {
    if (activePolls.length === 0) {
        alert('No active polls');
        return;
    }

    removeModalIfExists('activePollsModal');

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'activePollsModal';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Active Polls</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    ${renderActivePollsBody()}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Attach vote handlers
    modal.querySelectorAll('.vote-from-list-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const pollId = btn.dataset.pollId;
            const pollIndex = parseInt(btn.dataset.pollIndex, 10);
            handleVoteFromList(pollId, pollIndex);
        });
    });

    // Attach end poll handlers
    modal.querySelectorAll('.end-poll-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const pollId = btn.dataset.pollId;
            if (confirm('Are you sure you want to end this poll?')) {
                try {
                    await apiEndPoll(pollId);
                } catch (error) {
                    // Error already shown
                }
            }
        });
    });

    attachAutoCleanup(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

async function handleVoteFromList(pollId, pollIndex) {
    const selectedOption = document.querySelector(`#activePollsModal input[name="poll-${pollIndex}"]:checked`);

    if (!selectedOption) {
        alert('Please select an option');
        return;
    }

    try {
        const card = document.querySelector(`#activePollsModal [data-poll-id="${pollId}"]`);
        const voteBtn = card?.querySelector('.vote-from-list-btn');

        if (voteBtn) {
            voteBtn.disabled = true;
            voteBtn.textContent = 'Voting...';
        }

        await apiVotePoll(pollId, parseInt(selectedOption.value, 10));

        if (voteBtn) {
            voteBtn.textContent = 'Voted!';
            voteBtn.classList.remove('btn-primary');
            voteBtn.classList.add('btn-success');
        }

        // Disable radio buttons for this poll
        document.querySelectorAll(`#activePollsModal input[name="poll-${pollIndex}"]`).forEach(radio => {
            radio.disabled = true;
        });

        console.log('Vote submitted from list, waiting for poll-updated event');
    } catch (error) {
        // Re-enable on error
        const card = document.querySelector(`#activePollsModal [data-poll-id="${pollId}"]`);
        const voteBtn = card?.querySelector('.vote-from-list-btn');
        if (voteBtn) {
            voteBtn.disabled = false;
            voteBtn.textContent = 'Vote';
        }
    }
}

function updateActivePollCard(poll) {
    const modal = document.getElementById('activePollsModal');
    if (!modal) return;

    const card = modal.querySelector(`[data-poll-id="${poll.id}"]`);
    const options = Array.isArray(poll.options) ? poll.options : null;

    if (!card || !options) {
        // Re-render entire body if structure changed
        const body = modal.querySelector('.modal-body');
        if (body) {
            body.innerHTML = renderActivePollsBody();
        }
        return;
    }

    // Update vote counts
    options.forEach((opt, idx) => {
        const label = card.querySelector(`[data-option-label="${poll.id}-${idx}"]`);
        if (label) {
            label.textContent = formatVoteLabel(opt);
        }
    });
}

// ============================================
// Event Handlers
// ============================================

document.getElementById('show-polls')?.addEventListener('click', () => {
    if (isHost || isCoHost) {
        showCreatePollModal();
    } else {
        showActivePolls();
    }
});

// ============================================
// Socket Event Listeners (Real-time Updates)
// ============================================

if (typeof socket !== 'undefined') {
    socket.on('poll-created', (poll) => {
        console.log('Received poll-created:', poll);
        const normalized = normalizePoll(poll);
        activePolls.push(normalized);
        updateActivePollCard(normalized);
        showPoll(normalized);
    });

    socket.on('poll-updated', (poll) => {
        console.log('Received poll-updated:', poll);
        console.log('Poll options detail:', JSON.stringify(poll.options, null, 2));
        const normalized = normalizePoll(poll);

        // Update in activePolls array
        const index = activePolls.findIndex(p => p.id === normalized.id);
        if (index > -1) {
            activePolls[index] = normalized;
        }

        console.log('Calling updatePoll with:', normalized);
        console.log('Current poll modal ID:', currentPollId);
        updatePoll(normalized);
    });

    socket.on('poll-ended', ({ id }) => {
        activePolls = activePolls.filter(p => p.id !== id);

        // Close modals if showing ended poll
        if (currentPollId === id) {
            const modal = document.getElementById('pollModal');
            if (modal) {
                const instance = bootstrap.Modal.getInstance(modal);
                if (instance) instance.hide();
            }
        }

        updateActivePollCard({ id });
    });
}
