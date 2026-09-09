const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*' }));
app.use(express.json());

let qrCodeData = '';
let isReady = false;
let client;

function startClient() {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', (qr) => {
        qrCodeData = qr;
        isReady = false;
        console.log('⚡ تم توليد QR code جديد');
    });

    client.on('ready', () => {
        isReady = true;
        qrCodeData = '';
        console.log('✅ تم الاتصال بالواتساب بنجاح!');
    });

    client.on('disconnected', () => {
        isReady = false;
        console.log('⚠️ تم الانفصال، جاري إعادة التشغيل...');
        setTimeout(startClient, 3000);
    });

    try {
        client.initialize();
    } catch (err) {
        console.error('Initialization error:', err);
    }
}

app.get('/qr', (req, res) => {
    if (isReady) return res.send('<h2 style="color:green;text-align:center;">✅ السيرفر متصل بالواتساب!</h2>');
    if (!qrCodeData) return res.send('<h2 style="text-align:center;">⏳ جاري تحضير الـ QR Code... أعد التحديث بعد 5 ثوانٍ</h2>');
    res.send(`<div style="text-align:center;margin-top:10%;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}"/></div>`);
});

app.post('/send-otp', async (req, res) => {
    if (!isReady) return res.status(503).json({ success: false, message: 'السيرفر غير جاهز' });

    const { phoneNumber, code } = req.body;
    if (!phoneNumber || !code) return res.status(400).json({ success: false, message: 'بيانات ناقصة' });

    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('00')) cleanNumber = cleanNumber.substring(2);

    try {
        const chatId = `${cleanNumber}@c.us`;
        await client.sendMessage(chatId, `رمز التحقق الخاص بك هو: ${code}`);
        console.log(`✅ تم الإرسال بنجاح إلى ${cleanNumber}`);
        return res.json({ success: true, message: 'تم إرسال الرمز بنجاح' });
    } catch (error) {
        console.error('❌ خطأ في الإرسال:', error.message);
        if (error.message.includes('detached') || error.message.includes('closed')) {
            isReady = false;
            startClient();
        }
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    startClient();
});
