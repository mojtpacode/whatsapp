// مسار إرسال الـ OTP (معدل للاستجابة السريعة)
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

    // 1. الرد الفوري على تطبيق أندرويد لمنع خطأ Timeout
    res.status(200).json({ 
        success: true, 
        message: 'تم إرسال الطلب، جاري التوصيل عبر الواتساب' 
    });

    // 2. إرسال الرسالة في الخلفية
    try {
        await client.sendMessage(formattedPhone, message);
        console.log(`✅ تم إرسال الرمز ${code} بنجاح إلى ${phoneNumber}`);
    } catch (error) {
        console.error('❌ خطأ أثناء الإرسال في الخلفية:', error);
    }
});
