// DrD.HerniStul — hlavní herní obrazovka se záložkami Mapa / Družina / Kostky / Kronika / PJ.
window.DrD = window.DrD || {};

DrD.HerniStul = (function () {
  const St = DrD.Stav;
  const UI = DrD.UI;
  const M = DrD.Modely;
  const IK = DrD.Ikony;
  const esc = DrD.Util.esc;
  const formatCas = DrD.Util.formatCas;

  let _zalozka = "mapa";
  let _platnoStul = null;
  let _rezimMapa = "vyber";
  let _vybranaFigurkaId = null;

  function zalozky() {
    const zakl = [
      { id: "mapa", ikona: "mapa", nazev: "Mapa" },
      { id: "druzina", ikona: "stit", nazev: "Družina" },
      { id: "kostky", ikona: "kostka", nazev: "Kostky" },
      { id: "kronika", ikona: "svitek", nazev: "Kronika" },
    ];
    if (St.S.role === "pj") zakl.push({ id: "pj", ikona: "koruna", nazev: "PJ" });
    return zakl;
  }

  // ================= HLAVNÍ VYKRESLENÍ =================

  function vykresli(root) {
    const svet = St.S.svet || {};
    root.innerHTML = `
      <div class="stul-obal" id="stul-obal-hlavni">
        <div class="stul-hlavicka">
          <h2>${esc(svet.nazev || "Stůl")}</h2>
          ${St.S.kod ? `<span class="stul-kod">${esc(St.S.kod)}</span>` : ""}
        </div>
        <div class="stul-stav" id="stul-stav-spojeni">${esc(St.S.stavSpojeni)}</div>
        <div class="zalozka-obsah" id="zalozka-obsah"></div>
        <div class="tab-bar" id="tab-bar"></div>
        <div id="denik-vrstva"></div>
      </div>`;

    vykresliTabBar(root);
    vykresliAktivniZalozku(root);
  }

  function vykresliTabBar(root) {
    const bar = root.querySelector("#tab-bar");
    bar.innerHTML = zalozky().map((z) => `
      <button class="tab-btn${z.id === _zalozka ? " aktivni" : ""}" data-tab="${z.id}">
        <span class="ikona">${IK.svg(z.ikona)}</span><span>${z.nazev}</span>
      </button>`).join("");
    bar.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        _zalozka = btn.dataset.tab;
        vykresliTabBar(root);
        vykresliAktivniZalozku(root);
      });
    });
  }

  function vykresliAktivniZalozku(root) {
    const kont = root.querySelector("#zalozka-obsah");
    if (_zalozka === "mapa") renderMapa(kont);
    else if (_zalozka === "druzina") renderDruzina(kont);
    else if (_zalozka === "kostky") renderKostky(kont);
    else if (_zalozka === "kronika") renderKronika(kont);
    else if (_zalozka === "pj") renderPJ(kont);
  }

  function aktualizuj() {
    const obal = document.getElementById("stul-obal-hlavni");
    if (!obal) return;
    const stavEl = document.getElementById("stul-stav-spojeni");
    if (stavEl) stavEl.textContent = St.S.stavSpojeni;

    const kont = document.getElementById("zalozka-obsah");
    if (!kont) return;
    if (_zalozka === "mapa") aktualizujMapu(kont);
    else if (_zalozka === "druzina") aktualizujDruzinu(kont);
    else if (_zalozka === "kronika") aktualizujKroniku(kont);
    else if (_zalozka === "pj") aktualizujPJ(kont);
  }

  // ================= TAB: MAPA =================

  function renderMapa(kont) {
    const mapa = St.aktivniMapa();
    kont.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px; height:100%;">
        <div class="napoveda" id="tab-mapa-nazev">${mapa ? esc(mapa.nazev) : "Žádná mapa"}</div>
        <div class="mapa-obal" id="tab-mapa-platno" style="height:48vh;"></div>
        <div class="btn-radek">
          <button class="btn btn-vedlejsi btn-mala" data-tmr="vyber" title="Figurky">${IK.svg("postava")}</button>
          <button class="btn btn-vedlejsi btn-mala" data-tmr="posun" title="Posouvat">${IK.svg("ruka")}</button>
          <button class="btn btn-vedlejsi btn-mala" id="tab-mapa-zoom-minus">${IK.svg("lupaMinus")}</button>
          <button class="btn btn-vedlejsi btn-mala" id="tab-mapa-zoom-plus">${IK.svg("lupaPlus")}</button>
        </div>
        <div id="tab-mapa-info"></div>
      </div>`;

    _platnoStul = new DrD.MapaPlatno(kont.querySelector("#tab-mapa-platno"));
    kont.querySelectorAll("[data-tmr]").forEach((btn) => {
      btn.addEventListener("click", () => {
        _rezimMapa = btn.dataset.tmr;
        kont.querySelectorAll("[data-tmr]").forEach((b) => b.classList.toggle("btn-les", b === btn));
        prekresliPlatnoStul();
      });
    });
    kont.querySelector(`[data-tmr="${_rezimMapa}"]`).classList.add("btn-les");
    kont.querySelector("#tab-mapa-zoom-minus").addEventListener("click", () => _platnoStul.zoom(-6));
    kont.querySelector("#tab-mapa-zoom-plus").addEventListener("click", () => _platnoStul.zoom(6));

    prekresliPlatnoStul();
    vykresliInfoPanel(kont);
  }

  function aktualizujMapu(kont) {
    if (!kont.querySelector("#tab-mapa-platno")) return;
    const mapa = St.aktivniMapa();
    const nazevEl = kont.querySelector("#tab-mapa-nazev");
    if (nazevEl) nazevEl.textContent = mapa ? mapa.nazev : "Žádná mapa";
    prekresliPlatnoStul();
    vykresliInfoPanel(kont);
  }

  function prekresliPlatnoStul() {
    if (!_platnoStul) return;
    const mapa = St.aktivniMapa();
    if (!mapa) return;
    _platnoStul.aktualizuj({
      mapa, tokeny: St.tokenyAktivniMapy(), jePJ: St.S.role === "pj",
      rezim: _rezimMapa, vybranaFigurkaId: _vybranaFigurkaId,
      onPolicko: (bod) => tuknutiNaMapu(bod),
    });
  }

  function tuknutiNaMapu(bod) {
    const mapa = St.aktivniMapa();
    if (!mapa) return;
    const tokeny = St.tokenyAktivniMapy();
    const naPolicku = tokeny.find((t) => t.x === bod.x && t.y === bod.y);
    if (naPolicku) {
      if (St.S.role === "pj") { _vybranaFigurkaId = _vybranaFigurkaId === naPolicku.id ? null : naPolicku.id; prekresliPoVyberu(); return; }
      if (naPolicku.patriPostave === St.S.mojePostavaId) { _vybranaFigurkaId = _vybranaFigurkaId === naPolicku.id ? null : naPolicku.id; prekresliPoVyberu(); return; }
    }
    if (_vybranaFigurkaId) {
      St.pozadejOPohyb(_vybranaFigurkaId, bod);
      _vybranaFigurkaId = null;
      prekresliPoVyberu();
    } else if (St.S.role === "pj" && mapa.pouzitMlhu) {
      St.odhalMlhu(bod, 2);
    }
  }

  function prekresliPoVyberu() {
    const kont = document.getElementById("zalozka-obsah");
    if (!kont) return;
    prekresliPlatnoStul();
    vykresliInfoPanel(kont);
  }

  function vykresliInfoPanel(kont) {
    const info = kont.querySelector("#tab-mapa-info");
    if (!info) return;
    const mapa = St.aktivniMapa();
    const tokeny = St.tokenyAktivniMapy();
    const token = tokeny.find((t) => t.id === _vybranaFigurkaId);

    if (!token) {
      info.innerHTML = `<p class="napoveda">${St.S.role === "pj" ? "Ťukni na figurku a pak na cílové pole." : "Ťukni na svou figurku a pak na cílové pole."}</p>`;
      return;
    }

    const jePJ = St.S.role === "pj";
    const smiUpravovat = jePJ || token.patriPostave === St.S.mojePostavaId;

    info.innerHTML = `
      <div class="panel">
        <div style="display:flex; align-items:center; gap:8px;">
          ${token.portret ? `<span class="portret-mala">${DrD.Portret.svgPortret(token.portret, { rezim: "bysta" })}</span>` : ""}
          <strong style="flex:1;">${esc(token.nazev)}</strong>
          <button class="btn-mala btn-vedlejsi btn" id="info-zavrit" style="width:auto; padding:6px 10px;">${IK.svg("zavrit")}</button>
        </div>
        <div class="zdravi-radek" style="margin-top:8px;">
          ${smiUpravovat ? `<button class="zdravi-btn" id="info-hp-minus">${IK.svg("minus")}</button>` : ""}
          <span class="zdravi-hodnota">${token.zivotyAktualni}/${token.zivotyMax} ${IK.svg("telo")}</span>
          ${smiUpravovat ? `<button class="zdravi-btn" id="info-hp-plus">${IK.svg("plus")}</button>` : ""}
        </div>
        ${jePJ ? `
          <label style="display:flex; align-items:center; gap:8px; margin-top:8px; font-size:14px;">
            <input type="checkbox" id="info-skryta" ${token.skryta ? "checked" : ""} style="width:18px;height:18px;">
            <span>Skrytá před hráči</span>
          </label>
          <button class="btn btn-destrukce" id="info-smazat" style="margin-top:10px;">Odstranit z mapy</button>
        ` : ""}
      </div>`;

    info.querySelector("#info-zavrit").addEventListener("click", () => { _vybranaFigurkaId = null; prekresliPoVyberu(); });

    if (smiUpravovat) {
      const zmenHp = (delta) => {
        if (token.patriPostave) St.zmenZdroj(token.patriPostave, "telo", delta);
        else St.upravFigurku(mapa.id, token.id, { zivotyAktualni: Math.max(0, Math.min(token.zivotyMax, token.zivotyAktualni + delta)) });
      };
      info.querySelector("#info-hp-minus").addEventListener("click", () => zmenHp(-1));
      info.querySelector("#info-hp-plus").addEventListener("click", () => zmenHp(1));
    }
    if (jePJ) {
      info.querySelector("#info-skryta").addEventListener("change", (e) => St.upravFigurku(mapa.id, token.id, { skryta: e.target.checked }));
      info.querySelector("#info-smazat").addEventListener("click", () => {
        St.smazFigurku(mapa.id, token.id);
        _vybranaFigurkaId = null;
        prekresliPoVyberu();
      });
    }
  }

  // ================= TAB: DRUŽINA =================

  function renderDruzina(kont) {
    kont.innerHTML = `<div id="tab-druzina-seznam" style="display:flex; flex-direction:column; gap:12px;"></div>`;
    aktualizujDruzinu(kont);
  }

  function zdrojRadekHtml(p, klic, nazev, ikona) {
    const z = p[klic];
    const podil = z.hranice > 0 ? z.aktualni / z.hranice : 0;
    const smi = St.S.role === "pj" || p.id === St.S.mojePostavaId;
    return `
      <div class="zdroj-radek">
        <span class="ikona-svg">${IK.svg(ikona)}</span>
        <span class="zdroj-nazev">${nazev}</span>
        <div class="zdroj-pruh-obal"><div class="zdroj-pruh ${klic}" style="width:${Math.round(podil * 100)}%"></div></div>
        <span class="zdroj-cislo">${z.aktualni}/${z.hranice}</span>
        ${smi ? `
          <div class="zdroj-tlacitka">
            <button data-akce="zdroj-minus" data-pid="${p.id}" data-zdroj="${klic}">${IK.svg("minus")}</button>
            <button data-akce="zdroj-plus" data-pid="${p.id}" data-zdroj="${klic}">${IK.svg("plus")}</button>
          </div>` : ""}
      </div>`;
  }

  function aktualizujDruzinu(kont) {
    const seznam = kont.querySelector("#tab-druzina-seznam");
    if (!seznam) return;
    if (St.S.postavy.length === 0) {
      seznam.innerHTML = `<div class="prazdny-stav">Družina je zatím prázdná.</div>`;
      return;
    }
    seznam.innerHTML = St.S.postavy.map((p) => {
      const povolaniText = (p.povolani || []).map((pv) => `${M.POVOLANI[pv.klic] ? M.POVOLANI[pv.klic].nazev : pv.klic} ${pv.uroven}`).join(", ");
      return `
      <div class="panel postava-karta" data-pid="${p.id}">
        <div class="postava-hlavicka">
          <span class="portret-mala">${p.portret ? DrD.Portret.svgPortret(p.portret, { rezim: "bysta" }) : ""}</span>
          <div style="flex:1;">
            <div class="jmeno">${esc(p.jmeno)}</div>
            <div class="info">${esc(M.RASA[p.rasa].nazev)} · ${esc(povolaniText || "bez povolání")} · úroveň ${p.uroven}</div>
          </div>
          ${p.id === St.S.mojePostavaId ? `<span class="ty-znacka">TY</span>` : ""}
        </div>
        <div class="zdroje-trojice" style="margin-top:8px;">
          ${zdrojRadekHtml(p, "telo", "Tělo", "telo")}
          ${zdrojRadekHtml(p, "duse", "Duše", "duse")}
          ${zdrojRadekHtml(p, "vliv", "Vliv", "vliv")}
        </div>
        ${p.povahovyRys ? `<p class="napoveda" style="text-align:left; margin-top:6px;">„${esc(p.povahovyRys)}“</p>` : ""}
        <button class="btn btn-vedlejsi btn-mala" data-akce="denik" data-pid="${p.id}" style="margin-top:8px;">${IK.svg("batoh")} Deník</button>
      </div>`;
    }).join("");

    seznam.querySelectorAll('[data-akce="zdroj-minus"]').forEach((btn) => {
      btn.addEventListener("click", () => St.zmenZdroj(btn.dataset.pid, btn.dataset.zdroj, -1));
    });
    seznam.querySelectorAll('[data-akce="zdroj-plus"]').forEach((btn) => {
      btn.addEventListener("click", () => St.zmenZdroj(btn.dataset.pid, btn.dataset.zdroj, 1));
    });
    seznam.querySelectorAll('[data-akce="denik"]').forEach((btn) => {
      btn.addEventListener("click", () => otevriDenik(btn.dataset.pid));
    });
  }

  // ================= TAB: KOSTKY =================

  let _kostkyPocet = 1, _kostkyStran = 6, _kostkyBonus = 0;

  function renderKostky(kont) {
    const strany = [4, 6, 8, 10, 12, 20, 100];
    const mojePostava = St.mojePostava();
    kont.innerHTML = `
      ${mojePostava && mojePostava.povolani && mojePostava.povolani.length ? `
      <div class="panel">
        <div class="panel-nadpis">Zkouška povolání</div>
        <p class="napoveda" style="text-align:left;">Dračí doupě II: hoď dvě kostky (2–12) a přičti úroveň povolání.</p>
        <div class="pole"><label>Povolání</label>
          <select id="kk-zkouska-povolani">
            ${mojePostava.povolani.map((pv, i) => `<option value="${i}">${M.POVOLANI[pv.klic] ? M.POVOLANI[pv.klic].nazev : pv.klic} (úroveň ${pv.uroven})</option>`).join("")}
          </select>
        </div>
        <button class="btn btn-les" id="kk-zkouska-hodit">${IK.svg("kostka")} Hodit zkoušku (2k6 + úroveň)</button>
      </div>` : ""}

      <div class="panel">
        <div class="panel-nadpis">Vlastní hod</div>
        <div class="pole"><label>Počet kostek: <span id="kk-pocet-out">${_kostkyPocet}</span></label>
          <div class="btn-radek"><button class="btn btn-vedlejsi btn-mala" id="kk-pocet-minus">${IK.svg("minus")}</button><button class="btn btn-vedlejsi btn-mala" id="kk-pocet-plus">${IK.svg("plus")}</button></div>
        </div>
        <div class="pole"><label>Typ kostky</label>
          <div class="kostka-mrizka" id="kk-strany">
            ${strany.map((s) => `<button type="button" class="kostka-btn${s === _kostkyStran ? " vybrano" : ""}" data-stran="${s}">k${s}</button>`).join("")}
          </div>
        </div>
        <div class="pole"><label>Bonus: <span id="kk-bonus-out">${_kostkyBonus > 0 ? "+" : ""}${_kostkyBonus}</span></label>
          <div class="btn-radek"><button class="btn btn-vedlejsi btn-mala" id="kk-bonus-minus">${IK.svg("minus")}</button><button class="btn btn-vedlejsi btn-mala" id="kk-bonus-plus">${IK.svg("plus")}</button></div>
        </div>
        <div class="pole"><label>Popis hodu</label><input type="text" id="kk-popis" placeholder="Hod" value="Hod"></div>
      </div>

      <button class="btn" id="kk-hodit">${IK.svg("kostka")} Hodit</button>

      <div id="kk-vysledek"></div>`;

    kont.querySelector("#kk-pocet-minus").addEventListener("click", () => { _kostkyPocet = Math.max(1, _kostkyPocet - 1); kont.querySelector("#kk-pocet-out").textContent = _kostkyPocet; });
    kont.querySelector("#kk-pocet-plus").addEventListener("click", () => { _kostkyPocet = Math.min(12, _kostkyPocet + 1); kont.querySelector("#kk-pocet-out").textContent = _kostkyPocet; });
    kont.querySelector("#kk-bonus-minus").addEventListener("click", () => { _kostkyBonus -= 1; kont.querySelector("#kk-bonus-out").textContent = (_kostkyBonus > 0 ? "+" : "") + _kostkyBonus; });
    kont.querySelector("#kk-bonus-plus").addEventListener("click", () => { _kostkyBonus += 1; kont.querySelector("#kk-bonus-out").textContent = (_kostkyBonus > 0 ? "+" : "") + _kostkyBonus; });
    kont.querySelector("#kk-strany").addEventListener("click", (e) => {
      const btn = e.target.closest(".kostka-btn"); if (!btn) return;
      _kostkyStran = parseInt(btn.dataset.stran, 10);
      kont.querySelectorAll(".kostka-btn").forEach((b) => b.classList.toggle("vybrano", b === btn));
    });

    function zobrazVysledek(v) {
      kont.querySelector("#kk-vysledek").innerHTML = `
        <div class="panel vysledek-hodu">
          <div class="panel-nadpis" style="justify-content:center;">${esc(v.popis)}</div>
          <div class="cislo">${v.soucet}</div>
          <div class="zapis">${esc(v.zapis)}</div>
        </div>`;
    }

    kont.querySelector("#kk-hodit").addEventListener("click", () => {
      const popis = kont.querySelector("#kk-popis").value.trim() || "Hod";
      zobrazVysledek(St.hodKostkou(_kostkyPocet, _kostkyStran, _kostkyBonus, popis));
    });

    const zkouskaBtn = kont.querySelector("#kk-zkouska-hodit");
    if (zkouskaBtn) {
      zkouskaBtn.addEventListener("click", () => {
        const i = parseInt(kont.querySelector("#kk-zkouska-povolani").value, 10);
        const pv = mojePostava.povolani[i];
        const nazev = M.POVOLANI[pv.klic] ? M.POVOLANI[pv.klic].nazev : pv.klic;
        zobrazVysledek(St.hodKostkou(2, 6, pv.uroven, `Zkouška: ${nazev}`));
      });
    }
  }

  // ================= TAB: KRONIKA =================

  function renderKronika(kont) {
    kont.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%;">
        <div class="kronika-seznam" id="kronika-seznam" style="flex:1;"></div>
        <div class="kronika-vstup">
          <textarea id="kronika-vstup-text" rows="1" placeholder="${St.S.role === "pj" ? "Vyprávěj…" : "Co děláš?"}"></textarea>
          <button class="odeslat-btn" id="kronika-odeslat">${IK.svg("odeslat")}</button>
        </div>
      </div>`;

    vykresliZpravyKroniky(kont);

    const textarea = kont.querySelector("#kronika-vstup-text");
    const odeslat = () => {
      const text = textarea.value.trim();
      if (!text) return;
      St.pridejZpravu(text, St.S.role === "pj" ? "vypraveni" : "akce");
      textarea.value = "";
      textarea.style.height = "auto";
    };
    kont.querySelector("#kronika-odeslat").addEventListener("click", odeslat);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); odeslat(); }
    });
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(90, textarea.scrollHeight) + "px";
    });
  }

  function vykresliZpravyKroniky(kont) {
    const seznam = kont.querySelector("#kronika-seznam");
    if (!seznam) return;
    seznam.innerHTML = St.S.kronika.map((z) => `
      <div class="zprava ${esc(z.druh)}">
        <div class="radek-hlavicky">
          <span class="autor">${esc(z.autor)}</span>
          <span class="cas">${formatCas(z.cas)}</span>
        </div>
        <div class="text">${esc(z.text)}</div>
      </div>`).join("");
    seznam.scrollTop = seznam.scrollHeight;
  }

  function aktualizujKroniku(kont) {
    if (!kont.querySelector("#kronika-seznam")) return;
    vykresliZpravyKroniky(kont);
  }

  // ================= TAB: PJ =================

  let _netvorJmeno = "Skřet", _netvorHp = 8, _netvorDruh = "netvor", _netvorPortretKlic = null;

  function renderPJ(kont) {
    kont.innerHTML = `
      <div class="panel">
        <div class="panel-nadpis">Přidat na mapu</div>
        <div class="pole"><label>Název</label><input type="text" id="pj-nazev" value="${esc(_netvorJmeno)}"></div>
        <div class="btn-radek" id="pj-nabytek-rychle">
          ${["Stůl", "Postel", "Truhla", "Židle", "Regál", "Oheň"].map((n) => `<button type="button" class="btn btn-vedlejsi btn-mala" data-nabytek="${n}">${esc(n)}</button>`).join("")}
        </div>
        <div class="pole"><label>Životy: <span id="pj-hp-out">${_netvorHp}</span></label>
          <div class="btn-radek"><button class="btn btn-vedlejsi btn-mala" id="pj-hp-minus">${IK.svg("minus")}</button><button class="btn btn-vedlejsi btn-mala" id="pj-hp-plus">${IK.svg("plus")}</button></div>
        </div>
        <div class="pole"><label>Druh</label>
          <select id="pj-druh">
            ${Object.keys(M.DRUH_FIGURKY).map((k) => `<option value="${k}" ${k === _netvorDruh ? "selected" : ""}>${M.DRUH_FIGURKY[k].nazev}</option>`).join("")}
          </select>
        </div>
        <div class="pole" id="pj-vzhled-pole" style="display:none;">
          <label>Vzhled</label>
          <div class="galerie-mrizka" id="pj-vzhled-galerie"></div>
        </div>
        <div class="pole" id="pj-vchod-pole" style="display:none;">
          <label>Vede do mapy (vstup dovnitř)</label>
          <select id="pj-vchod-cil"></select>
          <p class="napoveda" style="text-align:left; margin-top:4px;">Až figurku vybereš na mapě, objeví se tlačítko „Vstoupit dovnitř" — třeba pro interiér domu s rozestavěným nábytkem.</p>
        </div>
        <button class="btn btn-vedlejsi" id="pj-postavit" style="margin-top:10px;">${IK.svg("plus")} Postavit na mapu</button>
      </div>

      <div class="panel">
        <div class="panel-nadpis">Mlha války</div>
        <div class="btn-radek">
          <button class="btn btn-vedlejsi" id="pj-odhalit-vse">${IK.svg("oko")} Odhalit vše</button>
          <button class="btn btn-vedlejsi" id="pj-zahalit-vse">${IK.svg("okoZavrene")} Zahalit vše</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-nadpis">Mapy</div>
        <div id="pj-seznam-map"></div>
        <div class="btn-radek" style="margin-top:8px;">
          <button class="btn btn-vedlejsi" id="pj-znovu-vygenerovat">${IK.svg("znovu")} Vygenerovat aktivní mapu znovu</button>
        </div>
        <button class="btn btn-vedlejsi" id="pj-editor-mapy" style="margin-top:8px;">${IK.svg("stetec")} Otevřít editor mapy</button>
        <button class="btn btn-vedlejsi" id="pj-synchronizovat" style="margin-top:8px;">${IK.svg("sdilet")} Poslat celý stav znovu všem hráčům</button>
        <p class="napoveda" style="text-align:left; margin-top:4px;">Použij, pokud někomu z hráčů nedorazila nová/velká mapa (např. vlastní nahraný obrázek).</p>
      </div>

      <div class="panel">
        <div class="panel-nadpis">${IK.svg("kniha")} Přehled pravidel</div>
        <a class="btn btn-vedlejsi btn-mala" href="dokumenty/rychla-pravidla.pdf" download style="text-decoration:none; display:inline-flex;">${IK.svg("stahnout")} Stáhnout PDF</a>
      </div>

      <div class="panel">
        <div class="panel-nadpis">Tajné poznámky PJ</div>        <textarea id="pj-poznamky" style="min-height:110px;">${esc((St.S.svet && St.S.svet.pjNotes) || "")}</textarea>
      </div>

      <div class="panel">
        <div class="panel-nadpis">Konec sezení</div>
        <p class="napoveda" style="text-align:left;">
          Ulož svět do souboru — je to záloha, kterou lze kdykoli nahrát a pokračovat pod novým kódem.
          Svět ale zůstává uložený i bez souboru v tomto prohlížeči (v „Moje světy“ na úvodní obrazovce).
        </p>
        <button class="btn btn-les" id="pj-stahnout">${IK.svg("stahnout")} Stáhnout svět do souboru</button>
        <button class="btn btn-vedlejsi" id="pj-ukoncit" style="margin-top:8px;">Uložit a ukončit hru</button>
      </div>`;

    kont.querySelector("#pj-nazev").addEventListener("input", (e) => { _netvorJmeno = e.target.value; });

    const vchodPole = kont.querySelector("#pj-vchod-pole");
    const vchodCil = kont.querySelector("#pj-vchod-cil");
    function obnovSeznamCilu() {
      const ostatni = St.S.mapy.filter((m) => m.id !== (St.aktivniMapa() || {}).id);
      vchodCil.innerHTML = ostatni.length
        ? ostatni.map((m) => `<option value="${m.id}">${esc(m.nazev)}</option>`).join("")
        : `<option value="">— nejdřív vytvoř další mapu —</option>`;
    }
    obnovSeznamCilu();

    const vzhledPole = kont.querySelector("#pj-vzhled-pole");
    const vzhledGalerie = kont.querySelector("#pj-vzhled-galerie");
    function vykresliGalerii() {
      vzhledGalerie.innerHTML = DrD.Portret.GALERIE_NETVOR.map((klic) => `
        <button type="button" class="galerie-polozka${klic === _netvorPortretKlic ? " vybrano" : ""}" data-klic="${klic}" title="${esc(DrD.Portret.NAZVY[klic] || klic)}">
          <img src="img/netvori/${klic}.png" alt="${esc(DrD.Portret.NAZVY[klic] || klic)}" loading="lazy">
        </button>`).join("");
      vzhledGalerie.querySelectorAll(".galerie-polozka").forEach((btn) => {
        btn.addEventListener("click", () => {
          _netvorPortretKlic = btn.dataset.klic;
          if (!kont.querySelector("#pj-nazev").matches(":focus")) {
            _netvorJmeno = DrD.Portret.NAZVY[_netvorPortretKlic] || _netvorJmeno;
            kont.querySelector("#pj-nazev").value = _netvorJmeno;
          }
          vykresliGalerii();
        });
      });
    }

    kont.querySelector("#pj-druh").addEventListener("change", (e) => {
      _netvorDruh = e.target.value;
      vchodPole.style.display = _netvorDruh === "vchod" ? "block" : "none";
      const zobrazitGalerii = _netvorDruh === "netvor" || _netvorDruh === "npc";
      vzhledPole.style.display = zobrazitGalerii ? "block" : "none";
      if (zobrazitGalerii && !_netvorPortretKlic) { _netvorPortretKlic = DrD.Portret.GALERIE_NETVOR[0]; vykresliGalerii(); }
      if (_netvorDruh === "vchod") obnovSeznamCilu();
    });
    if (_netvorDruh === "netvor" || _netvorDruh === "npc") {
      vzhledPole.style.display = "block";
      if (!_netvorPortretKlic) _netvorPortretKlic = DrD.Portret.GALERIE_NETVOR[0];
      vykresliGalerii();
    }
    kont.querySelector("#pj-hp-minus").addEventListener("click", () => { _netvorHp = Math.max(1, _netvorHp - 1); kont.querySelector("#pj-hp-out").textContent = _netvorHp; });
    kont.querySelector("#pj-hp-plus").addEventListener("click", () => { _netvorHp = Math.min(200, _netvorHp + 1); kont.querySelector("#pj-hp-out").textContent = _netvorHp; });

    kont.querySelector("#pj-nabytek-rychle").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-nabytek]");
      if (!btn) return;
      _netvorJmeno = btn.dataset.nabytek;
      kont.querySelector("#pj-nazev").value = _netvorJmeno;
      _netvorDruh = "predmet";
      kont.querySelector("#pj-druh").value = "predmet";
      vchodPole.style.display = "none";
      vzhledPole.style.display = "none";
    });

    kont.querySelector("#pj-postavit").addEventListener("click", () => {
      const mapa = St.aktivniMapa();
      if (!mapa) return;
      if (_netvorDruh === "vchod" && !vchodCil.value) { alert('Nejdřív vytvoř mapu, kam má vchod vést (tlačítko „Další mapa" výše v editoru).'); return; }
      const maPortret = (_netvorDruh === "netvor" || _netvorDruh === "npc") && _netvorPortretKlic;
      const token = M.novaFigurka({
        nazev: _netvorJmeno || "Netvor",
        x: Math.floor(Math.random() * mapa.sirka), y: Math.floor(Math.random() * mapa.vyska),
        druh: _netvorDruh, zivotyAktualni: _netvorHp, zivotyMax: _netvorHp,
        odkazNaMapu: _netvorDruh === "vchod" ? vchodCil.value : null,
        portret: maPortret ? DrD.Portret.netvorPortret(_netvorPortretKlic) : null,
      });
      St.pridejFigurku(token);
      St.pridejZpravu(`Na scéně se objevuje ${_netvorJmeno || "netvor"}.`, "systemova", "Systém");
    });

    kont.querySelector("#pj-odhalit-vse").addEventListener("click", () => St.odhalCelouMapu());
    kont.querySelector("#pj-zahalit-vse").addEventListener("click", () => St.zahalCelouMapu());
    kont.querySelector("#pj-znovu-vygenerovat").addEventListener("click", () => {
      if (confirm("Přegenerovat aktivní mapu novým náhodným terénem? Ruční úpravy na ní se ztratí.")) St.vygenerujZnovu();
    });

    vykresliSeznamMap(kont);

    kont.querySelector("#pj-editor-mapy").addEventListener("click", () => {
      St.S._navratPoEditoru = "stul";
      St.jdiNa("editorMapy");
    });
    kont.querySelector("#pj-synchronizovat").addEventListener("click", (e) => {
      St.vynutSynchronizaci();
      const btn = e.currentTarget;
      const puvodni = btn.textContent;
      btn.textContent = "Odesláno";
      setTimeout(() => { btn.innerHTML = `${IK.svg("sdilet")} Poslat celý stav znovu všem hráčům`; }, 1500);
    });

    const poznamkyEl = kont.querySelector("#pj-poznamky");
    const ulozPoznamky = DrD.Util.debounceFn((text) => St.nastavPoznamkyPJ(text), 400);
    poznamkyEl.addEventListener("input", () => ulozPoznamky(poznamkyEl.value));

    kont.querySelector("#pj-stahnout").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const puvodni = btn.innerHTML;
      btn.textContent = "Ukládám…"; btn.disabled = true;
      try { await St.stahniSvetDoSouboru(); } finally { btn.innerHTML = puvodni; btn.disabled = false; }
    });

    kont.querySelector("#pj-ukoncit").addEventListener("click", () => {
      if (confirm("Ukončit hru? Svět zůstane uložený a půjde znovu otevřít z „Moje světy“.")) St.ukonciHru();
    });
  }

  function vykresliSeznamMap(kont) {
    const el = kont.querySelector("#pj-seznam-map");
    if (!el) return;
    el.innerHTML = St.S.mapy.map((m) => `
      <button class="svet-radek" data-mid="${m.id}">
        <span class="info nazev" style="flex:1;">${esc(m.nazev)}</span>
        ${St.S.svet && St.S.svet.activeMapId === m.id ? `<span class="ikona-svg" style="color:var(--les);">${IK.svg("stit")}</span>` : ""}
      </button>`).join("");
    el.querySelectorAll("[data-mid]").forEach((btn) => {
      btn.addEventListener("click", () => {
        St.prepniMapu(btn.dataset.mid);
        St.pridejZpravu(`Scéna se mění: ${St.S.mapy.find((m) => m.id === btn.dataset.mid).nazev}`, "systemova", "Systém");
      });
    });
  }

  function aktualizujPJ(kont) {
    if (!kont.querySelector("#pj-seznam-map")) return;
    vykresliSeznamMap(kont);
  }

  // ================= DENÍK POSTAVY (inventář) =================

  function otevriDenik(postavaId) {
    const vrstva = document.getElementById("denik-vrstva");
    if (!vrstva) return;
    vykresliDenik(vrstva, postavaId);
  }

  function vykresliDenik(vrstva, postavaId) {
    const p = St.S.postavy.find((x) => x.id === postavaId);
    if (!p) { vrstva.innerHTML = ""; return; }
    const jeVlastnik = St.S.role === "pj" || p.id === St.S.mojePostavaId;
    const povolaniText = (p.povolani || []).map((pv) => `${M.POVOLANI[pv.klic] ? M.POVOLANI[pv.klic].nazev : pv.klic} (úr. ${pv.uroven})`).join(", ");

    vrstva.innerHTML = `
      <div class="denik-podklad">
        <div class="denik-okno">
          <div class="denik-hlavicka">
            <span class="portret-mala" style="width:52px;height:52px;">${p.portret ? DrD.Portret.svgPortret(p.portret, { rezim: "bysta" }) : ""}</span>
            <div style="flex:1;">
              <h2 style="margin:0;">${esc(p.jmeno)}</h2>
              <div class="napoveda" style="text-align:left;">${esc(M.RASA[p.rasa].nazev)} · ${esc(povolaniText)}</div>
            </div>
            <button class="btn-mala btn-vedlejsi btn" id="denik-zavrit" style="width:auto; padding:6px 10px;">${IK.svg("zavrit")}</button>
          </div>
          ${jeVlastnik ? `
          <div style="padding:10px 16px 0;">
            <button class="btn btn-vedlejsi btn-mala" id="denik-stahnout">${IK.svg("stahnout")} Uložit postavu do souboru (pro příští hru)</button>
          </div>` : ""}

          <div class="denik-obsah">
            <div class="panel">
              <div class="panel-nadpis">Vlastnosti a povolání</div>
              <div class="zdroje-trojice">
                ${zdrojRadekHtml(p, "telo", "Tělo", "telo")}
                ${zdrojRadekHtml(p, "duse", "Duše", "duse")}
                ${zdrojRadekHtml(p, "vliv", "Vliv", "vliv")}
              </div>
              <div class="pole" style="margin-top:10px;"><label>Rasová schopnost</label>
                <input type="text" id="dk-rasova-schopnost" value="${esc(p.rasovaSchopnost)}" ${jeVlastnik ? "" : "disabled"}>
              </div>
              <div class="pole"><label>Povahový rys</label>
                <input type="text" id="dk-povahovy-rys" value="${esc(p.povahovyRys)}" ${jeVlastnik ? "" : "disabled"}>
              </div>
              <div class="pole"><label>Bonusy / postihy</label>
                <textarea id="dk-bonusy" ${jeVlastnik ? "" : "disabled"}>${esc(p.bonusyPostihy)}</textarea>
              </div>
              <div class="pole"><label>Zvláštní schopnosti</label>
                <textarea id="dk-schopnosti" ${jeVlastnik ? "" : "disabled"}>${esc(p.zvlastniSchopnosti)}</textarea>
              </div>
              <div class="pole" style="margin-top:4px;">
                <label>Úroveň</label>
                <input type="number" id="dk-uroven" min="1" value="${p.uroven}" style="width:70px;" ${jeVlastnik ? "" : "disabled"}>
              </div>
              <div class="pole"><label>Volné zkušenosti</label>
                <input type="number" id="dk-zkusenosti" min="0" value="${p.volneZkusenosti}" style="width:70px;" ${jeVlastnik ? "" : "disabled"}>
              </div>
              <div class="pole" style="margin-top:6px;">
                <label>Povolání</label>
                <div id="dk-povolani-seznam"></div>
                ${jeVlastnik ? `<button class="btn btn-vedlejsi btn-mala" id="dk-pridat-povolani" style="margin-top:4px;">${IK.svg("plus")} Přidat / povýšit povolání</button>` : ""}
              </div>
            </div>

            <div class="denik-mrizka">
              <div class="panel">
                <div class="panel-nadpis">${IK.svg("mince")} Peníze</div>
                <div class="penize-radek">
                  <div class="penize-pole"><label>Dukáty</label><input type="number" id="dk-dukaty" min="0" value="${p.penize.dukaty}" ${jeVlastnik ? "" : "disabled"}></div>
                  <div class="penize-pole"><label>Groše</label><input type="number" id="dk-grose" min="0" value="${p.penize.grose}" ${jeVlastnik ? "" : "disabled"}></div>
                  <div class="penize-pole"><label>Haléře</label><input type="number" id="dk-halere" min="0" value="${p.penize.halere}" ${jeVlastnik ? "" : "disabled"}></div>
                </div>
                <div class="pole" style="margin-top:8px;"><label>Naložení</label>
                  <input type="text" id="dk-nalozeni" value="${esc(p.nalozeni)}" placeholder="lehké / střední / těžké" ${jeVlastnik ? "" : "disabled"}>
                </div>
              </div>

              <div class="panel">
                <div class="panel-nadpis">Poznámky</div>
                <textarea id="dk-poznamky" style="min-height:90px;" ${jeVlastnik ? "" : "disabled"}>${esc(p.poznamky)}</textarea>
              </div>
            </div>

            <div class="panel">
              <div class="panel-nadpis">${IK.svg("batoh")} Vybavení</div>
              <table class="vybaveni-tabulka">
                <thead><tr><th style="width:46%;">Předmět</th><th style="width:16%;">Počet</th><th>Poznámka</th><th></th></tr></thead>
                <tbody id="dk-vybaveni-telo"></tbody>
              </table>
              ${jeVlastnik ? `<button class="btn btn-vedlejsi btn-mala" id="dk-pridat-vybaveni" style="margin-top:8px;">${IK.svg("plus")} Přidat položku</button>` : ""}
            </div>
          </div>
        </div>
      </div>`;

    vrstva.querySelector("#denik-zavrit").addEventListener("click", () => { vrstva.innerHTML = ""; });
    const denikStahnoutBtn = vrstva.querySelector("#denik-stahnout");
    if (denikStahnoutBtn) denikStahnoutBtn.addEventListener("click", () => St.stahniPostavuDoSouboru(p.id));

    function moznostiPovolani() {
      return M.POVOLANI_SKUPINY.map((sk) => `
        <optgroup label="${esc(sk.nadpis)}">
          ${sk.klice.map((k) => `<option value="${k}">${esc(M.POVOLANI[k].nazev)}</option>`).join("")}
        </optgroup>`).join("");
    }

    let povolani = (p.povolani || []).map((pv) => Object.assign({}, pv));
    function vykresliPovolaniSeznam() {
      const kont = vrstva.querySelector("#dk-povolani-seznam");
      if (povolani.length === 0) {
        kont.innerHTML = `<p class="napoveda" style="text-align:left;">Zatím žádné povolání.</p>`;
      } else {
        kont.innerHTML = povolani.map((pv, i) => `
          <div class="povolani-radek" data-i="${i}">
            <select data-pole="klic" ${jeVlastnik ? "" : "disabled"}>${moznostiPovolani()}</select>
            <input type="number" data-pole="uroven" min="1" max="20" value="${pv.uroven}" ${jeVlastnik ? "" : "disabled"}>
            ${jeVlastnik ? `<button type="button" class="povolani-smazat" data-i="${i}">${IK.svg("kos")}</button>` : ""}
          </div>`).join("");
        kont.querySelectorAll(".povolani-radek").forEach((radek) => {
          const i = parseInt(radek.dataset.i, 10);
          const selectEl = radek.querySelector('[data-pole="klic"]');
          selectEl.value = povolani[i].klic;
          if (jeVlastnik) {
            selectEl.addEventListener("change", () => { povolani[i].klic = selectEl.value; ulozDenik(); });
            radek.querySelector('[data-pole="uroven"]').addEventListener("input", (e) => {
              povolani[i].uroven = Math.max(1, parseInt(e.target.value, 10) || 1); ulozDenik();
            });
          }
        });
        if (jeVlastnik) {
          kont.querySelectorAll(".povolani-smazat").forEach((btn) => {
            btn.addEventListener("click", () => {
              povolani.splice(parseInt(btn.dataset.i, 10), 1);
              vykresliPovolaniSeznam();
              ulozDenik();
            });
          });
        }
      }
    }
    vykresliPovolaniSeznam();
    const dkPridatPovolani = vrstva.querySelector("#dk-pridat-povolani");
    if (dkPridatPovolani) dkPridatPovolani.addEventListener("click", () => {
      povolani.push({ klic: "bojovnik", uroven: 1 });
      vykresliPovolaniSeznam();
      ulozDenik();
    });

    let vybaveni = (p.vybaveni || []).map((v) => Object.assign({}, v));
    function vykresliVybaveni() {
      vrstva.querySelector("#dk-vybaveni-telo").innerHTML = vybaveni.map((v, i) => `
        <tr data-i="${i}">
          <td><input type="text" data-pole="nazev" value="${esc(v.nazev)}" ${jeVlastnik ? "" : "disabled"}></td>
          <td><input type="text" data-pole="mnozstvi" value="${esc(v.mnozstvi)}" ${jeVlastnik ? "" : "disabled"}></td>
          <td><input type="text" data-pole="poznamka" value="${esc(v.poznamka)}" ${jeVlastnik ? "" : "disabled"}></td>
          <td>${jeVlastnik ? `<button class="vybaveni-smazat" data-i="${i}">${IK.svg("kos")}</button>` : ""}</td>
        </tr>`).join("");
      if (!jeVlastnik) return;
      vrstva.querySelectorAll("#dk-vybaveni-telo tr").forEach((radek) => {
        const i = parseInt(radek.dataset.i, 10);
        radek.querySelectorAll("input").forEach((inp) => {
          inp.addEventListener("input", () => { vybaveni[i][inp.dataset.pole] = inp.value; ulozDenik(); });
        });
      });
      vrstva.querySelectorAll(".vybaveni-smazat").forEach((btn) => {
        btn.addEventListener("click", () => { vybaveni.splice(parseInt(btn.dataset.i, 10), 1); vykresliVybaveni(); ulozDenik(); });
      });
    }
    vykresliVybaveni();

    const dkPridat = vrstva.querySelector("#dk-pridat-vybaveni");
    if (dkPridat) dkPridat.addEventListener("click", () => {
      vybaveni.push({ nazev: "", mnozstvi: "1", poznamka: "" });
      vykresliVybaveni();
    });

    function ulozDenik() {
      if (!jeVlastnik) return;
      St.upravPostavu(p.id, {
        rasovaSchopnost: vrstva.querySelector("#dk-rasova-schopnost").value,
        povahovyRys: vrstva.querySelector("#dk-povahovy-rys").value,
        bonusyPostihy: vrstva.querySelector("#dk-bonusy").value,
        zvlastniSchopnosti: vrstva.querySelector("#dk-schopnosti").value,
        uroven: Math.max(1, parseInt(vrstva.querySelector("#dk-uroven").value, 10) || 1),
        volneZkusenosti: Math.max(0, parseInt(vrstva.querySelector("#dk-zkusenosti").value, 10) || 0),
        povolani,
        penize: {
          dukaty: Math.max(0, parseInt(vrstva.querySelector("#dk-dukaty").value, 10) || 0),
          grose: Math.max(0, parseInt(vrstva.querySelector("#dk-grose").value, 10) || 0),
          halere: Math.max(0, parseInt(vrstva.querySelector("#dk-halere").value, 10) || 0),
        },
        nalozeni: vrstva.querySelector("#dk-nalozeni").value,
        poznamky: vrstva.querySelector("#dk-poznamky").value,
        vybaveni,
      });
    }

    if (jeVlastnik) {
      const ulozDebounced = DrD.Util.debounceFn(ulozDenik, 350);
      vrstva.querySelectorAll(".denik-okno input, .denik-okno textarea").forEach((el) => {
        if (el.closest("#dk-vybaveni-telo") || el.closest("#dk-povolani-seznam")) return; // ty se ukládají zvlášť výše
        el.addEventListener("input", ulozDebounced);
      });
    }
  }

  St.naDatovouZmenu(aktualizuj);

  return { vykresli, otevriDenik };
})();
