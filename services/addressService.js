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
  console.log("🏙️ [ADDRESS SERVICE] Fetching cities from Wallet API...");
  
  try {
    const walletCities = await walletApiService.getAddressCities();
    
    if (Array.isArray(walletCities) && walletCities.length > 0) {
      const cities = walletCities.map(city => ({
        // Preserve original Wallet API format
        id: city.id || city.cityId,
        name: city.name || city.cityName,
        // Also provide standardized fields for compatibility
        cityId: city.cityId || city.id,
        cityName: city.cityName || city.name,
        cityCode: city.cityCode || city.code || "",
        // Add source indicator
        source: SOURCE_WALLET_API
      }));
      console.log(`✅ [ADDRESS SERVICE] Found ${walletCities.length} cities from Wallet API`);
      
      return {
        data: cities,
        sources: {
          walletApi: cities.length,
          ownOrg: 0,
          total: cities.length
        }
      };
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No cities from Wallet API");
      return {
        data: [],
        sources: {
          walletApi: 0,
          ownOrg: 0,
          total: 0
        }
      };
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching cities from Wallet API:", error.message);
    return {
      data: [],
      sources: {
        walletApi: 0,
        ownOrg: 0,
        total: 0
      }
    };
  }
}

/**
 * Get districts from both sources
 * @param {string} cityId - City ID
 * @returns {Promise<Array>} Combined districts with source indicators
 */
