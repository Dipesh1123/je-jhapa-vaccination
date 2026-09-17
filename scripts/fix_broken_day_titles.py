"""One-off fix for JE-083_84 Daily Reporting_edited.xlsx: 119 day-block title
cells (column A, the row that should read "Day N - (date)") were overwritten
with broken cross-sheet formulas - almost certainly from editing several
sheet tabs while they were grouped together, which makes Excel apply the
same cell edit to every grouped sheet at once.

Replaces only those broken cells with plain text, matching the exact format
already correct in the 4 sheets the user had already fixed by hand
(Mechinagar, Buddhashanti, Arjundhara, Kankai): "Day N - (Weekday DD Ashwin
2083)". Touches nothing else - not the AD/BS date columns on the Total
sheet, not any entry cell, not the 4 already-correct sheets - per explicit
instruction to keep everything else in the edited file exactly as it is.

Run:  python scripts/fix_broken_day_titles.py
"""

from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "JE-083_84 Daily Reporting_edited.xlsx"

# Ashwin 5-15, 2083 BS with weekday - matches the format already correct in
# the 4 hand-fixed sheets exactly (see scripts/build_daily_report_excel.py's
# docstring for how nepali-date-converter is invoked to generate these).
DAY_LABELS = [
    "Day 1 - (Mon 05 Ashwin 2083)",
    "Day 2 - (Tue 06 Ashwin 2083)",
    "Day 3 - (Wed 07 Ashwin 2083)",
    "Day 4 - (Thu 08 Ashwin 2083)",
    "Day 5 - (Fri 09 Ashwin 2083)",
    "Day 6 - (Sat 10 Ashwin 2083)",
    "Day 7 - (Sun 11 Ashwin 2083)",
    "Day 8 - (Mon 12 Ashwin 2083)",
    "Day 9 - (Tue 13 Ashwin 2083)",
    "Day 10 - (Wed 14 Ashwin 2083)",
    "Day 11 - (Thu 15 Ashwin 2083)",
]


def main() -> None:
    wb = openpyxl.load_workbook(SRC)
    fixed = 0
    for name in wb.sheetnames:
        if name in ("Instructions", "Total "):
            continue
        ws = wb[name]
        day_idx = 0
        for r in range(1, ws.max_row + 1):
            cell = ws.cell(r, 1)
            is_block_title = ws.cell(r, 2).value is None and ws.cell(r + 1, 1).value == "Ward no."
            if not is_block_title:
                continue
            if isinstance(cell.value, str) and cell.value.startswith("="):
                # a broken day title - the top (Campaign Total) title is
                # never a formula, so day_idx is only advanced past it below,
                # meaning this branch only ever fires for day blocks.
                cell.value = DAY_LABELS[day_idx - 1]
                fixed += 1
            # advance the day counter once we've passed the top block's own
            # title (identified by column B holding a real value one row
            # down would not apply here; instead: any block-title row after
            # the very first one on the sheet is a day block).
            day_idx += 1

    wb.save(SRC)
    print(f"fixed {fixed} broken day-title cells in {SRC.name}")


if __name__ == "__main__":
    main()
