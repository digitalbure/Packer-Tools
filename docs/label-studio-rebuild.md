# Label Studio rebuild

## Why
The current studio (`src/components/QRPrintModal.tsx`, 5,400 lines) prints QR codes only, photographs the screen to make PDFs, has no
scan-safety checks, and its NFC, RFID and printer tabs do not talk to hardware. It needs a new core, then a new interface.

## Goals
1. **Professional printers**: roll and handheld thermal printers (Zebra, Brother, DYMO and others), starting with the DETONGER DT60S.
2. **Any printer**: sheets and plain paper, including a cut-and-tape layout for people without a label printer.
3. **Labels that scan**: real barcodes, sizes locked to the printer's dots, and refusal to print a code that is too small.
4. **Native to the app**: same brand language as the home page (concrete, foam, hazard orange, Big Shoulders / Barlow, tape labels), opened from
   Gear Library, packing lists, inventory sheets and the kiosk as part of those modules, not as a separate pop-up.
5. **Plain language** throughout (docs/copy-standard.md).

## Architecture
```
LabelSpec (mm)  ->  renderLabel()  ->  vector SVG  ->  outputs
 text, codes, rules   one renderer for      |--> on-screen preview
 {{asset.*}} fields   everything            |--> browser print (exact mm, @page)
                                            |--> sheets / tape-it-yourself pages
                                            |--> 1-bit PNG at printer dpi  (vendor apps, share sheet)
                                            |--> printer commands (ESC/POS, ZPL, ...)   [per printer, after testing]
```
- `src/labels/` (built): model, symbol encoding (QR, Code 128, Code 39, EAN-13, Data Matrix), dot-aligned fitting, scan-safety rules, renderer, sheet layout, printer profiles. 39 tests in `tests/labels-engine.mts`.
- Every module of every symbol is a whole number of printer dots, and printing is blocked when a code is below the scan limit.
- Printer profiles record what is proven. Nothing is "recommended" or "works" until it passes testing here.

## Getting a label out (transports)
| Way | Works with | Needs |
|---|---|---|
| Browser print at exact size | Any printer with a system driver | Nothing |
| Sheets and tape-it-yourself pages | Any office printer | Nothing |
| 1-bit PNG at 203 / 300 dpi | Vendor apps (share to the printer's own app) | Nothing |
| Web Bluetooth / USB commands | Chrome on Android and desktop; not iOS Safari | A known command set. To be built per printer after testing |
| Local bridge (network raw, vendor SDK) | Zebra network printers and native SDKs | A small helper on the user's machine. Later |

A web app cannot call a native Android or iOS SDK, so vendor SDKs (including the DT60S's) are used only through a helper or the vendor's own app.

## DETONGER DT60S: bring-up plan
Vendor listing (unverified until the unit arrives): thermal transfer, up to 54 mm paper, 203 or 300 dpi by model, USB and Bluetooth,
ESC/POS and LPAPI commands, native Android and iOS SDKs.

1. **Record the unit.** Model, dpi, label roll size and gap, firmware. Confirm the dpi on the box.
2. **Driver print.** Install the vendor driver, print a test label from the browser at 54 x 25 mm. Check size, offset and scan.
3. **Image print.** Export a 1-bit PNG at the printer's dpi, print it from the vendor's app. Check sharpness and scan with a phone.
4. **Scan test card.** Print QR codes at 8, 10, 12, 15 and 20 mm and Code 128 at three widths. Record which scan with a phone and a handheld scanner. This sets the printer's own scan limits.
5. **Printer Lab (only if steps 2 and 3 work).** A diagnostic page for Chrome on Android: list Bluetooth services, send a small ESC/POS raster test, log the result.
6. **Decide.** Pass = steps 2 to 4 give scannable labels at usable sizes. Then set the profile to "recommended" and add it to the list.

Report each step in a table (step, result, photo, notes) in this file.

## Roadmap
1. **Engine** (done in this change): `src/labels/`, tests, profiles, copy checker.
2. **Outputs**: browser print at exact size, sheet and tape pages, 1-bit PNG export, print preview showing every warning.
3. **New Label Studio screen**: choose what to label, pick label size and printer, check and print. Advanced editor behind it. Opens from each module.
4. **Migrate**: move saved templates to the new model, retire `QRPrintModal.tsx` and the mock `server/routes/labels.ts`.
5. **Direct printing** per printer after it passes testing: DT60S first, then Zebra (ZPL), Brother, DYMO.
6. **NFC and RFID**: return only when they write to real tags (Web NFC on supported devices).

## Open questions for the owner
- DT60S model: 203 or 300 dpi, and which label roll sizes will customers use?
- Which of Zebra, Brother and DYMO do your first customers own?
- Should saved templates be shared across a workspace, or stay per person?
