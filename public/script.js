// DOM элементы
const balanceDisplay = document.getElementById('balanceDisplay');
const chanceSlider = document.getElementById('chanceSlider');
const chanceValue = document.getElementById('chanceValue');
const betSlider = document.getElementById('betSlider');
const betValue = document.getElementById('betValue');
const maxBetBtn = document.getElementById('maxBetBtn');
const depositBtn = document.getElementById('depositBtn');
const spinBtn = document.getElementById('spinBtn');
const resultMessage = document.getElementById('resultMessage');
const historyList = document.getElementById('historyList');

const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');

let currentBalance = 0;
let isSpinning = false;

// === Колесо (рисование и анимация) ===
const segments = ['🔴', '🟢', '🔵', '🟡', '🟣', '🟠']; // просто для красоты
const colors = ['#e74c3c', '#2ecc71', '#3498db', '#f1c40f', '#9b59b6', '#e67e22'];

function drawWheel(rotation = 0) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 140;
    const segmentCount = segments.length;
    const angleStep = (2 * Math.PI) / segmentCount;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < segmentCount; i++) {
        const startAngle = rotation + i * angleStep;
        const endAngle = startAngle + angleStep;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Текст (эмодзи)
        const textAngle = startAngle + angleStep / 2;
        const textX = centerX + radius * 0.65 * Math.cos(textAngle);
        const textY = centerY + radius * 0.65 * Math.sin(textAngle);
        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(segments[i], textX, textY);
    }

    // Стрелка (сверху)
    ctx.beginPath();
    ctx.moveTo(centerX, 10);
    ctx.lineTo(centerX - 15, 30);
    ctx.lineTo(centerX + 15, 30);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
}

// Анимация вращения
function spinWheel(targetAngle, callback) {
    const duration = 2000; // 2 секунды
    const startTime = performance.now();
    const startRotation = currentRotation;

    function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out
        const ease = 1 - Math.pow(1 - progress, 3);
        const angle = startRotation + (targetAngle - startRotation) * ease;
        drawWheel(angle);
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            currentRotation = targetAngle;
            if (callback) callback();
        }
    }
    requestAnimationFrame(animate);
}

let currentRotation = 0;
drawWheel(0);

// === Обновление баланса и истории ===
async function fetchBalance() {
    try {
        const res = await fetch('/api/balance');
        const data = await res.json();
        currentBalance = data.balance;
        balanceDisplay.textContent = currentBalance;
        updateHistory(data.history);
        // Обновим максимальную ставку
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
    // Показываем последние 20 (свежие сверху)
    const reversed = [...history].reverse();
    reversed.forEach(entry => {
        const p = document.createElement('p');
        const winText = entry.isWin ? `✅ +${entry.winAmount} (x${entry.multiplier})` : `❌ -${entry.bet}`;
        p.className = entry.isWin ? 'win' : 'lose';
        p.textContent = `${entry.time} | Ставка: ${entry.bet}, Шанс: ${entry.chance}% → ${winText}`;
        historyList.appendChild(p);
    });
}

// === Обработчики ===

// Ползунки
chanceSlider.addEventListener('input', () => {
    chanceValue.textContent = chanceSlider.value;
});

betSlider.addEventListener('input', () => {
    betValue.textContent = betSlider.value;
});

maxBetBtn.addEventListener('click', () => {
    betSlider.value = currentBalance;
    betValue.textContent = currentBalance;
});

// Пополнение
depositBtn.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/deposit', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            currentBalance = data.newBalance;
            balanceDisplay.textContent = currentBalance;
            betSlider.max = currentBalance;
            resultMessage.innerHTML = `✅ Пополнено на ${data.deposited} монет!`;
            resultMessage.style.color = '#7ddf9a';
            fetchBalance(); // обновим историю тоже
        }
    } catch {
        resultMessage.innerHTML = '❌ Ошибка пополнения';
        resultMessage.style.color = '#f1948a';
    }
});

// Вращение
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

    // Случайный угол (минимум 5 полных оборотов)
    const extraSpins = 5 + Math.random() * 3;
    const targetAngle = currentRotation + extraSpins * 2 * Math.PI + Math.random() * 2 * Math.PI;

    // Отправляем запрос на сервер
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

        // Крутим колесо
        spinWheel(targetAngle, () => {
            // Показываем результат
            if (data.isWin) {
                resultMessage.innerHTML = `🎉 ВЫИГРЫШ! +${data.winAmount} (x${data.multiplier})`;
                resultMessage.style.color = '#7ddf9a';
            } else {
                resultMessage.innerHTML = `😞 ПРОИГРЫШ. -${bet}`;
                resultMessage.style.color = '#f1948a';
            }
            // Обновляем баланс и историю
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

// Первоначальная загрузка
fetchBalance();