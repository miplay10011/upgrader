const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(express.json());
app.use(express.static('public'));

// Инициализация БД
function initDB() {
    try {
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        if (data.balance === undefined || !data.history) throw new Error('Invalid DB');
        return data;
    } catch {
        const defaultData = { balance: 1000, history: [] };
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultData));
        return defaultData;
    }
}

// Чтение
function readDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

// Запись
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data));
}

// Получить баланс и историю
app.get('/api/balance', (req, res) => {
    const db = readDB();
    res.json({ balance: db.balance, history: db.history.slice(-20) }); // последние 20
});

// Пополнение (случайное)
app.post('/api/deposit', (req, res) => {
    const db = readDB();
    const amount = Math.floor(Math.random() * 400) + 100;
    db.balance += amount;
    writeDB(db);
    res.json({ success: true, newBalance: db.balance, deposited: amount });
});

// Вращение колеса
app.post('/api/spin', (req, res) => {
    const { bet, chance } = req.body;
    if (bet === undefined || chance === undefined) {
        return res.status(400).json({ error: 'Не указаны bet или chance' });
    }

    const db = readDB();
    const betAmount = Number(bet);
    const winChance = Number(chance); // 0..100

    // Проверка ставки
    if (betAmount <= 0) {
        return res.status(400).json({ error: 'Ставка должна быть больше 0' });
    }
    if (betAmount > db.balance) {
        return res.status(400).json({ error: 'Недостаточно средств на балансе' });
    }
    if (winChance < 0 || winChance > 100) {
        return res.status(400).json({ error: 'Шанс должен быть от 0 до 100' });
    }

    // Списываем ставку
    db.balance -= betAmount;

    // Определяем выигрыш
    const roll = Math.random() * 100;
    const isWin = roll < winChance;

    let winAmount = 0;
    // Коэффициент: чем меньше шанс, тем выше множитель (но не менее 1.0)
    // Формула: множитель = 100 / (winChance + 1) + 0.5, но ограничим
    let multiplier = 1;
    if (isWin) {
        // Базовый множитель: чем ниже шанс, тем выше (например, 100% => 1x, 10% => ~9x)
        multiplier = Math.max(1, (100 / (winChance + 1)) * 1.2);
        // Округлим до 2 знаков
        multiplier = Math.round(multiplier * 100) / 100;
        winAmount = Math.round(betAmount * multiplier);
        db.balance += winAmount;
    }

    // Сохраняем историю
    const entry = {
        time: new Date().toLocaleString(),
        bet: betAmount,
        chance: winChance,
        isWin,
        winAmount: isWin ? winAmount : 0,
        multiplier: isWin ? multiplier : 0,
        balanceAfter: db.balance
    };
    db.history.push(entry);
    // Ограничим историю 50 записями
    if (db.history.length > 50) db.history.shift();

    writeDB(db);

    res.json({
        success: true,
        isWin,
        winAmount: isWin ? winAmount : 0,
        multiplier: isWin ? multiplier : 0,
        newBalance: db.balance,
        history: db.history.slice(-20)
    });
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));