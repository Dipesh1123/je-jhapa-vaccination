"""Builds "JE-083_84 Daily Reporting.xlsx" - the same table Health Office Jhapa
already uses in JE-083_84.xlsx (ward no / population / JE target / vaccinated
by age band and sex / Grand Total / Progress %), but with one such table per
campaign day underneath a campaign-total table that sums them automatically.
Replaces the KoBo + BigQuery + web dashboard pipeline: the office asked for
"just the Excel sheet" instead, so this is the whole reporting tool.

Reads JE-083_84.xlsx read-only for each ward's population and JE target
(never modified). The 15 campaign-day dates (AD and BS) were generated once
with the project's existing nepali-date-converter package:

    node -e "
      const NepaliDate = require('nepali-date-converter').default;
      function pad(n){ return String(n).padStart(2,'0'); }
      const start = new Date(2026, 9, 5);  // month is 0-indexed: Oct=9
      for (let i = 0; i < 15; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i);
        const iso = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
        const nd = new NepaliDate(d);
        console.log((i+1)+'\t'+iso+'\t'+nd.format('YYYY-MM-DD')+'\t'+nd.format('ddd DD MMMM'));
      }"

and hardcoded below - update CAMPAIGN_DAYS (and re-run that command for new
dates) if the campaign window changes from the 5-19 Oct 2026 news-reported
window used everywhere else in this project (see api/_lib/campaign.js).

Run:  python scripts/build_daily_report_excel.py
"""

from __future__ import annotations

from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.worksheet import Worksheet

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "JE-083_84.xlsx"
OUT = ROOT / "JE-083_84 Daily Reporting.xlsx"

# (day index, AD date, BS date, BS day label) - see docstring for how these
# were generated. Day 1 = campaign start = api/_lib/campaign.js CAMPAIGN_START.
CAMPAIGN_DAYS = [
    (1, "2026-10-05", "2083-06-19", "Mon 19 Aswin"),
    (2, "2026-10-06", "2083-06-20", "Tue 20 Aswin"),
    (3, "2026-10-07", "2083-06-21", "Wed 21 Aswin"),
    (4, "2026-10-08", "2083-06-22", "Thu 22 Aswin"),
    (5, "2026-10-09", "2083-06-23", "Fri 23 Aswin"),
    (6, "2026-10-10", "2083-06-24", "Sat 24 Aswin"),
    (7, "2026-10-11", "2083-06-25", "Sun 25 Aswin"),
    (8, "2026-10-12", "2083-06-26", "Mon 26 Aswin"),
    (9, "2026-10-13", "2083-06-27", "Tue 27 Aswin"),
    (10, "2026-10-14", "2083-06-28", "Wed 28 Aswin"),
    (11, "2026-10-15", "2083-06-29", "Thu 29 Aswin"),
    (12, "2026-10-16", "2083-06-30", "Fri 30 Aswin"),
    (13, "2026-10-17", "2083-06-31", "Sat 31 Aswin"),
    (14, "2026-10-18", "2083-07-01", "Sun 01 Kartik"),
    (15, "2026-10-19", "2083-07-02", "Mon 02 Kartik"),
]

TOTAL_SHEET_NAME = "Total "  # matches source workbook's own sheet name exactly

# ---------------------------------------------------------------- styling
ENTRY_FILL = PatternFill("solid", fgColor="FFFFFF")
LOCKED_FILL = PatternFill("solid", fgColor="F2F2F0")
HEADER_FILL = PatternFill("solid", fgColor="DCE6F1")
TITLE_FILL = PatternFill("solid", fgColor="1F4E78")
DAY_TITLE_FILL = PatternFill("solid", fgColor="BDD7EE")
TOTAL_ROW_FILL = PatternFill("solid", fgColor="E2EFDA")

THIN = Side(style="thin", color="B7B7B7")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

HEADER_FONT = Font(bold=True, size=9)
TITLE_FONT = Font(bold=True, size=11, color="FFFFFF")
DAY_TITLE_FONT = Font(bold=True, size=10)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="center")

