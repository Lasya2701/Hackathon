import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  collection, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

async function main() {
  console.log('Connecting to Firestore project:', firebaseConfig.projectId);
  console.log('Database ID:', firebaseConfig.firestoreDatabaseId);

  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);

  const collectionsToCheck = ['foundItems', 'unclaimedItems', 'lostItems'];

  for (const collName of collectionsToCheck) {
    console.log(`\n--- Inspecting collection: ${collName} ---`);
    try {
      const snap = await getDocs(collection(db, collName));
      console.log(`Total documents in ${collName}: ${snap.size}`);

      const docs: { id: string; data: any }[] = [];
      snap.forEach((d) => {
        docs.push({ id: d.id, data: d.data() });
      });

      // Filter and deduplicate for:
      // 1. Hydro Flask 24oz Pacific Blue (or variations)
      // 2. Vivo FlashCharge 44W Charger
      const hydroFlaskDocs = docs.filter(d => {
        const title = (d.data.title || '').toLowerCase();
        return title.includes('hydro flask');
      });

      const vivoChargerDocs = docs.filter(d => {
        const title = (d.data.title || '').toLowerCase();
        return title.includes('vivo') && title.includes('charger');
      });

      console.log(`Found ${hydroFlaskDocs.length} Hydro Flask items in ${collName}`);
      console.log(`Found ${vivoChargerDocs.length} Vivo Charger items in ${collName}`);

      // Keep only one for Hydro Flask
      if (hydroFlaskDocs.length > 1) {
        // Keep the first one, delete the rest
        const toDelete = hydroFlaskDocs.slice(1);
        for (const item of toDelete) {
          console.log(`Deleting duplicate Hydro Flask item ${item.id} in ${collName}`);
          await deleteDoc(doc(db, collName, item.id));
        }
        console.log(`Cleaned up ${toDelete.length} duplicate Hydro Flask items.`);
      }

      // Keep only one for Vivo Charger in foundItems / unclaimedItems
      if (collName !== 'lostItems' && vivoChargerDocs.length > 1) {
        const toDelete = vivoChargerDocs.slice(1);
        for (const item of toDelete) {
          console.log(`Deleting duplicate Vivo Charger item ${item.id} in ${collName}`);
          await deleteDoc(doc(db, collName, item.id));
        }
        console.log(`Cleaned up ${toDelete.length} duplicate Vivo Charger items in ${collName}.`);
      }

      // Update phone number to 9640526975 for lost items or claims
      if (collName === 'lostItems') {
        for (const item of docs) {
          console.log(`Updating phone number to 9640526975 for lost item ${item.id} (${item.data.ownerName || 'Unknown'})`);
          await updateDoc(doc(db, 'lostItems', item.id), {
            ownerPhone: '9640526975'
          });
        }
      }
    } catch (err) {
      console.error(`Error querying ${collName}:`, err);
    }
  }

  // Also check claims collection
  try {
    const claimsSnap = await getDocs(collection(db, 'claims'));
    console.log(`\nClaims count: ${claimsSnap.size}`);
    claimsSnap.forEach(async (c) => {
      await updateDoc(doc(db, 'claims', c.id), {
        claimantPhone: '9640526975'
      });
    });
  } catch (err) {
    console.warn('Claims check:', err);
  }

  console.log('\nDeduplication and phone number update complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
