/**
 * Generates the professional Tasklert Mail HTML & text template
 * matching the Tasklert purple/lavender design reference.
 */
export const generateTasklertMailHtml = ({
  senderName,
  senderEmail,
  subject,
  messageHtml,
  priority = "normal",
  actionDeadline = null,
  appUrl = "https://tasklert.app",
}) => {
  const isActionRequired = priority === "action_required";
  const isImportant = priority === "important";

  const deadlineFormatted = actionDeadline
    ? new Date(actionDeadline).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const priorityBadge = isActionRequired
    ? `<span style="display:inline-block;background-color:#EDE9FE;color:#6D28D9;font-size:12px;font-weight:700;padding:4px 10px;border-radius:12px;margin-bottom:12px;border:1px solid #DDD6FE;">⚡ Action Required</span>`
    : isImportant
    ? `<span style="display:inline-block;background-color:#FEF3C7;color:#B45309;font-size:12px;font-weight:700;padding:4px 10px;border-radius:12px;margin-bottom:12px;border:1px solid #FDE68A;">⭐ Important</span>`
    : "";

  const actionBox = isActionRequired
    ? `
      <div style="background-color:#F5F3FF;border:1px solid #DDD6FE;border-left:4px solid #7C3AED;border-radius:8px;padding:14px 16px;margin:20px 0;">
        <div style="color:#5B21B6;font-size:13px;font-weight:700;margin-bottom:4px;">📌 Action Required for this task</div>
        <div style="color:#4B5563;font-size:13px;line-height:1.5;">Please review the details above and provide your response or updates${
          deadlineFormatted ? ` by <strong>${deadlineFormatted}</strong>` : " at your earliest convenience"
        }.</div>
      </div>
    `
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width:600px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(124,58,237,0.06);border:1px solid #EDE9FE;">
          
          <!-- Gradient Purple Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);padding:28px 24px;text-align:center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-flex;align-items:center;background:rgba(255,255,255,0.15);padding:8px 18px;border-radius:24px;backdrop-filter:blur(8px);">
                      <span style="font-size:18px;margin-right:8px;color:#FFFFFF;">✓</span>
                      <span style="color:#FFFFFF;font-size:18px;font-weight:800;letter-spacing:-0.5px;">Tasklert</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td style="padding:28px 24px 20px 24px;">
              ${priorityBadge}
              
              <div style="font-size:15px;line-height:1.65;color:#334155;margin-bottom:16px;">
                ${messageHtml}
              </div>

              ${actionBox}

              <!-- View Details CTA Button -->
              <div style="text-align:left;margin:24px 0 12px 0;">
                <a href="${appUrl}" target="_blank" style="display:inline-block;background-color:#7C3AED;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:10px 20px;border-radius:10px;box-shadow:0 2px 6px rgba(124,58,237,0.25);">
                  View Details &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 24px;">
              <hr style="border:none;border-top:1px solid #F1F5F9;margin:0;">
            </td>
          </tr>

          <!-- Sender Attribution Card (Design Match) -->
          <tr>
            <td style="padding:18px 24px;background-color:#FAFAFE;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Left: Sent by -->
                  <td style="vertical-align:middle;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#8B5CF6;font-weight:700;">Sent by</div>
                    <div style="font-size:14px;font-weight:700;color:#1E293B;margin-top:2px;">${senderName || "Tasklert User"}</div>
                    <div style="font-size:12px;color:#64748B;">${senderEmail}</div>
                  </td>
                  
                  <!-- Right: Via Tasklert Mail -->
                  <td align="right" style="vertical-align:middle;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#8B5CF6;font-weight:700;">Via</div>
                    <div style="display:inline-flex;align-items:center;font-size:13px;font-weight:700;color:#6D28D9;margin-top:2px;">
                      <span style="margin-right:4px;">✉️</span> Tasklert Mail
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Disclaimer -->
          <tr>
            <td style="padding:16px 24px;background-color:#F8FAFC;text-align:center;border-top:1px solid #F1F5F9;">
              <p style="font-size:11px;color:#94A3B8;margin:0;line-height:1.4;">
                This email was sent via Tasklert Mail from <strong>${senderName}</strong>. 
                Replying to this email will deliver directly to ${senderEmail}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

export const generateTasklertMailText = ({
  senderName,
  senderEmail,
  subject,
  messageText,
  priority = "normal",
  actionDeadline = null,
}) => {
  const isActionRequired = priority === "action_required";
  const deadline = actionDeadline ? new Date(actionDeadline).toDateString() : null;

  return `
[TASKLERT MAIL]
${isActionRequired ? `*** ACTION REQUIRED ***${deadline ? ` (Due: ${deadline})` : ""}\n` : ""}
Subject: ${subject}

${messageText}

----------------------------------------------------
Sent by: ${senderName} (${senderEmail})
Via: Tasklert Mail (https://tasklert.app)
Reply to this email to reach the sender directly.
`.trim();
};
