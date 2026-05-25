import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin (uses Application Default Credentials)
admin.initializeApp({
  projectId: "pmv-one",
});

const TARGET_DATABASE_ID = (process.env.FIRESTORE_TARGET_DATABASE_ID ?? "").trim();
const SOURCE_DATABASE_ID = (process.env.FIRESTORE_SOURCE_DATABASE_ID ?? "").trim();

const db = TARGET_DATABASE_ID && TARGET_DATABASE_ID !== "(default)"
  ? getFirestore(TARGET_DATABASE_ID)
  : getFirestore();
const sourceDb = SOURCE_DATABASE_ID && SOURCE_DATABASE_ID !== "(default)"
  ? getFirestore(SOURCE_DATABASE_ID)
  : getFirestore();

async function migrateCollection(collectionPath: string): Promise<void> {
  console.log(`\n📂 Migrating collection: ${collectionPath}`);

  try {
    const sourceSnap = await sourceDb.collection(collectionPath).get();
    console.log(`   Found ${sourceSnap.docs.length} documents`);

    let migratedCount = 0;

    for (const doc of sourceSnap.docs) {
      const data = doc.data();

      // Create or update document in default database
      await db.collection(collectionPath).doc(doc.id).set(data, { merge: true });
      migratedCount++;

      if (migratedCount % 50 === 0) {
        console.log(`   ✓ Migrated ${migratedCount}/${sourceSnap.docs.length} documents`);
      }
    }

    console.log(`   ✅ Completed: ${migratedCount} documents migrated`);
  } catch (error) {
    console.error(`   ❌ Error migrating ${collectionPath}:`, error);
  }
}

async function migrateAllCollections(): Promise<void> {
  try {
    console.log(
      `🚀 Starting database migration from ${SOURCE_DATABASE_ID || "(default)"} to ${TARGET_DATABASE_ID || "(default)"}...\n`,
    );

    // Get all collections from source database
    const collectionsSnap = await sourceDb.listCollections();
    const collectionNames = collectionsSnap.map((col: any) => col.id);

    console.log(`Found ${collectionNames.length} collections to migrate:`);
    collectionNames.forEach((name: string) => console.log(`  - ${name}`));

    // Migrate each collection
    for (const collectionName of collectionNames) {
      await migrateCollection(collectionName);
    }

    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateAllCollections();
