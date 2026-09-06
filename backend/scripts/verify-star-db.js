/**
 * DB-level verification of the Starred Messages fix.
 * Connects to the same MongoDB as the backend and checks that:
 *  - every starred doc has createdAt/updatedAt set by Mongoose
 *  - no duplicate (user, message) rows exist
 * Usage: node backend/scripts/verify-star-db.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const col = mongoose.connection.collection('starredmessages');
  const total = await col.countDocuments({});
  const missingTs = await col.countDocuments({
    $or: [
      { createdAt: { $exists: false } },
      { updatedAt: { $exists: false } },
    ],
  });
  const dupes = await col
    .aggregate([{ $group: { _id: { user: '$user', message: '$message' }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])
    .toArray();

  const sample = await col.find({}, { sort: { _id: -1 } }).limit(3).toArray();
  console.log(`starredmessages docs: ${total}`);
  console.log(`docs missing createdAt/updatedAt: ${missingTs}`);
  console.log(`duplicate (user, message) pairs: ${dupes.length}`);
  sample.forEach((d) =>
    console.log(
      `  sample: user=${d.user} message=${d.message} createdAt=${d.createdAt?.toISOString?.()} updatedAt=${d.updatedAt?.toISOString?.()}`
    )
  );

  const ok = total === 0 || (missingTs === 0 && dupes.length === 0);
  console.log(ok ? 'DB CHECK: PASS' : 'DB CHECK: FAIL');
  await mongoose.connection.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('verify-star-db failed:', e.message);
  process.exit(1);
});
