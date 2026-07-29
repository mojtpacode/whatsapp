const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

let qrCodeData = '';
let isReady = false;

// إعداد عميل الواتساب مع خيارات Puppeteer المحسنة لتفادي الـ Timeout
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        protocolTimeout: 120000, // زيادة مهلة بروتوكول Puppeteer إلى دقيقتين
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

// عند توليد الـ QR Code
client.on('qr', (qr) => {
    qrCodeData = qr;
    isReady = false;
    console.log('--- تم توليد رمز QR بنجاح ---');
});

// عند اكتمال الاتصال بالواتساب
client.on('ready', () => {
    isReady = true;
    qrCodeData = '';
    console.log('✅ تم الاتصال بالواتساب بنجاح');
});

// عند انقطاع الاتصال
client.on('disconnected', (reason) => {
    isReady = false;
    console.log('❌ تم إغلاق الجلسة:', reason);
    client.initialize();
});

// مسار عرض الـ QR Code في المتصفح
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

// مسار إرسال الـ OTP
app.post('/send-otp', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ 
            success: false, 
            message: 'سيرفر الواتساب غير جاهز أو لم يتم ربط الحساب بعد.' 
        });
    }

    try {
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

        // إرسال الرسالة عبر الواتساب
        await client.sendMessage(formattedPhone, message);

        console.log(`✅ تم إرسال الرمز ${code} إلى ${phoneNumber}`);
        return res.status(200).json({ 
            success: true, 
            message: 'تم إرسال الرمز بنجاح' 
        });

    } catch (error) {
        console.error('❌ خطأ أثناء الإرسال:', error);
        return res.status(500).json({ 
            success: false, 
            message: error.message || 'حدث خطأ أثناء الإرسال' 
        });
    }
});

// تشغيل السيرفر
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    client.initialize();
});
        console.error('خطأ أثناء تحويل الـ QR إلى صورة:', err);
    }
});

// عند اكتمال الاتصال بالواتساب
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

// ربط السيرفر على 0.0.0.0 لمنع خطأ 502 Bad Gateway
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
