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
      if (value === null || value === undefined) {
        // Convert null/undefined to empty string for String fields
        sanitized[key] = "";
      } else if (Array.isArray(value)) {
        // Recursively sanitize arrays
        sanitized[key] = value.map(item => sanitizeNullValues(item));
      } else if (typeof value === 'object') {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeNullValues(value);
      } else {
        // For other types (string, number, boolean), keep as is
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

    const response = await axios.post(`${WALLET_API_BASE_URL}/auth/token`, {
      username: WALLET_API_USERNAME,
      password: WALLET_API_PASSWORD,
    }, {
      timeout: 10000,
    });

    if (response.data && response.data.accessToken) {
      walletServiceToken = response.data.accessToken;
      tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      return walletServiceToken;
    }

    if (response.data && response.data.token) {
      walletServiceToken = response.data.token;
      tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
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
      // Ensure we return an array
      const data = response.data.data;
      if (Array.isArray(data)) {
        return data;
      } else if (typeof data === 'object') {
        return [data];
      }
      return [];
    }

    return [];
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        return [];
      }
      console.error("❌ [WALLET API] Error getting billing by address:", error.message);
    }
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
      let data = response.data.data;
      
      // If data is an array, process each item
      if (Array.isArray(data)) {
        // For each customer, try to get billingId if not present
        const enrichedData = await Promise.all(data.map(async (customer) => {
          // If billingId is already present, return as is
          if (customer.billingId) {
            return customer;
          }
          
          // Try to get billingId from billing list or by customerId
          try {
            if (customer.customerId) {
              const billing = await getBillingByCustomer(userId, customer.customerId);
              if (billing && billing.billingId) {
                customer.billingId = billing.billingId;
              } else {
                // Try billing list
                const billingList = await getBillingList(userId);
                const matchingBilling = billingList.find(b => 
                  b.customerId === customer.customerId || 
                  b.customerCode === customer.customerCode
                );
                if (matchingBilling && matchingBilling.billingId) {
                  customer.billingId = matchingBilling.billingId;
                } else {
                  customer.billingId = null;
                }
              }
            } else {
              customer.billingId = null;
            }
          } catch (err) {
            console.error("⚠️ [WALLET API] Error fetching billingId:", err.message);
            customer.billingId = null;
          }
          
          return customer;
        }));
        
        return enrichedData;
      } else if (typeof data === 'object') {
        // Single customer object
        if (!data.billingId && data.customerId) {
          try {
            const billing = await getBillingByCustomer(userId, data.customerId);
            if (billing && billing.billingId) {
              data.billingId = billing.billingId;
            } else {
              // Try billing list
              const billingList = await getBillingList(userId);
              const matchingBilling = billingList.find(b => 
                b.customerId === data.customerId || 
                b.customerCode === data.customerCode
              );
              if (matchingBilling && matchingBilling.billingId) {
                data.billingId = matchingBilling.billingId;
              } else {
                data.billingId = null;
              }
            }
          } catch (err) {
            console.error("⚠️ [WALLET API] Error fetching billingId:", err.message);
            data.billingId = null;
          }
        }
        return data;
      }
      
      return data;
    }

    return null;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    console.error("❌ [WALLET API] Error getting billing by biller:", error.message);
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
          userId: userId,  // Should be phoneNumber
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data && response.data.responseCode) {
      if (response.data.data) {
        let data = response.data.data;
        
        if (Array.isArray(data)) {
          return data.map((item) => sanitizeNullValues(item));
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
      `${WALLET_API_BASE_URL}/api/billing/payments/${billingId}`,
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
    if (error.response) {
      // If 404, return empty array (no payments exist yet)
      if (error.response.status === 404) {
        return [];
      }
      console.error("❌ [WALLET API] Error getting billing payments:", error.message);
    }
    throw error;
  }
}

// Helper function to clean objects from Mongoose/circular references
function cleanObjectForJSON(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  // Handle Mongoose documents
  if (obj.toObject && typeof obj.toObject === 'function') {
    return cleanObjectForJSON(obj.toObject());
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObjectForJSON(item));
  }
  
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const key in obj) {
      // Skip Mongoose internal properties
      if (key === '_id' && obj[key] && typeof obj[key].toString === 'function') {
        cleaned[key] = obj[key].toString();
      } else if (key.startsWith('_') && key !== '_id') {
        // Skip other Mongoose internal properties
        continue;
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Check for circular references by checking if it's a Mongoose model/connection
        if (obj[key].constructor && obj[key].constructor.name === 'NativeConnection') {
          continue;
        }
        if (obj[key].constructor && obj[key].constructor.name === 'Mongoose') {
          continue;
        }
        cleaned[key] = cleanObjectForJSON(obj[key]);
      } else {
        cleaned[key] = obj[key];
      }
    }
    return cleaned;
  }
  
  return obj;
}

