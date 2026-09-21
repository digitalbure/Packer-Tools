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
- `src/labels/` (built): model, symbol encoding (QR, Code 128, Code 39, EAN-13, Data Matrix), dot-aligned fitting, scan-safety rules, renderer, sheet layout, printer profiles. 62 tests in `tests/labels-engine.mts`.
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

## Test unit and stock: DETONGER DT60PLUS
Ordered by the owner: 2 inch thermal transfer printer **DT60PLUS, 300 dpi**, 2 x 50 mm x 30 m black ribbon, and the labels below.
The vendor listing found earlier was for the sibling DT60S (ESC/POS and LPAPI, USB and Bluetooth, native Android and iOS SDKs). Nothing about the DT60PLUS is assumed: confirm printable width, command set and Bluetooth behaviour on the unit.

| Ordered stock | Size (mm) | Notes |
|---|---|---|
| Synthetic P-cable label, white / yellow / red | 25 x 38 + 40 | 25 x 38 printed panel, 40 mm tail that wraps the cable. Feed length 78 mm. Black on red has low contrast |
| Synthetic P-cable label, white | 30 x 45 + 50 | Feed length 95 mm |
| PET silver matte | 30 x 22, 40 x 30, 50 x 30 | Silver is darker than white, so scan-test |
| Synthetic white PP | 40 x 30, 50 x 30 | |

Every stock is in `src/labels/presets.ts`, with a starter template for each. Tests prove each template renders without errors at 300 dpi with realistic data.
Ribbon: synthetic and PET labels are printed with thermal-transfer ribbon. Confirm with the supplier that the ribbon supplied (wax, wax-resin or resin) suits these materials.

**Cable labels and barcodes.** A barcode across a 25 mm panel is too small to scan at 300 dpi (about 0.17 mm per bar), so barcodes on cable labels run along the 38 mm length using element rotation. The studio refuses a code that is too small and says what size to aim for. Short IDs (for example `PT-1042`) fit; longer IDs need the QR code or a longer label.

### Bring-up plan
1. **Record the unit.** Model, dpi, printable width, firmware, ribbon type. Confirm the dpi on the box.
2. **Driver print.** Install the vendor driver, print a test label from the browser at 50 x 30 mm. Check size, offset and scan.
3. **Image print.** Export a 1-bit PNG at 300 dpi, print it from the vendor's app. Check sharpness and scan with a phone.
4. **Scan test card.** Print QR codes at 8, 10, 12, 15 and 20 mm and Code 128 at three widths on each stock, including silver PET and red synthetic. Record which scan with a phone and a handheld scanner. This sets the printer's own scan limits.
5. **Cable label test.** Print the 25 x 38 + 40 template. Check the tail feeds and is not printed, and the wrapped label scans.
6. **Printer Lab (only if steps 2 and 3 work).** A diagnostic page for Chrome on Android: list Bluetooth services, send a small raster test, log the result.
7. **Decide.** Pass = steps 2 to 5 give scannable labels at usable sizes. Then set the profile to "recommended" and add it to the list.

Report each step in a table (step, result, photo, notes) in this file.

## Roadmap
1. **Engine** (done in this change): `src/labels/`, tests, profiles, copy checker.
2. **Outputs**: browser print at exact size, sheet and tape pages, 1-bit PNG export, print preview showing every warning.
3. **New Label Studio screen**: choose what to label, pick label size and printer, check and print. Advanced editor behind it. Opens from each module.
4. **Migrate**: move saved templates to the new model, retire `QRPrintModal.tsx` and the mock `server/routes/labels.ts`.
5. **Direct printing** per printer after it passes testing: DT60S first, then Zebra (ZPL), Brother, DYMO.
6. **NFC and RFID**: return only when they write to real tags (Web NFC on supported devices).

## Decisions (from the owner)
- **Templates have two tiers.** *Global* templates are published by a Packer Tools admin: every user can use them, none can edit them, and any user can copy one into their own set. *Personal* templates belong to the person who made them and never become global. Storage: a global collection (admin write, everyone read) and `users/{uid}/labelTemplates` (owner only). The current public "marketplace templates" collection is retired.
- **First customer printers:** Zebra and Brother (assumed). Direct printing for them comes after the DT60S bring-up, using the same command layer.
- **Label sizes** are the printed sticker size, fixed by the roll or sheet. Starter presets (admin can add more, users can enter a custom size):

| Use | Size |
|---|---|
| Small item, cable or battery tag | 50 x 25 mm |
| Item or case label | 40 x 30 mm |
| Case, bin or shelf label | 76 x 51 mm (3 x 2 in) |
| Large flight-case label | 100 x 150 mm (4 x 6 in) |
| Brother roll | 62 mm wide, length per label |
| A4 sheets | 63.5 x 38.1 mm (3 x 7), 99.1 x 38.1 mm (2 x 7) |

## Open questions for the owner
- Approve or change the starter sizes above.
