// DrD.Stav — jediný zdroj pravdy pro běh appky.
//
// Síťový model: PJ je "host" a drží jediný pravdivý stav světa lokálně v paměti
// (+ průběžně v localStorage). Hráči jsou "klienti" — jejich akce se pošlou
// hostovi jako žádost, host je zpracuje a rozešle všem aktuální stav. Žádná
// databáze na pozadí, žádný účet — jen přímé spojení mezi prohlížeči.
window.DrD = window.DrD || {};

DrD.Stav = (function () {
  const M = DrD.Modely;

  const S = {
    obrazovka: "menu", // menu | vytvoreniSveta | editorMapy | lobbyPJ | pripojeni | vyberPostavy | tvorbaPostavy | stul
    role: "pj", // 'pj' | 'hrac'
    kod: null,
    svet: null,
    mapy: [],
    tokenyPodleMapy: {},
    postavy: [],
    kronika: [],
    jmenoHrace: localStorage.getItem("drd_jmeno") || "",
    mojePostavaId: null,
    _vlastnikPostavy: {},
    posledniHod: null,
    chyba: null,
    nacitaSe: false,
    stavSpojeni: "—",
    knihovna: [],
    _navratPoEditoru: "menu",
    _sit: null,
  };

  const posluchaciStruktura = [];
  const posluchaciData = [];
  let docasniPosluchaciData = [];

  function naStrukturalniZmenu(fn) { posluchaciStruktura.push(fn); }
  function naDatovouZmenu(fn) { posluchaciData.push(fn); }
  function naDatovouZmenuDocasne(fn) { posluchaciData.push(fn); docasniPosluchaciData.push(fn); }

  function oznamStrukturu() { posluchaciStruktura.forEach((f) => f()); }
  function oznamData() { posluchaciData.forEach((f) => f()); }

  function jdiNa(obrazovka) {
    if (docasniPosluchaciData.length) {
      docasniPosluchaciData.forEach((fn) => {
        const i = posluchaciData.indexOf(fn);
        if (i >= 0) posluchaciData.splice(i, 1);
      });
      docasniPosluchaciData = [];
    }
    S.obrazovka = obrazovka;
    oznamStrukturu();
  }

  function nastavChybu(text) { S.chyba = text; oznamStrukturu(); }
  function zavriChybu() { S.chyba = null; oznamStrukturu(); }

  function sklonujHrace(n) {
    if (n === 1) return "hráč";
    if (n >= 2 && n <= 4) return "hráči";
    return "hráčů";
  }

  // ---------- Místní knihovna světů (localStorage — appka je jediné "úložiště") ----------

  function nactiMistniKnihovnu() {
    try { S.knihovna = JSON.parse(localStorage.getItem("drd_svety") || "[]"); }
    catch (e) { S.knihovna = []; }
    return S.knihovna;
  }

  function ulozDoMistniKnihovny(zaznam) {
    nactiMistniKnihovnu();
    S.knihovna = S.knihovna.filter((z) => z.id !== zaznam.id);
    S.knihovna.unshift(zaznam);
    S.knihovna = S.knihovna.slice(0, 20);
    try { localStorage.setItem("drd_svety", JSON.stringify(S.knihovna)); } catch (e) {}
  }

  function odeberZMistniKnihovny(id) {
    nactiMistniKnihovnu();
    S.knihovna = S.knihovna.filter((z) => z.id !== id);
    localStorage.setItem("drd_svety", JSON.stringify(S.knihovna));
    try { localStorage.removeItem("drd_data_" + id); } catch (e) {}
  }

  function ulozAutosaveHned() {
    if (S.role !== "pj" || !S.svet) return;
    try {
      const balik = { svet: S.svet, mapy: S.mapy, tokenyPodleMapy: S.tokenyPodleMapy, postavy: S.postavy, kronika: S.kronika };
      localStorage.setItem("drd_data_" + S.svet.id, JSON.stringify(balik));
      ulozDoMistniKnihovny({
        id: S.svet.id, kod: S.kod, nazev: S.svet.nazev, posledniPristup: Date.now(),
        sezeni: S.svet.session || 1,
      });
    } catch (e) { console.warn("Autosave se nepovedl (možná plné úložiště prohlížeče):", e); }
  }
  const ulozAutosaveDebounced = DrD.Util.debounceFn(ulozAutosaveHned, 500);

  // ---------- Síť ----------

  function kompletniStav() {
    return { svet: S.svet, mapy: S.mapy, tokenyPodleMapy: S.tokenyPodleMapy, postavy: S.postavy, kronika: S.kronika };
  }

  function vysilejStav() {
    if (S.role !== "pj" || !S._sit) return;
    S._sit.vysilej({ typ: "stavSveta", data: kompletniStav() });
    ulozAutosaveDebounced();
  }

  // Ruční pojistka pro PJ — znovu pošle úplný stav všem právě připojeným
  // hráčům (např. když se velký payload jako vlastní obrázek mapy z nějakého
  // důvodu nedoručil při prvním pokusu).
  function vynutSynchronizaci() {
    vysilejStav();
  }
  let _vysilaniTimer = null;
  function vysilejStavDebounced(ms) {
    ulozAutosaveDebounced();
    clearTimeout(_vysilaniTimer);
    _vysilaniTimer = setTimeout(vysilejStav, ms || 220);
  }

  function posliHostovi(zprava) {
    if (S._sit && S._sit.posli) S._sit.posli(zprava);
  }

  function zastavSit() {
    if (S._sit) { try { S._sit.zavri(); } catch (e) {} S._sit = null; }
  }

  async function zapniHostovani() {
    zastavSit();
    S.stavSpojeni = "Spouštím stůl…"; oznamData();
    try {
      const sit = await DrD.PeerSit.vytvorHosta(S.kod);
      S._sit = sit;
      S.stavSpojeni = `Stůl běží · 0 ${sklonujHrace(0)}`;

      sit.naPripojeni((conn) => {
        S.stavSpojeni = `Stůl běží · ${sit.pocetPripojenych()} ${sklonujHrace(sit.pocetPripojenych())}`;
        oznamData();
      });
      sit.naOdpojeni(() => {
        S.stavSpojeni = `Stůl běží · ${sit.pocetPripojenych()} ${sklonujHrace(sit.pocetPripojenych())}`;
        oznamData();
      });
      sit.naZmenuStavu((stav) => {
        if (stav === "obnovuji") S.stavSpojeni = "Obnovuji spojení se stolem…";
        else if (stav === "obnoveno") S.stavSpojeni = `Stůl běží · ${sit.pocetPripojenych()} ${sklonujHrace(sit.pocetPripojenych())}`;
        oznamData();
      });
      sit.naZpravu((conn, zprava) => zpracujZpravuOdKlienta(conn, zprava));
      oznamData();
    } catch (chyba) {
      if (chyba && chyba.type === "unavailable-id") {
        // nesmírně nepravděpodobná kolize kódu — zkusíme jednou nový
        S.kod = M.novyKod();
        S.svet.kod = S.kod;
        return zapniHostovani();
      }
      S.stavSpojeni = "Stůl se nepodařilo spustit";
      nastavChybu("Stůl se nepodařilo spustit. Zkontroluj připojení k internetu a zkus to znovu.");
      oznamData();
    }
  }

  function zpracujZpravuOdKlienta(conn, zprava) {
    switch (zprava.typ) {
      case "pripojeniHrace":
        if (S._sit) S._sit.posliKlientovi(conn, { typ: "stavSveta", data: kompletniStav() });
        break;
      case "ulozPostavu": {
        if (!smiKlientUpravovat(conn, zprava.postava.id)) break;
        if (!S._vlastnikPostavy[zprava.postava.id]) S._vlastnikPostavy[zprava.postava.id] = conn.peer;
        _ulozPostavuInterni(zprava.postava);
        break;
      }
      case "prevezmiPostavu": {
        // explicitní "tohle je moje postava" z výběru postav — přepíše vlastnictví
        // i kdyby dřív patřilo jinému (starému) spojení stejného hráče.
        const p = S.postavy.find((x) => x.id === zprava.postavaId);
        if (!p) break;
        S._vlastnikPostavy[zprava.postavaId] = conn.peer;
        p.jmenoHrace = zprava.jmenoHrace || p.jmenoHrace;
        oznamData();
        vysilejStav();
        break;
      }
      case "zmenZdroj":
        if (!smiKlientUpravovat(conn, zprava.postavaId)) break;
        _zmenZdrojInterni(zprava.postavaId, zprava.zdroj, zprava.delta);
        break;
      case "zadostPohyb": presunFigurku(zprava.mapaId, zprava.tokenId, { x: zprava.x, y: zprava.y }); break;
      case "zprava": _pridejZpravuInterni(zprava.autor, zprava.text, zprava.druh, zprava.payload); break;
      default: break;
    }
  }

  // Host-side ověření: klient smí upravovat jen postavu, kterou sám vytvořil
  // nebo si ji výslovně převzal (viz "prevezmiPostavu" výše) — brání tomu,
  // aby si hráči navzájem přepisovali deníky/zdroje.
  function smiKlientUpravovat(conn, postavaId) {
    const vlastnik = S._vlastnikPostavy[postavaId];
    if (!vlastnik) return true; // dosud nepřiřazeno (nová postava) — povolit a přiřadit výš
    return vlastnik === conn.peer;
  }

  function zpracujZpravuOdHosta(zprava) {
    if (zprava.typ === "stavSveta") {
      S.svet = zprava.data.svet;
      S.mapy = zprava.data.mapy;
      S.tokenyPodleMapy = zprava.data.tokenyPodleMapy;
      S.postavy = zprava.data.postavy;
      S.kronika = zprava.data.kronika;
      oznamData();
    }
  }

  // ---------- Aktivní mapa / postava ----------

  function aktivniMapa() {
    if (!S.svet) return null;
    return S.mapy.find((m) => m.id === S.svet.activeMapId) || S.mapy[0] || null;
  }
  function tokenyAktivniMapy() {
    const mapa = aktivniMapa();
    if (!mapa) return [];
    return S.tokenyPodleMapy[mapa.id] || [];
  }
  function mojePostava() {
    return S.postavy.find((p) => p.id === S.mojePostavaId) || null;
  }

  // ---------- Tvorba světa (vždy jako PJ) ----------

  async function vytvorSvet(opts) {
    const kod = M.novyKod();
    let mapa;
    if (opts.typ === "vesnice") mapa = M.novaVesnice(opts.nazevMapy || "Mapa 1", opts.sirka, opts.vyska);
    else if (opts.typ === "obrazek") { mapa = M.novaMapa(opts.nazevMapy || "Mapa 1", opts.sirka, opts.vyska, "trava"); mapa.obrazek = opts.obrazek; mapa.typ = "obrazek"; mapa.mlha = "0".repeat(mapa.sirka * mapa.vyska); }
    else if (opts.typ === "prazdna") mapa = M.novaMapa(opts.nazevMapy || "Mapa 1", opts.sirka, opts.vyska, opts.zaklad);
    else mapa = M.novaDivocina(opts.nazevMapy || "Mapa 1", opts.sirka, opts.vyska);
    mapa.pouzitMlhu = !!opts.mlha;

    S.role = "pj";
    S.kod = kod;
    S.svet = {
      id: M.noveId(), kod, nazev: opts.nazev || "Bezejmenný kraj", popis: opts.popis || "",
      jmenoPJ: opts.jmenoPJ || "Pán jeskyně", activeMapId: mapa.id, session: 1, pjNotes: "",
    };
    S.mapy = [mapa];
    S.tokenyPodleMapy = { [mapa.id]: [] };
    S.postavy = [];
    S.kronika = [{ id: M.noveId(), autor: "Systém", text: `Svět „${S.svet.nazev}“ byl stvořen.`, druh: "systemova", cas: Date.now() }];
    S.mojePostavaId = null;
    S.jmenoHrace = S.svet.jmenoPJ;
    localStorage.setItem("drd_jmeno", S.svet.jmenoPJ);

    S._navratPoEditoru = "lobbyPJ";
    ulozAutosaveHned();
    await zapniHostovani();
    jdiNa("editorMapy");
  }

  // ---------- Editor mapy (jen PJ, síť je vždy zapnutá od vytvoření světa) ----------

  function nastavTeren(bod, terenKlic, stetec) {
    const mapa = aktivniMapa();
    if (!mapa) return;
    const r = stetec - 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        mapa.teren = M.nastavTeren(mapa, bod.x + dx, bod.y + dy, terenKlic);
      }
    }
    oznamData();
    vysilejStavDebounced(180);
  }

  function odhalMlhu(bod, polomer) {
    const mapa = aktivniMapa();
    if (!mapa) return;
    mapa.mlha = M.odhalOblast(mapa, bod.x, bod.y, polomer);
    oznamData();
    vysilejStavDebounced(150);
  }

  function nastavMlhuCela(hodnota) {
    const mapa = aktivniMapa();
    if (!mapa) return;
    mapa.mlha = hodnota.repeat(mapa.sirka * mapa.vyska);
    oznamData();
    vysilejStav();
  }
  function odhalCelouMapu() { nastavMlhuCela("0"); }
  function zahalCelouMapu() { nastavMlhuCela("1"); }

  async function pridejMapu(nazev, sirka, vyska, zaklad, mlha, typ, obrazek) {
    let mapa;
    if (typ === "vesnice") mapa = M.novaVesnice(nazev, sirka, vyska);
    else if (typ === "obrazek") { mapa = M.novaMapa(nazev, sirka, vyska, "trava"); mapa.obrazek = obrazek; mapa.typ = "obrazek"; mapa.mlha = "0".repeat(mapa.sirka * mapa.vyska); }
    else if (typ === "prazdna") mapa = M.novaMapa(nazev, sirka, vyska, zaklad);
    else mapa = M.novaDivocina(nazev, sirka, vyska);
    mapa.pouzitMlhu = !!mlha;
    S.mapy.push(mapa);
    S.tokenyPodleMapy[mapa.id] = [];
    S.svet.activeMapId = mapa.id;
    oznamData();
    vysilejStav();
  }

  function vygenerujZnovu() {
    const mapa = aktivniMapa();
    if (!mapa) return;
    if (mapa.typ !== "divocina" && mapa.typ !== "vesnice") return;
    mapa.seed = Math.floor(Math.random() * 2 ** 31);
    mapa.teren = mapa.typ === "vesnice"
      ? M.vygenerujVesnici(mapa.sirka, mapa.vyska, mapa.seed)
      : M.vygenerujDivocinu(mapa.sirka, mapa.vyska, mapa.seed);
    oznamData();
    vysilejStav();
  }

  function prepniMapu(mapaId) {
    S.svet.activeMapId = mapaId;
    oznamData();
    vysilejStav();
  }

  // ---------- Figurky (host-only operace — v UI je má k dispozici jen PJ) ----------

  function pridejFigurku(figurka) {
    const mapa = aktivniMapa();
    if (!mapa) return;
    if (!S.tokenyPodleMapy[mapa.id]) S.tokenyPodleMapy[mapa.id] = [];
    S.tokenyPodleMapy[mapa.id].push(figurka);
    oznamData();
    vysilejStav();
  }

  function smazFigurku(mapaId, tokenId) {
    S.tokenyPodleMapy[mapaId] = (S.tokenyPodleMapy[mapaId] || []).filter((t) => t.id !== tokenId);
    oznamData();
    vysilejStav();
  }

  function presunFigurku(mapaId, tokenId, bod) {
    const seznam = S.tokenyPodleMapy[mapaId] || [];
    const token = seznam.find((t) => t.id === tokenId);
    if (!token) return;
    token.x = bod.x; token.y = bod.y;
    const mapa = S.mapy.find((m) => m.id === mapaId);
    if (mapa && mapa.pouzitMlhu && token.druh === "hrdina") {
      mapa.mlha = M.odhalOblast(mapa, bod.x, bod.y, 2);
    }
    oznamData();
    vysilejStav();
  }

  function upravFigurku(mapaId, tokenId, zmena) {
    const seznam = S.tokenyPodleMapy[mapaId] || [];
    const token = seznam.find((t) => t.id === tokenId);
    if (!token) return;
    Object.assign(token, zmena);
    oznamData();
    vysilejStav();
  }

  function pozadejOPohyb(tokenId, bod) {
    const mapa = aktivniMapa();
    if (!mapa) return;
    if (S.role === "pj") { presunFigurku(mapa.id, tokenId, bod); return; }
    posliHostovi({ typ: "zadostPohyb", mapaId: mapa.id, tokenId, x: bod.x, y: bod.y });
    const token = (S.tokenyPodleMapy[mapa.id] || []).find((t) => t.id === tokenId);
    pridejZpravu(`posouvá figurku${token ? " „" + token.nazev + "“" : ""} na [${bod.x}, ${bod.y}]`, "pohyb");
  }

  // ---------- Postavy ----------

  function _ulozPostavuInterni(postava) {
    const jeNova = !S.postavy.some((p) => p.id === postava.id);
    const i = S.postavy.findIndex((p) => p.id === postava.id);
    if (i >= 0) S.postavy[i] = postava; else S.postavy.push(postava);

    if (jeNova) {
      const mapa = aktivniMapa();
      if (mapa) {
        if (!S.tokenyPodleMapy[mapa.id]) S.tokenyPodleMapy[mapa.id] = [];
        S.tokenyPodleMapy[mapa.id].push(M.novaFigurka({
          nazev: postava.jmeno, portret: postava.portret,
          x: Math.floor(mapa.sirka / 2), y: Math.floor(mapa.vyska / 2),
          druh: "hrdina", zivotyAktualni: postava.telo.aktualni, zivotyMax: postava.telo.hranice,
          patriPostave: postava.id,
        }));
      }
      const povolaniText = (postava.povolani || []).map((p) => `${M.POVOLANI[p.klic] ? M.POVOLANI[p.klic].nazev : p.klic} ${p.uroven}`).join(", ");
      S.kronika.push({
        id: M.noveId(), autor: "Systém",
        text: `${postava.jmeno} (${M.RASA[postava.rasa].nazev}${povolaniText ? ", " + povolaniText : ""}) vstupuje do příběhu.`,
        druh: "systemova", cas: Date.now(),
      });
    }
    oznamData();
    vysilejStav();
  }

  // Pošle/uloží data postavy — sama o sobě NErozhoduje, čí postava to je.
  // Používá se jak pro založení/převzetí vlastní postavy, tak pro odeslání
  // cizí úpravy (kterou host podle vlastnictví přijme, nebo tiše zahodí).
  function odesliPostavu(postava) {
    postava.aktualizovano = Date.now();
    if (S.role === "pj") _ulozPostavuInterni(postava);
    else posliHostovi({ typ: "ulozPostavu", postava });
  }

  // Uložení VLASTNÍ postavy — tvorba nové postavy nebo její návazná úprava.
  // Na rozdíl od odesliPostavu tohle nastavuje "tohle hraju já" (mojePostavaId
  // + zapamatování v prohlížeči). Nikdy to nevolej pro postavu, která není tvoje.
  async function ulozPostavu(postava) {
    S.mojePostavaId = postava.id;
    odesliPostavu(postava);
    zapamatujSiPostavu(postava.id);
  }

  // Částečná úprava existující postavy (deník/inventář) — sloučí zadaná pole
  // s aktuální postavou a pošle přes odesliPostavu. Nedotýká se mojePostavaId:
  // stejná funkce se používá jak pro úpravu vlastní postavy, tak (u PJ) pro
  // úpravu kterékoli cizí — host případně neautorizovanou úpravu sám odmítne
  // (viz smiKlientUpravovat), ale klient by si tím neměl přepsat, koho vlastně
  // hraje, i kdyby se o úpravu jen POKUSIL.
  function upravPostavu(postavaId, zmena) {
    const p = S.postavy.find((x) => x.id === postavaId);
    if (!p) return;
    odesliPostavu(Object.assign({}, p, zmena, { id: p.id }));
  }

  function _zmenZdrojInterni(postavaId, zdroj, delta) {
    const p = S.postavy.find((x) => x.id === postavaId);
    if (!p || !p[zdroj]) return;
    p[zdroj].aktualni = Math.max(0, Math.min(p[zdroj].hranice, p[zdroj].aktualni + delta));
    p.aktualizovano = Date.now();
    if (zdroj === "telo") {
      for (const mapa of S.mapy) {
        const token = (S.tokenyPodleMapy[mapa.id] || []).find((t) => t.patriPostave === postavaId);
        if (token) { token.zivotyAktualni = p.telo.aktualni; token.zivotyMax = p.telo.hranice; }
      }
    }
    oznamData();
    vysilejStav();
  }

  function zmenZdroj(postavaId, zdroj, delta) {
    if (S.role === "pj") _zmenZdrojInterni(postavaId, zdroj, delta);
    else posliHostovi({ typ: "zmenZdroj", postavaId, zdroj, delta });
  }

  // ---------- Kronika a kostky ----------

  function _pridejZpravuInterni(autor, text, druh, payload) {
    S.kronika.push({ id: M.noveId(), autor, text, druh, cas: Date.now(), payload: payload || null });
    if (S.kronika.length > 300) S.kronika.splice(0, S.kronika.length - 300);
    oznamData();
    vysilejStav();
  }

  function pridejZpravu(text, druh, autorPrepis) {
    const autor = autorPrepis || (S.role === "pj" ? (S.svet.jmenoPJ || "PJ") : (mojePostava() ? mojePostava().jmeno : S.jmenoHrace));
    if (S.role === "pj") _pridejZpravuInterni(autor, text, druh);
    else posliHostovi({ typ: "zprava", autor, text, druh });
  }

  function nastavPoznamkyPJ(text) {
    if (S.role !== "pj" || !S.svet) return;
    S.svet.pjNotes = text;
    vysilejStavDebounced(400);
  }

  function hodKostkou(pocet, stran, bonus, popis) {
    const vysledek = M.provedHod(pocet, stran, bonus, popis);
    S.posledniHod = vysledek;
    oznamData();
    pridejZpravu(`${popis}: ${vysledek.zapis}`, "hod");
    return vysledek;
  }

  // ---------- Připojení hráče ----------

  async function pripojSe(kod, jmeno) {
    kod = (kod || "").toUpperCase().trim();
    if (kod.length < 4) { nastavChybu("Zadej platný kód stolu."); return; }
    S.jmenoHrace = jmeno || "Hráč";
    localStorage.setItem("drd_jmeno", S.jmenoHrace);
    zavriChybu();
    S.nacitaSe = true; S.stavSpojeni = "Hledám stůl…"; oznamStrukturu();

    try {
      const sit = await DrD.PeerSit.pripojSeKHostovi(kod);
      S._sit = sit;
      S.role = "hrac";
      S.kod = kod;
      S.mojePostavaId = null;

      await new Promise((resolve) => {
        let hotovo = false;
        sit.naZpravu((zprava) => {
          zpracujZpravuOdHosta(zprava);
          if (!hotovo && zprava.typ === "stavSveta") { hotovo = true; resolve(); }
        });
        sit.posli({ typ: "pripojeniHrace", jmeno: S.jmenoHrace });
        setTimeout(resolve, 4000); // pojistka, kdyby první stav nedorazil
      });

      sit.naOdpojeni(() => {
        S.stavSpojeni = "Spojení se stolem přerušeno";
        nastavChybu("Spojení s PJ bylo přerušeno. Vrať se na start a zkus se připojit znovu.");
        oznamData();
      });

      S.stavSpojeni = "Připojeno";
      S.nacitaSe = false;
      jdiNa("vyberPostavy");
    } catch (chyba) {
      S.nacitaSe = false;
      S.stavSpojeni = "—";
      if (chyba && (chyba.type === "peer-unavailable")) {
        nastavChybu(`Stůl s kódem ${kod} nebyl nalezen. Zkontroluj kód a to, že PJ má appku právě otevřenou.`);
      } else if (chyba && chyba.type === "timeout") {
        nastavChybu("Připojování trvalo příliš dlouho. Kód byl nalezen, ale samotné spojení se nepodařilo navázat — obvykle to bývá přísná firewall/NAT na jedné ze sítí (často mobilní data). Zkuste to prosím oba na wifi, případně to zkuste znovu.");
      } else {
        nastavChybu("Připojení selhalo. Zkontroluj internetové připojení a zkus to znovu.");
      }
      oznamStrukturu();
    }
  }

  function prevezmiPostavu(postavaId) {
    S.mojePostavaId = postavaId;
    const p = S.postavy.find((x) => x.id === postavaId);
    if (p) {
      p.jmenoHrace = S.jmenoHrace;
      if (S.role === "pj") { S._vlastnikPostavy[postavaId] = "__pj__"; _ulozPostavuInterni(p); }
      else posliHostovi({ typ: "prevezmiPostavu", postavaId, jmenoHrace: S.jmenoHrace });
      zapamatujSiPostavu(postavaId);
    }
    jdiNa("stul");
  }

  // Appka si u HRÁČE (ne u PJ, ten má vlastní autoritativní stav) v tomto
  // prohlížeči pamatuje, kterou postavu si naposledy hrál v KTERÉM světě —
  // podle kódu stolu. Díky tomu appka při návratu do stejné hry rovnou pozná
  // a nabídne "jeho" postavu, místo aby ukazovala neutrální seznam jako
  // komukoli cizímu. Je to jen místní vodítko pro UI, ne zdroj pravdy —
  // ten zůstává vždy u PJ.
  function zapamatujSiPostavu(postavaId) {
    if (S.role === "pj" || !S.kod) return;
    try {
      const mapa = JSON.parse(localStorage.getItem("drd_moje_postavy") || "{}");
      mapa[S.kod] = postavaId;
      localStorage.setItem("drd_moje_postavy", JSON.stringify(mapa));
    } catch (e) {}
  }

  function zapamatovanaPostavaId() {
    if (!S.kod) return null;
    try {
      const mapa = JSON.parse(localStorage.getItem("drd_moje_postavy") || "{}");
      return mapa[S.kod] || null;
    } catch (e) { return null; }
  }

  function otevriStul() { jdiNa(S.role === "pj" ? "lobbyPJ" : "stul"); }

  // ---------- Obnovení uloženého světa / import ze souboru ----------

  async function pokracujVeSvete(balik) {
    S.nacitaSe = true; oznamStrukturu();
    zastavSit();

    const novyKod = M.novyKod();
    S.svet = Object.assign({}, balik.svet, { kod: novyKod, session: (balik.svet.session || 1) + 1 });
    S.mapy = balik.mapy || [];
    S.tokenyPodleMapy = balik.tokenyPodleMapy || {};
    S.postavy = balik.postavy || [];
    S.kronika = balik.kronika || [];
    S.role = "pj";
    S.kod = novyKod;
    S.mojePostavaId = null;
    S.jmenoHrace = S.svet.jmenoPJ || S.jmenoHrace;

    S.kronika.push({
      id: M.noveId(), autor: "Systém",
      text: `— Sezení ${S.svet.session} — příběh pokračuje. Nový kód stolu: ${novyKod}`,
      druh: "systemova", cas: Date.now(),
    });

    S._navratPoEditoru = "lobbyPJ";
    ulozAutosaveHned();
    await zapniHostovani();
    S.nacitaSe = false;
    jdiNa("lobbyPJ");
  }

  async function obnovZMistniKnihovny(id) {
    try {
      const data = localStorage.getItem("drd_data_" + id);
      if (!data) { nastavChybu("Uložená data tohoto světa se v prohlížeči nenašla (možná byla vymazána)."); return; }
      await pokracujVeSvete(JSON.parse(data));
    } catch (e) {
      nastavChybu("Svět se nepodařilo načíst: " + e.message);
    }
  }

  function stahniSvetDoSouboru() {
    if (!S.svet) { nastavChybu("Není co ukládat."); return; }
    const balik = { svet: S.svet, mapy: S.mapy, tokenyPodleMapy: S.tokenyPodleMapy, postavy: S.postavy, kronika: S.kronika };
    const soubor = { aplikace: "DrD Virtuální stůl", formatVerze: 2, ulozeno: new Date().toISOString(), data: balik };
    const blob = new Blob([JSON.stringify(soubor, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const bezpecnyNazev = (balik.svet.nazev || "svet").replace(/[\/:*?"<>|]/g, "-");
    a.href = url;
    a.download = `${bezpecnyNazev} – sezení ${balik.svet.session || 1}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pridejZpravu("Svět byl uložen do souboru.", "systemova", "Systém");
  }

  // Postava do vlastního souboru — nezávisle na světě, ať ji hráč (nebo PJ za
  // NPC) může znovu nahrát v jiné hře/kampani a nemusí tvořit postavu znovu.
  function stahniPostavuDoSouboru(postavaId) {
    const p = S.postavy.find((x) => x.id === postavaId);
    if (!p) { nastavChybu("Postavu se nepodařilo najít."); return; }
    const soubor = { aplikace: "DrD Virtuální stůl", druh: "postava", formatVerze: 1, ulozeno: new Date().toISOString(), postava: p };
    const blob = new Blob([JSON.stringify(soubor, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const bezpecnyNazev = (p.jmeno || "postava").replace(/[\/:*?"<>|]/g, "-");
    a.href = url;
    a.download = `postava – ${bezpecnyNazev}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function nactiPostavuZeSouboru(soubor, rezimKolize) {
    try {
      const text = await nactiSouborJakoText(soubor);
      const json = JSON.parse(text);
      const postava = json.postava;
      if (!postava || !postava.telo || !postava.duse || !postava.vliv) {
        nastavChybu("Soubor nemá platný formát postavy.");
        return null;
      }

      const existujici = S.postavy.find((p) => p.jmeno === postava.jmeno);
      if (existujici && !rezimKolize) {
        return { kolize: true, existujiciId: existujici.id, importovana: postava };
      }

      // "nahradit" přepíše hodnoty existující postavy (zachová její ID, takže
      // navazuje na existující token na mapě a vlastnictví); jinak vznikne
      // úplně nová postava s novým ID.
      let vysledna;
      if (rezimKolize === "nahradit" && existujici) {
        vysledna = Object.assign({}, existujici, postava, { id: existujici.id, jmenoHrace: S.jmenoHrace });
      } else {
        vysledna = Object.assign({}, postava, { id: M.noveId(), jmenoHrace: S.jmenoHrace });
      }
      await ulozPostavu(vysledna);
      return { kolize: false, postava: vysledna };
    } catch (e) {
      nastavChybu("Soubor s postavou se nepodařilo přečíst: " + e.message);
      return null;
    }
  }

  function nactiSouborJakoText(soubor) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(soubor);
    });
  }

  async function nactiSvetZeSouboru(soubor) {
    try {
      const text = await nactiSouborJakoText(soubor);
      const json = JSON.parse(text);
      const balik = json.data;
      if (!balik || !balik.svet) { nastavChybu("Soubor nemá platný formát světa."); return; }
      await pokracujVeSvete(balik);
    } catch (e) {
      nastavChybu("Soubor se nepodařilo přečíst: " + e.message);
    }
  }

  // ---------- Konec ----------

  function ukonciHru() {
    ulozAutosaveHned();
    zastavSit();
    S.svet = null; S.mapy = []; S.tokenyPodleMapy = {}; S.postavy = []; S.kronika = [];
    S.kod = null; S.mojePostavaId = null; S.stavSpojeni = "—";
    nactiMistniKnihovnu();
    jdiNa("menu");
  }

  nactiMistniKnihovnu();

  return {
    S, naStrukturalniZmenu, naDatovouZmenu, naDatovouZmenuDocasne, oznamStrukturu, oznamData,
    jdiNa, nastavChybu, zavriChybu,
    nactiMistniKnihovnu, ulozDoMistniKnihovny, odeberZMistniKnihovny,
    aktivniMapa, tokenyAktivniMapy, mojePostava,
    vytvorSvet, nastavTeren, odhalMlhu, odhalCelouMapu, zahalCelouMapu, pridejMapu, prepniMapu, vygenerujZnovu,
    pridejFigurku, smazFigurku, presunFigurku, upravFigurku, pozadejOPohyb,
    ulozPostavu, upravPostavu, zmenZdroj, vynutSynchronizaci, zapamatovanaPostavaId,
    pridejZpravu, hodKostkou, nastavPoznamkyPJ,
    pripojSe, prevezmiPostavu, otevriStul,
    stahniSvetDoSouboru, nactiSvetZeSouboru, pokracujVeSvete, obnovZMistniKnihovny,
    stahniPostavuDoSouboru, nactiPostavuZeSouboru,
    ukonciHru, zastavSit,
  };
})();
