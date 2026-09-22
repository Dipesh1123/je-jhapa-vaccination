/**
 * JE-083_84 Daily Reporting - restore broken formulas + lock down non-entry cells.
 * Generated from the reference workbook's own cell-protection design.
 * Run fixAndProtectAll() once from the Apps Script editor (Extensions > Apps Script).
 * Does NOT touch any white/data-entry cells (D,E,G,H) - only formula/header cells.
 */

var FORMULA_FIXES = [
  {sheet: "Mechinagar Municipality", cell: "F5", formula: "=D5+E5"},
  {sheet: "Mechinagar Municipality", cell: "I7", formula: "=G7+H7"},
  {sheet: "Mechinagar Municipality", cell: "F8", formula: "=D8+E8"},
  {sheet: "Mechinagar Municipality", cell: "I8", formula: "=G8+H8"},
  {sheet: "Mechinagar Municipality", cell: "F10", formula: "=D10+E10"},
  {sheet: "Mechinagar Municipality", cell: "I10", formula: "=G10+H10"},
  {sheet: "Mechinagar Municipality", cell: "F12", formula: "=D12+E12"},
  {sheet: "Mechinagar Municipality", cell: "I14", formula: "=G14+H14"},
  {sheet: "Kankai Municipality", cell: "F22", formula: "=D22+E22"},
  {sheet: "Kankai Municipality", cell: "F27", formula: "=D27+E27"},
];