async function saveBilling(userId, billingData) {
  try {
    const token = await getWalletServiceToken();
    
    // Clean the billingData to remove Mongoose objects and circular references
    const cleanedBillingData = cleanObjectForJSON(billingData);
    
    const response = await axios.post(
      `${WALLET_API_BASE_URL}/api/billing`,
      cleanedBillingData,
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
    if (error.response) {
      console.error("❌ [WALLET API] Error response status:", error.response.status);
      console.error("❌ [WALLET API] Error response data:", JSON.stringify(error.response.data));
      
      const errorMessage = error.response.data?.responseMsg || error.response.data?.message || "Failed to save billing";
      throw new Error(errorMessage);
    }
    console.error("❌ [WALLET API] Error saving billing:", error.message);
    if (error.message.includes("circular")) {
      console.error("❌ [WALLET API] Circular structure detected in billingData");
    }
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

    // If responseCode is false, log the error message
    const errorMsg = response.data?.responseMsg || response.data?.message || "Failed to create invoice in Wallet API";
    console.error("❌ [WALLET API] Invoice creation failed:", errorMsg);
    throw new Error(errorMsg);
  } catch (error) {
    if (error.response && error.response.data) {
      const errorMessage = error.response.data.responseMsg || error.response.data.message || "Failed to create invoice";
      throw new Error(errorMessage);
    }
    console.error("❌ [WALLET API] Error creating invoice:", error.message);
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
    console.error("❌ [WALLET API] Error getting invoice:", error.message);
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
    console.error("❌ [WALLET API] Error canceling invoice:", error.message);
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
    console.error("❌ [WALLET API] Error creating payment:", error.message);
    throw error;
  }
}

async function getPayment(userId, paymentId) {
  try {
    const token = await getWalletServiceToken();
    
    const response = await axios.get(
      `${WALLET_API_BASE_URL}/api/payment/${paymentId}`,
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
    console.error("❌ [WALLET API] Error getting payment:", error.message);
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

async function loginUser(phone, password) {
  try {
    const token = await getWalletServiceToken();
    
    // TODO: Update this endpoint if Wallet API has a different login endpoint
    // Common endpoints might be: /api/auth/login, /api/user/login, /api/login
    const response = await axios.post(
      `${WALLET_API_BASE_URL}/api/auth/login`,
      {
        phone: phone,
        password: password,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.responseCode) {
      if (response.data.data) {
        return { success: true, data: response.data.data };
      }
      return { success: false, message: response.data.responseMsg || "Invalid credentials" };
    }

    return { success: false, message: "Login failed" };
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401 || error.response.status === 403) {
        return { success: false, message: "Invalid phone or password" };
      }
      return { success: false, message: error.response.data?.responseMsg || "Login failed" };
    }
    // If endpoint doesn't exist (404), return false but don't throw
    if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
      return { success: false, message: "Login endpoint not available" };
    }
    console.error("❌ [WALLET API] Error during login:", error.message);
    return { success: false, message: "Login failed" };
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
  getPayment,
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
  loginUser,
};

