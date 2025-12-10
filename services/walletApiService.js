const axios = require("axios");

const WALLET_API_BASE_URL = process.env.WALLET_API_BASE_URL || "http://localhost:30510/v1";
const WALLET_API_USERNAME = process.env.WALLET_API_USERNAME || "neo_bpay";
const WALLET_API_PASSWORD = process.env.WALLET_API_PASSWORD || "123456";

let walletServiceToken = null;
let tokenExpiry = null;

async function getWalletServiceToken() {
  try {
    if (walletServiceToken && tokenExpiry && Date.now() < tokenExpiry) {
      return walletServiceToken;
    }

    console.log("🔑 [WALLET API] Requesting service token...");
    console.log("🔑 [WALLET API] URL:", `${WALLET_API_BASE_URL}/auth/token`);
    console.log("🔑 [WALLET API] Username:", WALLET_API_USERNAME);

    const response = await axios.post(`${WALLET_API_BASE_URL}/auth/token`, {
      username: WALLET_API_USERNAME,
      password: WALLET_API_PASSWORD,
    }, {
      timeout: 10000,
    });

    console.log("🔑 [WALLET API] Response status:", response.status);
    console.log("🔑 [WALLET API] Response data:", JSON.stringify(response.data).substring(0, 200));

    if (response.data && response.data.token) {
      walletServiceToken = response.data.token;
      tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      console.log("✅ [WALLET API] Service token obtained successfully");
      return walletServiceToken;
    }

    console.error("❌ [WALLET API] Token not found in response:", response.data);
    throw new Error("Failed to get wallet service token - token not in response");
  } catch (error) {
    if (error.response) {
      console.error("❌ [WALLET API] Error response status:", error.response.status);
      console.error("❌ [WALLET API] Error response data:", error.response.data);
    } else if (error.request) {
      console.error("❌ [WALLET API] No response received. URL:", `${WALLET_API_BASE_URL}/auth/token`);
      console.error("❌ [WALLET API] Check if Wallet API service is running and accessible");
    } else {
      console.error("❌ [WALLET API] Error setting up request:", error.message);
    }
    console.error("❌ [WALLET API] Full error:", error.message);
    throw new Error(`Failed to get wallet service token: ${error.message}`);
  }
}

async function getUserInfo(userId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(`${WALLET_API_BASE_URL}/api/user`, {
      headers: {
        userId: userId,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data && response.data.responseCode) {
      if (response.data.data && Object.keys(response.data.data).length > 0) {
        return response.data.data;
      }
      return null;
    }

    return null;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        return null;
      }
      if (error.response.status === 400 && error.response.data) {
        return null;
      }
    }
    console.error("Error getting user info from wallet API:", error.message);
    throw error;
  }
}

async function getBillingByAddress(userId, bairId, doorNo) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/billing/address/${bairId}/${doorNo}`,
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    console.error("Error getting billing by address from wallet API:", error.message);
    throw error;
  }
}

async function registerUser(phone, email) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.post(
      `${WALLET_API_BASE_URL}/api/user`,
      {
        email: email,
        phone: phone,
      },
      {
        headers: {
          userId: phone,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    throw new Error("Failed to register user in Wallet API");
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Registration failed";
      throw new Error(errorMessage);
    }
    console.error("Error registering user in wallet API:", error.message);
    throw error;
  }
}

module.exports = {
  getUserInfo,
  getBillingByAddress,
  getWalletServiceToken,
  registerUser,
};

