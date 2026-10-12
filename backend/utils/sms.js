import twilio from "twilio";

let client = null;

const getClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    throw new Error(
      "SMS is not configured yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER to backend/.env"
    );
  }

  if (!client) {
    client = twilio(sid, token);
  }
  return client;
};

// Sends a text (and, if a public backend URL is configured, an MMS with the
// first attachment) via Twilio.
export const sendSms = async ({ to, body, mediaUrls = [] }) => {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error(
      "Missing TWILIO_PHONE_NUMBER in backend/.env — add the Twilio number to send SMS from."
    );
  }

  const twilioClient = getClient();

  const payload = {
    from,
    to,
    body: body || " ",
  };

  // Twilio only accepts publicly reachable media URLs for MMS attachments.
  if (mediaUrls.length > 0) {
    payload.mediaUrl = mediaUrls;
  }

  const result = await twilioClient.messages.create(payload);
  return result;
};
