// SMS Notification for Traders — called when a buyer places an order
// Uses Twilio (free trial credits) or a generic SMS gateway
// Trader must opt in via the "SMS order alerts" toggle in their shop settings

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, message } = req.body || {};

  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone and message are required' });
  }

  // Sanitize phone: convert Ghana local format to international
  // 0XXXXXXXXX -> +233XXXXXXXXX
  let formattedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '233' + formattedPhone.substring(1);
  }

  // Truncate message to 160 chars (SMS limit)
  const smsText = message.substring(0, 155);

  try {
    // Option 1: Use environment variables for Twilio credentials
    // Set these in Vercel: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_FROM
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_FROM;

    if (accountSid && authToken && fromPhone) {
      // Use Twilio REST API directly (no SDK needed)
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const twilioResp = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromPhone,
          To: `+${formattedPhone}`,
          Body: smsText,
        }).toString(),
      });

      const twilioData = await twilioResp.json();
      if (twilioResp.ok) {
        return res.status(200).json({ success: true, messageId: twilioData.sid });
      } else {
        console.error('Twilio error:', twilioData);
        return res.status(500).json({ error: 'SMS failed', details: twilioData.message });
      }
    }

    // Option 2: Fallback — no SMS provider configured, log it
    // In production, the trader will still get the WhatsApp notification
    console.log(`[SMS not configured] Would send to +${formattedPhone}: ${smsText}`);
    return res.status(200).json({
      success: true,
      note: 'SMS provider not configured. WhatsApp notification was sent instead.',
      phone: formattedPhone,
    });
  } catch (err) {
    console.error('SMS notification error:', err);
    return res.status(500).json({ error: 'SMS notification failed', details: err.message });
  }
}
