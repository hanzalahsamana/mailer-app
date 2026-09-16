// Vercel Serverless Function: /api/send
// Runs on the server, so it can talk to Postmark without hitting CORS,
// and keeps the server token out of the browser entirely.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ Message: 'Method not allowed' });
  }

  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    return res.status(500).json({
      Message: 'Server is missing POSTMARK_SERVER_TOKEN. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.'
    });
  }

  const { from, to, cc, bcc, subject, body, attachments } = req.body || {};

  if (!from || !to || !subject) {
    return res.status(400).json({ Message: 'From, To, and Subject are required.' });
  }

  const payload = {
    From: from,
    To: to,
    Subject: subject,
    TextBody: body || '',
    MessageStream: 'outbound'
  };
  if (cc) payload.Cc = cc;
  if (bcc) payload.Bcc = bcc;
  if (Array.isArray(attachments) && attachments.length) {
    payload.Attachments = attachments;
  }

  try {
    const pmRes = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token
      },
      body: JSON.stringify(payload)
    });

    const data = await pmRes.json();
    return res.status(pmRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ Message: 'Could not reach Postmark: ' + err.message });
  }
}