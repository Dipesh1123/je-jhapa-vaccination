"""Generate the KoBo XLSForm for the JE daily facility report.

Choice lists are generated from data/reference.json so the palika and ward lists
can never drift from the approved microplan. Run:

    python scripts/extract_reference.py      # first - produces reference.json
    python scripts/build_xlsform.py          # then  - produces the XLSForm

Output: kobo/je_daily_facility_report.xlsx  -> upload to KoBoToolbox.

Form shape (one submission = one facility, one day):
  identification -> tally -> commodity ledger -> AEFI
"""

from __future__ import annotations

import json
from pathlib import Path

import openpyxl
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
REFERENCE = ROOT / "data" / "reference.json"
OUT_XLSX = ROOT / "kobo" / "je_daily_facility_report.xlsx"

NE = "label::नेपाली (ne)"
EN = "label::English (en)"
HINT_NE = "hint::नेपाली (ne)"
HINT_EN = "hint::English (en)"
CONSTRAINT_NE = "constraint_message::नेपाली (ne)"
CONSTRAINT_EN = "constraint_message::English (en)"

SURVEY_COLUMNS = [
    "type", "name", NE, EN, HINT_NE, HINT_EN,
    "required", "relevant", "constraint", CONSTRAINT_NE, CONSTRAINT_EN,
    "calculation", "appearance", "choice_filter", "default", "read_only",
]
CHOICES_COLUMNS = ["list_name", "name", NE, EN, "local_level"]

# Default selection for the 'doses per vial' question. The reporter can
# override it per submission, so a wrong default can never block anyone -
# it only sets which option is pre-selected.
DOSES_PER_VIAL = 5

# Each commodity tracked in the ledger: (prefix, Nepali label, English label, unit_ne, unit_en)
COMMODITIES = [
    ("vaccine",   "जे.ई. खोप",                    "JE vaccine",                  "भायल",  "vials"),
    ("diluent",   "डाइलुएन्ट",                    "Diluent",                     "एम्पुल", "ampoules"),
    ("ad_syr",    "ए.डी. सिरिन्ज (०.५ मि.ली.)",   "AD syringe (0.5 ml)",         "वटा",   "pieces"),
    ("recon_syr", "रिकन्स्टिच्युसन सिरिन्ज (५ मि.ली.)", "Reconstitution syringe (5 ml)", "वटा", "pieces"),
    ("safety_box", "सेफ्टी बक्स",                  "Safety box",                  "वटा",   "pieces"),
]


def row(**kwargs) -> dict:
    return {col: kwargs.get(col.replace("::", "_").replace(" ", "_").replace("(", "").replace(")", ""), "")
            for col in SURVEY_COLUMNS}


def q(type_, name, ne, en, **extra) -> dict:
    """Build one survey row. `extra` keys map onto SURVEY_COLUMNS directly."""
    r = {col: "" for col in SURVEY_COLUMNS}
    r["type"] = type_
    r["name"] = name
    r[NE] = ne
    r[EN] = en
    for key, value in extra.items():
        mapping = {
            "hint_ne": HINT_NE, "hint_en": HINT_EN,
            "cmsg_ne": CONSTRAINT_NE, "cmsg_en": CONSTRAINT_EN,
        }
        r[mapping.get(key, key)] = value
    return r


