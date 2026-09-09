const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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
        puppeteer: {
            headless: true,
            // إعدادات خاصة وموفرة للذاكرة لمنع خطأ Detached Frame في Railway
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-component-update'
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

    client.on('authenticated', () => {
        console.log('🔒 تم التوثيق بنجاح');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ فشل التوثيق:', msg);
        isReady = false;
    });

    client.on('disconnected', (reason) => {
        isReady = false;
        qrCodeData = '';
        console.log('⚠️ تم الانفصال، جاري إعادت المحاولة:', reason);
        setTimeout(() => {
            initClient();
        }, 3000);
    });

    try {
        client.initialize();
    } catch (e) {
        console.error('Initialization error:', e);
    }
}

// مسار عرض الـ QR Code
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.send(`
            <div style="text-align:center;margin-top:15%;font-family:sans-serif;">
                <h2 style="color:green;">✅ السيرفر متصل بالواتساب وجاهز!</h2>
                <p>إذا واجهت مشاكل في الإرسال، اضغط هنا لإعادة الربط:</p>
                <a href="/logout" style="background:#dc2626;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">إعادة ربط حساب جديد (Logout)</a>
            </div>
        `);
    }

    if (!qrCodeData) {
        return res.send(`
            <div style="text-align:center;margin-top:20%;font-family:sans-serif;">
                <h2>⏳ جاري تحضير الـ QR Code...</h2>
                <script>setTimeout(() => { location.reload(); }, 4000);</script>
            </div>
        `);
    }
    
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

// مسار مسح الجلسة (Logout)
app.get('/logout', async (req, res) => {
    isReady = false;
    qrCodeData = '';
    
    try {
        await client.destroy();
    } catch (e) {
        console.log('Destroy Error:', e.message);
    }

    const sessionDir = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(sessionDir)) {
        try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (err) {
            console.error('Session clean error:', err);
        }
    }

    initClient();

    res.send(`
        <div style="text-align:center;margin-top:20%;font-family:sans-serif;">
            <h2 style="color:green;">🔄 تم إعادة تشغيل السيرفر وتنظيف الجلسة!</h2>
            <script>setTimeout(() => { window.location.href = "/qr"; }, 3000);</script>
        </div>
    `);
});

// مسار إرسال الـ OTP المحمي ضد توقف المتصفح
app.post('/send-otp', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ 
            success: false, 
            message: 'السيرفر غير مرتبط بالواتساب حالياً.' 
        });
    }

    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
        return res.status(400).json({ 
            success: false, 
            message: 'يرجى إرسال رقم الهاتف ورمز التفعيل.' 
        });
    }

    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('00')) {
        cleanNumber = cleanNumber.substring(2);
    }

    try {
        const chatId = `${cleanNumber}@c.us`;
        const messageText = `رمز التحقق الخاص بك هو: ${code}`;

        // إرسال مباشر لتجنب مشاكل Frame Navigation
        await client.sendMessage(chatId, messageText);
        console.log(`✅ تم إرسال الرمز ${code} بنجاح إلى ${chatId}`);

        return res.status(200).json({ 
            success: true, 
            message: 'تم إرسال الرمز بنجاح' 
        });

    } catch (error) {
        console.error('❌ خطأ في الإرسال:', error.message || error);

        // إذا حدث خطأ Frame Detached نعيد تهيئة العميل فوراً
        if (error.message && error.message.includes('Detached')) {
            isReady = false;
            initClient();
        }

        return res.status(500).json({
            success: false,
            message: 'حدث خطأ في السيرفر أثناء الإرسال: ' + error.message
        });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    initClient();
});