def new_whole_number_validation() -> DataValidation:
    # A DataValidation instance belongs to exactly one worksheet in openpyxl
    # (its sqref is sheet-local) - sharing one object across sheets, or
    # forgetting `ws.add_data_validation(dv)`, silently produces a file with
    # no validation at all rather than an error, so every sheet gets its own.
    return DataValidation(type="whole", operator="greaterThanOrEqual", formula1="0",
                           showErrorMessage=True, errorTitle="Whole number only",
                           error="Enter a whole number of 0 or more.")


def col(i: int) -> str:
    return get_column_letter(i)


def load_source_wards() -> dict[str, list[tuple[int, int, float]]]:
    """local_level sheet name -> [(ward_no, population, je_target), ...]"""
    wb = openpyxl.load_workbook(SOURCE, data_only=True)
    out: dict[str, list[tuple[int, int, float]]] = {}
    for name in wb.sheetnames:
        if name == TOTAL_SHEET_NAME:
            continue
        ws = wb[name]
        wards = []
        for row in ws.iter_rows(min_row=5, max_col=3):
            ward_no, population, je_target = (c.value for c in row)
            if not isinstance(ward_no, (int, float)):
                break  # hit the "Total" row or a blank
            wards.append((int(ward_no), int(population), float(je_target)))
        if not wards:
            raise SystemExit(f"no ward rows found on sheet {name!r} - source layout may have changed")
        out[name] = wards
    total_wards = sum(len(w) for w in out.values())
    if total_wards != 131:
        raise SystemExit(f"expected 131 wards total across all sheets, found {total_wards}")
    return out


def write_block_header(ws: Worksheet, r0: int, title: str, row_a_label: str,
                        title_fill: PatternFill, title_font: Font) -> int:
    """Writes the 4-row header starting at r0 (title row). Returns the first
    data row (r0 + 4), matching JE-083_84.xlsx's own header shape exactly:
    row r0=title, r0+1=field labels, r0+2=age-band group labels, r0+3=F/M
    sub-labels - see the docstring's `merges` note for the exact merge shape
    this replicates."""
    row_a, row_b, row_c = r0 + 1, r0 + 2, r0 + 3

    ws.merge_cells(start_row=r0, start_column=1, end_row=r0, end_column=13)
    c = ws.cell(r0, 1, title)
    c.fill = title_fill
    c.font = title_font
    c.alignment = LEFT

    ws.merge_cells(start_row=row_a, start_column=1, end_row=row_c, end_column=1)
    ws.merge_cells(start_row=row_a, start_column=2, end_row=row_c, end_column=2)
    ws.merge_cells(start_row=row_a, start_column=3, end_row=row_c, end_column=3)
    ws.merge_cells(start_row=row_a, start_column=4, end_row=row_a, end_column=12)
    ws.merge_cells(start_row=row_a, start_column=13, end_row=row_c, end_column=13)
    ws.merge_cells(start_row=row_b, start_column=4, end_row=row_b, end_column=6)
    ws.merge_cells(start_row=row_b, start_column=7, end_row=row_b, end_column=9)
    ws.merge_cells(start_row=row_b, start_column=10, end_row=row_b, end_column=11)
    ws.merge_cells(start_row=row_b, start_column=12, end_row=row_c, end_column=12)

    labels_a = {1: row_a_label, 2: "Total population", 3: "JE target population",
                4: "Vaccinated", 13: "Progress %"}
    labels_b = {4: "Age 30-60 yrs", 7: "Age 60 above", 10: "Total", 12: "Grand Total"}
    labels_c = {4: "F", 5: "M", 6: "Total", 7: "F", 8: "M", 9: "Total", 10: "F", 11: "M"}

    for row_idx, labels in ((row_a, labels_a), (row_b, labels_b), (row_c, labels_c)):
        for ci in range(1, 14):
            cell = ws.cell(row_idx, ci, labels.get(ci))
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = CENTER
            cell.border = BORDER

    return r0 + 4


