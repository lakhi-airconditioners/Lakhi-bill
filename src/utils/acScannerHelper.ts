/**
 * AC Industry Scanner & IDU / ODU Barcode & QR Code Intelligence Helper
 * Detects whether a scanned code is an Indoor Unit (IDU) or Outdoor Unit (ODU)
 * Model Number or Serial Number based on industry manufacturer naming standards
 * (Daikin, Voltas, LG, Panasonic, Mitsubishi, Hitachi, Carrier, Blue Star, Lloyd, Samsung).
 */

export type AcRoleClassification =
  | 'IDU_SERIAL'
  | 'ODU_SERIAL'
  | 'IDU_MODEL'
  | 'ODU_MODEL'
  | 'SET_MODEL'
  | 'COMBINED_AC'
  | 'GENERAL_SERIAL'
  | 'STOCK_ID'
  | 'UNKNOWN';

export interface AcDetectionResult {
  raw: string;
  classification: AcRoleClassification;
  acUnitType: 'IDU' | 'ODU' | 'SET' | 'COMBINED' | 'OTHER';
  label: string;
  badgeTitle: string;
  badgeColor: 'blue' | 'indigo' | 'emerald' | 'purple' | 'amber' | 'slate';
  confidence: number; // 0 to 1
  reason: string;
  extractedValues: {
    cleanValue: string;
    serialNo?: string;
    modelNo?: string;
    indoorModelNo?: string;
    outdoorModelNo?: string;
    indoorUnitSerial?: string;
    outdoorUnitSerial?: string;
    brand?: string;
    type?: string;
    price?: number;
    stockId?: string;
  };
}

/**
 * Intelligent detector for AC Barcodes & QR codes
 */
