const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: '*' }));
app.use(express.json());

let sock = null;
let qrCodeData = '';
let isReady = false;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Hala Aljouf OTP", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeData = qr;
            isReady = false;
            console.log('⚡ تم توليد QR code جديد');
        }

        if (connection === 'open') {
            isReady = true;
            qrCodeData = '';
            console.log('✅ تم الاتصال بالواتساب بنجاح عبر Baileys!');
        }

        if (connection === 'close') {
            isReady = false;
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('⚠️ تم قطع الاتصال، جاري إعادة المحاولة:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 3000);
            }
        }
    });
}

// مسار عرض الـ QR
app.get('/qr', async (req, res) => {
    if (isReady) {
        return res.send(`
            <div style="text-align:center;margin-top:15%;font-family:sans-serif;">
                <h2 style="color:green;">✅ السيرفر متصل بالواتساب ومستقر 100%!</h2>
                <br>
                <a href="/logout" style="background:#dc2626;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">إعادة ربط حساب جديد (Logout)</a>
            </div>
        `);
    }

    if (!qrCodeData) {
        return res.send(`
            <div style="text-align:center;margin-top:20%;font-family:sans-serif;">
                <h2>⏳ جاري تحضير الـ QR Code...</h2>
                <script>setTimeout(() => { location.reload(); }, 3000);</script>
            </div>
        `);
    }

    try {
        const qrImageUrl = await QRCode.toDataURL(qrCodeData);
        res.send(`
            <html>
                <head><title>WhatsApp QR</title><meta http-equiv="refresh" content="5"></head>
                <body style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:sans-serif;">
                    <h2>امسح الـ QR Code لربط الحساب:</h2>
                    <img src="${qrImageUrl}" width="300" height="300" />
                </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('خطأ في إنتاج صورة الـ QR');
    }
});

// مسار تسجيل الخروج
app.get('/logout', async (req, res) => {
    isReady = false;
    qrCodeData = '';
    
    const authFolder = path.join(__dirname, 'baileys_auth_info');
    if (fs.existsSync(authFolder)) {
        try {
            fs.rmSync(authFolder, { recursive: true, force: true });
        } catch (e) {
            console.error('Logout clean error:', e);
        }
    }

    if (sock) {
        try { sock.end(); } catch (e) {}
    }

    setTimeout(connectToWhatsApp, 2000);

    res.send(`
        <div style="text-align:center;margin-top:20%;font-family:sans-serif;">
            <h2 style="color:green;">🔄 تم إعادة تشغيل السيرفر وتنظيف الجلسة!</h2>
            <script>setTimeout(() => { window.location.href = "/qr"; }, 3000);</script>
        </div>
    `);
});

// مسار إرسال الـ OTP
app.post('/send-otp', async (req, res) => {
    if (!isReady || !sock) {
        return res.status(503).json({ success: false, message: 'السيرفر غير متصل بالواتساب حالياً.' });
    }

    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
        return res.status(400).json({ success: false, message: 'يرجى إرسال رقم الهاتف ورمز التفعيل.' });
    }

    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('00')) {
        cleanNumber = cleanNumber.substring(2);
    }

    const recipientJid = `${cleanNumber}@s.whatsapp.net`;
    const messageText = `رمز التحقق الخاص بك هو: ${code}`;

    try {
        await sock.sendMessage(recipientJid, { text: messageText });
        console.log(`✅ تم إرسال الرمز ${code} بنجاح إلى ${cleanNumber}`);

        return res.status(200).json({ success: true, message: 'تم إرسال الرمز بنجاح' });
    } catch (error) {
        console.error('❌ خطأ في الإرسال:', error.message || error);
        return res.status(500).json({ success: false, message: 'حدث خطأ في السيرفر: ' + error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    connectToWhatsApp();
});
