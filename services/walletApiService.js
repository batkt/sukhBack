const axios = require("axios");

const WALLET_API_BASE_URL = process.env.WALLET_API_BASE_URL || "http://localhost:30510/v1";
const WALLET_API_USERNAME = process.env.WALLET_API_USERNAME || "neo_bpay";
const WALLET_API_PASSWORD = process.env.WALLET_API_PASSWORD || "123456";

let walletServiceToken = null;
let tokenExpiry = null;

function sanitizeNullValues(obj) {
  if (obj === null || obj === undefined) {
    return {};
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeNullValues(item));
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (value === null) {
        sanitized[key] = "";
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeNullValues(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
}

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

    if (response.data && response.data.accessToken) {
      walletServiceToken = response.data.accessToken;
      tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      console.log("✅ [WALLET API] Service token obtained successfully");
      return walletServiceToken;
    }

    if (response.data && response.data.token) {
      walletServiceToken = response.data.token;
      tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      console.log("✅ [WALLET API] Service token obtained successfully (legacy format)");
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
    
    console.log("🔍 [WALLET API] Fetching billing by address...");
    console.log("🔍 [WALLET API] userId:", userId);
    console.log("🔍 [WALLET API] bairId:", bairId);
    console.log("🔍 [WALLET API] doorNo:", doorNo);
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/billing/address/${bairId}/${doorNo}`,
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("📋 [WALLET API] Billing by address response status:", response.status);
    console.log("📋 [WALLET API] Billing by address responseCode:", response.data?.responseCode);
    console.log("📋 [WALLET API] Billing by address response data:", JSON.stringify(response.data));

    if (response.data && response.data.responseCode && response.data.data) {
      // Ensure we return an array
      const data = response.data.data;
      if (Array.isArray(data)) {
        return data;
      } else if (typeof data === 'object') {
        return [data];
      }
      return [];
    }

    console.warn("⚠️ [WALLET API] No billing data in response");
    return [];
  } catch (error) {
    if (error.response) {
      console.error("❌ [WALLET API] Error response status:", error.response.status);
      console.error("❌ [WALLET API] Error response data:", JSON.stringify(error.response.data));
      
      if (error.response.status === 404) {
        console.warn("⚠️ [WALLET API] Billing not found for address (404)");
        return [];
      }
    }
    console.error("❌ [WALLET API] Error getting billing by address:", error.message);
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

async function getAddressCities() {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(`${WALLET_API_BASE_URL}/api/address/city`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    return response.data?.data || [];
  } catch (error) {
    console.error("Error getting cities from wallet API:", error.message);
    throw error;
  }
}

async function getAddressDistricts(cityId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/address/district/${cityId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    return response.data?.data || [];
  } catch (error) {
    console.error("Error getting districts from wallet API:", error.message);
    throw error;
  }
}

async function getAddressKhoroo(districtId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/address/khoroo/${districtId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    return response.data?.data || [];
  } catch (error) {
    console.error("Error getting khoroo from wallet API:", error.message);
    throw error;
  }
}

async function getAddressBair(khorooId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/address/bair/${khorooId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    return response.data?.data || [];
  } catch (error) {
    console.error("Error getting bair from wallet API:", error.message);
    throw error;
  }
}

async function getBillers(userId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(`${WALLET_API_BASE_URL}/api/billers`, {
      headers: {
        userId: userId,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    return response.data?.data || [];
  } catch (error) {
    console.error("Error getting billers from wallet API:", error.message);
    throw error;
  }
}

async function getBillingByBiller(userId, billerCode, customerCode) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/billing/biller/${billerCode}/${customerCode}`,
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
    console.error("Error getting billing by biller from wallet API:", error.message);
    throw error;
  }
}

async function getBillingByCustomer(userId, customerId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/billing/customer/${customerId}`,
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
    console.error("Error getting billing by customer from wallet API:", error.message);
    throw error;
  }
}

async function getBillingList(userId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(`${WALLET_API_BASE_URL}/api/billing/list`, {
      headers: {
        userId: userId,
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("📋 [WALLET API] Billing list response status:", response.status);
    console.log("📋 [WALLET API] Billing list responseCode:", response.data?.responseCode);
    console.log("📋 [WALLET API] Billing list count:", response.data?.data?.length || 0);

    if (response.data && response.data.responseCode) {
      if (response.data.data) {
        if (Array.isArray(response.data.data)) {
          // Sanitize null values in each billing item
          return response.data.data.map(item => sanitizeNullValues(item));
        } else if (typeof response.data.data === 'object') {
          return [sanitizeNullValues(response.data.data)];
        }
      }
    }

    return [];
  } catch (error) {
    console.error("❌ [WALLET API] Error getting billing list:", error.message);
    if (error.response) {
      console.error("❌ [WALLET API] Error response status:", error.response.status);
      console.error("❌ [WALLET API] Error response data:", JSON.stringify(error.response.data));
    }
    throw error;
  }
}

async function getBillingBills(userId, billingId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/billing/bills/${billingId}`,
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode) {
      if (response.data.data) {
        let data = response.data.data;
        
        if (Array.isArray(data)) {
          return data.map(item => sanitizeNullValues(item));
        } else if (typeof data === 'object') {
          return [sanitizeNullValues(data)];
        }
      }
    }

    return [];
  } catch (error) {
    console.error("Error getting billing bills from wallet API:", error.message);
    if (error.response) {
      console.error("Error response data:", JSON.stringify(error.response.data));
    }
    throw error;
  }
}

