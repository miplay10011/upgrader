const balanceDisplay = document.getElementById('balanceDisplay');
const messageDiv = document.getElementById('message');
const historyDiv = document.getElementById('history');

// Функция обновления баланса на экране
async function updateBalance() {
    try {
        const response = await fetch('/api/balance');
        const data = await response.json();
        balanceDisplay.textContent = data.balance;
    } catch (error) {
        console.error('Ошибка получения баланса:', error);
    }
}

// Показать сообщение
function showMessage(text, isSuccess = true) {
    messageDiv.innerHTML = text;
    messageDiv.style.color = isSuccess ? '#a3e4d7' : '#f1948a';
}

// Добавить запись в историю
function addHistory(text) {
    const p = document.createElement('p');
    p.textContent = text;
    historyDiv.prepend(p); // Добавляем сверху
    if (historyDiv.children.length > 10) {
        historyDiv.removeChild(historyDiv.lastChild);
    }
}

// --- Обработчики кнопок ---

// Пополнение
document.getElementById('depositBtn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/deposit', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            balanceDisplay.textContent = data.newBalance;
            showMessage(`✅ Баланс пополнен на ${data.deposited} монет!`, true);
            addHistory(`💰 Пополнение: +${data.deposited} монет (Баланс: ${data.newBalance})`);
        }
    } catch (error) {
        showMessage('❌ Ошибка пополнения', false);
    }
});

// Апгрейд
document.getElementById('upgradeBtn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/upgrade', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            balanceDisplay.textContent = data.newBalance;
            if (data.isWin) {
                showMessage(`🎉 Успех! Вы выиграли ${data.winAmount} монет!`, true);
                addHistory(`🎉 Апгрейд: +${data.winAmount} монет (Баланс: ${data.newBalance})`);
            } else {
                showMessage(`😞 Неудача. Вы потеряли ${data.cost} монет.`, false);
                addHistory(`😞 Апгрейд: -${data.cost} монет (Баланс: ${data.newBalance})`);
            }
        } else {
            showMessage(`❌ ${data.message}`, false);
        }
    } catch (error) {
        showMessage('❌ Ошибка апгрейда', false);
    }
});

// Загружаем баланс при старте
updateBalance();