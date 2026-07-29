const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let qrCodeImage = '';
let isClientReady = false;

// إعداد Puppeteer ليستخدم Chromium الذي قمنا بتثبيته عبر Dockerfile
const client = new Client({
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
            '--disable-gpu'
        ]
    }
});

// تحويل الـ QR Code إلى صورة Base64 عند توليده
client.on('qr', async (qr) => {
    try {
        qrCodeImage = await QRCode.toDataURL(qr);
        console.log('--- تم توليد رمز QR بنجاح! ---');
    } catch (err) {
        console.error('خطأ أثناء تحويل الـ QR إلى صورة:', err);
    }
});

// عند جاهزية الواتساب
client.on('ready', () => {
    isClientReady = true;
    qrCodeImage = '';
    console.log('✅ تم الاتصال بالواتساب بنجاح!');
});

// صفحة الـ QR Code المباشرة
app.get('/qr', (req, res) => {
    if (isClientReady) {
        return res.send(`
            <div style="text-align:center; padding-top:50px; font-family:sans-serif;">
                <h2 style="color:green;">✅ الحساب مرتبط وجاهز للعمل!</h2>
            </div>
        `);
    }

    if (qrCodeImage) {
        return res.send(`
            <div style="text-align:center; padding-top:30px; font-family:sans-serif;">
                <h2>امسح رمز الـ QR لتسجيل الدخول</h2>
                <img src="${qrCodeImage}" alt="QR Code" style="width:280px; height:280px; border:4px solid #333; border-radius:10px; margin-top:10px;" />
                <p style="color:#666;">قم بتحديث الصفحة إذا انتهت صلاحية الرمز.</p>
            </div>
        `);
    }

    res.send(`
        <div style="text-align:center; padding-top:50px; font-family:sans-serif;">
            <h2>⏳ جاري تجهيز الـ QR Code...</h2>
            <p>انتظر بضع ثوانٍ ثم قم بتحديث الصفحة.</p>
        </div>
    `);
});

// مسار إرسال الـ OTP
app.post('/send-otp', async (req, res) => {
    const { phoneNumber, code } = req.body;

    if (!isClientReady) {
        return res.status(503).json({ success: false, message: 'سيرفر الواتساب غير متصل بعد.' });
    }

    if (!phoneNumber || !code) {
        return res.status(400).json({ success: false, message: 'يرجى إرسال رقم الهاتف والكود.' });
    }

    try {
        let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        const chatId = `${cleanNumber}@c.us`;
        
        await client.sendMessage(chatId, `رمز التفعيل الخاص بك هو: ${code}`);
        
        console.log(`تم إرسال الـ OTP إلى: ${cleanNumber}`);
        res.json({ success: true, message: 'تم إرسال الرسالة بنجاح' });
    } catch (error) {
        console.error('خطأ أثناء الإرسال:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

client.initialize();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
