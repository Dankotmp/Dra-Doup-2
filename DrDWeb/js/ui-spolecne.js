// DrD.UI — malé znovupoužitelné kousky rozhraní sdílené mezi obrazovkami.
window.DrD = window.DrD || {};

DrD.UI = (function () {
  const esc = DrD.Util.esc;

  function hlavickaHtml(titulek, sZpet) {
    return `
      <div class="hlavicka">
        ${sZpet ? `<button class="zpet-btn" id="btn-zpet" aria-label="Zpět">‹</button>` : ""}
        <h1>${esc(titulek)}</h1>
      </div>`;
  }

  function napojZpet(root, handler) {
    const btn = root.querySelector("#btn-zpet");
    if (btn) btn.addEventListener("click", handler);
  }

  function paletaTerenuHtml(vybranyKlic) {
    const T = DrD.Modely.TEREN;
    const bunky = Object.keys(T).map((klic) => {
      const t = T[klic];
      const vybr = klic === vybranyKlic ? " vybrano" : "";
      return `<button type="button" class="dlazdice-btn${vybr}" data-teren="${klic}" style="background:${t.barva}" title="${esc(t.nazev)}">${t.zkratka}</button>`;
    }).join("");
    return `<div class="paleta-terenu" data-role="paleta-terenu">${bunky}</div>
            <div class="napoveda" data-role="paleta-terenu-popis">${esc(T[vybranyKlic].nazev)}</div>`;
  }

  function napojPaletuTerenu(root, onVyber) {
    const paleta = root.querySelector('[data-role="paleta-terenu"]');
    const popis = root.querySelector('[data-role="paleta-terenu-popis"]');
    if (!paleta) return;
    paleta.addEventListener("click", (e) => {
      const btn = e.target.closest(".dlazdice-btn");
      if (!btn) return;
      paleta.querySelectorAll(".dlazdice-btn").forEach((b) => b.classList.remove("vybrano"));
      btn.classList.add("vybrano");
      const klic = btn.dataset.teren;
      if (popis) popis.textContent = DrD.Modely.TEREN[klic].nazev;
      onVyber(klic);
    });
  }

  function chybaHtml(text) {
    return text ? `<div class="chyba-banner">${esc(text)}</div>` : "";
  }

  function nacitaniHtml(text) {
    return `<div class="nacitani"><span class="spinner"></span> ${esc(text || "Načítám…")}</div>`;
  }

  return {
    hlavickaHtml, napojZpet,
    paletaTerenuHtml, napojPaletuTerenu,
    chybaHtml, nacitaniHtml,
  };
})();