def build_survey(ref: dict) -> list[dict]:
    rows: list[dict] = []

    # ---------------------------------------------------------------- identification
    rows.append(q("begin_group", "identification", "प्रतिवेदन विवरण", "Report details",
                  appearance="field-list"))
    rows.append(q("today", "today_ad", "", ""))
    rows.append(q("date", "report_date_ad", "मिति (ई.सं.)", "Date (AD)",
                  required="yes", default="today()",
                  constraint=". <= today()",
                  cmsg_ne="आगामी मितिको प्रतिवेदन पेश गर्न मिल्दैन।",
                  cmsg_en="A report cannot be dated in the future."))
    rows.append(q("select_one local_level", "local_level", "स्थानीय तह", "Local level",
                  required="yes", appearance="minimal"))
    rows.append(q("select_one ward", "ward_no", "वडा नं.", "Ward no.",
                  required="yes", appearance="minimal",
                  choice_filter="local_level=${local_level}",
                  hint_ne="छानिएको स्थानीय तहका वडाहरू मात्र देखिन्छन्।",
                  hint_en="Only wards of the selected local level are shown."))
    rows.append(q("text", "facility_name", "स्वास्थ्य संस्थाको नाम", "Health facility name",
                  required="yes",
                  hint_ne="प्रतिवेदन पेश गर्ने संस्थाको पूरा नाम लेख्नुहोस्।",
                  hint_en="Write the full name of the reporting facility."))
    rows.append(q("geopoint", "facility_gps", "स्थान (GPS)", "Location (GPS)",
                  hint_ne="नक्सामा देखाउन प्रयोग हुन्छ।",
                  hint_en="Used to plot the facility on the map."))
    rows.append(q("text", "reporter_name", "प्रतिवेदकको नाम", "Reporter's name", required="yes"))
    rows.append(q("text", "reporter_designation", "पद", "Designation"))
    rows.append(q("text", "reporter_phone", "सम्पर्क नम्बर", "Contact number",
                  constraint="regex(., '^[0-9]{7,10}$')",
                  cmsg_ne="७ देखि १० अंकको फोन नम्बर लेख्नुहोस्।",
                  cmsg_en="Enter a phone number of 7 to 10 digits."))
    rows.append(q("end_group", "identification", "", ""))

    # ------------------------------------------------------------------------ tally
    rows.append(q("begin_group", "tally", "खोप लगाइएको संख्या", "Number vaccinated",
                  appearance="field-list"))
    rows.append(q("note", "tally_note",
                  "आजको दिनमा यस संस्थाबाट खोप लगाइएका व्यक्तिको संख्या उमेर र लिङ्ग अनुसार लेख्नुहोस्।",
                  "Enter today's vaccinated count for this facility by age and sex."))

    tally_fields = [
        ("v_30_60_f", "३०–६० वर्ष — महिला", "Age 30–60 — Female"),
        ("v_30_60_m", "३०–६० वर्ष — पुरुष", "Age 30–60 — Male"),
        ("v_60plus_f", "६० वर्षमाथि — महिला", "Age 60+ — Female"),
        ("v_60plus_m", "६० वर्षमाथि — पुरुष", "Age 60+ — Male"),
    ]
    for name, ne, en in tally_fields:
        rows.append(q("integer", name, ne, en, required="yes", default="0",
                      constraint=". >= 0 and . <= 5000",
                      cmsg_ne="० देखि ५००० बीचको संख्या लेख्नुहोस्।",
                      cmsg_en="Enter a number between 0 and 5000."))

    rows.append(q("calculate", "total_doses", "", "",
                  calculation="${v_30_60_f} + ${v_30_60_m} + ${v_60plus_f} + ${v_60plus_m}"))
    rows.append(q("note", "total_doses_note",
                  "आजको जम्मा मात्रा: **${total_doses}**",
                  "Total doses today: **${total_doses}**"))
    rows.append(q("end_group", "tally", "", ""))

    # -------------------------------------------------------------------- commodity
    rows.append(q("begin_group", "commodity", "सामग्री विवरण", "Commodity ledger"))
    # Must precede vaccine_used - that field's cross-check constraint reads this.
    rows.append(q("select_one doses_per_vial", "doses_per_vial",
                  "एक भायलमा कति मात्रा?", "Doses per vial",
                  required="yes", appearance="minimal",
                  default=str(DOSES_PER_VIAL),
                  hint_ne="प्रयोग भइरहेको खोपको भायलमा उल्लेख भएअनुसार छान्नुहोस्।",
                  hint_en="Select what the vial label states for the vaccine in use."))
    for prefix, ne, en, unit_ne, unit_en in COMMODITIES:
        rows.append(q("begin_group", f"c_{prefix}", ne, en, appearance="field-list"))
        for suffix, s_ne, s_en in [
            ("opening", "प्रारम्भिक मौज्दात", "Opening balance"),
            ("received", "आज प्राप्त", "Received today"),
            ("used", "आज प्रयोग", "Used today"),
        ]:
            # The vaccine's "used" field doubles as the opened-vial count, and it
            # carries the cross-check: the vials opened must hold at least the
            # doses the tally claims were given. The constraint lives here, on a
            # field the user actually types into - a constraint on a read_only
            # field is skipped by some ODK clients.
            if prefix == "vaccine" and suffix == "used":
                rows.append(q("integer", "vaccine_used",
                              "आज प्रयोग (खोलिएका भायल)", "Used today (vials opened)",
                              required="yes", default="0",
                              hint_ne=unit_ne, hint_en=unit_en,
                              constraint=". >= 0 and (. * ${doses_per_vial}) >= ${total_doses}",
                              cmsg_ne=("खोलिएका भायलबाट उपलब्ध मात्रा (भायल × एक भायलको मात्रा) "
                                       "जम्मा खोप संख्या ${total_doses} भन्दा कम हुन सक्दैन। "
                                       "भायल संख्या, एक भायलको मात्रा वा खोपको संख्या मिलाउनुहोस्।"),
                              cmsg_en=("Doses available (vials x doses per vial) cannot be fewer "
                                       "than the ${total_doses} doses recorded in the tally. "
                                       "Correct the vial count, the doses per vial, or the tally.")))
                continue
            rows.append(q("integer", f"{prefix}_{suffix}", s_ne, s_en,
                          required="yes", default="0",
                          hint_ne=unit_ne, hint_en=unit_en,
                          constraint=". >= 0",
                          cmsg_ne="ऋणात्मक संख्या लेख्न मिल्दैन।",
                          cmsg_en="A negative quantity is not allowed."))
        rows.append(q("integer", f"{prefix}_closing", "अन्तिम मौज्दात", "Closing balance",
                      required="yes", default="0",
                      hint_ne=unit_ne, hint_en=unit_en,
                      constraint=(f". >= 0 and . = ${{{prefix}_opening}} "
                                  f"+ ${{{prefix}_received}} - ${{{prefix}_used}}"),
                      cmsg_ne=("अन्तिम मौज्दात = प्रारम्भिक + प्राप्त − प्रयोग हुनुपर्छ, "
                               "र ऋणात्मक हुन सक्दैन। प्रयोग भएको परिमाण मौज्दातभन्दा बढी छ कि जाँच्नुहोस्।"),
                      cmsg_en=("Closing must equal opening + received - used, and cannot be "
                               "negative. Check whether the quantity used exceeds the stock held.")))
        rows.append(q("end_group", f"c_{prefix}", "", ""))

    # Vaccine-specific: opened vials and the dose cross-check.
    rows.append(q("begin_group", "vial_use", "खोप भायल प्रयोग", "Vaccine vial use",
                  appearance="field-list"))
    rows.append(q("integer", "vials_discarded", "खेर गएका भायल", "Vials discarded",
                  required="yes", default="0",
                  constraint=". >= 0 and . <= ${vaccine_used}",
                  cmsg_ne="खेर गएका भायल प्रयोग भएका भायलभन्दा बढी हुन सक्दैन।",
                  cmsg_en="Discarded vials cannot exceed the vials used."))
    rows.append(q("calculate", "doses_available", "", "",
                  calculation="${vaccine_used} * ${doses_per_vial}"))
    rows.append(q("calculate", "wastage_rate", "", "",
                  calculation=("if(${doses_available} > 0, "
                               "round(100 * (${doses_available} - ${total_doses}) "
                               "div ${doses_available}, 1), 0)")))
    rows.append(q("note", "vial_summary_note",
                  "खोलिएका भायलबाट उपलब्ध मात्रा: **${doses_available}** · "
                  "जम्मा खोप: **${total_doses}** · खेर गएको दर: **${wastage_rate}%**",
                  "Doses available from opened vials: **${doses_available}** · "
                  "Doses given: **${total_doses}** · Wastage: **${wastage_rate}%**"))
    rows.append(q("end_group", "vial_use", "", ""))
    rows.append(q("end_group", "commodity", "", ""))

    # ------------------------------------------------------------------------- AEFI
    rows.append(q("begin_group", "aefi", "खोप पछिको प्रतिकूल घटना (AEFI)",
                  "Adverse Events Following Immunization (AEFI)", appearance="field-list"))
    rows.append(q("integer", "aefi_minor", "सामान्य घटना संख्या", "Minor events",
                  required="yes", default="0", constraint=". >= 0",
                  cmsg_ne="ऋणात्मक संख्या लेख्न मिल्दैन।",
                  cmsg_en="A negative quantity is not allowed."))
    rows.append(q("integer", "aefi_serious", "गम्भीर घटना संख्या", "Serious events",
                  required="yes", default="0", constraint=". >= 0",
                  cmsg_ne="ऋणात्मक संख्या लेख्न मिल्दैन।",
                  cmsg_en="A negative quantity is not allowed."))
    rows.append(q("text", "aefi_remarks", "गम्भीर घटनाको विवरण", "Details of serious events",
                  appearance="multiline",
                  relevant="${aefi_serious} > 0", required="yes",
                  hint_ne="घटना, उमेर, लिङ्ग र गरिएको उपचार उल्लेख गर्नुहोस्।",
                  hint_en="Describe the event, age, sex and action taken."))
    rows.append(q("end_group", "aefi", "", ""))

    rows.append(q("text", "remarks", "अन्य कैफियत", "Other remarks", appearance="multiline"))

    return rows


