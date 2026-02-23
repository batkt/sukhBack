const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars exactly like index.js does
dotenv.config({ path: "./tokhirgoo/tokhirgoo.env" });

async function wipe() {
  console.log("Connecting...");
  await mongoose.connect(process.env.DB_URL || "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin");
  console.log("Connected.");
  
  const { db } = require('zevbackv2'); // We can require it directly if it's in node_modules
  // Wait, wait, index.js does: const { db } = require("zevbackv2");
  // Let's make sure we initialize db first exactly like index.js does.
  // Actually, zevbackv2 doesn't initialize kholboltuud until db.kholboltUusgey is called!
  
  const express = require('express');
  const app = express();
  db.kholboltUusgey(app, "mongodb://admin:Br1stelback1@127.0.0.1:27017/amarSukh?authSource=admin");

  // Wait a few seconds for kholboltuud to populate
  await new Promise(r => setTimeout(r, 3000));
  
  try {
    for (const kholbolt of db.kholboltuud) {
      console.log(`Checking DB: ${kholbolt.name}`);
      const Geree = require('./models/geree')(kholbolt);
      const Baiguullaga = require('./models/baiguullaga')(kholbolt);
      const Ajiltan = require('./models/ajiltan')(kholbolt);
      const NekhemjlekhiinTuukh = require('./models/nekhemjlekhiinTuukh')(kholbolt);

      const baiguullagas = await Baiguullaga.find({ 'tokhirgoo.ajiltanTokhirgooIdevkhtei': true });
      console.log(`Found ${baiguullagas.length} orgs with setting on`);
      for (const org of baiguullagas) {
        
        const employees = await Ajiltan.find({ baiguullagiinId: String(org._id) });
        console.log(`Found ${employees.length} employees`);

        for (const emp of employees) {
          if (!emp.utas || !emp.ner || !emp.ovog) continue;
          
          let query = {
            baiguullagiinId: String(org._id),
            ner: { $regex: new RegExp(`^${emp.ner.trim()}$`, 'i') },
            ovog: { $regex: new RegExp(`^${emp.ovog.trim()}$`, 'i') }
          };

          const gerees = await Geree.find(query);
          for (const g of gerees) {
            // Further filter by utas since utas can be array or string
            let phoneMatch = false;
            let empPhones = Array.isArray(emp.utas) ? emp.utas : [emp.utas];
            let gereePhones = Array.isArray(g.utas) ? g.utas : [g.utas];
            
            for (let p of empPhones) {
              if (gereePhones.includes(p)) phoneMatch = true;
            }
            if (!phoneMatch) continue;

            console.log(`Wiping geree ${g.gereeniiDugaar} for ${emp.ner}`);
            await Geree.updateOne({ _id: g._id }, {
              $set: { globalUldegdel: 0, baritsaaniiUldegdel: 0, ekhniiUldegdel: 0 }
            });
            await NekhemjlekhiinTuukh.deleteMany({
              gereeniiId: String(g._id),
              tuluv: "Төлөөгүй"
            });
          }
        }
      }
    }
  } catch(e) { console.error(e); }
  console.log("Done");
  process.exit();
}

wipe();
