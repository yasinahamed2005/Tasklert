import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";

const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || "http://localhost:5173";
};

const getBackendUrl = () => {
  return process.env.BACKEND_URL || "http://localhost:5000";
};

const PROVIDER_NAMES = {
  google: "Google",
  facebook: "Facebook",
  github: "GitHub",
  linkedin: "LinkedIn",
};

/**
 * Check if a provider has configured credentials in environment
 */
export function isProviderConfigured(provider) {
  switch (provider) {
    case "google":
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    case "facebook":
      return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
    case "github":
      return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    case "linkedin":
      return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
    default:
      return false;
  }
}

/**
 * GET /api/auth/status
 * Returns configuration status for all providers (without exposing secrets)
 */
export async function getAuthStatus(req, res) {
  res.json({
    success: true,
    providers: {
      google: { configured: isProviderConfigured("google") },
      facebook: { configured: isProviderConfigured("facebook") },
      github: { configured: isProviderConfigured("github") },
      linkedin: { configured: isProviderConfigured("linkedin") },
    },
  });
}

/**
 * GET /api/auth/:provider
 * Initiates genuine OAuth 2.0 / OIDC Authorization-Code flow
 */
export async function initiateOAuth(req, res) {
  const provider = (req.params.provider || "").toLowerCase();
  const frontendUrl = getFrontendUrl();
  const backendUrl = getBackendUrl();

  if (!PROVIDER_NAMES[provider]) {
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(`Unsupported OAuth provider: ${provider}`)}`
    );
  }

  const providerName = PROVIDER_NAMES[provider];

  // 1. Verify provider credentials exist
  if (!isProviderConfigured(provider)) {
    const envPrefix =
      provider === "facebook" ? "FACEBOOK_APP" : `${provider.toUpperCase()}_CLIENT`;
    const errorMsg = `${providerName} authentication is not configured yet. Server administrator must set ${envPrefix}_ID and ${envPrefix}_SECRET in backend/.env.`;
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  // 2. Generate signed cryptographically secure state (prevents CSRF)
  const state = jwt.sign(
    {
      provider,
      nonce: crypto.randomBytes(16).toString("hex"),
      createdAt: Date.now(),
    },
    JWT_SECRET,
    { expiresIn: "10m" }
  );

  const callbackUrl = `${backendUrl}/api/auth/${provider}/callback`;

  // 3. Build genuine provider authorization URL
  try {
    let authUrl;

    switch (provider) {
      case "google": {
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
        url.searchParams.set("redirect_uri", callbackUrl);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", "openid email profile");
        url.searchParams.set("state", state);
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "select_account");
        authUrl = url.toString();
        break;
      }

      case "facebook": {
        const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
        url.searchParams.set("client_id", process.env.FACEBOOK_APP_ID);
        url.searchParams.set("redirect_uri", callbackUrl);
        url.searchParams.set("state", state);
        url.searchParams.set("scope", "email,public_profile");
        authUrl = url.toString();
        break;
      }

      case "github": {
        const url = new URL("https://github.com/login/oauth/authorize");
        url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
        url.searchParams.set("redirect_uri", callbackUrl);
        url.searchParams.set("state", state);
        url.searchParams.set("scope", "read:user user:email");
        authUrl = url.toString();
        break;
      }

      case "linkedin": {
        const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID);
        url.searchParams.set("redirect_uri", callbackUrl);
        url.searchParams.set("state", state);
        url.searchParams.set("scope", "openid profile email");
        authUrl = url.toString();
        break;
      }
    }

    return res.redirect(authUrl);
  } catch (err) {
    console.error(`Failed to initiate ${providerName} OAuth:`, err);
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(`Failed to initiate ${providerName} sign-in.`)}`
    );
  }
}

/**
 * GET /api/auth/:provider/callback
 * Handles genuine OAuth callback, server-to-server token exchange, and secure session creation
 */
