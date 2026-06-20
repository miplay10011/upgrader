const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(express.json());
app.use(express.static('public'));

// ===== Инициализация БД =====
function initDB() {
    try {
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        if (data.balance === undefined || !data.history || !data.messages) throw new Error('Invalid DB');
        return data;
    } catch {
        const defaultData = { balance: 1000, history: [], messages: [] };
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultData));
        return defaultData;
    }
}

function readDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data));
}

// ===== Онлайн-пользователи (в памяти) =====
const onlineSessions = {};
let onlineCount = 0;
const HEARTBEAT_TIMEOUT = 30000;

setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [id, time] of Object.entries(onlineSessions)) {
        if (now - time > HEARTBEAT_TIMEOUT) {
            delete onlineSessions[id];
            changed = true;
        }
    }
    if (changed) {
        onlineCount = Object.keys(onlineSessions).length;
        console.log(`Online count: ${onlineCount}`);
    }
}, 5000);

// ===== Эндпоинты =====

// 1. Получить баланс, историю и онлайн
app.get('/api/balance', (req, res) => {
    const db = readDB();
    res.json({
        balance: db.balance,
        history: db.history.slice(-20),
        online: onlineCount
    });
});

// 2. Донат
app.post('/api/donate', (req, res) => {
    const { amount, promo } = req.body;
    const depositAmount = Number(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Некорректная сумма' });
    }
    if (depositAmount > 100000) {
        return res.status(400).json({ success: false, error: 'Сумма не может превышать 100 000' });
    }

    const db = readDB();
    let bonus = 0;
    if (promo && promo.toUpperCase() === 'UPGRADE2026') {
        bonus = 100;
    }
    const totalAdd = depositAmount + bonus;
    db.balance += totalAdd;
    writeDB(db);

    res.json({
        success: true,
        newBalance: db.balance,
        added: depositAmount,
        bonus: bonus > 0 ? bonus : undefined
    });
});

// 3. Вращение колеса
app.post('/api/spin', (req, res) => {
    const { bet, chance } = req.body;
    if (bet === undefined || chance === undefined) {
        return res.status(400).json({ error: 'Не указаны bet или chance' });
    }

    const db = readDB();
    const betAmount = Number(bet);
    const winChance = Number(chance);

    if (betAmount <= 0) {
        return res.status(400).json({ error: 'Ставка должна быть больше 0' });
    }
    if (betAmount > db.balance) {
        return res.status(400).json({ error: 'Недостаточно средств на балансе' });
    }
    if (winChance < 0 || winChance > 100) {
        return res.status(400).json({ error: 'Шанс должен быть от 0 до 100' });
    }

    db.balance -= betAmount;
    const roll = Math.random() * 100;
    const isWin = roll < winChance;

    let winAmount = 0;
    let multiplier = 1;
    if (isWin) {
        multiplier = Math.max(1, (100 / (winChance + 1)) * 1.2);
        multiplier = Math.round(multiplier * 100) / 100;
        winAmount = Math.round(betAmount * multiplier);
        db.balance += winAmount;
    }

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
    if (db.history.length > 50) db.history.shift();

    writeDB(db);

    res.json({
        success: true,
        isWin,
        winAmount: isWin ? winAmount : 0,
        multiplier: isWin ? multiplier : 0,
        newBalance: db.balance,
        history: db.history.slice(-20),
        online: onlineCount
    });
});

// ===== Онлайн =====
app.post('/api/online/join', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'No sessionId' });
    onlineSessions[sessionId] = Date.now();
    onlineCount = Object.keys(onlineSessions).length;
    res.json({ online: onlineCount });
});

app.post('/api/online/heartbeat', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'No sessionId' });
    if (onlineSessions[sessionId]) {
        onlineSessions[sessionId] = Date.now();
    } else {
        onlineSessions[sessionId] = Date.now();
        onlineCount = Object.keys(onlineSessions).length;
    }
    res.json({ online: onlineCount });
});

app.post('/api/online/leave', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId && onlineSessions[sessionId]) {
        delete onlineSessions[sessionId];
        onlineCount = Object.keys(onlineSessions).length;
    }
    res.json({ online: onlineCount });
});

// ===== Чат =====
app.get('/api/chat', (req, res) => {
    const db = readDB();
    res.json({ messages: (db.messages || []).slice(-50) });
});

app.post('/api/chat', (req, res) => {
    const { username, text } = req.body;
    if (!username || !text || text.trim() === '') {
        return res.status(400).json({ error: 'Не указаны имя или текст' });
    }
    const db = readDB();
    const newMsg = {
        username: username.trim().substring(0, 20),
        text: text.trim().substring(0, 200),
        time: new Date().toLocaleString()
    };
    db.messages.push(newMsg);
    if (db.messages.length > 100) db.messages.shift();
    writeDB(db);
    res.json({ success: true, message: newMsg });
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));