export function detectAcBarcodeDetails(rawText: string): AcDetectionResult {
  const raw = (rawText || '').trim();
  const upper = raw.toUpperCase();

  // Base fallback
  const result: AcDetectionResult = {
    raw,
    classification: 'UNKNOWN',
    acUnitType: 'OTHER',
    label: 'Standard Barcode',
    badgeTitle: 'Barcode / QR',
    badgeColor: 'slate',
    confidence: 0.1,
    reason: 'Standard alphanumeric code',
    extractedValues: {
      cleanValue: raw,
    },
  };

  if (!raw) return result;

  // -------------------------------------------------------------
  // Check 0: Stock ID pattern (e.g. LAK-AC-101, STOCK-001)
  // -------------------------------------------------------------
  if (/^LAK[-_]/i.test(raw) || /^STOCK[-_]/i.test(raw) || /^SKU[-_]/i.test(raw)) {
    result.classification = 'STOCK_ID';
    result.acUnitType = 'OTHER';
    result.label = 'In-Store Stock ID';
    result.badgeTitle = '🏷️ Stock SKU ID';
    result.badgeColor = 'amber';
    result.confidence = 0.95;
    result.reason = 'Matches Lakhi internal Godown stock inventory identifier';
    result.extractedValues.stockId = raw;
    result.extractedValues.cleanValue = raw;
    return result;
  }

  // -------------------------------------------------------------
  // Check 1: Combined QR / Multi-line / Key-Value AC Barcode
  // Often on master carton packaging containing both IDU & ODU
  // e.g., "MODEL:FTKF50TV|IDU_SN:E012345|ODU_SN:R098765"
  // or "IDU: FTKF50TV-IDU / SN:12345 \n ODU: RKF50TV-ODU / SN:67890"
  // -------------------------------------------------------------
  const hasIduMention = /(IDU|INDOOR|\bIU\b)/i.test(upper);
  const hasOduMention = /(ODU|OUTDOOR|\bOU\b)/i.test(upper);

  if (hasIduMention && hasOduMention) {
    result.classification = 'COMBINED_AC';
    result.acUnitType = 'COMBINED';
    result.label = 'Complete AC Set (IDU + ODU Carton)';
    result.badgeTitle = '🟣 Combined AC (IDU + ODU)';
    result.badgeColor = 'purple';
    result.confidence = 0.95;
    result.reason = 'Carton code contains both Indoor (IDU) and Outdoor (ODU) parameters';

    // Parse segments from pipe, semicolon, newline, or comma
    const segments = raw.split(/[\r\n|;]+/);
    let foundIduSerial = '';
    let foundOduSerial = '';
    let foundIduModel = '';
    let foundOduModel = '';
    let foundSetModel = '';

    for (const seg of segments) {
      const s = seg.trim();
      const sUp = s.toUpperCase();

      // Check IDU Serial
      if (/(IDU[-_\s]?(SN|SERIAL|S\/N)|INDOOR[-_\s]?(SN|SERIAL)|IU[-_\s]?SN)/i.test(sUp)) {
        foundIduSerial = s.split(/[:=]/).slice(1).join(':').trim() || s;
      }
      // Check ODU Serial
      else if (/(ODU[-_\s]?(SN|SERIAL|S\/N)|OUTDOOR[-_\s]?(SN|SERIAL)|OU[-_\s]?SN)/i.test(sUp)) {
        foundOduSerial = s.split(/[:=]/).slice(1).join(':').trim() || s;
      }
      // Check IDU Model
      else if (/(IDU[-_\s]?(MODEL|MOD|PART)|INDOOR[-_\s]?(MODEL|MOD))/i.test(sUp)) {
        foundIduModel = s.split(/[:=]/).slice(1).join(':').trim() || s;
      }
      // Check ODU Model
      else if (/(ODU[-_\s]?(MODEL|MOD|PART)|OUTDOOR[-_\s]?(MODEL|MOD))/i.test(sUp)) {
        foundOduModel = s.split(/[:=]/).slice(1).join(':').trim() || s;
      }
      // Check Set Model
      else if (/(^MODEL|^SET|^ITEM|^CODE)/i.test(sUp)) {
        foundSetModel = s.split(/[:=]/).slice(1).join(':').trim() || s;
      }
    }

    result.extractedValues.indoorUnitSerial = foundIduSerial || undefined;
    result.extractedValues.outdoorUnitSerial = foundOduSerial || undefined;
    result.extractedValues.indoorModelNo = foundIduModel || undefined;
    result.extractedValues.outdoorModelNo = foundOduModel || undefined;
    result.extractedValues.modelNo = foundSetModel || foundIduModel || undefined;
    result.extractedValues.serialNo = foundIduSerial || foundOduSerial || raw;
    result.extractedValues.type = 'AC';
    return result;
  }

  // -------------------------------------------------------------
  // Check 2: Explicit IDU Serial Number Keywords
  // e.g. "IDU S/N: E012345", "IDUSN: 123456", "INDOOR SERIAL: XYZ"
  // -------------------------------------------------------------
  const iduSerialKeywordMatch = raw.match(
    /(?:IDU|INDOOR|IU)[-_\s]*(?:S\/N|SN|SERIAL|S\.NO|NO)[\s:=]+([A-Z0-9\-_]+)/i
  );
  if (iduSerialKeywordMatch && iduSerialKeywordMatch[1]) {
    const cleanSn = iduSerialKeywordMatch[1].trim();
    result.classification = 'IDU_SERIAL';
    result.acUnitType = 'IDU';
    result.label = 'Indoor Unit Serial No (IDU S/N)';
    result.badgeTitle = '🔵 Indoor Serial (IDU)';
    result.badgeColor = 'blue';
    result.confidence = 0.95;
    result.reason = `Explicit Indoor Unit serial prefix detected ("${iduSerialKeywordMatch[0].trim()}")`;
    result.extractedValues.indoorUnitSerial = cleanSn;
    result.extractedValues.serialNo = cleanSn;
    result.extractedValues.cleanValue = cleanSn;
    result.extractedValues.type = 'AC';
    return result;
  }

  // -------------------------------------------------------------
  // Check 3: Explicit ODU Serial Number Keywords
  // e.g. "ODU S/N: R098765", "ODUSN: 654321", "OUTDOOR SERIAL: ABC"
  // -------------------------------------------------------------
  const oduSerialKeywordMatch = raw.match(
    /(?:ODU|OUTDOOR|OU)[-_\s]*(?:S\/N|SN|SERIAL|S\.NO|NO)[\s:=]+([A-Z0-9\-_]+)/i
  );
  if (oduSerialKeywordMatch && oduSerialKeywordMatch[1]) {
    const cleanSn = oduSerialKeywordMatch[1].trim();
    result.classification = 'ODU_SERIAL';
    result.acUnitType = 'ODU';
    result.label = 'Outdoor Unit Serial No (ODU S/N)';
    result.badgeTitle = '🟢 Outdoor Serial (ODU)';
    result.badgeColor = 'emerald';
    result.confidence = 0.95;
    result.reason = `Explicit Outdoor Unit serial prefix detected ("${oduSerialKeywordMatch[0].trim()}")`;
    result.extractedValues.outdoorUnitSerial = cleanSn;
    result.extractedValues.serialNo = cleanSn;
    result.extractedValues.cleanValue = cleanSn;
    result.extractedValues.type = 'AC';
    return result;
  }

  // -------------------------------------------------------------
  // Check 4: Explicit IDU Model Keywords
  // e.g. "IDU MODEL: FTKF50TV", "INDOOR MODEL NO: 183V CZR"
  // -------------------------------------------------------------
  const iduModelKeywordMatch = raw.match(
    /(?:IDU|INDOOR|IU)[-_\s]*(?:MODEL|MOD|PART|ITEM)[\s:=]+([A-Z0-9\-_()\/ ]+)/i
  );
  if (iduModelKeywordMatch && iduModelKeywordMatch[1]) {
    const cleanMod = iduModelKeywordMatch[1].trim();
    result.classification = 'IDU_MODEL';
    result.acUnitType = 'IDU';
    result.label = 'Indoor Unit Model No (IDU Model)';
    result.badgeTitle = '🔵 Indoor Model (IDU)';
    result.badgeColor = 'blue';
    result.confidence = 0.95;
    result.reason = `Explicit Indoor Model prefix detected ("${iduModelKeywordMatch[0].trim()}")`;
    result.extractedValues.indoorModelNo = cleanMod;
    result.extractedValues.modelNo = cleanMod.replace(/[-_\s]*IDU/i, '').trim();
    result.extractedValues.cleanValue = cleanMod;
    result.extractedValues.type = 'AC';
    return result;
  }

  // -------------------------------------------------------------
  // Check 5: Explicit ODU Model Keywords
  // e.g. "ODU MODEL: RKF50TV", "OUTDOOR MODEL: 183V CZR"
  // -------------------------------------------------------------
  const oduModelKeywordMatch = raw.match(
    /(?:ODU|OUTDOOR|OU)[-_\s]*(?:MODEL|MOD|PART|ITEM)[\s:=]+([A-Z0-9\-_()\/ ]+)/i
  );
  if (oduModelKeywordMatch && oduModelKeywordMatch[1]) {
    const cleanMod = oduModelKeywordMatch[1].trim();
    result.classification = 'ODU_MODEL';
    result.acUnitType = 'ODU';
    result.label = 'Outdoor Unit Model No (ODU Model)';
    result.badgeTitle = '🟢 Outdoor Model (ODU)';
    result.badgeColor = 'emerald';
    result.confidence = 0.95;
    result.reason = `Explicit Outdoor Model prefix detected ("${oduModelKeywordMatch[0].trim()}")`;
    result.extractedValues.outdoorModelNo = cleanMod;
    result.extractedValues.modelNo = cleanMod.replace(/[-_\s]*ODU/i, '').trim();
    result.extractedValues.cleanValue = cleanMod;
    result.extractedValues.type = 'AC';
    return result;
  }

  // -------------------------------------------------------------
  // Check 6: Suffix / Infix IDU or ODU in Model or Serial string
  // e.g., "FTKF50TV-IDU", "183V-CZR(IDU)", "FTKF50TV_INDOOR", "SN-987654-IDU"
  // -------------------------------------------------------------
  if (/(?:[-_/(]IDU\b|[-_]INDOOR\b|\(IDU\))/i.test(upper)) {
    // Suffix IDU
    const isLikelySerial = /SN|SERIAL|\b[A-Z0-9]{12,}\b/i.test(upper) || /^\d{8,}$/.test(raw);
    if (isLikelySerial) {
      result.classification = 'IDU_SERIAL';
      result.acUnitType = 'IDU';
      result.label = 'Indoor Unit Serial No (IDU)';
      result.badgeTitle = '🔵 Indoor Serial (IDU)';
      result.badgeColor = 'blue';
      result.confidence = 0.9;
      result.reason = 'Code contains IDU/Indoor unit indicator with serial characteristics';
      result.extractedValues.indoorUnitSerial = raw;
      result.extractedValues.serialNo = raw;
      result.extractedValues.cleanValue = raw;
      result.extractedValues.type = 'AC';
      return result;
    } else {
      result.classification = 'IDU_MODEL';
      result.acUnitType = 'IDU';
      result.label = 'Indoor Unit Model No (IDU)';
      result.badgeTitle = '🔵 Indoor Model (IDU)';
      result.badgeColor = 'blue';
      result.confidence = 0.9;
      result.reason = 'Model contains explicit "-IDU" or "(IDU)" indoor unit suffix';
      result.extractedValues.indoorModelNo = raw;
      result.extractedValues.modelNo = raw.replace(/[-_\s/(]*IDU[)]*/i, '').trim();
      result.extractedValues.cleanValue = raw;
      result.extractedValues.type = 'AC';
      return result;
    }
  }

  if (/(?:[-_/(]ODU\b|[-_]OUTDOOR\b|\(ODU\))/i.test(upper)) {
    // Suffix ODU
    const isLikelySerial = /SN|SERIAL|\b[A-Z0-9]{12,}\b/i.test(upper) || /^\d{8,}$/.test(raw);
    if (isLikelySerial) {
      result.classification = 'ODU_SERIAL';
      result.acUnitType = 'ODU';
      result.label = 'Outdoor Unit Serial No (ODU)';
      result.badgeTitle = '🟢 Outdoor Serial (ODU)';
      result.badgeColor = 'emerald';
      result.confidence = 0.9;
      result.reason = 'Code contains ODU/Outdoor unit indicator with serial characteristics';
      result.extractedValues.outdoorUnitSerial = raw;
      result.extractedValues.serialNo = raw;
      result.extractedValues.cleanValue = raw;
      result.extractedValues.type = 'AC';
      return result;
    } else {
      result.classification = 'ODU_MODEL';
      result.acUnitType = 'ODU';
      result.label = 'Outdoor Unit Model No (ODU)';
      result.badgeTitle = '🟢 Outdoor Model (ODU)';
      result.badgeColor = 'emerald';
      result.confidence = 0.9;
      result.reason = 'Model contains explicit "-ODU" or "(ODU)" outdoor unit suffix';
      result.extractedValues.outdoorModelNo = raw;
      result.extractedValues.modelNo = raw.replace(/[-_\s/(]*ODU[)]*/i, '').trim();
      result.extractedValues.cleanValue = raw;
      result.extractedValues.type = 'AC';
      return result;
    }
  }

  // -------------------------------------------------------------
  // Check 7: Brand-Specific AC Model Code Standards
  // -------------------------------------------------------------

  // DAIKIN:
  // Indoor starts with FT (e.g. FTKF, FTKM, FTHT, FTE, FTL, FTX, FTQ, FCQ, FBA, FAA)
  // Outdoor starts with RK (e.g. RKF, RKM, RHT, RE, RL, RX, RQ, RCQ, RZA, RZQ)
  if (/^FT[A-Z0-9]{4,}/i.test(upper) || /^F[BC][A-Z0-9]{4,}/i.test(upper)) {
    const daikinModel = upper.split(/[\s_-]/)[0];
    result.classification = 'IDU_MODEL';
    result.acUnitType = 'IDU';
    result.label = 'Daikin Indoor Unit Model (FT... IDU)';
    result.badgeTitle = '🔵 Daikin IDU Model';
    result.badgeColor = 'blue';
    result.confidence = 0.92;
    result.reason = `Matches Daikin standard indoor unit prefix "${daikinModel.slice(0, 4)}"`;
    result.extractedValues.indoorModelNo = daikinModel;
    result.extractedValues.modelNo = daikinModel;
    // Derive corresponding outdoor model (replace FT with RK)
    result.extractedValues.outdoorModelNo = daikinModel.replace(/^FT/i, 'RK').replace(/^F/i, 'R');
    result.extractedValues.brand = 'Daikin';
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = daikinModel;
    return result;
  }

  if (/^RK[A-Z0-9]{4,}/i.test(upper) || /^R[BCZ][A-Z0-9]{4,}/i.test(upper)) {
    const daikinOduModel = upper.split(/[\s_-]/)[0];
    result.classification = 'ODU_MODEL';
    result.acUnitType = 'ODU';
    result.label = 'Daikin Outdoor Unit Model (RK... ODU)';
    result.badgeTitle = '🟢 Daikin ODU Model';
    result.badgeColor = 'emerald';
    result.confidence = 0.92;
    result.reason = `Matches Daikin standard outdoor unit prefix "${daikinOduModel.slice(0, 4)}"`;
    result.extractedValues.outdoorModelNo = daikinOduModel;
    // Derive corresponding indoor model (replace RK with FT)
    result.extractedValues.indoorModelNo = daikinOduModel.replace(/^RK/i, 'FT').replace(/^R/i, 'F');
    result.extractedValues.modelNo = result.extractedValues.indoorModelNo;
    result.extractedValues.brand = 'Daikin';
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = daikinOduModel;
    return result;
  }

  // PANASONIC:
  // CS- = Indoor, CU- = Outdoor
  if (/^CS-[A-Z0-9]+/i.test(upper)) {
    result.classification = 'IDU_MODEL';
    result.acUnitType = 'IDU';
    result.label = 'Panasonic Indoor Unit Model (CS-...)';
    result.badgeTitle = '🔵 Panasonic IDU Model';
    result.badgeColor = 'blue';
    result.confidence = 0.92;
    result.reason = 'Matches Panasonic CS- (Indoor Unit) standard model prefix';
    result.extractedValues.indoorModelNo = raw;
    result.extractedValues.outdoorModelNo = raw.replace(/^CS-/i, 'CU-');
    result.extractedValues.modelNo = raw;
    result.extractedValues.brand = 'Panasonic';
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = raw;
    return result;
  }

  if (/^CU-[A-Z0-9]+/i.test(upper)) {
    result.classification = 'ODU_MODEL';
    result.acUnitType = 'ODU';
    result.label = 'Panasonic Outdoor Unit Model (CU-...)';
    result.badgeTitle = '🟢 Panasonic ODU Model';
    result.badgeColor = 'emerald';
    result.confidence = 0.92;
    result.reason = 'Matches Panasonic CU- (Outdoor Unit) standard model prefix';
    result.extractedValues.outdoorModelNo = raw;
    result.extractedValues.indoorModelNo = raw.replace(/^CU-/i, 'CS-');
    result.extractedValues.modelNo = result.extractedValues.indoorModelNo;
    result.extractedValues.brand = 'Panasonic';
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = raw;
    return result;
  }

  // MITSUBISHI:
  // MSZ- / MSY- / SRK- = Indoor, MUZ- / MUY- / SRC- = Outdoor
  if (/^(MSZ|MSY|SRK)-[A-Z0-9]+/i.test(upper)) {
    result.classification = 'IDU_MODEL';
    result.acUnitType = 'IDU';
    result.label = 'Mitsubishi Indoor Unit Model (IDU)';
    result.badgeTitle = '🔵 Mitsubishi IDU Model';
    result.badgeColor = 'blue';
    result.confidence = 0.92;
    result.reason = 'Matches Mitsubishi MSZ/MSY/SRK Indoor Unit standard prefix';
    result.extractedValues.indoorModelNo = raw;
    result.extractedValues.outdoorModelNo = raw.replace(/^MS([ZY])/i, 'MU$1').replace(/^SRK/i, 'SRC');
    result.extractedValues.modelNo = raw;
    result.extractedValues.brand = 'Mitsubishi';
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = raw;
    return result;
  }

  if (/^(MUZ|MUY|SRC)-[A-Z0-9]+/i.test(upper)) {
    result.classification = 'ODU_MODEL';
    result.acUnitType = 'ODU';
    result.label = 'Mitsubishi Outdoor Unit Model (ODU)';
    result.badgeTitle = '🟢 Mitsubishi ODU Model';
    result.badgeColor = 'emerald';
    result.confidence = 0.92;
    result.reason = 'Matches Mitsubishi MUZ/MUY/SRC Outdoor Unit standard prefix';
    result.extractedValues.outdoorModelNo = raw;
    result.extractedValues.indoorModelNo = raw.replace(/^MU([ZY])/i, 'MS$1').replace(/^SRC/i, 'SRK');
    result.extractedValues.modelNo = result.extractedValues.indoorModelNo;
    result.extractedValues.brand = 'Mitsubishi';
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = raw;
    return result;
  }

  // HITACHI:
  // RAI- / RIDA- / RAS- = Indoor, RAC- / RODA- = Outdoor
  if (/^(RAI|RIDA|RAS)[-_]?[A-Z0-9]+/i.test(upper) || /^[A-Z0-9]+-I\b/i.test(upper)) {
    result.classification = 'IDU_MODEL';
    result.acUnitType = 'IDU';
    result.label = 'Hitachi Indoor Unit Model (IDU)';
    result.badgeTitle = '🔵 Hitachi IDU Model';
    result.badgeColor = 'blue';
    result.confidence = 0.9;
    result.reason = 'Matches Hitachi indoor unit prefix / suffix standard';
    result.extractedValues.indoorModelNo = raw;
    result.extractedValues.outdoorModelNo = raw.replace(/^RAI/i, 'RAC').replace(/^RIDA/i, 'RODA').replace(/-I$/i, '-O');
    result.extractedValues.modelNo = raw;
    result.extractedValues.brand = 'Hitachi';
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = raw;
    return result;
  }

  if (/^(RAC|RODA)[-_]?[A-Z0-9]+/i.test(upper) || /^[A-Z0-9]+-O\b/i.test(upper)) {
    result.classification = 'ODU_MODEL';
    result.acUnitType = 'ODU';
    result.label = 'Hitachi Outdoor Unit Model (ODU)';
    result.badgeTitle = '🟢 Hitachi ODU Model';
    result.badgeColor = 'emerald';
    result.confidence = 0.9;
    result.reason = 'Matches Hitachi outdoor unit prefix / suffix standard';
    result.extractedValues.outdoorModelNo = raw;
    result.extractedValues.indoorModelNo = raw.replace(/^RAC/i, 'RAI').replace(/^RODA/i, 'RIDA').replace(/-O$/i, '-I');
    result.extractedValues.modelNo = result.extractedValues.indoorModelNo;
    result.extractedValues.brand = 'Hitachi';
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = raw;
    return result;
  }

  // CARRIER:
  // CAI- = Indoor, CAO- = Outdoor
  if (/^CAI[A-Z0-9]+/i.test(upper)) {
    result.classification = 'IDU_MODEL';
    result.acUnitType = 'IDU';
    result.label = 'Carrier Indoor Unit Model (CAI...)';
    result.badgeTitle = '🔵 Carrier IDU Model';
    result.badgeColor = 'blue';
    result.confidence = 0.92;
    result.reason = 'Matches Carrier CAI (Indoor Unit) standard model prefix';
    result.extractedValues.indoorModelNo = raw;
    result.extractedValues.outdoorModelNo = raw.replace(/^CAI/i, 'CAO');
    result.extractedValues.modelNo = raw;
    result.extractedValues.brand = 'Carrier';
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = raw;
    return result;
  }

  if (/^CAO[A-Z0-9]+/i.test(upper)) {
    result.classification = 'ODU_MODEL';
    result.acUnitType = 'ODU';
    result.label = 'Carrier Outdoor Unit Model (CAO...)';
    result.badgeTitle = '🟢 Carrier ODU Model';
    result.badgeColor = 'emerald';
    result.confidence = 0.92;
    result.reason = 'Matches Carrier CAO (Outdoor Unit) standard model prefix';
    result.extractedValues.outdoorModelNo = raw;
    result.extractedValues.indoorModelNo = raw.replace(/^CAO/i, 'CAI');
    result.extractedValues.modelNo = result.extractedValues.indoorModelNo;
    result.extractedValues.brand = 'Carrier';
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = raw;
    return result;
  }

  // -------------------------------------------------------------
  // Check 8: Generic AC Serial or Set Model Detection
  // e.g. "SN: 12345678" or barcode prefix "SN-"
  // -------------------------------------------------------------
  if (/^(SN|SER|SERIAL)[-_:]/i.test(raw)) {
    const cleanSn = raw.replace(/^(SN|SER|SERIAL)[-_:]\s*/i, '').trim();
    result.classification = 'GENERAL_SERIAL';
    result.acUnitType = 'OTHER';
    result.label = 'Unit Serial Number (S/N)';
    result.badgeTitle = '🏷️ Serial Number (SR)';
    result.badgeColor = 'slate';
    result.confidence = 0.85;
    result.reason = 'Starts with serial number prefix';
    result.extractedValues.serialNo = cleanSn;
    result.extractedValues.cleanValue = cleanSn;
    return result;
  }

  // Check 9: Pure alphanumeric serial number (10+ digits or mixed letters/digits with serial characteristics)
  if (/^[A-Z0-9]{10,24}$/i.test(raw) && /\d/.test(raw)) {
    result.classification = 'GENERAL_SERIAL';
    result.acUnitType = 'OTHER';
    result.label = 'Serial Number (SR)';
    result.badgeTitle = '🏷️ Serial No (SR)';
    result.badgeColor = 'slate';
    result.confidence = 0.75;
    result.reason = 'Alphanumeric code matching manufacturer product serial number format';
    result.extractedValues.serialNo = raw;
    result.extractedValues.cleanValue = raw;
    return result;
  }

  // Check 10: Model number pattern (shorter alphanumeric, e.g. "FTKF50", "183VCZR", "AR18CY3")
  if (/^[A-Z0-9\-]{5,12}$/i.test(raw) && /[A-Z]/i.test(raw) && /\d/.test(raw)) {
    result.classification = 'SET_MODEL';
    result.acUnitType = 'SET';
    result.label = 'AC Set Model Number';
    result.badgeTitle = '📦 Set Model No';
    result.badgeColor = 'amber';
    result.confidence = 0.7;
    result.reason = 'Standard alphanumeric appliance model number format';
    result.extractedValues.modelNo = raw;
    result.extractedValues.indoorModelNo = `${raw}-IDU`;
    result.extractedValues.outdoorModelNo = `${raw}-ODU`;
    result.extractedValues.type = 'AC';
    result.extractedValues.cleanValue = raw;
    return result;
  }

  return result;
}

/**
 * Helper to extract the most relevant field for a specific scan target
 * e.g., if staff clicked scan next to "Indoor Unit Serial", extract IDU serial
 */
export function extractCleanValueForTarget(
  scannedText: string,
  targetFieldHint?: string
): string {
  const detected = detectAcBarcodeDetails(scannedText);
  const hint = (targetFieldHint || '').toLowerCase();

  // If scanning specifically for Indoor Serial
  if (hint.includes('indoor') && (hint.includes('serial') || hint.includes('sr'))) {
    return (
      detected.extractedValues.indoorUnitSerial ||
      detected.extractedValues.serialNo ||
      detected.extractedValues.cleanValue ||
      scannedText.trim()
    );
  }

  // If scanning specifically for Outdoor Serial
  if (hint.includes('outdoor') && (hint.includes('serial') || hint.includes('sr'))) {
    return (
      detected.extractedValues.outdoorUnitSerial ||
      detected.extractedValues.serialNo ||
      detected.extractedValues.cleanValue ||
      scannedText.trim()
    );
  }

  // If scanning specifically for Indoor Model
  if (hint.includes('indoor') && hint.includes('model')) {
    return (
      detected.extractedValues.indoorModelNo ||
      detected.extractedValues.modelNo ||
      detected.extractedValues.cleanValue ||
      scannedText.trim()
    );
  }

  // If scanning specifically for Outdoor Model
  if (hint.includes('outdoor') && hint.includes('model')) {
    return (
      detected.extractedValues.outdoorModelNo ||
      detected.extractedValues.modelNo ||
      detected.extractedValues.cleanValue ||
      scannedText.trim()
    );
  }

  // If scanning specifically for Model No
  if (hint.includes('model')) {
    return (
      detected.extractedValues.modelNo ||
      detected.extractedValues.indoorModelNo ||
      detected.extractedValues.cleanValue ||
      scannedText.trim()
    );
  }

  // If scanning specifically for Serial No
  if (hint.includes('serial') || hint.includes('sr')) {
    return (
      detected.extractedValues.serialNo ||
      detected.extractedValues.indoorUnitSerial ||
      detected.extractedValues.outdoorUnitSerial ||
      detected.extractedValues.cleanValue ||
      scannedText.trim()
    );
  }

  return detected.extractedValues.cleanValue || scannedText.trim();
}
