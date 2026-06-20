// DOM элементы
const balanceDisplay = document.getElementById('balanceDisplay');
const chanceSlider = document.getElementById('chanceSlider');
const chanceValue = document.getElementById('chanceValue');
const betSlider = document.getElementById('betSlider');
const betValue = document.getElementById('betValue');
const maxBetBtn = document.getElementById('maxBetBtn');
const donateBtn = document.getElementById('donateBtn');
const spinBtn = document.getElementById('spinBtn');
const resultMessage = document.getElementById('resultMessage');
const historyList = document.getElementById('historyList');

// Модалка
const modal = document.getElementById('donateModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const donateForm = document.getElementById('donateForm');
const donateAmount = document.getElementById('donateAmount');
const donatePromo = document.getElementById('donatePromo');
const donateMessage = document.getElementById('donateMessage');

const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');

let currentBalance = 0;
let isSpinning = false;

// Параметры колеса
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = 130;
let currentAngle = 0;

// Рисование колеса
function drawWheel(chancePercent) {
    const chance = Math.min(100, Math.max(0, chancePercent)) / 100;
    const winAngle = chance * 2 * Math.PI;
    const startAngle = -Math.PI / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Выигрышный сектор (зелёный)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + winAngle);
    ctx.closePath();
    ctx.fillStyle = '#2ecc71';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Проигрышный сектор (красный)
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
    ctx.fillText(`${chancePercent}%`, centerX, centerY - 8);
    ctx.font = '12px sans-serif';
    ctx.fillText('шанс победы', centerX, centerY + 18);

    drawPointer(currentAngle);
}

// Стрелка
function drawPointer(angle) {
    const pointerRadius = radius + 10;
    const tipRadius = radius + 30;
    const baseX = centerX + pointerRadius * Math.cos(angle - Math.PI/2);
    const baseY = centerY + pointerRadius * Math.sin(angle - Math.PI/2);
    const tipX = centerX + tipRadius * Math.cos(angle - Math.PI/2);
    const tipY = centerY + tipRadius * Math.sin(angle - Math.PI/2);

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    const perpAngle = angle;
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

// Анимация стрелки
function spinPointer(targetAngle, callback) {
    const duration = 2000;
    const startTime = performance.now();
    const startAngle = currentAngle;

    function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const angle = startAngle + (targetAngle - startAngle) * ease;
        currentAngle = angle;
        drawWheel(Number(chanceSlider.value));
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            currentAngle = targetAngle;
            drawWheel(Number(chanceSlider.value));
            if (callback) callback();
        }
    }
    requestAnimationFrame(animate);
}

// === Обновление баланса и истории ===
async function fetchBalance() {
    try {
        const res = await fetch('/api/balance');
        const data = await res.json();
        currentBalance = data.balance;
        balanceDisplay.textContent = currentBalance;
        updateHistory(data.history);
        betSlider.max = currentBalance;
        if (Number(betSlider.value) > currentBalance) betSlider.value = currentBalance;
        betValue.textContent = betSlider.value;
    } catch (e) {
        console.error(e);
    }
}

function updateHistory(history) {
    historyList.innerHTML = '';
    if (!history || history.length === 0) {
        historyList.innerHTML = '<p style="color:#777;">История пуста</p>';
        return;
    }
    const reversed = [...history].reverse();
    reversed.forEach(entry => {
        const p = document.createElement('p');
        const winText = entry.isWin ? `✅ +${entry.winAmount} (x${entry.multiplier})` : `❌ -${entry.bet}`;
        p.className = entry.isWin ? 'win' : 'lose';
        p.textContent = `${entry.time} | Ставка: ${entry.bet}, Шанс: ${entry.chance}% → ${winText}`;
        historyList.appendChild(p);
    });
}

// === Модальное окно ===
function openModal() {
    modal.style.display = 'flex';
    donateAmount.value = 100;
    donatePromo.value = '';
    donateMessage.textContent = '';
}

function closeModal() {
    modal.style.display = 'none';
}

// Закрытие по клику вне окна
window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

closeModalBtn.addEventListener('click', closeModal);
donateBtn.addEventListener('click', openModal);

// Отправка формы доната
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

// === Обработчики слайдеров ===
chanceSlider.addEventListener('input', () => {
    const val = chanceSlider.value;
    chanceValue.textContent = val;
    drawWheel(Number(val));
});

betSlider.addEventListener('input', () => {
    betValue.textContent = betSlider.value;
});

maxBetBtn.addEventListener('click', () => {
    betSlider.value = currentBalance;
    betValue.textContent = currentBalance;
});

// === Вращение ===
spinBtn.addEventListener('click', async () => {
    if (isSpinning) return;
    const bet = Number(betSlider.value);
    const chance = Number(chanceSlider.value);
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

    try {
        const res = await fetch('/api/spin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bet, chance })
        });
        const data = await res.json();

        if (!data.success) {
            resultMessage.innerHTML = `❌ ${data.error}`;
            resultMessage.style.color = '#f1948a';
            isSpinning = false;
            spinBtn.disabled = false;
            return;
        }

        // Целевой угол для стрелки
        const winAngle = (chance / 100) * 2 * Math.PI;
        const startAngle = -Math.PI / 2;
        let targetSectorAngle;
        if (data.isWin) {
            const offset = Math.random() * winAngle;
            targetSectorAngle = startAngle + offset;
        } else {
            const loseStart = startAngle + winAngle;
            const loseEnd = startAngle + 2 * Math.PI;
            const offset = Math.random() * (loseEnd - loseStart);
            targetSectorAngle = loseStart + offset;
        }
        const extraSpins = 3 + Math.random() * 3;
        const finalAngle = targetSectorAngle + extraSpins * 2 * Math.PI;

        spinPointer(finalAngle, () => {
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
        });

    } catch (e) {
        resultMessage.innerHTML = '❌ Ошибка сервера';
        resultMessage.style.color = '#f1948a';
        isSpinning = false;
        spinBtn.disabled = false;
    }
});

// Инициализация
drawWheel(Number(chanceSlider.value));
fetchBalance();