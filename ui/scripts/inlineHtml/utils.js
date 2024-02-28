const uniqueIds = new Set();

// eslint-disable-next-line no-unused-vars
function generateTrulyUniqueRowId() {
  let newId = generateRowID();
  while(uniqueIds.has(newId)) {
    newId = generateRowID();
  }
  uniqueIds.add(newId);
  return newId;
}
