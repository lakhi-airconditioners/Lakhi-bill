(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LA_D_Store_Dataset = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  return {
  "storeProfile": {
    "companyName": "LAKHI ELECTRONICS AIRCONDITIONERS",
    "storeGstin": "24AAIPU5764D1ZI",
    "storeHelpline": "+91 99980 21446"
  },
  "dateKey": "20261027",
  "exportTimestamp": "2026-10-27T18:06:09.945588",
  "customers": [
    {
      "id": "C202610271001",
      "customMiddleId": "VIP-CORP",
      "externalName": "NEXUS INFRASTRUCTURE PRIVATE LIMITED",
      "internalName": "Nexus Infra - Tally Ledger",
      "phone": "+91 98250 27209",
      "accessPin": "4037",
      "email": "contact@nexusinfra.in",
      "openingBalance": 145000.0,
      "currentBalance": 145000.0,
      "billingAddress": "702, Nexus Tower, SG Highway, Ahmedabad",
      "installationAddress": "702, Nexus Tower, SG Highway, Ahmedabad",
      "gstin": "24AAACN1234F1Z5",
      "createdAt": "2026-10-27T18:06:09.945556"
    }
  ],
  "vendors": [
    {
      "id": "V202610271001",
      "vendorName": "DAIKIN AIRCONDITIONING INDIA PVT LTD",
      "category": "SUPPLIER_STOCK",
      "partyPhone": "+91 99980 21446",
      "billOrderReferenceNo": "PO-V202610271001",
      "targetDueDate": "2026-10-30",
      "amountWeOwe": 285000.0,
      "notes": "Daikin Factory Stock Purchase",
      "createdAt": "2026-10-27T18:06:09.945580"
    }
  ],
  "storeStock": [
    {
      "id": "STK202610271001",
      "name": "Daikin 1.5 Ton 5 Star Inverter Split AC",
      "modelNo": "FTKM50U",
      "indoorModel": "FTKM50UVM16",
      "outdoorModel": "RKM50UVM16",
      "type": "Inverter Split AC",
      "brand": "Daikin",
      "serialNo": "SN202610271001",
      "indoorUnitSerial": "IDSN202610271001",
      "outdoorUnitSerial": "ODSN202610271001",
      "sellingPrice": 45500.0,
      "createdAt": "2026-10-27T18:06:09.945584"
    }
  ],
  "invoices": [],
  "deliveries": [],
  "transactions": []
};
}));