def formula_row(ws: Worksheet, row: int, entry: bool, dv: DataValidation | None = None) -> None:
    """Writes F/I/J/K/L/M as formulas for one data row. D/E/G/H are the only
    cells the caller may have already filled with a value or its own formula;
    if `entry` is True they're also unlocked, and - given `dv` - validated for
    typing (dv must already be registered on `ws` via add_data_validation)."""
    D, E, F, G, H, I, J, K, L, M = (f"{col(i)}{row}" for i in range(4, 14))
    ws[F] = f"={D}+{E}"
    ws[I] = f"={G}+{H}"
    ws[J] = f"={D}+{G}"
    ws[K] = f"={E}+{H}"
    ws[L] = f"={J}+{K}"
    ws[M] = f'=IF({col(3)}{row}=0,0,{L}/{col(3)}{row}*100)'
    ws[M].number_format = '0.0"%"'

    for ci in range(1, 14):
        cell = ws.cell(row, ci)
        cell.border = BORDER
        is_entry_cell = entry and ci in (4, 5, 7, 8)
        cell.fill = ENTRY_FILL if is_entry_cell else LOCKED_FILL
        cell.protection = openpyxl.styles.Protection(locked=not is_entry_cell)
        if 2 <= ci <= 12:
            cell.number_format = "#,##0.##"
        if is_entry_cell and dv is not None:
            dv.add(cell)


def write_total_row(ws: Worksheet, row: int, first_data_row: int, last_data_row: int) -> None:
    ws.cell(row, 1, "Total")
    for ci in range(2, 12):
        letter = col(ci)
        ws.cell(row, ci, f"=SUM({letter}{first_data_row}:{letter}{last_data_row})")
    formula_row(ws, row, entry=False)
    for ci in range(1, 14):
        cell = ws.cell(row, ci)
        cell.fill = TOTAL_ROW_FILL
        cell.font = HEADER_FONT
        cell.protection = openpyxl.styles.Protection(locked=True)


def build_palika_sheet(ws: Worksheet, palika_name: str, wards: list[tuple[int, int, float]]) -> dict:
    """Returns bookkeeping the Total sheet needs: the top (cumulative) block's
    total row, and each day's total row - so the district sheet can reference
    exact cells instead of re-deriving them."""
    n = len(wards)
    r0 = 1
    dv = new_whole_number_validation()
    ws.add_data_validation(dv)
    top_data_first = write_block_header(
        ws, r0, f"{palika_name} - Campaign Total (5-19 Oct 2026)", "Ward no.",
        TITLE_FILL, TITLE_FONT,
    )
    for i, (ward_no, population, je_target) in enumerate(wards):
        row = top_data_first + i
        ws.cell(row, 1, ward_no)
        ws.cell(row, 2, population)
        ws.cell(row, 3, je_target)
        formula_row(ws, row, entry=False)
    top_total_row = top_data_first + n
    write_total_row(ws, top_total_row, top_data_first, top_data_first + n - 1)

    day_total_rows: dict[int, int] = {}
    day_first_rows: dict[int, int] = {}
    r = top_total_row + 2
    for day_idx, ad_date, bs_date, bs_label in CAMPAIGN_DAYS:
        title = f"Day {day_idx} - {ad_date} ({bs_label} {bs_date.split('-')[0]})"
        first = write_block_header(ws, r, title, "Ward no.", DAY_TITLE_FILL, DAY_TITLE_FONT)
        day_first_rows[day_idx] = first
        for i, (ward_no, _population, _je_target) in enumerate(wards):
            row = first + i
            ws.cell(row, 1, ward_no)
            ws.cell(row, 2, f"={col(2)}{top_data_first + i}")  # top block's own B/C col for this ward
            ws.cell(row, 3, f"={col(3)}{top_data_first + i}")
            for ci in (2, 3):
                ws.cell(row, ci).protection = openpyxl.styles.Protection(locked=True)
                ws.cell(row, ci).fill = LOCKED_FILL
            formula_row(ws, row, entry=True, dv=dv)
        total_row = first + n
        write_total_row(ws, total_row, first, first + n - 1)
        day_total_rows[day_idx] = total_row
        r = total_row + 2

    # Now that every daily block exists, point the top block's D/E/G/H at the
    # SUM of that ward's row across all 15 days (F/I/J/K/L/M already derive
    # from D/E/G/H via formula_row, so they don't need touching again).
    for i in range(n):
        row = top_data_first + i
        for src_col, letter in ((4, "D"), (5, "E"), (7, "G"), (8, "H")):
            refs = "+".join(f"{letter}{day_first_rows[d]+i}" for d, *_ in CAMPAIGN_DAYS)
            ws.cell(row, src_col, f"={refs}")

    ws.freeze_panes = "A5"
    ws.column_dimensions["A"].width = 9
    ws.column_dimensions["B"].width = 12
    ws.column_dimensions["C"].width = 13
    for ci in range(4, 12):
        ws.column_dimensions[col(ci)].width = 7.5
    ws.column_dimensions["L"].width = 10
    ws.column_dimensions["M"].width = 9
    ws.sheet_view.showGridLines = False

    return {"top_total_row": top_total_row, "day_total_rows": day_total_rows}