def build_choices(ref: dict) -> list[dict]:
    rows: list[dict] = []
    for ll in ref["local_levels"]:
        rows.append({
            "list_name": "local_level",
            "name": ll["code"],
            NE: ll["name"],
            EN: ll["name"],
            "local_level": "",
        })
    for n in (1, 5, 10, 20):
        rows.append({
            "list_name": "doses_per_vial",
            "name": str(n),
            NE: f"{n} मात्रा",
            EN: f"{n} doses",
            "local_level": "",
        })
    for ll in ref["local_levels"]:
        for ward in ll["wards"]:
            rows.append({
                "list_name": "ward",
                "name": ward["code"],
                NE: f"वडा नं. {ward['ward_no']}",
                EN: f"Ward {ward['ward_no']}",
                "local_level": ll["code"],
            })
    return rows


def write_sheet(ws, columns: list[str], rows: list[dict]) -> None:
    ws.append(columns)
    for r in rows:
        ws.append([r.get(col, "") for col in columns])
    for idx, col in enumerate(columns, start=1):
        width = max(len(str(col)), *(len(str(r.get(col, ""))) for r in rows)) if rows else len(col)
        ws.column_dimensions[get_column_letter(idx)].width = min(max(width + 2, 10), 55)
    ws.freeze_panes = "A2"


