const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
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
    console.log('=== امسح رمز الـ QR التالي عبر الواتساب ===');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('جاهز لإرسال رسائل التأكيد!');
});

client.initialize();

app.post('/send-otp', async (req, res) => {
    const { phoneNumber, code } = req.body;
    if (!phoneNumber || !code) {
        return res.status(400).json({ success: false, message: 'بيانات غير مكتملة' });
    }

    const formattedNumber = `${phoneNumber.replace('+', '').replace(/\s/g, '')}@c.us`;
    const message = `رمز التأكيد الخاص بك هو: *${code}*`;

    try {
        await client.sendMessage(formattedNumber, message);
        res.status(200).json({ success: true, message: 'تم الإرسال بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
