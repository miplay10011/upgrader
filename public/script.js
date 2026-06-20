// ===== DOM элементы =====
const balanceDisplay = document.getElementById('balanceDisplay');
const onlineCountEl = document.getElementById('onlineCount');
const chanceSlider = document.getElementById('chanceSlider');
const chanceValue = document.getElementById('chanceValue');
const betSlider = document.getElementById('betSlider');
const betValue = document.getElementById('betValue');
const maxBetBtn = document.getElementById('maxBetBtn');
const donateBtn = document.getElementById('donateBtn');
const spinBtn = document.getElementById('spinBtn');
const resultMessage = document.getElementById('resultMessage');
const historyList = document.getElementById('historyList');

// Модалка доната
const modal = document.getElementById('donateModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const donateForm = document.getElementById('donateForm');
const donateAmount = document.getElementById('donateAmount');
const donatePromo = document.getElementById('donatePromo');
const donateMessage = document.getElementById('donateMessage');

// Чат
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatWindow = document.getElementById('chatWindow');
const chatCloseBtn = document.getElementById('chatCloseBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

// Колесо
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');

// ===== Глобальные переменные =====
let currentBalance = 0;
let isSpinning = false;
let currentDrawChance = 50;

const sessionId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
let heartbeatInterval = null;

// Параметры колеса
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = 130;
let currentAngle = 0; // угол стрелки (в радианах)

// ===== Рисование колеса =====
function drawWheel(chancePercent) {
    if (chancePercent === undefined) {
        chancePercent = currentDrawChance;
    }
    const chance = Math.min(100, Math.max(0, chancePercent)) / 100;
    const winAngle = chance * 2 * Math.PI;
    const startAngle = -Math.PI / 2; // верх

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Зелёный сектор (выигрыш)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + winAngle);
    ctx.closePath();
    ctx.fillStyle = '#2ecc71';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Красный сектор (проигрыш)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle + winAngle, startAngle + 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.stroke();

    // Обводка
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Текст
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(chancePercent)}%`, centerX, centerY - 8);
    ctx.font = '12px sans-serif';
    ctx.fillText('шанс победы', centerX, centerY + 18);

    drawPointer(currentAngle);
}

// ===== Стрелка (без смещения, точное направление) =====
function drawPointer(angle) {
    const pointerRadius = radius + 10;
    const tipRadius = radius + 30;
    const baseX = centerX + pointerRadius * Math.cos(angle);
    const baseY = centerY + pointerRadius * Math.sin(angle);
    const tipX = centerX + tipRadius * Math.cos(angle);
    const tipY = centerY + tipRadius * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    const perpAngle = angle + Math.PI / 2;
    const sideOffset = 10;
    const leftX = baseX + sideOffset * Math.cos(perpAngle);
    const leftY = baseY + sideOffset * Math.sin(perpAngle);
    const rightX = baseX - sideOffset * Math.cos(perpAngle);
    const rightY = baseY - sideOffset * Math.sin(perpAngle);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fillStyle = '#f1c40f';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#f1c40f';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
}

// ===== Анимация стрелки (фиксированный шанс) =====
function spinPointer(targetAngle, chance, callback) {
    const duration = 2000;
    const startTime = performance.now();
    const startAngle = currentAngle;

    function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const angle = startAngle + (targetAngle - startAngle) * ease;
        currentAngle = angle;
        drawWheel(chance);
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            currentAngle = targetAngle;
            drawWheel(chance);
            if (callback) callback();
        }
    }
    requestAnimationFrame(animate);
}

// ===== Обновление баланса, онлайна и истории =====
async function fetchBalance() {
    try {
        const res = await fetch('/api/balance');
        const data = await res.json();
        currentBalance = data.balance;
        balanceDisplay.textContent = currentBalance;
        onlineCountEl.textContent = data.online || 0;
        updateHistory(data.history);
        betSlider.max = currentBalance;
        if (Number(betSlider.value) > currentBalance) betSlider.value = currentBalance;
        betValue.textContent = betSlider.value;
    } catch (e) {
        console.error(e);
    }
}

// ===== Отрисовка истории с эффектом затухания =====
function updateHistory(history) {
    historyList.innerHTML = '';
    if (!history || history.length === 0) {
        historyList.innerHTML = '<p style="color:#777; text-align:center;">История пуста</p>';
        return;
    }
    // Берём последние 20 записей
    const last20 = history.slice(-20);
    // Отрисовываем в обратном порядке (свежие сверху)
    const reversed = [...last20].reverse();

    reversed.forEach((entry, index) => {
        const p = document.createElement('p');
        const winText = entry.isWin ? `✅ +${entry.winAmount} (x${entry.multiplier})` : `❌ -${entry.bet}`;
        p.className = entry.isWin ? 'win' : 'lose';

        // Основной текст
        const textSpan = document.createElement('span');
        textSpan.textContent = `${entry.time} | ${entry.chance}% → ${winText}`;
        p.appendChild(textSpan);

        // Время отдельно (для стиля)
        const timeSpan = document.createElement('span');
        timeSpan.className = 'time';
        timeSpan.textContent = entry.time;
        p.appendChild(timeSpan);

        // Эффект затухания: чем старше запись (больше индекс), тем прозрачнее
        // Индекс 0 — самая свежая, opacity 1; последняя — opacity ~0.3
        const opacity = Math.max(0.2, 1 - (index / reversed.length) * 0.8);
        p.style.opacity = opacity;

        historyList.appendChild(p);
    });
}

// ===== Онлайн =====
async function joinOnline() {
    try {
        await fetch('/api/online/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        heartbeatInterval = setInterval(sendHeartbeat, 15000);
    } catch (e) {
        console.error('Ошибка join:', e);
    }
}

async function sendHeartbeat() {
    try {
        const res = await fetch('/api/online/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        const data = await res.json();
        if (data.online !== undefined) {
            onlineCountEl.textContent = data.online;
        }
    } catch (e) {
        console.error('Heartbeat error:', e);
    }
}

async function leaveOnline() {
    try {
        await fetch('/api/online/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
    } catch (e) {}
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

window.addEventListener('beforeunload', leaveOnline);

// ===== Чат =====
let chatUsername = 'User' + Math.floor(Math.random() * 1000);
let chatPollInterval = null;

async function loadChatMessages() {
    try {
        const res = await fetch('/api/chat');
        const data = await res.json();
        renderChatMessages(data.messages || []);
    } catch (e) {
        console.error('Ошибка загрузки чата:', e);
    }
}

function renderChatMessages(messages) {
    chatMessages.innerHTML = '';
    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'msg';
        if (msg.username === chatUsername) {
            div.classList.add('self');
        }
        div.innerHTML = `<span class="user">${escapeHtml(msg.username)}</span>${escapeHtml(msg.text)}<span class="time">${msg.time}</span>`;
        chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    try {
        await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: chatUsername, text })
        });
        loadChatMessages();
    } catch (e) {
        console.error('Ошибка отправки:', e);
    }
}

function toggleChat(show) {
    if (show === undefined) {
        chatWindow.classList.toggle('hidden');
    } else if (show) {
        chatWindow.classList.remove('hidden');
    } else {
        chatWindow.classList.add('hidden');
    }
    if (!chatWindow.classList.contains('hidden')) {
        loadChatMessages();
        if (!chatPollInterval) {
            chatPollInterval = setInterval(loadChatMessages, 5000);
        }
    } else {
        if (chatPollInterval) {
            clearInterval(chatPollInterval);
            chatPollInterval = null;
        }
    }
}

chatToggleBtn.addEventListener('click', () => toggleChat());
chatCloseBtn.addEventListener('click', () => toggleChat(false));
chatSendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

// ===== Модалка доната =====
function openModal() {
    modal.style.display = 'flex';
    donateAmount.value = 100;
    donatePromo.value = '';
    donateMessage.textContent = '';
}

function closeModal() {
    modal.style.display = 'none';
}

window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});
closeModalBtn.addEventListener('click', closeModal);
donateBtn.addEventListener('click', openModal);

donateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseInt(donateAmount.value);
    const promo = donatePromo.value.trim().toUpperCase();

    if (isNaN(amount) || amount < 1) {
        donateMessage.textContent = '❌ Введите корректную сумму (≥1)';
        donateMessage.style.color = '#f1948a';
        return;
    }
    if (amount > 100000) {
        donateMessage.textContent = '❌ Сумма не может превышать 100 000';
        donateMessage.style.color = '#f1948a';
        return;
    }

    donateMessage.textContent = '⏳ Обработка...';
    donateMessage.style.color = '#f1c40f';

    try {
        const res = await fetch('/api/donate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, promo })
        });
        const data = await res.json();

        if (data.success) {
            currentBalance = data.newBalance;
            balanceDisplay.textContent = currentBalance;
            betSlider.max = currentBalance;
            if (Number(betSlider.value) > currentBalance) betSlider.value = currentBalance;
            betValue.textContent = betSlider.value;

            let msg = `✅ Баланс пополнен на ${amount} монет!`;
            if (data.bonus) msg += ` 🎁 Бонус: +${data.bonus} монет!`;
            donateMessage.textContent = msg;
            donateMessage.style.color = '#7ddf9a';
            setTimeout(closeModal, 2000);
        } else {
            donateMessage.textContent = `❌ ${data.error}`;
            donateMessage.style.color = '#f1948a';
        }
    } catch (err) {
        donateMessage.textContent = '❌ Ошибка сервера';
        donateMessage.style.color = '#f1948a';
    }
});

// ===== Слайдеры =====
chanceSlider.addEventListener('input', () => {
    const val = chanceSlider.value;
    chanceValue.textContent = val;
    if (!isSpinning) {
        currentDrawChance = Number(val);
        drawWheel();
    }
});

betSlider.addEventListener('input', () => {
    betValue.textContent = betSlider.value;
});

maxBetBtn.addEventListener('click', () => {
    betSlider.value = currentBalance;
    betValue.textContent = currentBalance;
});

// ===== Вращение (исправленное) =====
spinBtn.addEventListener('click', async () => {
    if (isSpinning) return;
    const bet = Number(betSlider.value);
    const spinChance = Number(chanceSlider.value);
    if (bet <= 0) {
        resultMessage.innerHTML = '❌ Ставка должна быть > 0';
        resultMessage.style.color = '#f1948a';
        return;
    }
    if (bet > currentBalance) {
        resultMessage.innerHTML = '❌ Недостаточно средств!';
        resultMessage.style.color = '#f1948a';
        return;
    }

    isSpinning = true;
    spinBtn.disabled = true;
    chanceSlider.disabled = true;
    betSlider.disabled = true;
    maxBetBtn.disabled = true;

    try {
        const res = await fetch('/api/spin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bet, chance: spinChance })
        });
        const data = await res.json();

        if (!data.success) {
            resultMessage.innerHTML = `❌ ${data.error}`;
            resultMessage.style.color = '#f1948a';
            isSpinning = false;
            spinBtn.disabled = false;
            chanceSlider.disabled = false;
            betSlider.disabled = false;
            maxBetBtn.disabled = false;
            return;
        }

        if (data.online !== undefined) {
            onlineCountEl.textContent = data.online;
        }

        // Вычисляем угол для стрелки строго по результату сервера
        const winAngle = (spinChance / 100) * 2 * Math.PI;
        const startAngle = -Math.PI / 2;

        let targetSectorAngle;
        if (data.isWin) {
            // Попадаем в зелёный сектор
            const offset = Math.random() * winAngle;
            targetSectorAngle = startAngle + offset;
        } else {
            // Попадаем в красный сектор
            const loseStart = startAngle + winAngle;
            const loseEnd = startAngle + 2 * Math.PI;
            const offset = Math.random() * (loseEnd - loseStart);
            targetSectorAngle = loseStart + offset;
        }

        // Добавляем несколько полных оборотов
        const extraSpins = 3 + Math.random() * 3;
        const finalAngle = targetSectorAngle + extraSpins * 2 * Math.PI;

        // Запускаем анимацию
        spinPointer(finalAngle, spinChance, () => {
            if (data.isWin) {
                resultMessage.innerHTML = `🎉 ВЫИГРЫШ! +${data.winAmount} (x${data.multiplier})`;
                resultMessage.style.color = '#7ddf9a';
            } else {
                resultMessage.innerHTML = `😞 ПРОИГРЫШ. -${bet}`;
                resultMessage.style.color = '#f1948a';
            }
            currentBalance = data.newBalance;
            balanceDisplay.textContent = currentBalance;
            betSlider.max = currentBalance;
            if (Number(betSlider.value) > currentBalance) betSlider.value = currentBalance;
            betValue.textContent = betSlider.value;
            updateHistory(data.history);

            isSpinning = false;
            spinBtn.disabled = false;
            chanceSlider.disabled = false;
            betSlider.disabled = false;
            maxBetBtn.disabled = false;
            currentDrawChance = Number(chanceSlider.value);
            drawWheel();
        });

    } catch (e) {
        resultMessage.innerHTML = '❌ Ошибка сервера';
        resultMessage.style.color = '#f1948a';
        isSpinning = false;
        spinBtn.disabled = false;
        chanceSlider.disabled = false;
        betSlider.disabled = false;
        maxBetBtn.disabled = false;
        currentDrawChance = Number(chanceSlider.value);
        drawWheel();
    }
});

// ===== Инициализация =====
currentDrawChance = Number(chanceSlider.value);
drawWheel();
fetchBalance();
joinOnline();
setInterval(fetchBalance, 10000);