def main() -> int:
    if not REFERENCE.exists():
        raise SystemExit("data/reference.json missing - run scripts/extract_reference.py first")

    ref = json.loads(REFERENCE.read_text(encoding="utf-8"))

    wb = openpyxl.Workbook()
    write_sheet(wb.active, SURVEY_COLUMNS, build_survey(ref))
    wb.active.title = "survey"

    write_sheet(wb.create_sheet("choices"), CHOICES_COLUMNS, build_choices(ref))

    settings = wb.create_sheet("settings")
    settings.append(["form_title", "form_id", "version", "default_language", "style"])
    settings.append([
        "जापानिज इन्सेफ्लाइटिस खोप अभियान — दैनिक प्रतिवेदन (झापा)",
        "je_daily_facility_report",
        "2083084001",
        "नेपाली (ne)",
        "pages",
    ])
    for idx, width in enumerate([55, 30, 14, 18, 10], start=1):
        settings.column_dimensions[get_column_letter(idx)].width = width

    OUT_XLSX.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT_XLSX)

    survey_rows = len(build_survey(ref))
    choice_rows = len(build_choices(ref))
    print(f"wrote {OUT_XLSX.relative_to(ROOT)}")
    print(f"  survey rows  : {survey_rows}")
    print(f"  choice rows  : {choice_rows} "
          f"({ref['local_level_count']} local levels + {ref['ward_count']} wards)")
    print(f"  doses/vial   : {DOSES_PER_VIAL}  <- confirm against the district microplan")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
