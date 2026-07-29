const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');

// 1. تعريف التطبيق وتجهيز المتغيرات الأساسية
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

let qrCodeData = '';
let isReady = false;

// 2. إعداد عميل الواتساب مع خيارات Puppeteer
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        protocolTimeout: 120000,
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

// أحداث الواتساب
client.on('qr', (qr) => {
    qrCodeData = qr;
    isReady = false;
    console.log('--- تم توليد رمز QR بنجاح ---');
});

client.on('ready', () => {
    isReady = true;
    qrCodeData = '';
    console.log('✅ تم الاتصال بالواتساب بنجاح');
});

client.on('disconnected', (reason) => {
    isReady = false;
    console.log('❌ تم إغلاق الجلسة:', reason);
    client.initialize();
});

// 3. مسار عرض الـ QR Code في المتصفح
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.send('<h3>✅ الجهاز مرتبط بالواتساب بالفعل ويعمل بنجاح!</h3>');
    }
    if (!qrCodeData) {
        return res.send('<h3>⏳ جاري تحضير الـ QR Code، يرجى إعادة تحديث الصفحة بعد ثوانٍ...</h3>');
    }
    const html = `
        <html>
            <head><title>WhatsApp QR</title></head>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:sans-serif;">
                <h2>افتح الواتساب وامسح الـ QR Code:</h2>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}" />
            </body>
        </html>
    `;
    res.send(html);
});

// 4. مسار إرسال الـ OTP (رد فورى لمنع الـ Timeout)
app.post('/send-otp', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ 
            success: false, 
            message: 'سيرفر الواتساب غير جاهز أو لم يتم ربط الحساب بعد.' 
        });
    }

    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
        return res.status(400).json({ 
            success: false, 
            message: 'يرجى إرسال رقم الهاتف ورمز التفعيل.' 
        });
    }

    // تنظيف رقم الهاتف وإعداده بالصيغة المطلوبة
    let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (!formattedPhone.endsWith('@c.us')) {
        formattedPhone = `${formattedPhone}@c.us`;
    }

    const message = `رمز التحقق الخاص بك هو: ${code}`;

    // الرد الفوري على تطبيق أندرويد
    res.status(200).json({ 
        success: true, 
        message: 'تم إرسال الطلب، جاري التوصيل عبر الواتساب' 
    });

    // الإرسال في الخلفية
    try {
        await client.sendMessage(formattedPhone, message);
        console.log(`✅ تم إرسال الرمز ${code} بنجاح إلى ${phoneNumber}`);
    } catch (error) {
        console.error('❌ خطأ أثناء الإرسال في الخلفية:', error);
    }
});

// 5. تشغيل السيرفر
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    client.initialize();
});
