/**
 * H63: roster column fit. Name / Employee no. / Shoulder no. take the width of their
 * content (in px, so the longest name never wraps onto two lines); the day columns share
 * the remaining width equally on screen and on the printed page.
 */

/**
 * Pure: pixel widths for the content-sized columns — natural width rounded up, plus a little slack,
 * so the longest name keeps its one line on screen and on the printed page. Day columns get no
 * width and share what is left equally under fixed table layout.
 */
export function fixedColumnPx(fixedNatural) {
  return fixedNatural.map((w) => Math.ceil(w) + 2);
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
    if (!nat.some((w) => w > 0) || isFixed.every((x) => x)) return;
    const px = fixedColumnPx(nat.filter((_, i) => isFixed[i]));
    let f = 0;
    const cols = isFixed.map((fx) => (fx ? `<col style="width:${px[f++]}px">` : "<col>")).join("");
    table.insertAdjacentHTML("afterbegin", `<colgroup>${cols}</colgroup>`);
    table.classList.add("colfit");
  });
}
