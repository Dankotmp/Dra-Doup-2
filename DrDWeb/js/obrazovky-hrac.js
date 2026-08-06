// DrD.ObrazovkyHrac — připojení kódem, výběr postavy, tvorba postavy.
window.DrD = window.DrD || {};

DrD.ObrazovkyHrac = (function () {
  const St = DrD.Stav;
  const UI = DrD.UI;
  const M = DrD.Modely;
  const IK = DrD.Ikony;
  const esc = DrD.Util.esc;

  // ================= PŘIPOJENÍ =================

  function pripojeni(root) {
    root.innerHTML = `
      <div class="obrazovka">
        ${UI.hlavickaHtml("Připojit se ke stolu", true)}

        <div class="panel">
          <div class="pole"><label>Tvé jméno</label><input type="text" id="in-jmeno" placeholder="Jak ti říkají u stolu" value="${esc(St.S.jmenoHrace)}"></div>
          <div class="pole">
            <label>Kód stolu od PJ</label>
            <input type="text" id="in-kod" class="kod-vstup" placeholder="ABC123" maxlength="6" autocapitalize="characters">
          </div>
        </div>

        ${UI.chybaHtml(St.S.chyba)}

        <button class="btn btn-les" id="btn-pripojit-se">Připojit se</button>
        <div class="napoveda" id="stav-pripojeni">${esc(St.S.stavSpojeni)}</div>
      </div>`;

    UI.napojZpet(root, () => St.jdiNa("menu"));

    const kodInput = root.querySelector("#in-kod");
    kodInput.addEventListener("input", () => { kodInput.value = kodInput.value.toUpperCase().slice(0, 6); });

    const spustPripojeni = () => {
      St.zavriChybu();
      St.pripojSe(kodInput.value, root.querySelector("#in-jmeno").value.trim() || "Hráč");
    };
    root.querySelector("#btn-pripojit-se").addEventListener("click", spustPripojeni);
    kodInput.addEventListener("keydown", (e) => { if (e.key === "Enter") spustPripojeni(); });
  }

  // ================= VÝBĚR POSTAVY =================

  function vyberPostavy(root) {
    const svet = St.S.svet || {};
    root.innerHTML = `
      <div class="obrazovka">
        ${UI.hlavickaHtml("Tvá role v příběhu", true)}

        <div class="panel">
          <div class="panel-nadpis">${esc(svet.nazev || "")}</div>
          <p>${esc(svet.popis) || "Příběh teprve začíná."}</p>
          <p class="napoveda" style="text-align:left;">Sezení ${svet.session || 1} · Pán jeskyně: ${esc(svet.jmenoPJ || "")}</p>
        </div>

        <div class="panel" id="panel-moje" style="display:none;">
          <div class="panel-nadpis">${IK.svg("stit")} Tvá postava</div>
          <div id="moje-postava"></div>
        </div>

        <div class="panel" id="panel-existujici" style="display:none;">
          <div class="panel-nadpis">Ostatní v družině</div>
          <p class="napoveda" style="text-align:left;">Vyber jen pokud přebíráš cizí postavu (např. za nepřítomného hráče).</p>
          <div id="seznam-postav"></div>
        </div>

        <button class="btn" id="btn-nova-postava">${IK.svg("postava")} Vytvořit novou postavu</button>
        <button class="btn btn-vedlejsi" id="btn-nahrat-postavu">${IK.svg("import")} Nahrát uloženou postavu ze souboru</button>
        <input type="file" id="import-postava-input" accept="application/json,.json" style="display:none">
      </div>`;

    UI.napojZpet(root, () => St.jdiNa("pripojeni"));

    root.querySelector("#btn-nahrat-postavu").addEventListener("click", () => root.querySelector("#import-postava-input").click());
    root.querySelector("#import-postava-input").addEventListener("change", async (e) => {
      const soubor = e.target.files[0];
      if (!soubor) return;
      const vysl = await St.nactiPostavuZeSouboru(soubor);
      if (!vysl) { e.target.value = ""; return; }
      if (vysl.kolize) {
        const existujici = St.S.postavy.find((p) => p.id === vysl.existujiciId);
        const volba = prompt(
          `Ve světě už postava jménem „${existujici.jmeno}" existuje.\n\n` +
          `Napiš:\n"nahradit" — přepsat ji hodnotami z nahraného souboru (zachová se stejný token na mapě)\n` +
          `"novy" — založit jako úplně novou, samostatnou postavu\n(cokoli jiného / zavřít = zrušit import)`
        );
        e.target.value = "";
        if (volba === "nahradit" || volba === "novy") {
          const vysl2 = await St.nactiPostavuZeSouboru(soubor, volba);
          if (vysl2 && !vysl2.kolize) St.jdiNa("stul");
        }
        return;
      }
      e.target.value = "";
      St.jdiNa("stul");
    });

    function radekPostavy(p) {
      const povolaniText = (p.povolani || []).map((pv) => M.POVOLANI[pv.klic] ? M.POVOLANI[pv.klic].nazev : pv.klic).join(", ");
      return `
        <button class="svet-radek" data-id="${p.id}">
          <span class="portret-mala">${p.portret ? DrD.Portret.svgPortret(p.portret, { rezim: "bysta" }) : ""}</span>
          <div class="info">
            <div class="nazev">${esc(p.jmeno)}</div>
            <div class="meta">${esc(M.RASA[p.rasa].nazev)}${povolaniText ? " · " + esc(povolaniText) : ""} · úroveň ${p.uroven}</div>
          </div>
          <span>›</span>
        </button>`;
    }

    function vykresliPostavy() {
      const panelMoje = root.querySelector("#panel-moje");
      const kontMoje = root.querySelector("#moje-postava");
      const panel = root.querySelector("#panel-existujici");
      const kont = root.querySelector("#seznam-postav");
      if (!panel || !kont) return;

      const mojeId = St.zapamatovanaPostavaId();
      const mojePostava = mojeId ? St.S.postavy.find((p) => p.id === mojeId) : null;
      const ostatni = St.S.postavy.filter((p) => !mojePostava || p.id !== mojePostava.id);

      if (mojePostava) {
        panelMoje.style.display = "block";
        kontMoje.innerHTML = radekPostavy(mojePostava);
        kontMoje.querySelector(".svet-radek").addEventListener("click", () => St.prevezmiPostavu(mojePostava.id));
      } else {
        panelMoje.style.display = "none";
      }

      if (ostatni.length === 0) { panel.style.display = "none"; return; }
      panel.style.display = "block";
      kont.innerHTML = ostatni.map((p, i) => `${i > 0 ? `<hr class="oddelovac">` : ""}${radekPostavy(p)}`).join("");
      kont.querySelectorAll(".svet-radek").forEach((btn) => {
        btn.addEventListener("click", () => St.prevezmiPostavu(btn.dataset.id));
      });
    }
    vykresliPostavy();
    St.naDatovouZmenuDocasne(() => { if (document.body.contains(root.querySelector("#panel-existujici"))) vykresliPostavy(); });

    root.querySelector("#btn-nova-postava").addEventListener("click", () => St.jdiNa("tvorbaPostavy"));
  }

  // ================= TVORBA POSTAVY =================

  function tvorbaPostavy(root) {
    let rasaKlic = "clovek";
    let portret = M.novaPostava("", "", rasaKlic).portret;
    let telo = 5, duse = 5, vliv = 5; // výchozí rozložení 15 bodů
    let povolaniSeznam = [{ klic: "bojovnik", uroven: 1 }];

    function moznostiPovolani() {
      return M.POVOLANI_SKUPINY.map((sk) => `
        <optgroup label="${esc(sk.nadpis)}">
          ${sk.klice.map((k) => `<option value="${k}">${esc(M.POVOLANI[k].nazev)}</option>`).join("")}
        </optgroup>`).join("");
    }

    root.innerHTML = `
      <div class="obrazovka">
        ${UI.hlavickaHtml("Nová postava", true)}

        <div class="portret-obal">
          <div class="portret-ramecek" id="portret-ukazka"></div>
          <div class="napoveda" id="portret-nazev" style="text-align:center; font-weight:600;"></div>
          <button class="btn btn-vedlejsi btn-mala" id="btn-reroll-vzhled">${IK.svg("znovu")} Přehodit vzhled</button>
        </div>

        <div class="panel">
          <div class="panel-nadpis">Základ</div>
          <div class="pole"><label>Jméno postavy</label><input type="text" id="in-jmeno-postavy" placeholder="Aragorn z Hvozdu"></div>

          <div class="pole">
            <label>Rasa</label>
            <select id="in-rasa">
              ${Object.keys(M.RASA).map((k) => `<option value="${k}">${M.RASA[k].nazev}</option>`).join("")}
            </select>
          </div>
          <p class="napoveda" style="text-align:left;" id="popis-rasy">${M.RASA[rasaKlic].popis}</p>
          <div class="pole"><label>Rasová schopnost</label><input type="text" id="in-rasova-schopnost" placeholder="${esc(M.RASA[rasaKlic].schopnostNavrh)}"></div>
          <div class="pole"><label>Povahový rys</label><input type="text" id="in-povahovy-rys" placeholder="Např. nikdy neopustí přítele v nesnázi"></div>
        </div>

        <div class="panel">
          <div class="panel-nadpis">Vlastnosti — rozděl 15 bodů</div>
          <div class="rozdelovac-bodu">
            <div class="rozdelovac-sloupec" data-zdroj="telo">
              <div class="nazev">${IK.svg("telo")} Tělo</div>
              <div class="hodnota" data-out="telo">5</div>
              <div class="rozdelovac-tlacitka">
                <button type="button" data-akce="minus">${IK.svg("minus")}</button>
                <button type="button" data-akce="plus">${IK.svg("plus")}</button>
              </div>
            </div>
            <div class="rozdelovac-sloupec" data-zdroj="duse">
              <div class="nazev">${IK.svg("duse")} Duše</div>
              <div class="hodnota" data-out="duse">5</div>
              <div class="rozdelovac-tlacitka">
                <button type="button" data-akce="minus">${IK.svg("minus")}</button>
                <button type="button" data-akce="plus">${IK.svg("plus")}</button>
              </div>
            </div>
            <div class="rozdelovac-sloupec" data-zdroj="vliv">
              <div class="nazev">${IK.svg("vliv")} Vliv</div>
              <div class="hodnota" data-out="vliv">5</div>
              <div class="rozdelovac-tlacitka">
                <button type="button" data-akce="minus">${IK.svg("minus")}</button>
                <button type="button" data-akce="plus">${IK.svg("plus")}</button>
              </div>
            </div>
          </div>
          <div class="rozdelovac-zbyva hotovo" id="rozdelovac-info" style="margin-top:10px;">Rozděleno: 15 / 15</div>
          <p class="napoveda" style="text-align:left; margin-top:6px;">Hranice bývají typicky mezi 3 a 8. Odpočinkem se zdroj doplní zpět na hranici.</p>
        </div>

        <div class="panel">
          <div class="panel-nadpis">Povolání</div>
          <div id="seznam-povolani"></div>
          <button class="btn btn-vedlejsi btn-mala" id="btn-pridat-povolani" style="margin-top:6px;">${IK.svg("plus")} Přidat povolání</button>
        </div>

        <button class="btn" id="btn-usednout">${IK.svg("stit")} Usednout ke stolu</button>
      </div>`;

    UI.napojZpet(root, () => St.jdiNa(St.S.role === "pj" ? "lobbyPJ" : "vyberPostavy"));

    function vykresliPortret() {
      root.querySelector("#portret-ukazka").innerHTML = DrD.Portret.svgPortret(portret);
      root.querySelector("#portret-nazev").textContent = DrD.Portret.nazevPostavy(portret);
    }
    vykresliPortret();
    root.querySelector("#btn-reroll-vzhled").addEventListener("click", () => {
      portret = DrD.Portret.znovuVygenerovat(portret.seed, rasaKlic);
      vykresliPortret();
    });

    root.querySelector("#in-rasa").addEventListener("change", (e) => {
      rasaKlic = e.target.value;
      root.querySelector("#popis-rasy").textContent = M.RASA[rasaKlic].popis;
      root.querySelector("#in-rasova-schopnost").placeholder = M.RASA[rasaKlic].schopnostNavrh;
      portret = DrD.Portret.nahodnyPortret(rasaKlic);
      vykresliPortret();
    });

    // --- rozdělovač 15 bodů ---
    function vykresliRozdelovac() {
      root.querySelector('[data-out="telo"]').textContent = telo;
      root.querySelector('[data-out="duse"]').textContent = duse;
      root.querySelector('[data-out="vliv"]').textContent = vliv;
      const soucet = telo + duse + vliv;
      const info = root.querySelector("#rozdelovac-info");
      info.textContent = `Rozděleno: ${soucet} / ${M.SOUCET_BODU_VLASTNOSTI}`;
      info.classList.toggle("hotovo", soucet === M.SOUCET_BODU_VLASTNOSTI);
      root.querySelectorAll(".rozdelovac-sloupec").forEach((sl) => {
        const zdroj = sl.dataset.zdroj;
        const hod = zdroj === "telo" ? telo : zdroj === "duse" ? duse : vliv;
        sl.querySelector('[data-akce="minus"]').disabled = hod <= M.MIN_HRANICE;
        sl.querySelector('[data-akce="plus"]').disabled = soucet >= M.SOUCET_BODU_VLASTNOSTI;
      });
    }
    vykresliRozdelovac();

    root.querySelectorAll(".rozdelovac-sloupec").forEach((sl) => {
      const zdroj = sl.dataset.zdroj;
      sl.querySelector('[data-akce="plus"]').addEventListener("click", () => {
        const soucet = telo + duse + vliv;
        if (soucet >= M.SOUCET_BODU_VLASTNOSTI) return;
        if (zdroj === "telo") telo++; else if (zdroj === "duse") duse++; else vliv++;
        vykresliRozdelovac();
      });
      sl.querySelector('[data-akce="minus"]').addEventListener("click", () => {
        const hod = zdroj === "telo" ? telo : zdroj === "duse" ? duse : vliv;
        if (hod <= M.MIN_HRANICE) return;
        if (zdroj === "telo") telo--; else if (zdroj === "duse") duse--; else vliv--;
        vykresliRozdelovac();
      });
    });

    // --- povolání (více zároveň, s úrovní) ---
    function vykresliPovolani() {
      const kont = root.querySelector("#seznam-povolani");
      kont.innerHTML = povolaniSeznam.map((p, i) => `
        <div class="povolani-radek" data-i="${i}">
          <select data-pole="klic">${moznostiPovolani()}</select>
          <input type="number" data-pole="uroven" min="1" max="10" value="${p.uroven}">
          ${povolaniSeznam.length > 1 ? `<button type="button" class="povolani-smazat" data-i="${i}">${IK.svg("kos")}</button>` : ""}
        </div>`).join("");
      kont.querySelectorAll(".povolani-radek").forEach((radek) => {
        const i = parseInt(radek.dataset.i, 10);
        const selectEl = radek.querySelector('[data-pole="klic"]');
        selectEl.value = povolaniSeznam[i].klic;
        selectEl.addEventListener("change", () => { povolaniSeznam[i].klic = selectEl.value; });
        radek.querySelector('[data-pole="uroven"]').addEventListener("input", (e) => {
          povolaniSeznam[i].uroven = Math.max(1, parseInt(e.target.value, 10) || 1);
        });
        const smazBtn = radek.querySelector(".povolani-smazat");
        if (smazBtn) smazBtn.addEventListener("click", () => { povolaniSeznam.splice(i, 1); vykresliPovolani(); });
      });
    }
    vykresliPovolani();
    root.querySelector("#btn-pridat-povolani").addEventListener("click", () => {
      povolaniSeznam.push({ klic: "lovec", uroven: 1 });
      vykresliPovolani();
    });

    // --- uložení ---
    root.querySelector("#btn-usednout").addEventListener("click", () => {
      const soucet = telo + duse + vliv;
      if (soucet !== M.SOUCET_BODU_VLASTNOSTI) {
        alert(`Rozděl přesně ${M.SOUCET_BODU_VLASTNOSTI} bodů mezi Tělo, Duši a Vliv (teď je to ${soucet}).`);
        return;
      }
      const jmeno = root.querySelector("#in-jmeno-postavy").value.trim() || "Bezejmenný";
      const postava = M.novaPostava(St.S.jmenoHrace, jmeno, rasaKlic);
      M.nastavHranice(postava, telo, duse, vliv);
      postava.portret = portret;
      postava.rasovaSchopnost = root.querySelector("#in-rasova-schopnost").value.trim() || M.RASA[rasaKlic].schopnostNavrh;
      postava.povahovyRys = root.querySelector("#in-povahovy-rys").value.trim();
      postava.povolani = povolaniSeznam.map((p) => ({ klic: p.klic, uroven: p.uroven }));
      postava.uroven = Math.max(...povolaniSeznam.map((p) => p.uroven), 1);

      St.ulozPostavu(postava).then(() => St.jdiNa("stul"));
    });
  }

  return { pripojeni, vyberPostavy, tvorbaPostavy };
})();
