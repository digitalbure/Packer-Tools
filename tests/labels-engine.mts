/** Label engine: encoding, dot-aligned fitting, scan-safety rules, vector rendering, sheets. No emulator needed. */
import { recommendTemplateId, FIELD_OPTIONS, sanitizeSpec, LABEL_STOCKS, STARTER_TEMPLATES, getStock, encodeSymbol, SymbolError, fitSymbol, renderLabel, renderSheets, layoutSheet, PAGES, tapeItYourselfOptions, resolvePlaceholders, esc, mmToDots, PRINTERS, recommendedPrinters, getPrinter, type LabelSpec } from "../src/labels";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`); };

// ---- placeholders and escaping ----
check("placeholders fill in and missing values become empty", resolvePlaceholders("{{asset.name}} / {{ asset.assetTag }} / {{asset.serial}}", { name: "Cam", assetTag: "PT-1" }) === "Cam / PT-1 / ");
check("markup characters are escaped", esc(`<script>"x"&'y'</script>`) === "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");

// ---- encoding ----
const qr = encodeSymbol("qr", "https://packer.tools/gear/abc123");
check("QR encodes to a square module grid with a finder pattern", qr.kind === "matrix" && qr.modulesX === qr.modulesY && qr.modulesX >= 25 && qr.matrix![0] === 1 && qr.matrix![6] === 1, `${qr.modulesX}`);
check("QR quiet zone is 4 modules", qr.quietModules === 4);
const c128 = encodeSymbol("code128", "PT-ABC123");
check("Code 128 encodes to bars", c128.kind === "linear" && c128.bars!.length > 10 && c128.modulesX > 50 && c128.bars![0].x === 0);
check("Code 128 bars never overlap", c128.bars!.every((b, i, a) => i === 0 || b.x >= a[i - 1].x + a[i - 1].w));
const ean = encodeSymbol("ean13", "590123412345");
check("EAN-13 is 95 modules wide", ean.modulesX === 95, `${ean.modulesX}`);
check("Code 39 and Data Matrix encode", encodeSymbol("code39", "PT-ABC123").kind === "linear" && encodeSymbol("datamatrix", "PT-ABC123").kind === "matrix");
const bad = (fn: () => unknown) => { try { fn(); return ""; } catch (e) { return e instanceof SymbolError ? e.message : "wrong error type"; } };
check("EAN-13 with too few digits gives a plain message", bad(() => encodeSymbol("ean13", "12")) === "An EAN-13 barcode needs exactly 12 or 13 digits.");
check("Code 39 rejects lowercase with a plain message", /capital letters/.test(bad(() => encodeSymbol("code39", "abc"))));
check("empty value is rejected", /nothing to encode/.test(bad(() => encodeSymbol("qr", ""))));

// ---- fitting: whole dots per module ----
const f203 = fitSymbol(qr, 30, 30, 203, "QR code");
check("module is a whole number of dots", Number.isInteger(f203.moduleDots) && f203.moduleDots >= 3, `${f203.moduleDots}`);
check("module size in mm matches dots", Math.abs(f203.moduleMm - (f203.moduleDots * 25.4) / 203) < 1e-9);
check("symbol fits inside the box", f203.widthMm <= 30 + 1e-9 && f203.heightMm <= 30 + 1e-9);
check("a generous QR at 300 dpi has no issues", fitSymbol(qr, 30, 30, 300).issues.length === 0);
const tiny = fitSymbol(qr, 10, 10, 203, "QR code");
check("a tiny QR is an error with a size to aim for", tiny.issues[0]?.level === "error" && /at least \d+(\.\d)? mm wide/.test(tiny.issues[0].message), JSON.stringify(tiny.issues));
check("a borderline QR is a warning", fitSymbol(qr, 20, 20, 203).issues.every(i => i.level !== "error"));
check("a code that cannot fit at all says so", fitSymbol(qr, 3, 3, 203).issues[0].message.includes("does not fit"));
const long128 = encodeSymbol("code128", "PT-ABC123-VERYLONGSERIALNUMBER-0001");
check("a long barcode in a narrow box is flagged", fitSymbol(long128, 40, 10, 203).issues.some(i => i.level === "error"));

// ---- rendering ----
const spec: LabelSpec = {
  id: "t1", name: "Asset 50x25", widthMm: 50, heightMm: 25,
  elements: [
    { id: "n", kind: "text", x: 2, y: 2, w: 28, h: 8, fontMm: 3.2, bold: true, text: "{{asset.name}}" },
    { id: "t", kind: "text", x: 2, y: 19, w: 28, h: 4, fontMm: 2.6, text: "ID {{asset.assetTag}}" },
    { id: "q", kind: "code", x: 32, y: 2, w: 16, h: 16, symbology: "qr", value: "https://packer.tools/gear/{{asset.assetTag}}" },
  ],
};
const r = renderLabel(spec, { name: "Cinema camera body", assetTag: "PT-ABC123" }, { dpi: 300 });
const small = renderLabel({ ...spec, elements: [{ ...spec.elements[2], x: 34, y: 6, w: 12, h: 12 } as any] }, { assetTag: "PT-ABC123" }, { dpi: 300 });
check("label is sized in millimetres", r.svg.includes('width="50mm"') && r.svg.includes('height="25mm"') && r.svg.includes('viewBox="0 0 50 25"'));
check("label contains text, a path for the code, and no scripts", r.svg.includes("Cinema camera") && r.svg.includes("<path") && !/<script/i.test(r.svg));
check("a 12 mm QR at 300 dpi is refused as too small to scan", small.issues.some(i => i.elementId === "q" && i.level === "error"), JSON.stringify(small.issues));
check("a 16 mm QR at 300 dpi is fine", r.issues.filter(i => i.elementId === "q").length === 0, JSON.stringify(r.issues));
const inj = renderLabel(spec, { name: '<img src=x onerror=alert(1)>', assetTag: '"><script>' }, { dpi: 300 });
check("hostile item names cannot inject markup", !/<img|<script/i.test(inj.svg) && inj.svg.includes("&lt;img"));
const good = renderLabel({ ...spec, elements: [{ ...spec.elements[2], w: 22, h: 22, x: 26, y: 1.5 } as any] }, { assetTag: "PT-1" }, { dpi: 300 });
check("a right-sized QR renders with no issues", good.issues.length === 0, JSON.stringify(good.issues));
check("output is deterministic", renderLabel(spec, { name: "A" }).svg === renderLabel(spec, { name: "A" }).svg);
const longText = renderLabel({ ...spec, elements: [{ id: "n", kind: "text", x: 2, y: 2, w: 20, h: 4, fontMm: 3, text: "A very long item name that cannot possibly fit on one line of this label" }] }, {});
check("text that does not fit is cut with an ellipsis and a warning", longText.svg.includes("…") && longText.issues.some(i => i.message.includes("cut off")));
check("elements past the edge are reported", renderLabel({ ...spec, elements: [{ id: "x", kind: "rule", x: 45, y: 1, w: 10, h: 1 }] }, {}).issues.some(i => i.message.includes("edge")));
const badCode = renderLabel({ ...spec, elements: [{ id: "e", kind: "code", x: 2, y: 2, w: 40, h: 12, symbology: "ean13", value: "12" }] }, {});
check("an invalid code is an error and is not drawn", badCode.issues.some(i => i.level === "error") && !badCode.svg.includes("<path"));
// modules land on the dot grid
const pathD = /<path d="([^"]+)"/.exec(good.svg)![1];
const xs = [...pathD.matchAll(/M([\d.]+) ([\d.]+)/g)].map(m => parseFloat(m[1]));
check("QR starts on a printer dot", xs.every(x => Math.abs(mmToDots(x, 300) - Math.round(mmToDots(x, 300))) < 0.05), String(xs.slice(0, 3)));

// ---- sheets ----
const lay = layoutSheet(PAGES.a4, { widthMm: 63.5, heightMm: 38.1 }, { marginMm: 7.2, gapMm: 2.5 });
check("A4 fits a 3 x 7 grid of 63.5 x 38.1 mm labels (Avery L7160 style)", lay.cols === 3 && lay.rows === 7 && lay.perPage === 21, JSON.stringify([lay.cols, lay.rows]));
const many = Array.from({ length: 35 }, () => ({ inner: r.inner, widthMm: 50, heightMm: 25 }));
const pages = renderSheets(many, PAGES.a4, { marginMm: 8, gapMm: 3 });
check("labels spill onto extra pages", pages.length === 2, `${pages.length}`);
check("pages are A4 in millimetres", pages[0].includes('width="210mm"') && pages[0].includes('height="297mm"'));
const diy = renderSheets(many.slice(0, 4), PAGES.a4, tapeItYourselfOptions());
check("tape-it-yourself pages carry dashed cut lines and a wide gap", (diy[0].match(/stroke-dasharray/g) || []).length === 4 && tapeItYourselfOptions().gapMm! >= 4);
check("printer offsets shift the whole grid", layoutSheet(PAGES.a4, { widthMm: 50, heightMm: 25 }, { marginMm: 8, offsetXmm: 1.5 }).cells[0].x === 9.5);
check("corner guides draw four marks per label", (renderSheets(many.slice(0, 1), PAGES.a4, { guides: "corners" })[0].match(/stroke="#8a8a8a"/g) || []).length === 4);

// ---- printers ----
const dt = getPrinter("detonger-dt60plus")!;
check("DT60PLUS is in testing, not recommended, 300 dpi only", dt.status === "in-testing" && dt.dpiOptions.length === 1 && dt.dpiOptions[0] === 300);
check("no printer is claimed as recommended or verified before hands-on testing", recommendedPrinters().length === 0 && PRINTERS.every(p => p.transports.every(t => t.status !== "works")));
check("the old DT60S profile is gone (the ordered unit is the DT60PLUS)", getPrinter("detonger-dt60s") === undefined);


// ---- stocks from the owner's order ----
const ordered = ["pcable-25x38-40-white", "pcable-25x38-40-yellow", "pcable-25x38-40-red", "pcable-30x45-50-white", "pet-30x22", "pet-40x30", "pet-50x30", "pp-40x30", "pp-50x30"];
check("every stock in the DT60PLUS order is in the catalogue", ordered.every(id => !!getStock(id)));
check("cable stocks carry their wrap tail", getStock("pcable-25x38-40-white")!.tailMm === 40 && getStock("pcable-30x45-50-white")!.tailMm === 50);
check("stock ids are unique", new Set(LABEL_STOCKS.map(s => s.id)).size === LABEL_STOCKS.length);
check("every ordered label fits the 2 inch printer width", ordered.every(id => getStock(id)!.widthMm <= 50.8));

// ---- starter templates must scan on the ordered stock at 300 dpi ----
const sample = { name: "Cinema camera body", assetTag: "PT-ABC123", brand: "Sony", url: "https://packer.tools/gear/AbCdEfGhIjKlMnOpQrSt", ownerName: "Packer Tools Production", ownerPhone: "+61 2 5550 0100", ownerEmail: "assets@example.com", category: "Camera" };
for (const t of STARTER_TEMPLATES) {
  const out = renderLabel(t, sample, { dpi: 300 });
  const stock = getStock(t.stockId!)!;
  check(`${t.name}: matches its stock size`, stock.widthMm === t.widthMm && stock.heightMm === t.heightMm && (stock.tailMm ?? 0) === (t.tailMm ?? 0));
  check(`${t.name}: no errors at 300 dpi`, out.issues.filter(i => i.level === "error").length === 0, JSON.stringify(out.issues));
}
const cable = renderLabel(STARTER_TEMPLATES.find(t => t.id === "starter-cable-25x38")!, sample, { dpi: 300 });
check("cable label feeds 78 mm: 38 printed plus 40 tail", cable.feedHeightMm === 78 && cable.svg.includes('height="78mm"'));
check("preview shows the tail hatched, print output does not", renderLabel(STARTER_TEMPLATES[4], sample, { preview: true }).svg.includes("url(#tail)") && !cable.svg.includes("url(#tail)"));

// ---- barcodes on narrow labels: rotation makes them fit ----
const barSpec = (rotate: 0 | 90): LabelSpec => ({ id: "b", name: "b", widthMm: 25, heightMm: 38, tailMm: 40, elements: [rotate === 0
  ? { id: "c", kind: "code", symbology: "code128", value: "PT-1042", x: 1, y: 2, w: 23, h: 12 }
  : { id: "c", kind: "code", symbology: "code128", value: "PT-1042", x: 2, y: 1, w: 12, h: 36, rotate: 90 }] });
check("a Code 128 barcode across a 25 mm label is too small to scan", renderLabel(barSpec(0), {}, { dpi: 300 }).issues.some(i => i.level === "error"));
const rotated = renderLabel(barSpec(90), {}, { dpi: 300 });
check("the same barcode turned along the 38 mm length scans", rotated.issues.length === 0 && rotated.svg.includes("rotate(90)"), JSON.stringify(rotated.issues));
const rotX = [...rotated.svg.matchAll(/translate\(([\d.]+) ([\d.]+)\)/g)][0];
check("rotated placement lands on a printer dot", Math.abs(mmToDots(parseFloat(rotX[1]), 300) - Math.round(mmToDots(parseFloat(rotX[1]), 300))) < 0.05);
const long9 = renderLabel({ ...barSpec(90), elements: [{ id: "c", kind: "code", symbology: "code128", value: "PT-ABC123", x: 2, y: 1, w: 12, h: 36, rotate: 90 }] }, {}, { dpi: 300 });
check("a longer tag on that label is refused with a size to aim for", long9.issues.some(i => i.level === "error" && /at least/.test(i.message)), JSON.stringify(long9.issues));
check("rotated text renders too", renderLabel({ ...barSpec(90), elements: [{ id: "t", kind: "text", x: 2, y: 1, w: 8, h: 30, fontMm: 3, text: "PT-ABC123", rotate: 90 }] }, {}).svg.includes("rotate(90)"));

// ---- stored templates are untrusted ----
check("a stored template renders identically after a JSON round trip", STARTER_TEMPLATES.every(s => renderLabel(sanitizeSpec(JSON.stringify(s))!, { name: "Cam", assetTag: "PT-1", url: "https://packer.tools/gear/x" }, { dpi: 300 }).svg === renderLabel(s, { name: "Cam", assetTag: "PT-1", url: "https://packer.tools/gear/x" }, { dpi: 300 }).svg));
check("garbage is rejected", sanitizeSpec("not json") === null && sanitizeSpec(null) === null && sanitizeSpec({ widthMm: "x" }) === null);
const hostile = sanitizeSpec({ widthMm: 9999, heightMm: -5, name: "x".repeat(500), elements: [{ kind: "script", x: 1 }, { kind: "code", symbology: "evil", x: 0 }, { kind: "text", text: "ok", x: "1e9", y: NaN, w: -4, h: 0, fontMm: 900, rotate: 45 }, ...Array.from({ length: 100 }, () => ({ kind: "rule", x: 0, y: 0, w: 1, h: 1 }))] })!;
check("sizes are clamped and names capped", hostile.widthMm === 300 && hostile.heightMm === 5 && hostile.name.length === 80);
check("unknown kinds and symbologies are dropped and the count is capped", hostile.elements.length <= 40 && hostile.elements[0].kind === "text" && hostile.elements.every(e => ["text", "code", "rule"].includes(e.kind)), String(hostile.elements.length));
const t0 = hostile.elements[0] as any;
check("numbers inside elements are clamped and rotation is limited", t0.x === 500 && t0.w === 0.5 && t0.h === 0.5 && t0.fontMm === 60 && t0.rotate === 0, JSON.stringify(t0));
check("a sanitised hostile template still renders", renderLabel(hostile, {}).svg.startsWith("<svg"));

// ---- owner fields, footer, recommendation ----
check("owner placeholders fill from the owner fields", resolvePlaceholders("{{owner.name}} / {{owner.phone}} / {{owner.email}}", { ownerName: "ABC", ownerPhone: "1", ownerEmail: "a@b.c" }) === "ABC / 1 / a@b.c");
const prop = STARTER_TEMPLATES.find(t => t.id === "starter-property-50x20")!;
const propOut = renderLabel(prop, sample, { dpi: 300 });
check("the Property of layout (from the owner's photo) shows the owner and asset ID", propOut.svg.includes("PROPERTY OF") && propOut.svg.includes("Production") && propOut.svg.includes("PT-ABC123"));
check("every starter carries the by Packer.Tools footer", STARTER_TEMPLATES.every(t => t.brandFooter === true) && renderLabel(prop, sample).svg.includes("by Packer.Tools"));
check("the footer can be switched off", !renderLabel(prop, sample, { footer: false }).svg.includes("by Packer.Tools"));
check("there are several starter layouts (property, return, case, flight, cable, barcode)", STARTER_TEMPLATES.length >= 12 && ["property", "return", "case", "flight", "cable", "barcode"].every(k => STARTER_TEMPLATES.some(t => t.id.includes(k))));
check("each starter's footer stays inside the label", STARTER_TEMPLATES.every(t => t.elements.every(e => e.y + e.h <= t.heightMm + 0.01)));
check("owner text does not leak when the owner is unknown", !renderLabel(prop, { ...sample, ownerName: "" }).svg.includes("Production"));
check("recommendations follow the kind of item", recommendTemplateId({ name: "XLR cable 5m" }) === "starter-cable-25x38" && recommendTemplateId({ name: "Pelican 1510 case" }) === "starter-case-76x51" && recommendTemplateId({ name: "V-mount battery" }) === "starter-small-30x22" && recommendTemplateId({ category: "Flight case" }) === "starter-flight-100x150" && recommendTemplateId({ name: "Sony A7", ownerName: "ABC" }) === "starter-property-50x30" && recommendTemplateId({ name: "Sony A7" }) === "starter-asset-50x30");
check("every recommended template exists", ["XLR cable", "Pelican case", "battery", "flight case", "camera"].every(n => STARTER_TEMPLATES.some(t => t.id === recommendTemplateId({ name: n }))));
check("the field dropdown offers item, owner and fixed text values", ["Item", "Owner", "Fixed text"].every(g => FIELD_OPTIONS.some(o => o.group === g)) && new Set(FIELD_OPTIONS.map(o => o.value)).size === FIELD_OPTIONS.length);

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
