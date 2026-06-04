// Vercel serverless function — POST /api/send
// Receives the date-night answers from the frontend and emails them to you via Resend.
// The API key lives ONLY here on the server, never in the browser.

const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_NUTogNvK_57DyTdYzmZTru6YJ9WbnJ3FN";
const TO_EMAIL   = process.env.TO_EMAIL   || "ethanrwilliams@me.com";
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Vercel parses JSON bodies automatically; fall back to manual parse just in case.
    let body = req.body;
    if (!body || typeof body === "string") {
      try { body = JSON.parse(body || "{}"); } catch { body = {}; }
    }

    const { questions = [], date, time, phone, note, submittedAt } = body;

    const qaRows = questions.map(
      (q) => `
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid rgba(51,33,29,.10);color:rgba(51,33,29,.58);font-size:14px;width:48%;vertical-align:top;">${esc(q.question)}</td>
          <td style="padding:11px 0 11px 14px;border-bottom:1px solid rgba(51,33,29,.10);color:#33211d;font-size:15px;font-weight:600;vertical-align:top;">${esc(q.answer)}</td>
        </tr>`
    ).join("");

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f8f1e6;padding:32px 18px;">
        <div style="max-width:560px;margin:0 auto;background:#fffaf2;border:1px solid rgba(51,33,29,.12);border-radius:22px;overflow:hidden;box-shadow:0 24px 60px -22px rgba(120,60,40,.35);">
          <div style="padding:30px 30px 26px;border-bottom:1px solid rgba(51,33,29,.10);">
            <div style="font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:#c7553f;font-weight:600;">She said yes</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;color:#33211d;margin-top:8px;font-style:italic;">Her date-night plan</div>
          </div>
          <div style="padding:26px 30px;">
            <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(51,33,29,.45);font-weight:600;margin-bottom:5px;">When she's free</div>
            <p style="margin:0 0 22px;color:#33211d;font-size:18px;font-weight:600;">${esc(date)} &nbsp;·&nbsp; ${esc(time)}</p>

            <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(51,33,29,.45);font-weight:600;margin-bottom:5px;">Reach her at</div>
            <p style="margin:0 0 22px;color:#33211d;font-size:18px;font-weight:600;">${esc(phone)}</p>

            ${note ? `<div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(51,33,29,.45);font-weight:600;margin-bottom:5px;">Her note</div>
            <p style="margin:0 0 22px;color:#33211d;font-size:15px;line-height:1.55;background:rgba(199,85,63,.08);border-left:2px solid #c7553f;border-radius:8px;padding:13px 15px;">${esc(note)}</p>` : ""}

            <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(51,33,29,.45);font-weight:600;margin:24px 0 10px;">Her picks</div>
            <table style="width:100%;border-collapse:collapse;">
              ${qaRows}
            </table>

            <p style="margin:22px 0 0;color:rgba(51,33,29,.35);font-size:12px;">Submitted ${esc(submittedAt || "")}</p>
          </div>
        </div>
      </div>`;

    const text =
      `She said yes.\n\nWhen: ${date} at ${time}\nPhone: ${phone}\n` +
      (note ? `Note: ${note}\n` : "") + `\nHer picks:\n` +
      questions.map((q) => `- ${q.question}\n  ${q.answer}`).join("\n") +
      `\n\nSubmitted ${submittedAt || ""}`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Date Night <${FROM_EMAIL}>`,
        to: [TO_EMAIL],
        subject: "She said yes — the date-night plan",
        html,
        text,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      res.status(502).json({ error: "Resend error", detail: errText });
      return;
    }

    const data = await resp.json();
    res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: String(err && err.message || err) });
  }
};
