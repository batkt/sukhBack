const mongoose = require('mongoose');
const { db } = require('./node_modules/zevbackv2');

async function wipe() {
  console.log("Starting wipe...");
  try {
    for (const kholbolt of db.kholboltuud) {
      console.log(`Checking DB: ${kholbolt.name}`);
      const Geree = require('./models/geree')(kholbolt);
      const Baiguullaga = require('./models/baiguullaga')(kholbolt);
      const Ajiltan = require('./models/ajiltan')(kholbolt);
      const NekhemjlekhiinTuukh = require('./models/nekhemjlekhiinTuukh')(kholbolt);

      const baiguullagas = await Baiguullaga.find({});
      for (const org of baiguullagas) {
        const exemptOrg = org.tokhirgoo?.ajiltanTokhirgooIdevkhtei;
        // Check buildings
        const exemptBuildings = (org.barilguud || []).filter(b => b.tokhirgoo?.ajiltanTokhirgooIdevkhtei).map(b => String(b._id));
        
        if (!exemptOrg && exemptBuildings.length === 0) continue;
        console.log(`Found exempt setting for org ${org.ner}`);

        const employees = await Ajiltan.find({ baiguullagiinId: String(org._id) });
        console.log(`Found ${employees.length} employees`);

        for (const emp of employees) {
          if (!emp.utas || !emp.ner || !emp.ovog) continue;
          
          let query = {
            baiguullagiinId: String(org._id),
            ner: { $regex: new RegExp(`^${emp.ner.trim()}$`, 'i') },
            ovog: { $regex: new RegExp(`^${emp.ovog.trim()}$`, 'i') },
            utas: { $in: emp.utas.split ? [emp.utas] : emp.utas }
          };

          if (!exemptOrg) {
            query.barilgiinId = { $in: exemptBuildings };
          }

          const gerees = await Geree.find(query);
          for (const g of gerees) {
            console.log(`Wiping geree ${g.gereeniiDugaar} for ${emp.ner}`);
            await Geree.updateOne({ _id: g._id }, {
              $set: { globalUldegdel: 0, baritsaaniiUldegdel: 0, ekhniiUldegdel: 0 }
            });
            // Delete unpaid/any invoices? The user said "that resident should not have any nekhemjlekh". We should probably delete all unpaid invoices for them, or all invoices. Unpaid ones contribute to uldegdel.
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
