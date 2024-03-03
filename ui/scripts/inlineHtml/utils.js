const uniqueIds = new Set();

/**
 * generateRowID() doesn't always generate a unique value.
 * See:
 * https://app.roll20.net/forum/post/8879969/generaterowid-does-not-always-generate-a-star-unique-star-rowid
 */
// eslint-disable-next-line no-unused-vars
function generateTrulyUniqueRowId() {
  let newId = generateRowID();
  while(uniqueIds.has(newId)) {
    newId = generateRowID();
  }
  uniqueIds.add(newId);
  return newId;
}
