const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Путь к файлу "базы данных"
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Middleware для обработки JSON и статики
app.use(express.json());
app.use(express.static('public'));

// Функция для чтения баланса из файла
function getBalance() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data).balance;
    } catch (error) {
        // Если файла нет или он битый, создаем новый с балансом 1000
        const defaultData = { balance: 1000 };
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultData));
        return defaultData.balance;
    }
}

// Функция для записи нового баланса
function setBalance(newBalance) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ balance: newBalance }));
}

// --- Эндпоинты API ---

// 1. Получить текущий баланс
app.get('/api/balance', (req, res) => {
    const balance = getBalance();
    res.json({ balance });
});

// 2. Пополнить баланс (на случайную сумму от 100 до 500)
app.post('/api/deposit', (req, res) => {
    let balance = getBalance();
    const amount = Math.floor(Math.random() * 400) + 100; // Случайная сумма
    balance += amount;
    setBalance(balance);
    res.json({ success: true, newBalance: balance, deposited: amount });
});

// 3. "Апгрейд" - списывает 50 монет и с вероятностью 60% возвращает выигрыш
app.post('/api/upgrade', (req, res) => {
    let balance = getBalance();
    const cost = 50;
    
    if (balance < cost) {
        return res.status(400).json({ success: false, message: 'Недостаточно средств!' });
    }

    // Списываем стоимость
    balance -= cost;
    
    // Симуляция апгрейда: 60% шанс на успех
    const isWin = Math.random() < 0.6; 
    let winAmount = 0;
    
    if (isWin) {
        // Выигрыш от 30 до 150 монет
        winAmount = Math.floor(Math.random() * 120) + 30;
        balance += winAmount;
    }

    setBalance(balance);
    
    res.json({
        success: true,
        newBalance: balance,
        isWin: isWin,
        winAmount: winAmount,
        cost: cost
    });
});

// Запускаем сервер
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});