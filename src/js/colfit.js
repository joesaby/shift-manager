/**
 * H63: roster column fit. Name / Employee no. / Shoulder no. take the width of their
 * content; the day columns share the remaining width equally. Widths are written as
 * percentages of the table so the same layout fits the screen and the printed page.
 */

/**
 * Pure: content-sized columns keep their natural width; the day columns share what is left equally.
 * Returns percentages of `tableWidth` (px), or null when there is nothing to fit.
 */
export function columnPercents(fixedNatural, dayCount, tableWidth) {
  if (!(tableWidth > 0) || !(dayCount > 0)) return null;
  const fixed = fixedNatural.map((w) => Math.min(w / tableWidth * 100, 100 / (dayCount + fixedNatural.length)));
  const left = 100 - fixed.reduce((a, b) => a + b, 0);
  return { fixed, days: Array(dayCount).fill(left / dayCount) };
}

/** DOM: measure each roster table under `root` in auto layout, then fix its column widths. */
export function fitRosterColumns(root) {
  (root || document).querySelectorAll("table.rota-freeze").forEach((table) => {
    const heads = Array.from(table.querySelectorAll("thead tr:first-child th"));
    if (!heads.length) return;
    const old = table.querySelector("colgroup");
    if (old) old.remove();
    table.classList.remove("colfit");
    table.style.width = "auto"; /* natural widths, not stretched to the container */
    const nat = heads.map((th) => th.getBoundingClientRect().width);
    table.style.width = "";
    const isFixed = heads.map((th) => th.classList.contains("stickycol") || th.classList.contains("numcol"));
    const width = table.parentElement ? table.parentElement.clientWidth : 0;
    const pct = columnPercents(nat.filter((_, i) => isFixed[i]), isFixed.filter((x) => !x).length, width);
    if (!pct) return;
    let f = 0, d = 0;
    const cols = isFixed.map((fx) => `<col style="width:${(fx ? pct.fixed[f++] : pct.days[d++]).toFixed(3)}%">`).join("");
    table.insertAdjacentHTML("afterbegin", `<colgroup>${cols}</colgroup>`);
    table.classList.add("colfit");
  });
}
