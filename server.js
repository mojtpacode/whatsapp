const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let qrImageUrl = '';
let isClientReady = false;

// إعداد عميل الواتساب مع خيارات المتصفح المتوافقة مع Railway
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
            '--disable-gpu'
        ]
    }
});

// عند توليد رمز الـ QR
client.on('qr', (qr) => {
    // طباعة الرمز في السجلات كنسخة احتياطية
    qrcode.generate(qr, { small: true });
    
    // إنشاء رابط صورة ناعمة ونقية للـ QR
    qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
    console.log('--- تم توليد رمز QR جديد، يمكنك رؤيته عبر الرابط /qr ---');
});

// عند نجاح الاتصال
client.on('ready', () => {
    isClientReady = true;
    qrImageUrl = '';
    console.log('✅ تم الاتصال بالواتساب بنجاح! السيرفر جاهز لإرسال الرسائل.');
});

// صفحة عرض الـ QR Code كصورة ناعمة في المتصفح
app.get('/qr', (req, res) => {
    if (isClientReady) {
        return res.send(`
            <div style="text-align:center; padding-top:50px; font-family:sans-serif;">
                <h2 style="color:green;">✅ الحساب مرتبط وجاهز للعمل!</h2>
                <p>لا تحتاج لمسح الـ QR مرة أخرى.</p>
            </div>
        `);
    }

    if (qrImageUrl) {
        return res.send(`
            <div style="text-align:center; padding-top:30px; font-family:sans-serif;">
                <h2>امسح رمز الـ QR لتسجيل الدخول</h2>
                <img src="${qrImageUrl}" alt="WhatsApp QR Code" style="border: 5px solid #333; padding: 10px; border-radius: 8px;" />
                <p>قم بتحديث الصفحة إذا انتهت صلاحية الرمز.</p>
            </div>
        `);
    }

    res.send(`
        <div style="text-align:center; padding-top:50px; font-family:sans-serif;">
            <h2>⏳ جاري إعداد رمز الـ QR...</h2>
            <p>يرجى الانتظار بضع ثوانٍ ثم تحديث الصفحة.</p>
        </div>
    `);
});

// مسار إرسال الـ OTP لتطبيق Sketchware
app.post('/send-otp', async (req, res) => {
    const { phoneNumber, code } = req.body;

    if (!isClientReady) {
        return res.status(503).json({ success: false, message: 'سيرفر الواتساب غير متصل بعد.' });
    }

    if (!phoneNumber || !code) {
        return res.status(400).json({ success: false, message: 'يرجى تزويد رقم الهاتف وكود التحقق.' });
    }

    try {
        // تنظيف رقم الهاتف وتجهيزه بصيغة الواتساب الدولية
        let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        const chatId = `${cleanNumber}@c.us`;

        const message = `رمز التفعيل الخاص بك هو: ${code}`;

        await client.sendMessage(chatId, message);
        console.log(`تم إرسال الـ OTP إلى ${cleanNumber}`);
        
        res.json({ success: true, message: 'تم إرسال الرسالة بنجاح' });
    } catch (error) {
        console.error('خطأ أثناء الإرسال:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

client.initialize();

app.listen(PORT, () => {
    console.log(`السيرفر يعمل الآن على البورت ${PORT}`);
});
