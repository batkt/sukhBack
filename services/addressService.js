const walletApiService = require("./walletApiService");
const { db } = require("zevbackv2");
const Baiguullaga = require("../models/baiguullaga");

/**
 * Unified Address Service
 * Fetches addresses from both Wallet API and own organization database
 * Returns combined results with source indicators
 */

// Source constants
const SOURCE_WALLET_API = "WALLET_API";
const SOURCE_OWN_ORG = "OWN_ORG";

/**
 * Get cities from both sources
 * @returns {Promise<Array>} Combined cities with source indicators
 */
async function getCities() {
  console.log("🏙️ [ADDRESS SERVICE] Fetching cities from all sources...");
  
  const results = {
    walletApi: [],
    ownOrg: [],
    combined: []
  };

  // Fetch from Wallet API
  try {
    console.log("📡 [ADDRESS SERVICE] Fetching cities from Wallet API...");
    const walletCities = await walletApiService.getAddressCities();
    
    if (Array.isArray(walletCities) && walletCities.length > 0) {
      results.walletApi = walletCities.map(city => ({
        // Preserve original Wallet API format
        id: city.id || city.cityId,
        name: city.name || city.cityName,
        // Also provide standardized fields
        cityId: city.cityId || city.id,
        cityName: city.cityName || city.name,
        cityCode: city.cityCode || city.code || "",
        // Add source indicator
        source: SOURCE_WALLET_API
      }));
      console.log(`✅ [ADDRESS SERVICE] Found ${walletCities.length} cities from Wallet API`);
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No cities from Wallet API");
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching cities from Wallet API:", error.message);
    // Continue with own org data even if Wallet API fails
  }

  // Fetch from own organization
  try {
    console.log("📡 [ADDRESS SERVICE] Fetching cities from own organization...");
    const ownOrgCities = await getOwnOrgCities();
    
    if (Array.isArray(ownOrgCities) && ownOrgCities.length > 0) {
      results.ownOrg = ownOrgCities.map(city => ({
        ...city,
        source: SOURCE_OWN_ORG
      }));
      console.log(`✅ [ADDRESS SERVICE] Found ${ownOrgCities.length} cities from own organization`);
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No cities from own organization");
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching cities from own organization:", error.message);
    // Continue with Wallet API data even if own org fails
  }

  // Combine results
  results.combined = [...results.walletApi, ...results.ownOrg];
  console.log(`✅ [ADDRESS SERVICE] Total cities: ${results.combined.length} (Wallet API: ${results.walletApi.length}, Own Org: ${results.ownOrg.length})`);

  return {
    data: results.combined,
    sources: {
      walletApi: results.walletApi.length,
      ownOrg: results.ownOrg.length,
      total: results.combined.length
    }
  };
}

/**
 * Get districts from both sources
 * @param {string} cityId - City ID
 * @returns {Promise<Array>} Combined districts with source indicators
 */
async function getDistricts(cityId) {
  console.log("🏘️ [ADDRESS SERVICE] Fetching districts for cityId:", cityId);
  
  const results = {
    walletApi: [],
    ownOrg: [],
    combined: []
  };

  // Fetch from Wallet API
  try {
    console.log("📡 [ADDRESS SERVICE] Fetching districts from Wallet API...");
    const walletDistricts = await walletApiService.getAddressDistricts(cityId);
    
    if (Array.isArray(walletDistricts) && walletDistricts.length > 0) {
      results.walletApi = walletDistricts.map(district => ({
        // Preserve original Wallet API format
        id: district.id || district.districtId,
        name: district.name || district.districtName,
        // Also provide standardized fields
        districtId: district.districtId || district.id,
        districtName: district.districtName || district.name,
        districtCode: district.districtCode || district.code || "",
        // Add source indicator
        source: SOURCE_WALLET_API
      }));
      console.log(`✅ [ADDRESS SERVICE] Found ${walletDistricts.length} districts from Wallet API`);
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No districts from Wallet API");
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching districts from Wallet API:", error.message);
  }

  // Fetch from own organization
  try {
    console.log("📡 [ADDRESS SERVICE] Fetching districts from own organization...");
    const ownOrgDistricts = await getOwnOrgDistricts(cityId);
    
    if (Array.isArray(ownOrgDistricts) && ownOrgDistricts.length > 0) {
      results.ownOrg = ownOrgDistricts.map(district => ({
        ...district,
        source: SOURCE_OWN_ORG
      }));
      console.log(`✅ [ADDRESS SERVICE] Found ${ownOrgDistricts.length} districts from own organization`);
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No districts from own organization");
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching districts from own organization:", error.message);
  }

  // Combine results
  results.combined = [...results.walletApi, ...results.ownOrg];
  console.log(`✅ [ADDRESS SERVICE] Total districts: ${results.combined.length} (Wallet API: ${results.walletApi.length}, Own Org: ${results.ownOrg.length})`);

  return {
    data: results.combined,
    sources: {
      walletApi: results.walletApi.length,
      ownOrg: results.ownOrg.length,
      total: results.combined.length
    }
  };
}

/**
 * Get khoroos from both sources
 * @param {string} districtId - District ID
 * @returns {Promise<Array>} Combined khoroos with source indicators
 */
async function getKhoroo(districtId) {
  console.log("🏘️ [ADDRESS SERVICE] Fetching khoroos for districtId:", districtId);
  
  const results = {
    walletApi: [],
    ownOrg: [],
    combined: []
  };

  // Fetch from Wallet API
  try {
    console.log("📡 [ADDRESS SERVICE] Fetching khoroos from Wallet API...");
    const walletKhoroo = await walletApiService.getAddressKhoroo(districtId);
    
    if (Array.isArray(walletKhoroo) && walletKhoroo.length > 0) {
      results.walletApi = walletKhoroo.map(khoroo => ({
        // Preserve original Wallet API format
        id: khoroo.id || khoroo.khorooId,
        name: khoroo.name || khoroo.khorooName,
        // Also provide standardized fields
        khorooId: khoroo.khorooId || khoroo.id,
        khorooName: khoroo.khorooName || khoroo.name,
        khorooCode: khoroo.khorooCode || khoroo.code || "",
        // Add source indicator
        source: SOURCE_WALLET_API
      }));
      console.log(`✅ [ADDRESS SERVICE] Found ${walletKhoroo.length} khoroos from Wallet API`);
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No khoroos from Wallet API");
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching khoroos from Wallet API:", error.message);
  }

  // Fetch from own organization
  try {
    console.log("📡 [ADDRESS SERVICE] Fetching khoroos from own organization...");
    const ownOrgKhoroo = await getOwnOrgKhoroo(districtId);
    
    if (Array.isArray(ownOrgKhoroo) && ownOrgKhoroo.length > 0) {
      results.ownOrg = ownOrgKhoroo.map(khoroo => ({
        ...khoroo,
        source: SOURCE_OWN_ORG
      }));
      console.log(`✅ [ADDRESS SERVICE] Found ${ownOrgKhoroo.length} khoroos from own organization`);
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No khoroos from own organization");
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching khoroos from own organization:", error.message);
  }

  // Combine results
  results.combined = [...results.walletApi, ...results.ownOrg];
  console.log(`✅ [ADDRESS SERVICE] Total khoroos: ${results.combined.length} (Wallet API: ${results.walletApi.length}, Own Org: ${results.ownOrg.length})`);

  return {
    data: results.combined,
    sources: {
      walletApi: results.walletApi.length,
      ownOrg: results.ownOrg.length,
      total: results.combined.length
    }
  };
}

/**
 * Get bair (buildings) from both sources
 * @param {string} khorooId - Khoroo ID
 * @returns {Promise<Array>} Combined bair with source indicators
 */
async function getBair(khorooId) {
  console.log("🏢 [ADDRESS SERVICE] Fetching bair for khorooId:", khorooId);
  
  const results = {
    walletApi: [],
    ownOrg: [],
    combined: []
  };

  // Fetch from Wallet API
  try {
    console.log("📡 [ADDRESS SERVICE] Fetching bair from Wallet API...");
    const walletBair = await walletApiService.getAddressBair(khorooId);
    
    if (Array.isArray(walletBair) && walletBair.length > 0) {
      results.walletApi = walletBair.map(bair => ({
        // Preserve original Wallet API format
        id: bair.id || bair.bairId,
        name: bair.name || bair.bairName,
        // Also provide standardized fields
        bairId: bair.bairId || bair.id,
        bairName: bair.bairName || bair.name,
        bairAddress: bair.bairAddress || bair.address || "",
        // Add source indicator
        source: SOURCE_WALLET_API
      }));
      console.log(`✅ [ADDRESS SERVICE] Found ${walletBair.length} bair from Wallet API`);
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No bair from Wallet API");
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching bair from Wallet API:", error.message);
  }

  // Fetch from own organization
  try {
    console.log("📡 [ADDRESS SERVICE] Fetching bair from own organization...");
    const ownOrgBair = await getOwnOrgBair(khorooId);
    
    if (Array.isArray(ownOrgBair) && ownOrgBair.length > 0) {
      results.ownOrg = ownOrgBair.map(bair => ({
        ...bair,
        source: SOURCE_OWN_ORG
      }));
      console.log(`✅ [ADDRESS SERVICE] Found ${ownOrgBair.length} bair from own organization`);
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No bair from own organization");
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching bair from own organization:", error.message);
  }

  // Combine results
  results.combined = [...results.walletApi, ...results.ownOrg];
  console.log(`✅ [ADDRESS SERVICE] Total bair: ${results.combined.length} (Wallet API: ${results.walletApi.length}, Own Org: ${results.ownOrg.length})`);

  return {
    data: results.combined,
    sources: {
      walletApi: results.walletApi.length,
      ownOrg: results.ownOrg.length,
      total: results.combined.length
    }
  };
}

// ============================================
// OWN ORGANIZATION ADDRESS FUNCTIONS
// ============================================
// These functions fetch addresses from your own database
// Customize these based on your database structure

/**
 * Get cities from own organization database
 * @returns {Promise<Array>} Array of cities
 */
async function getOwnOrgCities() {
  try {
    // TODO: Replace with your own database query
    // Example: Fetch from a cities collection or extract unique cities from baiguullaga
    
    // Option 1: If you have a separate cities collection
    // const Cities = require("../models/city");
    // const cities = await Cities.find({}).select("_id name code").lean();
    // return cities.map(city => ({
    //   cityId: city._id.toString(),
    //   cityName: city.name,
    //   cityCode: city.code
    // }));

    // Option 2: Extract unique cities from baiguullaga addresses
    const kholboltuud = db.kholboltuud || [];
    const uniqueCities = new Set();
    const cities = [];

    for (const kholbolt of kholboltuud) {
      try {
        const baiguullaguud = await Baiguullaga(kholbolt).find({}).select("barilguud.tokhirgoo.duuregNer").lean();
        
        for (const baiguullaga of baiguullaguud) {
          if (baiguullaga.barilguud && Array.isArray(baiguullaga.barilguud)) {
            for (const barilga of baiguullaga.barilguud) {
              if (barilga.tokhirgoo && barilga.tokhirgoo.duuregNer) {
                const cityName = barilga.tokhirgoo.duuregNer;
                if (!uniqueCities.has(cityName)) {
                  uniqueCities.add(cityName);
                  cities.push({
                    cityId: `own_${cityName.replace(/\s+/g, '_').toLowerCase()}`,
                    cityName: cityName,
                    cityCode: barilga.tokhirgoo.districtCode || ""
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ [ADDRESS SERVICE] Error fetching from kholbolt ${kholbolt}:`, error.message);
      }
    }

    return cities;
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error getting cities from own organization:", error.message);
    return [];
  }
}

/**
 * Get districts from own organization database
 * @param {string} cityId - City ID
 * @returns {Promise<Array>} Array of districts
 */
async function getOwnOrgDistricts(cityId) {
  try {
    // TODO: Replace with your own database query
    // Extract districts from baiguullaga based on city
    
    const kholboltuud = db.kholboltuud || [];
    const uniqueDistricts = new Set();
    const districts = [];

    // If cityId starts with "own_", it's from our own org
    const cityName = cityId.startsWith("own_") 
      ? cityId.replace("own_", "").replace(/_/g, " ")
      : null;

    if (!cityName) {
      return [];
    }

    for (const kholbolt of kholboltuud) {
      try {
        const baiguullaguud = await Baiguullaga(kholbolt).find({}).select("barilguud.tokhirgoo").lean();
        
        for (const baiguullaga of baiguullaguud) {
          if (baiguullaga.barilguud && Array.isArray(baiguullaga.barilguud)) {
            for (const barilga of baiguullaga.barilguud) {
              if (barilga.tokhirgoo && 
                  barilga.tokhirgoo.duuregNer === cityName &&
                  barilga.tokhirgoo.districtCode) {
                const districtKey = `${barilga.tokhirgoo.districtCode}_${barilga.tokhirgoo.duuregNer}`;
                if (!uniqueDistricts.has(districtKey)) {
                  uniqueDistricts.add(districtKey);
                  districts.push({
                    districtId: `own_${barilga.tokhirgoo.districtCode}`,
                    districtName: barilga.tokhirgoo.duuregNer || "",
                    districtCode: barilga.tokhirgoo.districtCode
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ [ADDRESS SERVICE] Error fetching from kholbolt ${kholbolt}:`, error.message);
      }
    }

    return districts;
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error getting districts from own organization:", error.message);
    return [];
  }
}

/**
 * Get khoroos from own organization database
 * @param {string} districtId - District ID
 * @returns {Promise<Array>} Array of khoroos
 */
async function getOwnOrgKhoroo(districtId) {
  try {
    // TODO: Replace with your own database query
    // Extract khoroos from baiguullaga based on district
    
    const kholboltuud = db.kholboltuud || [];
    const uniqueKhoroos = new Set();
    const khoroos = [];

    // If districtId starts with "own_", it's from our own org
    const districtCode = districtId.startsWith("own_") 
      ? districtId.replace("own_", "")
      : null;

    if (!districtCode) {
      return [];
    }

    for (const kholbolt of kholboltuud) {
      try {
        const baiguullaguud = await Baiguullaga(kholbolt).find({}).select("barilguud.tokhirgoo").lean();
        
        for (const baiguullaga of baiguullaguud) {
          if (baiguullaga.barilguud && Array.isArray(baiguullaga.barilguud)) {
            for (const barilga of baiguullaga.barilguud) {
              if (barilga.tokhirgoo && 
                  barilga.tokhirgoo.districtCode === districtCode &&
                  barilga.tokhirgoo.horoo) {
                const khorooKey = `${barilga.tokhirgoo.horoo.kod}_${barilga.tokhirgoo.horoo.ner}`;
                if (!uniqueKhoroos.has(khorooKey)) {
                  uniqueKhoroos.add(khorooKey);
                  khoroos.push({
                    khorooId: `own_${barilga.tokhirgoo.horoo.kod}`,
                    khorooName: barilga.tokhirgoo.horoo.ner || "",
                    khorooCode: barilga.tokhirgoo.horoo.kod || ""
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ [ADDRESS SERVICE] Error fetching from kholbolt ${kholbolt}:`, error.message);
      }
    }

    return khoroos;
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error getting khoroos from own organization:", error.message);
    return [];
  }
}

/**
 * Get bair (buildings) from own organization database
 * @param {string} khorooId - Khoroo ID
 * @returns {Promise<Array>} Array of bair
 */
async function getOwnOrgBair(khorooId) {
  try {
    // TODO: Replace with your own database query
    // Extract buildings from baiguullaga based on khoroo
    
    const kholboltuud = db.kholboltuud || [];
    const uniqueBair = new Set();
    const bair = [];

    // If khorooId starts with "own_", it's from our own org
    const khorooCode = khorooId.startsWith("own_") 
      ? khorooId.replace("own_", "")
      : null;

    if (!khorooCode) {
      return [];
    }

    for (const kholbolt of kholboltuud) {
      try {
        const baiguullaguud = await Baiguullaga(kholbolt).find({}).select("barilguud").lean();
        
        for (const baiguullaga of baiguullaguud) {
          if (baiguullaga.barilguud && Array.isArray(baiguullaga.barilguud)) {
            for (const barilga of baiguullaga.barilguud) {
              if (barilga.tokhirgoo && 
                  barilga.tokhirgoo.horoo &&
                  barilga.tokhirgoo.horoo.kod === khorooCode &&
                  barilga.ner) {
                const bairKey = `${barilga.ner}_${barilga._id}`;
                if (!uniqueBair.has(bairKey)) {
                  uniqueBair.add(bairKey);
                  bair.push({
                    bairId: `own_${barilga._id.toString()}`,
                    bairName: barilga.ner || "",
                    bairAddress: barilga.khayag || "",
                    sohNer: barilga.tokhirgoo.sohNer || ""
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ [ADDRESS SERVICE] Error fetching from kholbolt ${kholbolt}:`, error.message);
      }
    }

    return bair;
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error getting bair from own organization:", error.message);
    return [];
  }
}

module.exports = {
  getCities,
  getDistricts,
  getKhoroo,
  getBair,
  SOURCE_WALLET_API,
  SOURCE_OWN_ORG
};

