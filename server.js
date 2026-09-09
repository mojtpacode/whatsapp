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

function initClient() {
    client = new Client({
        authStrategy: new LocalAuth(),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process']
        }
    });

    client.on('qr', (qr) => { qrCodeData = qr; isReady = false; });
    client.on('ready', () => { isReady = true; qrCodeData = ''; console.log('✅ جاهز'); });
    client.on('disconnected', () => { isReady = false; setTimeout(initClient, 3000); });

    try { client.initialize(); } catch (e) { console.error(e); }
}

app.get('/qr', (req, res) => {
    if (isReady) return res.send('<h2 style="color:green;text-align:center;">✅ السيرفر متصل!</h2>');
    if (!qrCodeData) return res.send('<h2 style="text-align:center;">⏳ جاري التحضير... أعد التحديث بعد 5 ثوانٍ</h2>');
    res.send(`<div style="text-align:center;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}"/></div>`);
});

app.post('/send-otp', async (req, res) => {
    if (!isReady) return res.status(503).json({ success: false, message: 'السيرفر غير متصل بالواتساب' });
    const { phoneNumber, code } = req.body;
    if (!phoneNumber || !code) return res.status(400).json({ success: false, message: 'بيانات ناقصة' });

    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('00')) cleanNumber = cleanNumber.substring(2);

    try {
        const chatId = `${cleanNumber}@c.us`;
        await client.sendMessage(chatId, `رمز التحقق الخاص بك هو: ${code}`);
        console.log(`✅ تم الإرسال إلى ${cleanNumber}`);
        return res.json({ success: true, message: 'تم الإرسال بنجاح' });
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        // في حال انفصال الإطار، نعيد تشغيل الجلسة فوراً
        if (error.message.includes('detached') || error.message.includes('closed')) {
            isReady = false;
            initClient();
        }
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(port, '0.0.0.0', () => { console.log(`Running on ${port}`); initClient(); });
