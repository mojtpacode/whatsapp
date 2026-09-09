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

function initWhatsApp() {
    client = new Client({
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
        qrCodeData = qr;
        isReady = false;
        console.log('⚡ تم توليد QR code جديد');
    });

    client.on('ready', () => {
        isReady = true;
        qrCodeData = '';
        console.log('✅ تم الاتصال بالواتساب بنجاح!');
    });

    client.on('disconnected', (reason) => {
        isReady = false;
        qrCodeData = '';
        console.log('⚠️ تم الانفصال، جاري إعادة المحاولة:', reason);
        setTimeout(initWhatsApp, 3000);
    });

    try {
        client.initialize();
    } catch (e) {
        console.error('Init Error:', e);
    }
}

app.get('/qr', (req, res) => {
    if (isReady) return res.send('<h2 style="color:green;text-align:center;margin-top:20%;">✅ السيرفر جاهز ومرتبط بالواتساب!</h2>');
    if (!qrCodeData) return res.send('<h2 style="text-align:center;margin-top:20%;">⏳ جاري تحضير الـ QR... أعد التحديث بعد 5 ثوانٍ</h2>');
    
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}`;
    res.send(`
        <html>
            <head><title>WhatsApp QR</title><meta http-equiv="refresh" content="10"></head>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:sans-serif;">
                <h2>امسح الـ QR Code لربط الحساب:</h2>
                <img src="${qrImageUrl}" width="300" height="300" />
            </body>
        </html>
    `);
});

app.post('/send-otp', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ success: false, message: 'السيرفر غير مرتبط بالواتساب حالياً.' });
    }

    const { phoneNumber, code } = req.body;
    if (!phoneNumber || !code) {
        return res.status(400).json({ success: false, message: 'يرجى إرسال رقم الهاتف ورمز التفعيل.' });
    }

    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('00')) cleanNumber = cleanNumber.substring(2);

    const chatId = `${cleanNumber}@c.us`;
    const messageText = `رمز التحقق الخاص بك هو: ${code}`;

    try {
        await client.sendMessage(chatId, messageText);
        console.log(`✅ تم إرسال الرمز ${code} بنجاح إلى ${cleanNumber}`);
        return res.status(200).json({ success: true, message: 'تم إرسال الرمز بنجاح' });
    } catch (error) {
        console.error('❌ خطأ في الإرسال:', error.message || error);
        
        // عند حدوث خطأ Frame Detached يتم إعادة تعيين العميل تلقائياً
        if (error.message && (error.message.includes('detached') || error.message.includes('closed'))) {
            isReady = false;
            try { await client.destroy(); } catch (e) {}
            setTimeout(initWhatsApp, 2000);
        }

        return res.status(500).json({ success: false, message: 'حدث خطأ في السيرفر أثناء الإرسال: ' + error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    initWhatsApp();
});
