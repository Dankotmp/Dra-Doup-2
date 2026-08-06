// DrD.ObrazovkyPJ — menu, tvorba světa, editor mapy, lobby PJ.
window.DrD = window.DrD || {};

DrD.ObrazovkyPJ = (function () {
  const St = DrD.Stav;
  const UI = DrD.UI;
  const M = DrD.Modely;
  const IK = DrD.Ikony;
  const esc = DrD.Util.esc;

  // ================= MENU =================

  function menu(root) {
    const knihovna = St.nactiMistniKnihovnu();

    root.innerHTML = `
      <div class="obrazovka">
        <div class="titulni-blok">
          <span class="drak-ikona">${IK.svg("drak")}</span>
          <h1>Dračí doupě</h1>
          <div class="podtitul">Virtuální stůl</div>
        </div>

        ${UI.chybaHtml(St.S.chyba)}

        <button class="btn" id="btn-novy-svet">${IK.svg("svitek")} Založit nový svět (jsem PJ)</button>
        <button class="btn btn-les" id="btn-pripojit">${IK.svg("postava")} Připojit se jako hráč</button>

        <button class="btn btn-vedlejsi" id="btn-import">${IK.svg("import")} Nahrát svět ze souboru</button>
        <input type="file" id="import-input" accept="application/json,.json" style="display:none">

        ${knihovna.length ? `
        <div class="panel">
          <div class="panel-nadpis">Moje světy (uloženo v tomto prohlížeči)</div>
          <div id="knihovna-seznam"></div>
        </div>` : ""}

        <a class="btn btn-vedlejsi" href="dokumenty/rychla-pravidla.pdf" download style="text-decoration:none; text-align:center;">${IK.svg("kniha")} Stáhnout přehled pravidel (PDF)</a>

        <p class="napoveda">Appka nepoužívá žádný server ani účet — hráči se připojují přímo
        k tvému prohlížeči, dokud máš appku otevřenou. Svět si appka průběžně ukládá tady
        v prohlížeči a navíc si ho můžeš kdykoli stáhnout do souboru jako zálohu.</p>
      </div>`;

    if (knihovna.length) vykresliKnihovnu(root.querySelector("#knihovna-seznam"), knihovna);

    root.querySelector("#btn-novy-svet").addEventListener("click", () => St.jdiNa("vytvoreniSveta"));
    root.querySelector("#btn-pripojit").addEventListener("click", () => St.jdiNa("pripojeni"));

    root.querySelector("#btn-import").addEventListener("click", () => root.querySelector("#import-input").click());
    root.querySelector("#import-input").addEventListener("change", (e) => {
      if (e.target.files[0]) St.nactiSvetZeSouboru(e.target.files[0]);
    });
  }

  function vykresliKnihovnu(kontejner, knihovna) {
    kontejner.innerHTML = knihovna.map((z, i) => `
      ${i > 0 ? `<hr class="oddelovac">` : ""}
      <button class="svet-radek" data-id="${esc(z.id)}">
        <div class="info">
          <div class="nazev">${esc(z.nazev)}</div>
          <div class="meta">Sezení ${z.sezeni || 1} · naposledy ${new Date(z.posledniPristup).toLocaleDateString("cs-CZ")}</div>
        </div>
        <span class="ikona-svg">${IK.svg("zpet")}</span>
      </button>
    `).join("");
    kontejner.querySelectorAll(".svet-radek").forEach((btn) => {
      btn.addEventListener("click", () => St.obnovZMistniKnihovny(btn.dataset.id));
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (confirm("Smazat tento svět z prohlížeče? (Stažený soubor, pokud ho máš, zůstane zachovaný.)")) {
          St.odeberZMistniKnihovny(btn.dataset.id);
          vykresliKnihovnu(kontejner, St.nactiMistniKnihovnu());
        }
      });
    });
  }

  // ================= Sdílený výběr typu nové mapy (Divočina / Prázdná) =================

  function typMapyHtml(idPrefix, vychoziZaklad) {
    return `
      <div class="btn-radek" data-typ-mapy="${idPrefix}" style="flex-wrap:wrap;">
        <button type="button" class="btn btn-les btn-mala" data-typ="divocina">${IK.svg("mapa")} Divočina</button>
        <button type="button" class="btn btn-vedlejsi btn-mala" data-typ="vesnice">${IK.svg("hrad")} Vesnice</button>
        <button type="button" class="btn btn-vedlejsi btn-mala" data-typ="obrazek">${IK.svg("import")} Nahrát obrázek</button>
        <button type="button" class="btn btn-vedlejsi btn-mala" data-typ="prazdna">Prázdná plocha</button>
      </div>
      <div id="${idPrefix}-paleta" style="display:none; margin-top:8px;">
        <div class="pole"><label>Základní terén</label></div>
        ${UI.paletaTerenuHtml(vychoziZaklad || "podlaha")}
      </div>
      <div id="${idPrefix}-obrazek" style="display:none; margin-top:8px;">
        <input type="file" accept="image/png,image/jpeg,image/webp" id="${idPrefix}-obrazek-input">
        <p class="napoveda" id="${idPrefix}-obrazek-stav" style="text-align:left; margin-top:6px;">
          Nahraj mapu jako obrázek (např. z Dungeon Scrawl, Inkarnate nebo naskenovaný list) — appka na ni položí mřížku pro pohyb a mlhu.
          Rozměry výše nastav tak, aby seděl poměr stran obrázku.
        </p>
      </div>
      <p class="napoveda" id="${idPrefix}-popis" style="text-align:left; margin-top:6px;">
        Vygeneruje přírodní krajinu s pohořím, lesy a řekou — hotový základ, který můžeš dál domalovat.
      </p>`;
  }

  function zpracujObrazekMapy(soubor, maxRozmer) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Nepodařilo se přečíst soubor."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Nepodařilo se načíst obrázek."));
        img.onload = () => {
          const meritko = Math.min(1, maxRozmer / Math.max(img.width, img.height));
          const w = Math.round(img.width * meritko), h = Math.round(img.height * meritko);
          const platno = document.createElement("canvas");
          platno.width = w; platno.height = h;
          platno.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: platno.toDataURL("image/jpeg", 0.72), pomerStran: img.width / img.height });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(soubor);
    });
  }

  function napojTypMapy(root, idPrefix, elSirka, elVyska) {
    let typ = "divocina";
    let zaklad = "podlaha";
    let obrazekData = null;
    const obal = root.querySelector(`[data-typ-mapy="${idPrefix}"]`);
    const paletaObal = root.querySelector(`#${idPrefix}-paleta`);
    const obrazekObal = root.querySelector(`#${idPrefix}-obrazek`);
    const obrazekStav = root.querySelector(`#${idPrefix}-obrazek-stav`);
    const popis = root.querySelector(`#${idPrefix}-popis`);

    function prepni(novyTyp) {
      typ = novyTyp;
      obal.querySelectorAll("[data-typ]").forEach((b) => {
        b.classList.toggle("btn-les", b.dataset.typ === typ);
        b.classList.toggle("btn-vedlejsi", b.dataset.typ !== typ);
      });
      paletaObal.style.display = typ === "prazdna" ? "block" : "none";
      obrazekObal.style.display = typ === "obrazek" ? "block" : "none";
      popis.style.display = typ === "divocina" ? "block" : "none";
    }
    obal.querySelectorAll("[data-typ]").forEach((btn) => btn.addEventListener("click", () => prepni(btn.dataset.typ)));
    UI.napojPaletuTerenu(paletaObal, (klic) => { zaklad = klic; });

    const vstupSoubor = root.querySelector(`#${idPrefix}-obrazek-input`);
    if (vstupSoubor) {
      vstupSoubor.addEventListener("change", async () => {
        const soubor = vstupSoubor.files[0];
        if (!soubor) return;
        obrazekStav.textContent = "Zpracovávám obrázek…";
        try {
          const vysl = await zpracujObrazekMapy(soubor, 1000);
          obrazekData = vysl.dataUrl;
          obrazekStav.textContent = `Obrázek nahrán (${Math.round(obrazekData.length / 1024)} kB). Rozměry mapy nahoře nastav podle poměru stran ${vysl.pomerStran.toFixed(2)}:1.`;
          if (elSirka && elVyska) {
            const sirka = parseInt(elSirka.value, 10);
            elVyska.value = Math.max(4, Math.round(sirka / vysl.pomerStran));
            elVyska.dispatchEvent(new Event("input"));
          }
        } catch (e) {
          obrazekStav.textContent = "Nepodařilo se zpracovat obrázek: " + e.message;
        }
      });
    }

    return { ziskej: () => ({ typ, zaklad, obrazek: obrazekData }) };
  }

  // ================= TVORBA SVĚTA =================

  function tvorbaSveta(root) {
    root.innerHTML = `
      <div class="obrazovka">
        ${UI.hlavickaHtml("Nový svět", true)}

        <div class="panel">
          <div class="panel-nadpis">Kronika</div>
          <div class="pole"><label>Název světa</label><input type="text" id="in-nazev" placeholder="Stíny nad Krondorem"></div>
          <div class="pole"><label>Jméno Pána jeskyně</label><input type="text" id="in-jmeno-pj" placeholder="Tvé jméno" value="${esc(St.S.jmenoHrace)}"></div>
          <div class="pole"><label>Úvodní situace</label><textarea id="in-popis" placeholder="Kde a jak příběh začíná…"></textarea></div>
        </div>

        <div class="panel">
          <div class="panel-nadpis">První mapa</div>
          <div class="pole"><label>Název mapy</label><input type="text" id="in-nazev-mapy" value="Kraj u Vysokého lesa"></div>

          <div class="rozsah">
            <div class="rozsah-popisek"><span>Šířka</span><span id="out-sirka">24 polí</span></div>
            <input type="range" id="in-sirka" min="8" max="50" value="24">
          </div>
          <div class="rozsah">
            <div class="rozsah-popisek"><span>Výška</span><span id="out-vyska">24 polí</span></div>
            <input type="range" id="in-vyska" min="8" max="50" value="24">
          </div>

          ${typMapyHtml("nsv", "trava")}

          <label style="display:flex; align-items:center; gap:8px; margin-top:10px; font-size:15px;">
            <input type="checkbox" id="in-mlha" checked style="width:18px;height:18px;">
            <span>Mlha války — hráči vidí jen odhalená pole</span>
          </label>
        </div>

        <button class="btn" id="btn-rozlozit">${IK.svg("mapa")} Rozložit mapu</button>
      </div>`;

    UI.napojZpet(root, () => St.jdiNa("menu"));
    const sirka = root.querySelector("#in-sirka"), vyska = root.querySelector("#in-vyska");
    const typMapy = napojTypMapy(root, "nsv", sirka, vyska);

    sirka.addEventListener("input", () => { root.querySelector("#out-sirka").textContent = sirka.value + " polí"; });
    vyska.addEventListener("input", () => { root.querySelector("#out-vyska").textContent = vyska.value + " polí"; });

    root.querySelector("#btn-rozlozit").addEventListener("click", () => {
      const { typ, zaklad, obrazek } = typMapy.ziskej();
      if (typ === "obrazek" && !obrazek) { alert("Nejdřív nahraj obrázek mapy."); return; }
      St.vytvorSvet({
        nazev: root.querySelector("#in-nazev").value.trim() || "Bezejmenný kraj",
        popis: root.querySelector("#in-popis").value.trim(),
        jmenoPJ: root.querySelector("#in-jmeno-pj").value.trim() || "Pán jeskyně",
        nazevMapy: root.querySelector("#in-nazev-mapy").value.trim() || "Mapa 1",
        sirka: parseInt(sirka.value, 10),
        vyska: parseInt(vyska.value, 10),
        typ, zaklad, obrazek,
        mlha: root.querySelector("#in-mlha").checked,
      });
    });
  }

  // ================= EDITOR MAPY =================

  let _platnoEditor = null;
  let _rezimEditor = "kresleni";
  let _terenEditor = "les";
  let _stetecEditor = 1;

  function editorMapy(root) {
    const mapa = St.aktivniMapa();
    root.innerHTML = `
      <div class="obrazovka" style="padding-bottom:8px;">
        ${UI.hlavickaHtml(mapa ? mapa.nazev : "Mapa", true)}

        <div class="mapa-obal" id="mapa-obal" style="height:44vh;"></div>

        <div class="btn-radek">
          <button class="btn btn-vedlejsi btn-mala" data-rezim="kresleni" title="Kreslit">${IK.svg("stetec")}</button>
          <button class="btn btn-vedlejsi btn-mala" data-rezim="vyber" title="Posouvat">${IK.svg("ruka")}</button>
          <button class="btn btn-vedlejsi btn-mala" id="btn-zoom-minus">${IK.svg("lupaMinus")}</button>
          <button class="btn btn-vedlejsi btn-mala" id="btn-zoom-plus">${IK.svg("lupaPlus")}</button>
          <button class="btn btn-vedlejsi btn-mala" id="btn-regenerovat" title="Vygenerovat znovu">${IK.svg("znovu")}</button>
        </div>

        <div class="panel">
          <div class="panel-nadpis">Štětec</div>
          ${UI.paletaTerenuHtml(_terenEditor)}
          <div class="pole" style="margin-top:8px;">
            <label>Velikost štětce: <span id="out-stetec">${_stetecEditor}</span>×<span id="out-stetec2">${_stetecEditor}</span></label>
            <input type="range" id="in-stetec" min="1" max="5" value="${_stetecEditor}">
          </div>
        </div>

        <div class="btn-radek">
          <button class="btn btn-vedlejsi" id="btn-dalsi-mapa">${IK.svg("plus")} Další mapa</button>
          ${St.S.mapy.length > 1 ? `<button class="btn btn-vedlejsi" id="btn-prepnout-mapu">${IK.svg("mapa")} Přepnout mapu</button>` : ""}
        </div>

        <div class="panel" id="panel-nova-mapa" style="display:none;">
          <div class="panel-nadpis">Nová mapa</div>
          <div class="pole"><label>Název</label><input type="text" id="nm-nazev" placeholder="Podzemí pod hradem"></div>
          <div class="rozsah"><div class="rozsah-popisek"><span>Šířka</span><span id="nm-out-sirka">20</span></div><input type="range" id="nm-sirka" min="8" max="50" value="20"></div>
          <div class="rozsah"><div class="rozsah-popisek"><span>Výška</span><span id="nm-out-vyska">20</span></div><input type="range" id="nm-vyska" min="8" max="50" value="20"></div>
          ${typMapyHtml("nm", "podlaha")}
          <label style="display:flex; align-items:center; gap:8px; margin-top:8px; font-size:15px;">
            <input type="checkbox" id="nm-mlha" checked style="width:18px;height:18px;"><span>Mlha války</span>
          </label>
          <button class="btn" id="nm-vytvorit" style="margin-top:10px;">Vytvořit mapu</button>
        </div>

        <button class="btn" id="btn-otevrit-stul">${IK.svg("klic")} Otevřít stůl a získat kód</button>
      </div>`;

    UI.napojZpet(root, () => St.jdiNa(St.S._navratPoEditoru || "menu"));

    const platnoEl = root.querySelector("#mapa-obal");
    _platnoEditor = new DrD.MapaPlatno(platnoEl);

    function prekresliPlatno() {
      _platnoEditor.aktualizuj({
        mapa: St.aktivniMapa(), tokeny: [], jePJ: true, rezim: _rezimEditor,
        onPolicko: (bod) => { if (_rezimEditor === "kresleni") St.nastavTeren(bod, _terenEditor, _stetecEditor); },
      });
    }
    prekresliPlatno();
    St.naDatovouZmenuDocasne(() => { if (document.body.contains(platnoEl)) prekresliPlatno(); });

    root.querySelectorAll("[data-rezim]").forEach((btn) => {
      btn.addEventListener("click", () => {
        _rezimEditor = btn.dataset.rezim;
        root.querySelectorAll("[data-rezim]").forEach((b) => b.classList.toggle("btn-les", b === btn));
        prekresliPlatno();
      });
    });
    root.querySelector(`[data-rezim="${_rezimEditor}"]`).classList.add("btn-les");

    root.querySelector("#btn-zoom-minus").addEventListener("click", () => _platnoEditor.zoom(-6));
    root.querySelector("#btn-zoom-plus").addEventListener("click", () => _platnoEditor.zoom(6));
    root.querySelector("#btn-regenerovat").addEventListener("click", () => {
      if (confirm("Přegenerovat tuto mapu novým náhodným terénem? Ruční úpravy se ztratí.")) St.vygenerujZnovu();
    });

    UI.napojPaletuTerenu(root, (klic) => { _terenEditor = klic; });
    const stetec = root.querySelector("#in-stetec");
    stetec.addEventListener("input", () => {
      _stetecEditor = parseInt(stetec.value, 10);
      root.querySelector("#out-stetec").textContent = _stetecEditor;
      root.querySelector("#out-stetec2").textContent = _stetecEditor;
    });

    const panelNova = root.querySelector("#panel-nova-mapa");
    root.querySelector("#btn-dalsi-mapa").addEventListener("click", () => {
      panelNova.style.display = panelNova.style.display === "none" ? "block" : "none";
    });
    const nmSirka = root.querySelector("#nm-sirka"), nmVyska = root.querySelector("#nm-vyska");
    nmSirka.addEventListener("input", () => { root.querySelector("#nm-out-sirka").textContent = nmSirka.value; });
    nmVyska.addEventListener("input", () => { root.querySelector("#nm-out-vyska").textContent = nmVyska.value; });
    const typMapyNova = napojTypMapy(panelNova, "nm", nmSirka, nmVyska);

    root.querySelector("#nm-vytvorit").addEventListener("click", () => {
      const { typ, zaklad, obrazek } = typMapyNova.ziskej();
      if (typ === "obrazek" && !obrazek) { alert("Nejdřív nahraj obrázek mapy."); return; }
      St.pridejMapu(
        root.querySelector("#nm-nazev").value.trim() || `Mapa ${St.S.mapy.length + 1}`,
        parseInt(nmSirka.value, 10), parseInt(nmVyska.value, 10), zaklad,
        root.querySelector("#nm-mlha").checked, typ, obrazek
      );
      panelNova.style.display = "none";
    });

    const prepnoutBtn = root.querySelector("#btn-prepnout-mapu");
    if (prepnoutBtn) {
      prepnoutBtn.addEventListener("click", () => {
        const seznam = St.S.mapy.map((m) => `${m.nazev}`).join("\n");
        const vyber = prompt("Na kterou mapu přepnout? Napiš přesný název:\n\n" + seznam);
        const nalezena = St.S.mapy.find((m) => m.nazev === vyber);
        if (nalezena) St.prepniMapu(nalezena.id);
      });
    }

    root.querySelector("#btn-otevrit-stul").addEventListener("click", () => {
      St.jdiNa("lobbyPJ");
    });
  }

  // ================= LOBBY PJ =================

  function lobbyPJ(root) {
    root.innerHTML = `
      <div class="obrazovka" id="stul-obal-lobby">
        ${UI.hlavickaHtml("Lobby", true)}

        <div class="pecet-obal">
          <div class="pecet"><span class="pecet-kod" id="pecet-kod">${esc(St.S.kod || "")}</span></div>
          <div class="pecet-popisek">Kód stolu</div>
        </div>

        <div class="btn-radek">
          <button class="btn btn-vedlejsi" id="btn-kopirovat">${IK.svg("kopie")} Kopírovat kód</button>
          <button class="btn btn-vedlejsi" id="btn-sdilet">${IK.svg("sdilet")} Sdílet</button>
        </div>

        <div class="panel">
          <div class="panel-nadpis">Družina (<span id="pocet-druziny">${St.S.postavy.length}</span>)</div>
          <div id="druzina-lobby"></div>
        </div>

        <div class="napoveda" id="lobby-stav">${esc(St.S.stavSpojeni)}</div>

        <button class="btn" id="btn-zacit-hru">${IK.svg("stit")} Začít hru</button>
      </div>`;

    UI.napojZpet(root, () => St.jdiNa("editorMapy"));

    function vykresliDruzinu() {
      const kont = root.querySelector("#druzina-lobby");
      if (!kont) return;
      root.querySelector("#pocet-druziny").textContent = St.S.postavy.length;
      root.querySelector("#lobby-stav").textContent = St.S.stavSpojeni;
      if (St.S.postavy.length === 0) {
        kont.innerHTML = `<div class="prazdny-stav">Zatím nikdo nedorazil. Pošli hráčům kód výše.</div>`;
        return;
      }
      kont.innerHTML = St.S.postavy.map((p) => {
        const povolaniText = (p.povolani || []).map((pv) => M.POVOLANI[pv.klic] ? M.POVOLANI[pv.klic].nazev : pv.klic).join(", ");
        return `
        <div class="postava-hlavicka" style="margin-bottom:8px;">
          <span class="portret-mala">${p.portret ? DrD.Portret.svgPortret(p.portret, { rezim: "bysta" }) : ""}</span>
          <div style="flex:1;">
            <div class="jmeno">${esc(p.jmeno)}</div>
            <div class="info">${esc(M.RASA[p.rasa].nazev)}${povolaniText ? " · " + esc(povolaniText) : ""} · ${esc(p.jmenoHrace)}</div>
          </div>
          <div>${p.telo.aktualni}/${p.telo.hranice} ${IK.svg("telo")}</div>
        </div>`;
      }).join("");
    }
    vykresliDruzinu();
    St.naDatovouZmenuDocasne(() => { if (document.body.contains(root.querySelector("#stul-obal-lobby"))) vykresliDruzinu(); });

    root.querySelector("#btn-kopirovat").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(St.S.kod); } catch (e) {}
    });
    root.querySelector("#btn-sdilet").addEventListener("click", async () => {
      const text = `Připoj se k mé hře v Dračím doupěti! Kód stolu: ${St.S.kod}`;
      if (navigator.share) { try { await navigator.share({ text }); } catch (e) {} }
      else { try { await navigator.clipboard.writeText(text); } catch (e) {} }
    });
    root.querySelector("#btn-zacit-hru").addEventListener("click", () => St.jdiNa("stul"));
  }

  return { menu, tvorbaSveta, editorMapy, lobbyPJ };
})();