var UNLOCKED_RANGES = {
  "Mechinagar Municipality": [
    "D26:E40",
    "G26:H40",
    "D47:E61",
    "G47:H61",
    "D68:E82",
    "G68:H82",
    "D89:E103",
    "G89:H103",
    "D110:E124",
    "G110:H124",
    "D131:E145",
    "G131:H145",
    "D152:E166",
    "G152:H166",
    "D173:E187",
    "G173:H187",
    "D194:E208",
    "G194:H208",
    "D215:E229",
    "G215:H229",
    "D236:E250",
    "G236:H250"
  ],
  "Buddhashanti Gaunpalika": [
    "D18:E24",
    "G18:H24",
    "D31:E37",
    "G31:H37",
    "D44:E50",
    "G44:H50",
    "D57:E63",
    "G57:H63",
    "D70:E76",
    "G70:H76",
    "D83:E89",
    "G83:H89",
    "D96:E102",
    "G96:H102",
    "D109:E115",
    "G109:H115",
    "D122:E128",
    "G122:H128",
    "D135:E141",
    "G135:H141",
    "D148:E154",
    "G148:H154"
  ],
  "Arjundhara Municipality": [
    "D22:E32",
    "G22:H32",
    "D39:E49",
    "G39:H49",
    "D56:E66",
    "G56:H66",
    "D73:E83",
    "G73:H83",
    "D90:E100",
    "G90:H100",
    "D107:E117",
    "G107:H117",
    "D124:E134",
    "G124:H134",
    "D141:E151",
    "G141:H151",
    "D158:E168",
    "G158:H168",
    "D175:E185",
    "G175:H185",
    "D192:E202",
    "G192:H202"
  ],
  "Kankai Municipality": [
    "D20:E28",
    "G20:H28",
    "D35:E43",
    "G35:H43",
    "D50:E58",
    "G50:H58",
    "D65:E73",
    "G65:H73",
    "D80:E88",
    "G80:H88",
    "D95:E103",
    "G95:H103",
    "D110:E118",
    "G110:H118",
    "D125:E133",
    "G125:H133",
    "D140:E148",
    "G140:H148",
    "D155:E163",
    "G155:H163",
    "D170:E178",
    "G170:H178"
  ],
  "Shivasatakshi Municipality": [
    "D22:E32",
    "G22:H32",
    "D39:E49",
    "G39:H49",
    "D56:E66",
    "G56:H66",
    "D73:E83",
    "G73:H83",
    "D90:E100",
    "G90:H100",
    "D107:E117",
    "G107:H117",
    "D124:E134",
    "G124:H134",
    "D141:E151",
    "G141:H151",
    "D158:E168",
    "G158:H168",
    "D175:E185",
    "G175:H185",
    "D192:E202",
    "G192:H202"
  ],
  "Kamal Gaunpalika": [
    "D18:E24",
    "G18:H24",
    "D31:E37",
    "G31:H37",
    "D44:E50",
    "G44:H50",
    "D57:E63",
    "G57:H63",
    "D70:E76",
    "G70:H76",
    "D83:E89",
    "G83:H89",
    "D96:E102",
    "G96:H102",
    "D109:E115",
    "G109:H115",
    "D122:E128",
    "G122:H128",
    "D135:E141",
    "G135:H141",
    "D148:E154",
    "G148:H154"
  ],
  "Damak Municipality": [
    "D21:E30",
    "G21:H30",
    "D37:E46",
    "G37:H46",
    "D53:E62",
    "G53:H62",
    "D69:E78",
    "G69:H78",
    "D85:E94",
    "G85:H94",
    "D101:E110",
    "G101:H110",
    "D117:E126",
    "G117:H126",
    "D133:E142",
    "G133:H142",
    "D149:E158",
    "G149:H158",
    "D165:E174",
    "G165:H174",
    "D181:E190",
    "G181:H190"
  ],
  "Gauradaha Municipality": [
    "D20:E28",
    "G20:H28",
    "D35:E43",
    "G35:H43",
    "D50:E58",
    "G50:H58",
    "D65:E73",
    "G65:H73",
    "D80:E88",
    "G80:H88",
    "D95:E103",
    "G95:H103",
    "D110:E118",
    "G110:H118",
    "D125:E133",
    "G125:H133",
    "D140:E148",
    "G140:H148",
    "D155:E163",
    "G155:H163",
    "D170:E178",
    "G170:H178"
  ],
  "Gauriganj Gaunpalika": [
    "D17:E22",
    "G17:H22",
    "D29:E34",
    "G29:H34",
    "D41:E46",
    "G41:H46",
    "D53:E58",
    "G53:H58",
    "D65:E70",
    "G65:H70",
    "D77:E82",
    "G77:H82",
    "D89:E94",
    "G89:H94",
    "D101:E106",
    "G101:H106",
    "D113:E118",
    "G113:H118",
    "D125:E130",
    "G125:H130",
    "D137:E142",
    "G137:H142"
  ],
  "Jhapa Gaunpalika": [
    "D18:E24",
    "G18:H24",
    "D31:E37",
    "G31:H37",
    "D44:E50",
    "G44:H50",
    "D57:E63",
    "G57:H63",
    "D70:E76",
    "G70:H76",
    "D83:E89",
    "G83:H89",
    "D96:E102",
    "G96:H102",
    "D109:E115",
    "G109:H115",
    "D122:E128",
    "G122:H128",
    "D135:E141",
    "G135:H141",
    "D148:E154",
    "G148:H154"
  ],
  "Barhadashi Gaunpalika": [
    "D18:E24",
    "G18:H24",
    "D31:E37",
    "G31:H37",
    "D44:E50",
    "G44:H50",
    "D57:E63",
    "G57:H63",
    "D70:E76",
    "G70:H76",
    "D83:E89",
    "G83:H89",
    "D96:E102",
    "G96:H102",
    "D109:E115",
    "G109:H115",
    "D122:E128",
    "G122:H128",
    "D135:E141",
    "G135:H141",
    "D148:E154",
    "G148:H154"
  ],
  "Birtamod Municipality": [
    "D21:E30",
    "G21:H30",
    "D37:E46",
    "G37:H46",
    "D53:E62",
    "G53:H62",
    "D69:E78",
    "G69:H78",
    "D85:E94",
    "G85:H94",
    "D101:E110",
    "G101:H110",
    "D117:E126",
    "G117:H126",
    "D133:E142",
    "G133:H142",
    "D149:E158",
    "G149:H158",
    "D165:E174",
    "G165:H174",
    "D181:E190",
    "G181:H190"
  ],
  "Haldibari Gaunpalika": [
    "D16:E20",
    "G16:H20",
    "D27:E31",
    "G27:H31",
    "D38:E42",
    "G38:H42",
    "D49:E53",
    "G49:H53",
    "D60:E64",
    "G60:H64",
    "D71:E75",
    "G71:H75",
    "D82:E86",
    "G82:H86",
    "D93:E97",
    "G93:H97",
    "D104:E108",
    "G104:H108",
    "D115:E119",
    "G115:H119",
    "D126:E130",
    "G126:H130"
  ],
  "Bhadrapur Municipality": [
    "D21:E30",
    "G21:H30",
    "D37:E46",
    "G37:H46",
    "D53:E62",
    "G53:H62",
    "D69:E78",
    "G69:H78",
    "D85:E94",
    "G85:H94",
    "D101:E110",
    "G101:H110",
    "D117:E126",
    "G117:H126",
    "D133:E142",
    "G133:H142",
    "D149:E158",
    "G149:H158",
    "D165:E174",
    "G165:H174",
    "D181:E190",
    "G181:H190"
  ],
  "Kachanakawal Gaunpalika": [
    "D18:E24",
    "G18:H24",
    "D31:E37",
    "G31:H37",
    "D44:E50",
    "G44:H50",
    "D57:E63",
    "G57:H63",
    "D70:E76",
    "G70:H76",
    "D83:E89",
    "G83:H89",
    "D96:E102",
    "G96:H102",
    "D109:E115",
    "G109:H115",
    "D122:E128",
    "G122:H128",
    "D135:E141",
    "G135:H141",
    "D148:E154",
    "G148:H154"
  ]
};

