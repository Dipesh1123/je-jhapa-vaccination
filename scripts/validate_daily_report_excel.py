"""Validates JE-083_84 Daily Reporting.xlsx by actually recalculating it (via
the `formulas` package - `pip install formulas`) rather than just inspecting
formula text, which caught a real bug (B/C cells in daily blocks pointing at
header rows) that a plain openpyxl read would have missed since openpyxl
never evaluates a formula.

Writes test entries into a few ward-days across two different palikas, saves
a throwaway copy, recalculates it, and checks the results propagate correctly
up through: the palika's own Campaign Total table, the Total sheet's
per-palika cumulative row, and the Total sheet's day-by-day district summary
(including the running cumulative-doses total, which chains day to day).

Run:  python scripts/validate_daily_report_excel.py
"""

from pathlib import Path

import openpyxl
import formulas

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "JE-083_84 Daily Reporting.xlsx"
TEST_FILE = ROOT / "_test_daily_report.xlsx"

wb = openpyxl.load_workbook(SRC)

# Haldibari Gaunpalika: 5 wards, top block rows 5-9, day-1 block rows 16-20,
# day-2 block rows 27-31 (see the sheet's own header rows for the +11 spacing
# - 4 header rows + 5 wards + 1 total + 2 blank = 12... row 16 to row 27 is
# +11, confirmed by inspection above).
ws = wb["Haldibari Gaunpalika"]
# Day 1, ward 1 (row 16): 10 doses total (3+2 age30-60, 3+2 age60+)
ws["D16"], ws["E16"], ws["G16"], ws["H16"] = 3, 2, 3, 2
# Day 2, ward 1 (row 27): a further 5 doses
ws["D27"], ws["E27"], ws["G27"], ws["H27"] = 2, 1, 1, 1
# Day 1, ward 3 (row 18): 7 doses
ws["D18"], ws["E18"], ws["G18"], ws["H18"] = 4, 1, 1, 1

# Mechinagar Municipality: 15 wards, top block rows 5-19, day-1 block starts
# at row 26 (4 header + 15 wards + 1 total + 2 blank = 22 offset from row 5's
# header start; verified below rather than assumed).
mech = wb["Mechinagar Municipality"]
day1_first_mech = None
for row in mech.iter_rows(min_row=1, max_row=40):
    if row[0].value == "Ward no." and mech.cell(row[0].row - 1, 1).value and "Day 1" in str(mech.cell(row[0].row - 1, 1).value):
        day1_first_mech = row[0].row + 3
        break
assert day1_first_mech, "could not locate Mechinagar's Day 1 block"
mech.cell(day1_first_mech, 4, 6)   # ward 1, day 1: D
mech.cell(day1_first_mech, 5, 4)   # E
mech.cell(day1_first_mech, 7, 3)   # G
mech.cell(day1_first_mech, 8, 2)   # H
# expected day-1 doses for Mechinagar ward 1: 6+4+3+2 = 15

wb.save(TEST_FILE)

xl = formulas.ExcelModel().loads(str(TEST_FILE)).finish()
solution = xl.calculate()


def val(sheet: str, cell: str):
    key = f"'[{TEST_FILE.name}]{sheet.upper()}'!{cell}"
    return solution[key].value[0, 0]


checks = []


def check(label, actual, expected):
    ok = actual == expected
    checks.append((label, ok, actual, expected))


# --- Haldibari's own Campaign Total table --------------------------------
check("Haldibari ward 1 cumulative D (age30-60 F, day1+day2)", val("Haldibari Gaunpalika", "D5"), 3 + 2)
check("Haldibari ward 1 cumulative Grand Total (L)", val("Haldibari Gaunpalika", "L5"), 10 + 5)
check("Haldibari ward 3 cumulative Grand Total (L)", val("Haldibari Gaunpalika", "L7"), 7)
check("Haldibari campaign Total row Grand Total (L10)", val("Haldibari Gaunpalika", "L10"), 10 + 5 + 7)
je_target_ward1 = 3987.36
expected_pct = round((10 + 5) / je_target_ward1 * 100, 6)
check("Haldibari ward 1 Progress % (M5)", round(val("Haldibari Gaunpalika", "M5"), 6), expected_pct)

# --- Haldibari's day-1 block Total row ------------------------------------
check("Haldibari day-1 Total row Grand Total (L21)", val("Haldibari Gaunpalika", "L21"), 10 + 7)

# --- Total sheet: per-palika cumulative row --------------------------------
# Total sheet rows: header rows 1-4, then 15 palikas alphabetically-as-listed
# (source sheet order), row = 5 + index in `order`. Haldibari is the 13th
# sheet in JE-083_84.xlsx's own tab order (0-indexed 12) -> row 17.
order = [n for n in openpyxl.load_workbook(ROOT / "JE-083_84.xlsx", read_only=True).sheetnames if n != "Total "]
haldibari_row = 5 + order.index("Haldibari Gaunpalika")
mech_row = 5 + order.index("Mechinagar Municipality")
check(f"Total sheet Haldibari row ({haldibari_row}) Grand Total", val("Total ", f"L{haldibari_row}"), 10 + 5 + 7)
check(f"Total sheet Mechinagar row ({mech_row}) Grand Total", val("Total ", f"L{mech_row}"), 15)

# --- Total sheet: day-by-day district summary ------------------------------
# Header block is 4 rows + 15 palikas + 1 total + spacer(1) + title(1) +
# table header(1) = find it by scanning for "District total by day".
total_ws = wb["Total "]
summary_header_row = None
for r in range(1, 60):
    if total_ws.cell(r, 1).value == "District total by day":
        summary_header_row = r + 1  # column-header row
        break
assert summary_header_row, "could not locate the day-by-day summary table"
day1_row = summary_header_row + 1
day2_row = summary_header_row + 2

check("District Day 1 doses (D col)", val("Total ", f"D{day1_row}"), (10) + (7) + 15)  # Haldibari d1 wards 1+3, Mechinagar d1 ward1
check("District Day 1 cumulative (E col)", val("Total ", f"E{day1_row}"), (10) + (7) + 15)
check("District Day 2 doses (D col)", val("Total ", f"D{day2_row}"), 5)
check("District Day 2 cumulative (E col) = day1 + day2", val("Total ", f"E{day2_row}"), (10 + 7 + 15) + 5)

failed = 0
for label, ok, actual, expected in checks:
    print(f"{'PASS' if ok else 'FAIL'}  {label}  (got {actual}, expected {expected})")
    if not ok:
        failed += 1

TEST_FILE.unlink(missing_ok=True)
print(f"\n{len(checks) - failed}/{len(checks)} passed")
raise SystemExit(1 if failed else 0)