async function getDistricts(cityId) {
  console.log("🏘️ [ADDRESS SERVICE] Fetching districts for cityId:", cityId);
  
  try {
    const walletDistricts = await walletApiService.getAddressDistricts(cityId);
    
    if (Array.isArray(walletDistricts) && walletDistricts.length > 0) {
      const districts = walletDistricts.map(district => ({
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
      
      return {
        data: districts,
        sources: {
          walletApi: districts.length,
          ownOrg: 0,
          total: districts.length
        }
      };
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No districts from Wallet API");
      return {
        data: [],
        sources: {
          walletApi: 0,
          ownOrg: 0,
          total: 0
        }
      };
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching districts from Wallet API:", error.message);
    return {
      data: [],
      sources: {
        walletApi: 0,
        ownOrg: 0,
        total: 0
      }
    };
  }
}

/**
 * Get khoroos from both sources
 * @param {string} districtId - District ID
 * @returns {Promise<Array>} Combined khoroos with source indicators
 */
async function getKhoroo(districtId) {
  console.log("🏘️ [ADDRESS SERVICE] Fetching khoroos for districtId:", districtId);
  
  try {
    const walletKhoroo = await walletApiService.getAddressKhoroo(districtId);
    
    if (Array.isArray(walletKhoroo) && walletKhoroo.length > 0) {
      const khoroos = walletKhoroo.map(khoroo => ({
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
      
      return {
        data: khoroos,
        sources: {
          walletApi: khoroos.length,
          ownOrg: 0,
          total: khoroos.length
        }
      };
    } else {
      console.log("⚠️ [ADDRESS SERVICE] No khoroos from Wallet API");
      return {
        data: [],
        sources: {
          walletApi: 0,
          ownOrg: 0,
          total: 0
        }
      };
    }
  } catch (error) {
    console.error("❌ [ADDRESS SERVICE] Error fetching khoroos from Wallet API:", error.message);
    return {
      data: [],
      sources: {
        walletApi: 0,
        ownOrg: 0,
        total: 0
      }
    };
  }
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
      // Format to match Wallet API structure (id, name) and use barilgiinId as id
      results.ownOrg = ownOrgBair.map(bair => ({
        id: bair.barilgiinId || bair.bairId, // Use barilgiinId as id
        name: bair.bairName,
        // Include baiguullaga and barilga IDs for OWN_ORG bair
        baiguullagiinId: bair.baiguullagiinId || "",
        barilgiinId: bair.barilgiinId || "",
        bairName: bair.bairName,
        bairAddress: bair.bairAddress || "",
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
    console.log("📡 [ADDRESS SERVICE] Fetching cities from baiguullaga...");
    
    const kholboltuud = db.kholboltuud || [];
    const uniqueCities = new Set();
    const cities = [];

    for (const kholbolt of kholboltuud) {
      try {
        // Select both EbarimtDuuregNer and duuregNer to determine city/district
        const baiguullaguud = await Baiguullaga(kholbolt).find({}).select("barilguud.tokhirgoo.EbarimtDuuregNer barilguud.tokhirgoo.duuregNer barilguud.tokhirgoo.EbarimtDistrictCode").lean();
        
        for (const baiguullaga of baiguullaguud) {
          if (baiguullaga.barilguud && Array.isArray(baiguullaga.barilguud)) {
            for (const barilga of baiguullaga.barilguud) {
              if (barilga.tokhirgoo) {
                // Use EbarimtDuuregNer as primary city/district identifier
                // If not available, use duuregNer as fallback
                // Both represent districts, but we'll use them as city identifiers for now
                const cityName = barilga.tokhirgoo.EbarimtDuuregNer || barilga.tokhirgoo.duuregNer;
                
                if (cityName && !uniqueCities.has(cityName)) {
                  uniqueCities.add(cityName);
                  cities.push({
                    cityId: `own_${cityName.replace(/\s+/g, '_').toLowerCase()}`,
                    cityName: cityName,
                    cityCode: barilga.tokhirgoo.EbarimtDistrictCode || ""
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

    console.log(`✅ [ADDRESS SERVICE] Found ${cities.length} unique cities from baiguullaga`);
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
    console.log("📡 [ADDRESS SERVICE] Fetching districts from baiguullaga for cityId:", cityId);
    
    const kholboltuud = db.kholboltuud || [];
    const uniqueDistricts = new Set();
    const districts = [];

    // If cityId starts with "own_", it's from our own org
    const cityName = cityId.startsWith("own_") 
      ? cityId.replace("own_", "").replace(/_/g, " ")
      : null;

    if (!cityName) {
      console.log("⚠️ [ADDRESS SERVICE] cityId is not from own org, skipping");
      return [];
    }

    for (const kholbolt of kholboltuud) {
      try {
        const baiguullaguud = await Baiguullaga(kholbolt).find({}).select("barilguud.tokhirgoo").lean();
        
        for (const baiguullaga of baiguullaguud) {
          if (baiguullaga.barilguud && Array.isArray(baiguullaga.barilguud)) {
            for (const barilga of baiguullaga.barilguud) {
              if (barilga.tokhirgoo) {
                // Match by EbarimtDuuregNer or duuregNer (both can be city/district names)
                const barilgaCity = barilga.tokhirgoo.EbarimtDuuregNer || barilga.tokhirgoo.duuregNer;
                
                if (barilgaCity === cityName && barilga.tokhirgoo.duuregNer) {
                  // Use duuregNer as district name
                  const districtName = barilga.tokhirgoo.duuregNer;
                  // Extract district code from districtCode if it's a combined string
                  // districtCode might be like "Сүхбаатар1-р хороо", extract just the district part
                  let districtCode = barilga.tokhirgoo.districtCode || "";
                  
                  // If districtCode contains the district name, use it as is
                  // Otherwise, use duuregNer as code
                  if (!districtCode || districtCode === districtName) {
                    districtCode = districtName;
                  }
                  
                  const districtKey = `${districtCode}_${districtName}`;
                  if (!uniqueDistricts.has(districtKey)) {
                    uniqueDistricts.add(districtKey);
                    districts.push({
                      districtId: `own_${districtCode.replace(/\s+/g, '_').toLowerCase()}`,
                      districtName: districtName,
                      districtCode: districtCode
                    });
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ [ADDRESS SERVICE] Error fetching from kholbolt ${kholbolt}:`, error.message);
      }
    }

    console.log(`✅ [ADDRESS SERVICE] Found ${districts.length} districts from baiguullaga`);
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
    console.log("📡 [ADDRESS SERVICE] Fetching khoroos from baiguullaga for districtId:", districtId);
    
    const kholboltuud = db.kholboltuud || [];
    const uniqueKhoroos = new Set();
    const khoroos = [];

    // If districtId starts with "own_", it's from our own org
    const districtCode = districtId.startsWith("own_") 
      ? districtId.replace("own_", "").replace(/_/g, " ")
      : null;

    if (!districtCode) {
      console.log("⚠️ [ADDRESS SERVICE] districtId is not from own org, skipping");
      return [];
    }

    for (const kholbolt of kholboltuud) {
      try {
        const baiguullaguud = await Baiguullaga(kholbolt).find({}).select("barilguud.tokhirgoo").lean();
        
        for (const baiguullaga of baiguullaguud) {
          if (baiguullaga.barilguud && Array.isArray(baiguullaga.barilguud)) {
            for (const barilga of baiguullaga.barilguud) {
              if (barilga.tokhirgoo && 
                  barilga.tokhirgoo.duuregNer &&
                  (barilga.tokhirgoo.duuregNer === districtCode || 
                   barilga.tokhirgoo.districtCode === districtCode) &&
                  barilga.tokhirgoo.horoo &&
                  barilga.tokhirgoo.horoo.kod) {
                const khorooKey = `${barilga.tokhirgoo.horoo.kod}_${barilga.tokhirgoo.horoo.ner}`;
                if (!uniqueKhoroos.has(khorooKey)) {
                  uniqueKhoroos.add(khorooKey);
                  khoroos.push({
                    khorooId: `own_${barilga.tokhirgoo.horoo.kod.replace(/\s+/g, '_').toLowerCase()}`,
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

    console.log(`✅ [ADDRESS SERVICE] Found ${khoroos.length} khoroos from baiguullaga`);
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
    console.log("📡 [ADDRESS SERVICE] Fetching bair from baiguullaga for khorooId:", khorooId);
    
    const kholboltuud = db.kholboltuud || [];
    const uniqueBair = new Set();
    const bair = [];

    // If khorooId starts with "own_", it's from our own org
    const khorooCode = khorooId.startsWith("own_") 
      ? khorooId.replace("own_", "").replace(/_/g, " ")
      : null;

    if (!khorooCode) {
      console.log("⚠️ [ADDRESS SERVICE] khorooId is not from own org, skipping");
      return [];
    }

    for (const kholbolt of kholboltuud) {
      try {
        // Select baiguullaga._id and barilga._id to include in response
        const baiguullaguud = await Baiguullaga(kholbolt).find({}).select("_id barilguud.ner barilguud.khayag barilguud.tokhirgoo barilguud._id").lean();
        
        for (const baiguullaga of baiguullaguud) {
          if (baiguullaga.barilguud && Array.isArray(baiguullaga.barilguud)) {
            for (const barilga of baiguullaga.barilguud) {
              if (barilga.tokhirgoo && 
                  barilga.tokhirgoo.horoo &&
                  (barilga.tokhirgoo.horoo.kod === khorooCode || 
                   barilga.tokhirgoo.horoo.ner === khorooCode) &&
                  barilga.ner) {
                const bairKey = `${barilga.ner}_${barilga._id}`;
                if (!uniqueBair.has(bairKey)) {
                  uniqueBair.add(bairKey);
                  bair.push({
                    bairId: `own_${barilga._id.toString()}`,
                    bairName: barilga.ner || "",
                    bairAddress: barilga.khayag || "",
                    // Include baiguullaga and barilga IDs for OWN_ORG bair
                    baiguullagiinId: baiguullaga._id.toString(),
                    barilgiinId: barilga._id.toString(),
                    sohNer: barilga.tokhirgoo.sohNer || "",
                    duuregNer: barilga.tokhirgoo.duuregNer || "",
                    districtCode: barilga.tokhirgoo.districtCode || "",
                    khorooNer: barilga.tokhirgoo.horoo?.ner || "",
                    khorooKod: barilga.tokhirgoo.horoo?.kod || ""
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

    console.log(`✅ [ADDRESS SERVICE] Found ${bair.length} bair from baiguullaga`);
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

