const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

let sock = null;
let qrCodeImage = '';
let isReady = false;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeImage = await QRCode.toDataURL(qr);
            isReady = false;
            console.log('⚡ تم توليد QR code جديد');
        }

        if (connection === 'close') {
            isReady = false;
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ انقطع الاتصال، جاري إعادة الاتصال:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            isReady = true;
            qrCodeImage = '';
            console.log('✅ تم الاتصال بالواتساب بنجاح عبر Baileys!');
        }
    });
}

// مسار عرض الـ QR Code
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.send('<h2 style="color:green;text-align:center;margin-top:20%;">✅ السيرفر جاهز ومرتبط بالواتساب!</h2>');
    }
    if (!qrCodeImage) {
        return res.send('<h2 style="text-align:center;margin-top:20%;">⏳ جاري تحضير الـ QR... انتظر 5 ثوانٍ ثم اعمل Refresh</h2>');
    }
    const html = `
        <html>
            <head>
                <title>WhatsApp QR</title>
                <meta http-equiv="refresh" content="10">
            </head>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:sans-serif;">
                <h2>امسح الـ QR Code للربط:</h2>
                <img src="${qrCodeImage}" width="300"/>
            </body>
        </html>
    `;
    res.send(html);
});

// مسار إرسال الـ OTP
app.post('/send-otp', async (req, res) => {
    if (!isReady || !sock) {
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

    // تجهيز الرقم وتنسيقه
    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const id = `${cleanNumber}@s.whatsapp.net`;
    const message = `رمز التحقق الخاص بك هو: ${code}`;

    // الرد الفوري لأندرويد
    res.status(200).json({ 
        success: true, 
        message: 'جاري إرسال الرمز' 
    });

    // الإرسال الفوري
    try {
        await sock.sendMessage(id, { text: message });
        console.log(`✅ تم إرسال الرمز ${code} إلى ${cleanNumber}`);
    } catch (error) {
        console.error('❌ خطأ في الإرسال:', error);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    connectToWhatsApp();
});