var FULLY_LOCKED_SHEETS = ['Instructions', 'Total '];

function fixFormulas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  FORMULA_FIXES.forEach(function(fix) {
    var sheet = ss.getSheetByName(fix.sheet);
    if (!sheet) { Logger.log('Sheet not found: ' + fix.sheet); return; }
    var range = sheet.getRange(fix.cell);
    var before = range.getFormula() || range.getValue();
    range.setFormula(fix.formula);
    Logger.log(fix.sheet + '!' + fix.cell + ': ' + before + ' -> ' + fix.formula);
  });
  SpreadsheetApp.flush();
}

function protectSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheetNames = Object.keys(UNLOCKED_RANGES).concat(FULLY_LOCKED_SHEETS);
  allSheetNames.forEach(function(name) {
    try {
      var sheet = ss.getSheetByName(name);
      if (!sheet) { Logger.log('Sheet not found: ' + name); return; }

      // Remove any prior protections (of either type) on this sheet so re-running is safe.
      sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function(p) {
        if (p.canEdit()) p.remove();
      });
      var existingSheetProtection = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      existingSheetProtection.forEach(function(p) {
        if (p.canEdit()) p.remove();
      });

      // setUnprotectedRanges() only works on a whole-sheet protection, not a range one.
      var protection = sheet.protect().setDescription('Auto-protected: formulas & headers (not data-entry cells)');

      // A new protection lets EVERY spreadsheet editor edit it. It restricts nobody
      // until the other editors are stripped off, so this block is what does the work.
      var me = Session.getEffectiveUser();
      var myEmail = me.getEmail();
      protection.addEditor(me);
      protection.getEditors().forEach(function(user) {
        var email = user.getEmail();
        if (!email || email === myEmail) return;
        try {
          protection.removeEditor(user);
        } catch (e3) {
          Logger.log('  could not remove editor ' + email + ' on ' + name + ': ' + e3.message);
        }
      });
      try {
        if (protection.canDomainEdit()) protection.setDomainEdit(false);
      } catch (e2) {
        // Not a Workspace-shared file; ignore.
      }

      var unlockedA1 = UNLOCKED_RANGES[name];
      if (unlockedA1 && unlockedA1.length) {
        var ranges = unlockedA1.map(function(a1) { return sheet.getRange(a1); });
        protection.setUnprotectedRanges(ranges);
      }
      Logger.log('Protected: ' + name + ' (editors remaining: ' + protection.getEditors().length + ')');
    } catch (e) {
      Logger.log('FAILED: ' + name + ' - ' + e.message);
    }
    // Small pause so we don't hit Google's protection-API rate limit mid-run.
    Utilities.sleep(400);
  });
}

function fixAndProtectAll() {
  fixFormulas();
  protectSheets();
  Logger.log('Done.');
}