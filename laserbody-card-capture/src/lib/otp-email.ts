type SendOtpInput = {
  toEmail: string;
  otpCode: string;
};

function isDevOtpMode() {
  return (process.env.CLAIM_OTP_DEV_MODE ?? "true").toLowerCase() === "true";
}

export async function sendOtpEmail(input: SendOtpInput) {
  if (isDevOtpMode()) {
    return { mode: "dev" as const, delivered: false };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.OTP_FROM_EMAIL;
  const subject = process.env.OTP_EMAIL_SUBJECT ?? "Your LaserbodyMD verification code";

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY for OTP email delivery.");
  }

  if (!fromEmail) {
    throw new Error("Missing OTP_FROM_EMAIL for OTP email delivery.");
  }

  const expiresMinutes = Number(process.env.CLAIM_OTP_EXPIRES_MINUTES ?? "10");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">LaserbodyMD verification code</h2>
      <p style="margin: 0 0 12px;">Use this one-time code to finish creating your account:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 0 0 12px;">${input.otpCode}</p>
      <p style="margin: 0; color: #4b5563;">This code expires in ${expiresMinutes} minutes.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.toEmail],
      subject,
      html,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || payload?.error || "Failed to send OTP email";
    throw new Error(message);
  }

  return {
    mode: "live" as const,
    delivered: true,
    providerMessageId: payload?.id ? String(payload.id) : undefined,
  };
}