async function getBillingPayments(userId, billingId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/billing/${billingId}/payments`,
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode) {
      if (response.data.data) {
        let data = response.data.data;
        
        if (Array.isArray(data)) {
          return data.map(item => sanitizeNullValues(item));
        } else if (typeof data === 'object') {
          return [sanitizeNullValues(data)];
        }
      }
    }

    return [];
  } catch (error) {
    console.error("Error getting billing payments from wallet API:", error.message);
    if (error.response) {
      console.error("Error response data:", JSON.stringify(error.response.data));
    }
    throw error;
  }
}

async function saveBilling(userId, billingData) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.post(
      `${WALLET_API_BASE_URL}/api/billing`,
      billingData,
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    throw new Error("Failed to save billing in Wallet API");
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Failed to save billing";
      throw new Error(errorMessage);
    }
    console.error("Error saving billing in wallet API:", error.message);
    throw error;
  }
}

async function removeBilling(userId, billingId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.delete(
      `${WALLET_API_BASE_URL}/api/billing/${billingId}`,
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode) {
      return response.data;
    }

    throw new Error("Failed to remove billing in Wallet API");
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Failed to remove billing";
      throw new Error(errorMessage);
    }
    console.error("Error removing billing in wallet API:", error.message);
    throw error;
  }
}

async function removeBill(userId, billingId, billId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.delete(
      `${WALLET_API_BASE_URL}/api/billing/${billingId}/bill/${billId}`,
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode) {
      return response.data;
    }

    throw new Error("Failed to remove bill in Wallet API");
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Failed to remove bill";
      throw new Error(errorMessage);
    }
    console.error("Error removing bill in wallet API:", error.message);
    throw error;
  }
}

async function recoverBill(userId, billingId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.put(
      `${WALLET_API_BASE_URL}/api/billing/${billingId}/recover`,
      {},
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode) {
      return response.data;
    }

    throw new Error("Failed to recover bill in Wallet API");
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Failed to recover bill";
      throw new Error(errorMessage);
    }
    console.error("Error recovering bill in wallet API:", error.message);
    throw error;
  }
}

async function changeBillingName(userId, billingId, newName) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.put(
      `${WALLET_API_BASE_URL}/api/billing/${billingId}/name`,
      { name: newName },
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.responseCode) {
      return response.data;
    }

    throw new Error("Failed to change billing name in Wallet API");
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Failed to change billing name";
      throw new Error(errorMessage);
    }
    console.error("Error changing billing name in wallet API:", error.message);
    throw error;
  }
}

async function createInvoice(userId, invoiceData) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.post(
      `${WALLET_API_BASE_URL}/api/invoice`,
      invoiceData,
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    throw new Error("Failed to create invoice in Wallet API");
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Failed to create invoice";
      throw new Error(errorMessage);
    }
    console.error("Error creating invoice in wallet API:", error.message);
    throw error;
  }
}

async function getInvoice(userId, invoiceId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/invoice/${invoiceId}`,
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
    console.error("Error getting invoice from wallet API:", error.message);
    throw error;
  }
}

async function cancelInvoice(userId, invoiceId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.put(
      `${WALLET_API_BASE_URL}/api/invoice/${invoiceId}/cancel`,
      {},
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode) {
      return response.data;
    }

    throw new Error("Failed to cancel invoice in Wallet API");
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Failed to cancel invoice";
      throw new Error(errorMessage);
    }
    console.error("Error canceling invoice in wallet API:", error.message);
    throw error;
  }
}

async function createPayment(userId, paymentData) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.post(
      `${WALLET_API_BASE_URL}/api/payment`,
      paymentData,
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    throw new Error("Failed to create payment in Wallet API");
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Failed to create payment";
      throw new Error(errorMessage);
    }
    console.error("Error creating payment in wallet API:", error.message);
    throw error;
  }
}

async function editUser(userId, userData) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.put(
      `${WALLET_API_BASE_URL}/api/user`,
      userData,
      {
        headers: {
          userId: userId,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.responseCode && response.data.data) {
      return response.data.data;
    }

    throw new Error("Failed to edit user in Wallet API");
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Failed to edit user";
      throw new Error(errorMessage);
    }
    console.error("Error editing user in wallet API:", error.message);
    throw error;
  }
}

module.exports = {
  getUserInfo,
  getBillingByAddress,
  getWalletServiceToken,
  registerUser,
  getAddressCities,
  getAddressDistricts,
  getAddressKhoroo,
  getAddressBair,
  getBillers,
  getBillingByBiller,
  getBillingByCustomer,
  getBillingList,
  getBillingBills,
  getBillingPayments,
  saveBilling,
  removeBilling,
  removeBill,
  recoverBill,
  changeBillingName,
  createInvoice,
  getInvoice,
  cancelInvoice,
  createPayment,
  editUser,
};