export async function handleOAuthCallback(req, res) {
  const provider = (req.params.provider || "").toLowerCase();
  const frontendUrl = getFrontendUrl();
  const backendUrl = getBackendUrl();
  const providerName = PROVIDER_NAMES[provider] || "Social";

  const { code, state, error, error_description } = req.query;

  // 1. Check for provider-returned error or user cancellation
  if (error) {
    const errorMsg =
      error === "access_denied"
        ? `${providerName} sign-in was cancelled.`
        : error_description || error || `${providerName} authorization failed.`;
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  // 2. Validate state token (CSRF defense)
  if (!state) {
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent("Missing state parameter in authorization response.")}`
    );
  }

  try {
    const decoded = jwt.verify(state, JWT_SECRET);
    if (decoded.provider !== provider) {
      throw new Error("Provider mismatch in state parameter");
    }
  } catch (stateErr) {
    console.error("State validation error:", stateErr.message);
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent("Invalid or expired OAuth session state. Please try again.")}`
    );
  }

  // 3. Ensure authorization code is present
  if (!code) {
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent("No authorization code provided by provider.")}`
    );
  }

  const callbackUrl = `${backendUrl}/api/auth/${provider}/callback`;

  // 4. Server-to-server token exchange & profile retrieval
  let profile = null;

  try {
    switch (provider) {
      case "google": {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: callbackUrl,
            grant_type: "authorization_code",
          }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange Google token");
        }

        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userData = await userRes.json();
        if (!userData.sub || !userData.email) {
          throw new Error("Could not retrieve Google profile or email.");
        }

        if (userData.email_verified === false) {
          throw new Error("Google email is not verified. Please verify your Google account first.");
        }

        profile = {
          providerId: userData.sub,
          email: userData.email.toLowerCase().trim(),
          name: userData.name || userData.given_name || "Google User",
          avatar: userData.picture || "",
        };
        break;
      }

      case "facebook": {
        const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
        tokenUrl.searchParams.set("client_id", process.env.FACEBOOK_APP_ID);
        tokenUrl.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET);
        tokenUrl.searchParams.set("redirect_uri", callbackUrl);
        tokenUrl.searchParams.set("code", code);

        const tokenRes = await fetch(tokenUrl.toString());
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error?.message || "Failed to exchange Facebook token");
        }

        const userUrl = new URL("https://graph.facebook.com/v19.0/me");
        userUrl.searchParams.set("fields", "id,name,email,picture.type(large)");
        userUrl.searchParams.set("access_token", tokenData.access_token);

        const userRes = await fetch(userUrl.toString());
        const userData = await userRes.json();
        if (!userData.id) {
          throw new Error("Could not retrieve Facebook profile.");
        }

        if (!userData.email) {
          throw new Error("Facebook did not provide an email address. Please allow email access to sign in.");
        }

        profile = {
          providerId: userData.id,
          email: userData.email.toLowerCase().trim(),
          name: userData.name || "Facebook User",
          avatar: userData.picture?.data?.url || "",
        };
        break;
      }

      case "github": {
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: callbackUrl,
          }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange GitHub token");
        }

        const userRes = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "User-Agent": "Tasklert-App",
          },
        });

        const userData = await userRes.json();
        if (!userData.id) {
          throw new Error("Could not retrieve GitHub profile.");
        }

        // Handle private emails on GitHub
        let email = userData.email;
        if (!email) {
          const emailsRes = await fetch("https://api.github.com/user/emails", {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "User-Agent": "Tasklert-App",
            },
          });
          if (emailsRes.ok) {
            const emailsData = await emailsRes.json();
            const primary = emailsData.find((e) => e.primary && e.verified) || emailsData.find((e) => e.verified);
            if (primary) {
              email = primary.email;
            }
          }
        }

        if (!email) {
          throw new Error("Could not retrieve a verified email from GitHub. Please set a verified email on GitHub.");
        }

        profile = {
          providerId: String(userData.id),
          email: email.toLowerCase().trim(),
          name: userData.name || userData.login || "GitHub User",
          avatar: userData.avatar_url || "",
        };
        break;
      }

      case "linkedin": {
        const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: process.env.LINKEDIN_CLIENT_ID,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET,
            redirect_uri: callbackUrl,
          }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange LinkedIn token");
        }

        const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userData = await userRes.json();
        if (!userData.sub) {
          throw new Error("Could not retrieve LinkedIn user identity.");
        }

        if (!userData.email) {
          throw new Error("Could not retrieve email from LinkedIn.");
        }

        if (userData.email_verified === false) {
          throw new Error("Your LinkedIn email address is not verified.");
        }

        profile = {
          providerId: userData.sub,
          email: userData.email.toLowerCase().trim(),
          name:
            userData.name ||
            `${userData.given_name || ""} ${userData.family_name || ""}`.trim() ||
            "LinkedIn User",
          avatar: userData.picture || "",
        };
        break;
      }

      default:
        throw new Error(`Unsupported provider ${provider}`);
    }
  } catch (oauthErr) {
    console.error(`OAuth token/profile error for ${providerName}:`, oauthErr);
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(oauthErr.message || `Failed to authenticate with ${providerName}.`)}`
    );
  }

  // 5. Secure database lookup & account linking
  try {
    // Check if account already exists with this provider & providerId
    let user = await User.findOne({ provider, providerId: profile.providerId });

    if (!user) {
      // Check if email already belongs to a user with another provider or local password
      const existingWithEmail = await User.findOne({ email: profile.email });
      if (existingWithEmail) {
        const method =
          existingWithEmail.provider === "local" ? "Email & Password" : PROVIDER_NAMES[existingWithEmail.provider] || existingWithEmail.provider;
        const msg = `An account with ${profile.email} is already registered via ${method}. Please sign in with that method to avoid account duplication.`;
        return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(msg)}`);
      }

      // Create new authenticated user
      user = await User.create({
        name: profile.name,
        email: profile.email,
        provider,
        providerId: profile.providerId,
        avatar: profile.avatar || "",
      });
    } else {
      // Update avatar if provider provided a new one
      if (profile.avatar && user.avatar !== profile.avatar) {
        user.avatar = profile.avatar;
        await user.save();
      }
    }

    // 6. Establish application session via JWT token
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "24h" });

    // 7. Redirect back to frontend with session credentials
    const redirectUrl = new URL(`${frontendUrl}/login`);
    redirectUrl.searchParams.set("oauth_success", "true");
    redirectUrl.searchParams.set("token", token);
    redirectUrl.searchParams.set("userId", String(user._id));
    redirectUrl.searchParams.set("name", user.name);
    redirectUrl.searchParams.set("email", user.email);
    if (user.avatar) redirectUrl.searchParams.set("avatar", user.avatar);
    redirectUrl.searchParams.set("provider", provider);

    return res.redirect(redirectUrl.toString());
  } catch (dbErr) {
    console.error("Database user creation/lookup error:", dbErr);
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent("Server database error while finalizing sign-in.")}`
    );
  }
}
