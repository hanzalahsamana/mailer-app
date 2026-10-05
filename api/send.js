// Vercel Serverless Function: /api/send
// Runs on the server so the SMTP2GO API key never reaches the browser.

const SMTP2GO_URL = "https://api.smtp2go.com/v3/email/send";

const toList = (value) =>
  String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ Message: "Method not allowed" });
  }

  const apiKey = process.env.SMTP2GO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      Message:
        "Server is missing SMTP2GO_API_KEY. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.",
    });
  }

  const { from, to, cc, bcc, subject, body, htmlBody, attachments } =
    req.body || {};

  if (!from || !to || !subject) {
    return res
      .status(400)
      .json({ Message: "From, To, and Subject are required." });
  }

  const payload = {
    sender: from,
    to: toList(to),
    subject,
    text_body: body || "",
  };
  if (htmlBody) payload.html_body = htmlBody;
  if (cc) payload.cc = toList(cc);
  if (bcc) payload.bcc = toList(bcc);
  if (Array.isArray(attachments) && attachments.length) {
    payload.attachments = attachments.map((a) => ({
      filename: a.Name,
      fileblob: a.Content,
      mimetype: a.ContentType,
    }));
  }

  try {
    const smtpRes = await fetch(SMTP2GO_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Smtp2go-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await smtpRes.json();
    const result = data.data || {};

    if (smtpRes.ok && result.succeeded > 0 && !result.failed) {
      return res
        .status(200)
        .json({ ErrorCode: 0, Message: "OK", MessageID: result.email_id });
    }

    return res.status(smtpRes.ok ? 422 : smtpRes.status).json({
      ErrorCode: 1,
      Message: result.error || "SMTP2GO could not send this email.",
    });
  } catch (err) {
    return res
      .status(502)
      .json({ Message: "Could not reach SMTP2GO: " + err.message });
  }
};
