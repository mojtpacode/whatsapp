const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    // سيظهر رمز الـ QR في لوحة تحكم السيرفر لتقوم بمسحه
    qrcode.generate(qr, { small: true });
    console.log('سجل الدخول عبر مسح الـ QR Code من الواتساب في هاتفك');
});

client.on('ready', () => {
    console.log('السيرفر جاهز لإرسال الرسائل!');
});

client.initialize();

app.post('/send-otp', async (req, res) => {
    const { phoneNumber, code } = req.body;
    const formattedNumber = `${phoneNumber.replace('+', '')}@c.us`;
    const message = `رمز التأكيد الخاص بك هو: *${code}*`;

    try {
        await client.sendMessage(formattedNumber, message);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
