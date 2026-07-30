const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

let qrCodeData = '';
let isReady = false;

// إعداد عميل الواتساب
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
    console.log('⚠️ تم الانفصال، جاري إعادة التشغيل:', reason);
    client.initialize();
});

// مسار عرض الـ QR Code عبر جوجل API مباشرة (بدون مكتبات جديدة)
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.send('<h2 style="color:green;text-align:center;margin-top:20%;">✅ السيرفر جاهز ومرتبط بالواتساب!</h2>');
    }
    if (!qrCodeData) {
        return res.send('<h2 style="text-align:center;margin-top:20%;">⏳ جاري تحضير الـ QR... انتظر 5 ثوانٍ ثم أعد تحديث الصفحة</h2>');
    }
    
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}`;
    
    const html = `
        <html>
            <head>
                <title>WhatsApp QR</title>
                <meta http-equiv="refresh" content="10">
            </head>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:sans-serif;">
                <h2>امسح الـ QR Code لربط الحساب:</h2>
                <img src="${qrImageUrl}" width="300" height="300" />
            </body>
        </html>
    `;
    res.send(html);
});

// مسار إرسال الـ OTP (استجابة فورية بدون تعليق)
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

    // رد فوري للتطبيق لمنع الـ Timeout
    res.status(200).json({ 
        success: true, 
        message: 'جاري الإرسال عبر الواتساب' 
    });

    // الإرسال الآمن في الخلفية
    try {
        const sanitizedNumber = await client.getNumberId(cleanNumber);
        if (sanitizedNumber) {
            const message = `رمز التحقق الخاص بك هو: ${code}`;
            await client.sendMessage(sanitizedNumber._serialized, message);
            console.log(`✅ تم إرسال الرمز ${code} بنجاح إلى ${cleanNumber}`);
        } else {
            console.error(`❌ الرقم ${cleanNumber} غير مسجل على الواتساب`);
        }
    } catch (error) {
        console.error('❌ خطأ في الإرسال:', error.message || error);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    client.initialize();
});
