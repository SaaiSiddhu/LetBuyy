String productImportMessage(String code) => switch (code) {
  'PRODUCT_IMPORT_ROW_FAILED' =>
    'A row could not be created. Review its original CSV row before resuming.',
  'PRODUCT_LIMIT_REACHED' =>
    'Your store has reached its product limit. Free a product slot or review your plan before resuming.',
  'ENTITLEMENT_AUTHORITY_UNAVAILABLE' =>
    'Product limits are unavailable. Keep this import and try again later.',
  'PRODUCT_IMPORT_ACCESS_CHANGED' =>
    'Store access changed. This import is blocked for review.',
  'PRODUCT_IMPORT_LEASE_EXPIRED' =>
    'Another attempt owns this import. Refresh its current status.',
  'PRODUCT_IMPORT_SOURCE_CONFLICT' =>
    'This request belongs to different CSV contents. Recover the original import.',
  'PRODUCT_IMPORT_STOPPED' =>
    'Remaining rows were stopped. Products already committed remain.',
  _ => 'This row needs review. Keep the original CSV.',
};
