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

// إعداد عميل الواتساب
let client = new Client({
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

function initWhatsApp() {
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
        console.log('⚠️ تم الانفصال، جاري إعادة التشغيل:', reason);
        client.initialize();
    });

    client.initialize();
}

// مسار عرض الـ QR Code
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.send(`
            <div style="text-align:center;margin-top:15%;font-family:sans-serif;">
                <h2 style="color:green;">✅ السيرفر يعتقد أنه مرتبط بالواتساب!</h2>
                <p>إذا لم تكن الرسائل تصل، اضغط الزر أدناه لحذف الجلسة وإعادة مسح الـ QR:</p>
                <a href="/logout" style="background:red;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">إعادة ربط حساب جديد (Logout)</a>
            </div>
        `);
    }
    if (!qrCodeData) {
        return res.send('<h2 style="text-align:center;margin-top:20%;font-family:sans-serif;">⏳ جاري تحضير الـ QR... انتظر 5 ثوانٍ ثم أعد تحديث الصفحة</h2>');
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

// مسار مسح الجلسة وإعادة الربط (Fix Logout)
app.get('/logout', async (req, res) => {
    isReady = false;
    qrCodeData = '';
    try {
        await client.destroy();
    } catch (e) {
        console.log('Error destroying client:', e);
    }
    
    // مسح مجلد الجلسات المخزنة
    const sessionPath = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    // إعادة إنشاء كائن جديد
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    initWhatsApp();

    res.send(`
        <div style="text-align:center;margin-top:20%;font-family:sans-serif;">
            <h2>🔄 تم مسح الجلسة القديمة بنجاح!</h2>
            <p>جاري توليد QR Code جديد... <a href="/qr">اضغط هنا للانتقال لصفحة الـ QR</a></p>
        </div>
    `);
});

// مسار إرسال الـ OTP
app.post('/send-otp', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ success: false, message: 'السيرفر غير مرتبط بالواتساب حالياً.' });
    }

    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
        return res.status(400).json({ success: false, message: 'يرجى إرسال رقم الهاتف ورمز التفعيل.' });
    }

    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('00')) {
        cleanNumber = cleanNumber.substring(2);
    }

    try {
        const numberDetails = await client.getNumberId(cleanNumber);
        
        if (!numberDetails) {
            console.log(`❌ الرقم ${cleanNumber} غير مسجل في الواتساب!`);
            return res.status(400).json({ success: false, message: 'رقم الهاتف غير مسجل في الواتساب.' });
        }

        const chatId = numberDetails._serialized;
        const message = `رمز التحقق الخاص بك هو: ${code}`;
        
        await client.sendMessage(chatId, message);
        console.log(`✅ تم إرسال الرمز ${code} بنجاح إلى ${cleanNumber}`);
        
        return res.status(200).json({ success: true, message: 'تم إرسال الرمز بنجاح!' });

    } catch (error) {
        console.error('❌ خطأ في الإرسال:', error.message || error);
        return res.status(500).json({ success: false, message: 'حدث خطأ أثناء إرسال الرسالة.' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    initWhatsApp();
});
