// مسار إرسال الـ OTP (معالج الأخطاء)
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

    // تنظيف رقم الهاتف 
    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');

    // الرد الفوري للتطبيق لضمان عدم حدوث Timeout في أندرويد
    res.status(200).json({ 
        success: true, 
        message: 'تم استقبال الطلب، جاري معالجة الإرسال...' 
    });

    // تنفيذ الإرسال في الخلفية مع التحقق من معرّف الواتساب
    try {
        // 1. الحصول على معرف الواتساب الصحيح للرقم لتجنب خطأ No LID
        const sanitizedNumber = await client.getNumberId(cleanNumber);

        if (sanitizedNumber) {
            const message = `رمز التحقق الخاص بك هو: ${code}`;
            await client.sendMessage(sanitizedNumber._serialized, message);
            console.log(`✅ تم إرسال الرمز ${code} بنجاح إلى ${cleanNumber}`);
        } else {
            console.error(`❌ الرقم ${cleanNumber} غير مسجل في الواتساب!`);
        }
    } catch (error) {
        console.error('❌ خطأ أثناء الإرسال في الخلفية:', error.message || error);
    }
});
