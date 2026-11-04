import twilio from "twilio";

let client = null;

const getClient = () => {
  const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();

  const isGenuineSid = sid.startsWith("AC") && sid.length === 34 && !sid.toLowerCase().includes("your_");
  const isGenuineToken = token.length >= 32 && !token.toLowerCase().includes("your_");

  if (!isGenuineSid || !isGenuineToken) {
    throw new Error(
      "SMS provider is not configured. Add valid TWILIO_ACCOUNT_SID (must start with AC), TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER to backend/.env"
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