def build_total_sheet(ws: Worksheet, palikas: list[tuple[str, list[tuple[int, int, float]]]],
                       bookkeeping: dict[str, dict]) -> None:
    n = len(palikas)
    first = write_block_header(
        ws, 1, "Jhapa District - Campaign Total (5-19 Oct 2026)", "Local Level",
        TITLE_FILL, TITLE_FONT,
    )
    for i, (name, wards) in enumerate(palikas):
        row = first + i
        population = sum(w[1] for w in wards)
        je_target = sum(w[2] for w in wards)
        ws.cell(row, 1, name)
        ws.cell(row, 2, population)
        ws.cell(row, 3, je_target)
        top_total_row = bookkeeping[name]["top_total_row"]
        for ci, letter in ((4, "D"), (5, "E"), (7, "G"), (8, "H")):
            ws.cell(row, ci, f"='{name}'!{letter}{top_total_row}")
        for ci in (1, 2, 3):
            ws.cell(row, ci).protection = openpyxl.styles.Protection(locked=True)
            ws.cell(row, ci).fill = LOCKED_FILL
        formula_row(ws, row, entry=False)
    total_row = first + n
    write_total_row(ws, total_row, first, first + n - 1)

    ws.freeze_panes = "A5"
    ws.column_dimensions["A"].width = 24
    ws.column_dimensions["B"].width = 12
    ws.column_dimensions["C"].width = 13
    for ci in range(4, 12):
        ws.column_dimensions[col(ci)].width = 7.5
    ws.column_dimensions["L"].width = 10
    ws.column_dimensions["M"].width = 9
    ws.sheet_view.showGridLines = False

    # ---------------------------------------------------- daily district summary
    r = total_row + 3
    ws.cell(r, 1, "District total by day").font = Font(bold=True, size=11)
    r += 1
    headers = ["Day", "Date (AD)", "Date (BS)", "Doses that day", "Cumulative doses", "Cumulative progress %"]
    for ci, h in enumerate(headers, start=1):
        cell = ws.cell(r, ci, h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.border = BORDER
        cell.alignment = CENTER
    header_row = r
    r += 1
    grand_target_row = total_row  # column C of the palika Total row = district JE target
    first_day_row = r
    for day_idx, ad_date, bs_date, bs_label in CAMPAIGN_DAYS:
        refs = "+".join(f"'{name}'!L{bookkeeping[name]['day_total_rows'][day_idx]}" for name, _ in palikas)
        ws.cell(r, 1, day_idx)
        ws.cell(r, 2, ad_date)
        ws.cell(r, 3, f"{bs_label} {bs_date}")
        ws.cell(r, 4, f"={refs}")
        if day_idx == 1:
            ws.cell(r, 5, f"=D{r}")
        else:
            ws.cell(r, 5, f"=E{r-1}+D{r}")
        ws.cell(r, 6, f"=IF(C{grand_target_row}=0,0,E{r}/C{grand_target_row}*100)")
        ws.cell(r, 6).number_format = '0.0"%"'
        for ci in range(1, 7):
            cell = ws.cell(r, ci)
            cell.border = BORDER
            cell.protection = openpyxl.styles.Protection(locked=True)
            cell.fill = LOCKED_FILL
            if ci in (1,):
                cell.alignment = CENTER
        r += 1
    ws.freeze_panes = "A5"  # keep the top block's freeze; this table scrolls with the sheet


def build_instructions_sheet(ws: Worksheet) -> None:
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 100
    lines = [
        ("JE Vaccination Campaign - Daily Reporting Workbook", True, 14),
        ("जापानिज इन्सेफ्लाइटिस खोप अभियान - दैनिक प्रतिवेदन पुस्तिका", True, 12),
        ("", False, 10),
        ("How to use this file / प्रयोग विधि:", True, 11),
        ("1. Each of the 15 sheet tabs below is one local level (palika), same as JE-083_84.xlsx.", False, 10),
        ("   प्रत्येक ट्याब एउटा स्थानीय तह हो, JE-083_84.xlsx जस्तै।", False, 10),
        ("2. Every sheet has a 'Campaign Total' table at the top, then one table per campaign day", False, 10),
        ("   (Day 1 to Day 15) below it. Only type into the WHITE cells inside each day's table -", False, 10),
        ("   the age 30-60 and age 60+ Female/Male counts for that day, for each ward.", False, 10),
        ("   माथिको जम्मा तालिका र मुनि दिनको तालिकाहरू छन् - सेता कोष्ठमा मात्र त्यस दिनको संख्या लेख्नुहोस्।", False, 10),
        ("3. Grey cells calculate themselves (Total, Grand Total, Progress %, and the Campaign", False, 10),
        ("   Total table at the top). Do not type into grey cells.", False, 10),
        ("   खरानी रङका कोष्ठले आफै गणना गर्छन् - त्यहाँ नलेख्नुहोस्।", False, 10),
        ("4. The 'Total ' sheet (last tab) shows the whole district, and a day-by-day district", False, 10),
        ("   total below its table - the single number for 'how many doses today'.", False, 10),
        ("5. Sheets are protected (no password) so typing outside the white cells is blocked by", False, 10),
        ("   Excel automatically. To make a correction elsewhere, use Review > Unprotect Sheet.", False, 10),
        ("", False, 10),
        (f"Campaign window: 5-19 Oct 2026 (19 Aswin - 2 Kartik 2083 BS), 15 days.", False, 10),
        ("Source of population / JE target figures: JE-083_84.xlsx (unchanged, kept alongside this file).", False, 10),
    ]
    for i, (text, bold, size) in enumerate(lines, start=1):
        cell = ws.cell(i, 1, text)
        cell.font = Font(bold=bold, size=size)
        cell.alignment = LEFT


def main() -> None:
    source_wards = load_source_wards()
    # Preserve the same sheet order as the source workbook.
    order = [n for n in openpyxl.load_workbook(SOURCE, read_only=True).sheetnames if n != TOTAL_SHEET_NAME]

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    instructions_ws = wb.create_sheet("Instructions")
    build_instructions_sheet(instructions_ws)

    bookkeeping: dict[str, dict] = {}
    for name in order:
        ws = wb.create_sheet(name)
        ws.protection.sheet = True
        ws.protection.formatCells = False
        ws.protection.formatColumns = False
        ws.protection.formatRows = False
        bookkeeping[name] = build_palika_sheet(ws, name, source_wards[name])

    total_ws = wb.create_sheet(TOTAL_SHEET_NAME)
    total_ws.protection.sheet = True
    build_total_sheet(total_ws, [(n, source_wards[n]) for n in order], bookkeeping)

    wb.save(OUT)
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"  {len(order)} local-level sheets + Instructions + {TOTAL_SHEET_NAME.strip()}")


if __name__ == "__main__":
    main()
