// DrD.Modely — herní modely podle Dračího doupěte II (základní příručka, ISBN 978-80-85979-73-2).
// Zjednodušeno pro potřeby virtuálního stolu — appka je nástroj k vedení hry, ne náhrada příručky.
window.DrD = window.DrD || {};

DrD.Modely = (function () {

  // ---------- Pomocné ----------

  function noveId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function novyKod() {
    const znaky = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let kod = "";
    for (let i = 0; i < 6; i++) kod += znaky[Math.floor(Math.random() * znaky.length)];
    return kod;
  }

  function hod(pocetStran) { return Math.floor(Math.random() * pocetStran) + 1; }
  function hodVice(pocet, stran) {
    const kostky = [];
    for (let i = 0; i < pocet; i++) kostky.push(hod(stran));
    return kostky;
  }

  function provedHod(pocet, stran, bonus, popis) {
    const kostky = hodVice(pocet, stran);
    const soucetKostek = kostky.reduce((a, b) => a + b, 0);
    const soucet = soucetKostek + (bonus || 0);
    let zapis = `${pocet}k${stran}`;
    if (bonus) zapis += (bonus > 0 ? "+" : "") + bonus;
    zapis += ` → [${kostky.join(", ")}]`;
    if (bonus) zapis += ` ${bonus > 0 ? "+" : ""}${bonus}`;
    zapis += ` = ${soucet}`;
    return { pocet, stran, bonus: bonus || 0, kostky, soucetKostek, soucet, popis, zapis, cas: Date.now() };
  }

  // Deterministické "náhodné" hodnoty odvozené ze seedu mapy + souřadnic —
  // díky tomu vypadá vygenerovaná mapa u všech hráčů úplně stejně, aniž by
  // appka musela posílat po síti každý detail kresby.
  function hashCisla(...cisla) {
    let h = 0x9E3779B9 >>> 0;
    for (const c of cisla) {
      h = Math.imul(h ^ (c | 0), 0x85EBCA6B);
      h = (h ^ (h >>> 13)) >>> 0;
    }
    h = Math.imul(h ^ (h >>> 16), 0x27D4EB2F);
    return (h ^ (h >>> 15)) >>> 0;
  }
  function nahodaZHashe(h) { return (h % 1000000) / 1000000; }
  function rngBunky(seed, x, y, sul) { return nahodaZHashe(hashCisla(seed, x, y, sul || 0)); }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Terén ----------
  // barva slouží jen jako podklad/nouzové vykreslení — skutečný vzhled maluje
  // DrD.MapaPlatno ručně-ilustrovaným stylem (viz ta komponenta).

  const TEREN = {
    trava:   { nazev: "Tráva",   barva: "#8CA861", pruchozi: true, zkratka: "TR" },
    les:     { nazev: "Les",     barva: "#3D6B42", pruchozi: true, zkratka: "LE" },
    hory:    { nazev: "Hory",    barva: "#80756B", pruchozi: false, zkratka: "HO" },
    voda:    { nazev: "Voda",    barva: "#4778A8", pruchozi: false, zkratka: "VO" },
    cesta:   { nazev: "Cesta",   barva: "#C2A878", pruchozi: true, zkratka: "CE" },
    dlazba:  { nazev: "Dlažba",  barva: "#B5A98C", pruchozi: true, zkratka: "DL" },
    pisek:   { nazev: "Písek",   barva: "#E0CF94", pruchozi: true, zkratka: "PI" },
    bazina:  { nazev: "Bažina",  barva: "#616B4D", pruchozi: true, zkratka: "BA" },
    zed:     { nazev: "Zeď",     barva: "#47403B", pruchozi: false, zkratka: "ZE" },
    strecha: { nazev: "Střecha (dům)", barva: "#8A4A38", pruchozi: false, zkratka: "ST" },
    podlaha: { nazev: "Podlaha", barva: "#A89C87", pruchozi: true, zkratka: "PO" },
    kamen:   { nazev: "Kámen",   barva: "#94918C", pruchozi: true, zkratka: "KA" },
    snih:    { nazev: "Sníh",    barva: "#E6EBF0", pruchozi: true, zkratka: "SN" },
    lava:    { nazev: "Láva",    barva: "#B83D1A", pruchozi: false, zkratka: "LA" },
  };
  const TEREN_KODY = Object.keys(TEREN);
  const TEREN_ZNAK_PRO_KOD = {};
  TEREN_KODY.forEach((k, i) => { TEREN_ZNAK_PRO_KOD[String.fromCharCode(97 + i)] = k; });
  function terenNaKod(klic) { const i = TEREN_KODY.indexOf(klic); return String.fromCharCode(97 + (i < 0 ? 0 : i)); }
  function kodNaTeren(znak) { return TEREN_ZNAK_PRO_KOD[znak] || "trava"; }

  // ---------- Mapa ----------

  function prazdnaMriz(sirka, vyska, klicTerenu) {
    return terenNaKod(klicTerenu || "trava").repeat(sirka * vyska);
  }

  function novaMapa(nazev, sirka, vyska, zaklad) {
    sirka = Math.max(4, Math.min(50, sirka));
    vyska = Math.max(4, Math.min(50, vyska));
    return {
      id: noveId(), nazev, sirka, vyska, typ: "prazdna",
      teren: prazdnaMriz(sirka, vyska, zaklad || "trava"),
      mlha: "1".repeat(sirka * vyska),
      pouzitMlhu: true,
      seed: Math.floor(Math.random() * 2 ** 31),
      poradi: Date.now(),
    };
  }

  function indexPole(mapa, x, y) { return y * mapa.sirka + x; }
  function terenNaPoli(mapa, x, y) {
    const i = indexPole(mapa, x, y);
    if (i < 0 || i >= mapa.teren.length) return "trava";
    return kodNaTeren(mapa.teren[i]);
  }
  function zahalenoNaPoli(mapa, x, y) {
    if (!mapa.pouzitMlhu) return false;
    const i = indexPole(mapa, x, y);
    if (i < 0 || i >= mapa.mlha.length) return false;
    return mapa.mlha[i] === "1";
  }
  function platnyBod(mapa, x, y) { return x >= 0 && y >= 0 && x < mapa.sirka && y < mapa.vyska; }

  function nastavTeren(mapa, x, y, klicTerenu) {
    if (!platnyBod(mapa, x, y)) return mapa.teren;
    const pole = mapa.teren.split("");
    pole[indexPole(mapa, x, y)] = terenNaKod(klicTerenu);
    return pole.join("");
  }

  function odhalOblast(mapa, cx, cy, polomer) {
    const pole = mapa.mlha.split("");
    for (let dy = -polomer; dy <= polomer; dy++) {
      for (let dx = -polomer; dx <= polomer; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!platnyBod(mapa, x, y)) continue;
        pole[indexPole(mapa, x, y)] = "0";
      }
    }
    return pole.join("");
  }

  // ---------- Procedurální generátor divočiny ----------
  // Vytvoří přírodní mapu s pohořím, lesy, řekou/jezerem a cestou — místo
  // prázdné plochy jednoho terénu. PJ pak může výsledek ručně domalovat.

  function vygenerujDivocinu(sirka, vyska, seed) {
    seed = seed || Math.floor(Math.random() * 2 ** 31);
    const rnd = mulberry32(seed);
    const n = sirka * vyska;
    const teren = new Array(n).fill("trava");
    const idx = (x, y) => y * sirka + x;
    const vBoxu = (x, y) => x >= 0 && y >= 0 && x < sirka && y < vyska;

    function sum2D(skala) {
      const gw = Math.ceil(sirka / skala) + 2, gh = Math.ceil(vyska / skala) + 2;
      const mrizka = [];
      for (let i = 0; i < gw * gh; i++) mrizka.push(rnd());
      return (x, y) => {
        const gx = x / skala, gy = y / skala;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const fx = gx - x0, fy = gy - y0;
        const g = (ix, iy) => mrizka[iy * gw + ix] || 0;
        const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
        const ab = a + (b - a) * fx, cd = c + (d - c) * fx;
        return ab + (cd - ab) * fy;
      };
    }
    const sumTerenu = sum2D(Math.max(3, Math.round(Math.min(sirka, vyska) / 4)));
    const sumLesa = sum2D(Math.max(2, Math.round(Math.min(sirka, vyska) / 6)));

    // základní krajina: pláně, jen řídké kamenité/písčité skvrny (ne celé oblasti)
    for (let y = 0; y < vyska; y++) {
      for (let x = 0; x < sirka; x++) {
        const v = sumTerenu(x, y);
        teren[idx(x, y)] = v > 0.82 ? "kamen" : (v < 0.1 ? "pisek" : "trava");
      }
    }

    const pocetPohori = 1 + (rnd() < 0.5 ? 1 : 0);
    for (let p = 0; p < pocetPohori; p++) {
      const zeStranyX = rnd() < 0.5;
      let x = zeStranyX ? (rnd() < 0.5 ? 0 : sirka - 1) : Math.floor(rnd() * sirka);
      let y = zeStranyX ? Math.floor(rnd() * vyska) : (rnd() < 0.5 ? 0 : vyska - 1);
      let smerX = zeStranyX ? (x === 0 ? 1 : -1) : (rnd() < 0.5 ? 1 : -1);
      let smerY = zeStranyX ? (rnd() < 0.5 ? 1 : -1) : (y === 0 ? 1 : -1);
      const delka = Math.round((sirka + vyska) * (0.4 + rnd() * 0.3));
      for (let k = 0; k < delka; k++) {
        teren[idx(x, y)] = "hory";
        if (rnd() < 0.5 && vBoxu(x + 1, y)) teren[idx(x + 1, y)] = "hory";
        if (rnd() < 0.5 && vBoxu(x - 1, y)) teren[idx(x - 1, y)] = "hory";
        if (rnd() < 0.5 && vBoxu(x, y + 1)) teren[idx(x, y + 1)] = "hory";
        if (rnd() < 0.5 && vBoxu(x, y - 1)) teren[idx(x, y - 1)] = "hory";
        // hřeben putuje hlavně jedním směrem (delší rovné úseky), jen občas uhne
        if (rnd() < 0.75) x += smerX; else y += smerY;
        if (rnd() < 0.12) smerX *= -1;
        if (rnd() < 0.12) smerY *= -1;
        if (!vBoxu(x, y)) break;
      }
    }

    for (let y = 0; y < vyska; y++) {
      for (let x = 0; x < sirka; x++) {
        if (teren[idx(x, y)] !== "trava") continue;
        if (sumLesa(x, y) > 0.56) teren[idx(x, y)] = "les";
      }
    }

    const horskeBody = [];
    for (let i = 0; i < n; i++) if (teren[i] === "hory") horskeBody.push(i);
    if (horskeBody.length && rnd() < 0.85) {
      let start = horskeBody[Math.floor(rnd() * horskeBody.length)];
      let x = start % sirka, y = Math.floor(start / sirka);
      const cilY = y < vyska / 2 ? vyska - 1 : 0;
      const smerY = cilY > y ? 1 : -1;
      let bezpecnost = sirka * vyska * 2;
      while (y !== cilY && bezpecnost-- > 0) {
        teren[idx(x, y)] = "voda";
        if (vBoxu(x + 1, y) && rnd() < 0.3) teren[idx(x + 1, y)] = "voda";
        if (vBoxu(x - 1, y) && rnd() < 0.3) teren[idx(x - 1, y)] = "voda";
        y += smerY;
        if (rnd() < 0.45) x += rnd() < 0.5 ? 1 : -1;
        x = Math.max(0, Math.min(sirka - 1, x));
      }
    }

    if (rnd() < 0.5) {
      const vodniBody = [];
      for (let i = 0; i < n; i++) if (teren[i] === "voda") vodniBody.push(i);
      if (vodniBody.length) {
        const stred = vodniBody[Math.floor(rnd() * vodniBody.length)];
        const cx = stred % sirka, cy = Math.floor(stred / sirka);
        const polomer = 1 + Math.floor(rnd() * 2);
        for (let dy = -polomer; dy <= polomer; dy++) {
          for (let dx = -polomer; dx <= polomer; dx++) {
            if (dx * dx + dy * dy > polomer * polomer) continue;
            const nx = cx + dx, ny = cy + dy;
            if (vBoxu(nx, ny) && teren[idx(nx, ny)] !== "hory") {
              teren[idx(nx, ny)] = rnd() < 0.6 ? "voda" : "bazina";
            }
          }
        }
      }
    }

    if (rnd() < 0.8) {
      let x = 0, y = Math.floor(vyska * (0.3 + rnd() * 0.4));
      while (x < sirka) {
        if (teren[idx(x, y)] !== "hory" && teren[idx(x, y)] !== "voda") teren[idx(x, y)] = "cesta";
        x += 1;
        if (rnd() < 0.4) y = Math.max(0, Math.min(vyska - 1, y + (rnd() < 0.5 ? 1 : -1)));
      }
    }

    return teren.map((k) => terenNaKod(k)).join("");
  }

  function novaDivocina(nazev, sirka, vyska) {
    const mapa = novaMapa(nazev, sirka, vyska, "trava");
    mapa.typ = "divocina";
    mapa.teren = vygenerujDivocinu(mapa.sirka, mapa.vyska, mapa.seed);
    return mapa;
  }

  // ---------- Procedurální generátor vesnice/města ----------
  // Cesty (dlažba) protínající mapu + rozestavěné domy (navenek vidět jako
  // střecha — po vstupu dovnitř dá PJ na propojenou mapu zeď/podlahu).

  function vygenerujVesnici(sirka, vyska, seed) {
    seed = seed || Math.floor(Math.random() * 2 ** 31);
    const rnd = mulberry32(seed);
    const teren = new Array(sirka * vyska).fill("trava");
    const idx = (x, y) => y * sirka + x;
    const vBoxu = (x, y) => x >= 0 && y >= 0 && x < sirka && y < vyska;

    // hlavní křižovatka cest
    const hlY = Math.floor(vyska * (0.35 + rnd() * 0.3));
    const hlX = Math.floor(sirka * (0.35 + rnd() * 0.3));
    for (let x = 0; x < sirka; x++) { teren[idx(x, hlY)] = "dlazba"; if (vBoxu(x, hlY + 1) && rnd() < 0.3) teren[idx(x, hlY + 1)] = "dlazba"; }
    for (let y = 0; y < vyska; y++) { teren[idx(hlX, y)] = "dlazba"; if (vBoxu(hlX + 1, y) && rnd() < 0.3) teren[idx(hlX + 1, y)] = "dlazba"; }
    // náves kolem křižovatky
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (vBoxu(hlX + dx, hlY + dy)) teren[idx(hlX + dx, hlY + dy)] = "dlazba";

    const obsazeno = (x0, y0, w, h) => {
      for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
        if (!vBoxu(x, y)) return true;
        if (teren[idx(x, y)] !== "trava") return true;
      }
      return false;
    };

    const pocetDomu = Math.max(4, Math.round((sirka * vyska) / 45));
    let pokusy = 0;
    let umisteno = 0;
    while (umisteno < pocetDomu && pokusy < pocetDomu * 25) {
      pokusy++;
      const w = 2 + Math.floor(rnd() * 3), h = 2 + Math.floor(rnd() * 3);
      const x0 = Math.floor(rnd() * sirka), y0 = Math.floor(rnd() * vyska);
      if (obsazeno(x0, y0, w, h)) continue;
      // musí být kousek u cesty, ať vesnice drží pohromadě
      let blizkoCesty = false;
      for (let y = Math.max(0, y0 - 2); y < Math.min(vyska, y0 + h + 2) && !blizkoCesty; y++) {
        for (let x = Math.max(0, x0 - 2); x < Math.min(sirka, x0 + w + 2); x++) {
          if (teren[idx(x, y)] === "dlazba") { blizkoCesty = true; break; }
        }
      }
      if (!blizkoCesty) continue;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) teren[idx(x, y)] = "strecha";
      umisteno++;
    }

    // trocha zeleně na okrajích
    for (let y = 0; y < vyska; y++) {
      for (let x = 0; x < sirka; x++) {
        if (teren[idx(x, y)] !== "trava") continue;
        if (rngBunky(seed, x, y, 77) > 0.85) teren[idx(x, y)] = "les";
      }
    }

    return teren.map((k) => terenNaKod(k)).join("");
  }

  function novaVesnice(nazev, sirka, vyska) {
    const mapa = novaMapa(nazev, sirka, vyska, "trava");
    mapa.typ = "vesnice";
    mapa.teren = vygenerujVesnici(mapa.sirka, mapa.vyska, mapa.seed);
    return mapa;
  }

  // ---------- Figurky ----------

  const DRUH_FIGURKY = {
    hrdina:  { nazev: "Hrdina",     barva: "#3B73BF" },
    netvor:  { nazev: "Netvor",     barva: "#A8291E" },
    npc:     { nazev: "Postava PJ", barva: "#598C51" },
    predmet: { nazev: "Předmět",    barva: "#B88C33" },
    past:    { nazev: "Past",       barva: "#733D8C" },
    vchod:   { nazev: "Vchod",      barva: "#5B4636" },
  };

  function novaFigurka(data) {
    return Object.assign({
      id: noveId(), nazev: "Nová figurka", x: 0, y: 0, druh: "netvor",
      zivotyAktualni: 4, zivotyMax: 4, patriPostave: null, skryta: false,
      poznamka: "", portret: null, odkazNaMapu: null,
    }, data);
  }

  // ---------- Rasy (Dračí doupě II: 5 hratelných ras) ----------

  const RASA = {
    clovek:   { nazev: "Člověk",   popis: "Nejpočetnější a nejpřizpůsobivější z ras — bez výrazných extrémů, doma skoro všude.",
                schopnostNavrh: "Přizpůsobivost — snadněji se učí novým věcem." },
    elf:      { nazev: "Elf",      popis: "Dlouhověký, půvabný a citlivý k magii i přírodě. Ve městech spíš host než doma.",
                schopnostNavrh: "Elfí zrak — vidí i za šera a na dálku." },
    trpaslik: { nazev: "Trpaslík", popis: "Houževnatý horník a řemeslník s kamennou tvrdohlavostí i výdrží.",
                schopnostNavrh: "Odolnost hor — hůř podléhá jedům a únavě." },
    hobit:    { nazev: "Hobit",    popis: "Malý, mrštný a nenápadný — mistr tichého kroku a klidného života.",
                schopnostNavrh: "Tichý krok — snáz se ukryje a přeslechne." },
    kroll:    { nazev: "Kroll",    popis: "Statný obr obrovské síly, kterému to naopak často nemyslí tak rychle.",
                schopnostNavrh: "Drtivá síla — v přímém střetu budí respekt." },
  };

  // ---------- Povolání (5 základních + 10 pokročilých, DrD II) ----------

  const POVOLANI_ZAKLADNI = {
    bojovnik:  { nazev: "Bojovník",  popis: "Síla a zbraně zblízka — první linie v každé šarvátce." },
    lovec:     { nazev: "Lovec",     popis: "Stopování, přežití v divočině, střelba a jednání se zvířaty." },
    kejklir:   { nazev: "Kejklíř",   popis: "Dítě ulice — mrštnost, triky, kapsářství, zapadne kamkoliv." },
    masticker: { nazev: "Mastičkář", popis: "Léčivé i jedovaté lektvary, byliny a mastičky vlastní výroby." },
    zarikavac: { nazev: "Zaříkávač", popis: "Prokletí a požehnání — vlivová a duševní magie." },
  };

  const POVOLANI_POKROCILA = {
    valecnik:   { nazev: "Válečník",   popis: "Bojovník + Kejklíř — bojovník s uličnickou mrštností a drzostí." },
    hranicar:   { nazev: "Hraničář",   popis: "Lovec + Bojovník — stopař a bojovník divočiny v jednom." },
    saman:      { nazev: "Šaman",      popis: "Lovec + Mastičkář — duchovní vůdce blízký přírodě i kmeni." },
    druid:      { nazev: "Druid",      popis: "Lovec + Zaříkávač — strážce divočiny s mocí nad přírodou." },
    lupic:      { nazev: "Lupič",      popis: "Kejklíř + Mastičkář — vykradač s trikem i jedovatou lstí." },
    zved:       { nazev: "Zvěd",       popis: "Kejklíř + Lovec — nenápadný průzkumník a stopař měst i lesů." },
    vedmak:     { nazev: "Vědmák",     popis: "Bojovník + Mastičkář — lovec nestvůr vyzbrojený jedy a čepelí." },
    alchymista: { nazev: "Alchymista", popis: "Mastičkář + Zaříkávač — tvůrce kouzelných substancí a předmětů." },
    mag:        { nazev: "Mág",        popis: "Zaříkávač + Kejklíř — iluze, triky a mazaná magie mysli." },
    carodej:    { nazev: "Čaroděj",    popis: "Bojovník + Zaříkávač — bojovník posilněný prokletími a kletbami." },
  };

  const POVOLANI = Object.assign({}, POVOLANI_ZAKLADNI, POVOLANI_POKROCILA);
  const POVOLANI_SKUPINY = [
    { nadpis: "Základní", klice: Object.keys(POVOLANI_ZAKLADNI) },
    { nadpis: "Pokročilá", klice: Object.keys(POVOLANI_POKROCILA) },
  ];

  // ---------- Postava (Tělo / Duše / Vliv, 15 bodů) ----------

  const SOUCET_BODU_VLASTNOSTI = 15;
  const MIN_HRANICE = 1;

  function novaPostava(jmenoHrace, jmeno, rasaKlic) {
    return {
      id: noveId(), jmenoHrace, jmeno, rasa: rasaKlic || "clovek",
      rasovaSchopnost: "", povahovyRys: "",
      telo: { hranice: 5, aktualni: 5 },
      duse: { hranice: 5, aktualni: 5 },
      vliv: { hranice: 5, aktualni: 5 },
      povolani: [],
      uroven: 1, volneZkusenosti: 0,
      zvlastniSchopnosti: "", bonusyPostihy: "",
      penize: { dukaty: 0, grose: 5, halere: 0 },
      vybaveni: [], nalozeni: "", poznamky: "",
      portret: (window.DrD && DrD.Portret) ? DrD.Portret.nahodnyPortret(rasaKlic || "clovek") : null,
      znak: "",
      aktualizovano: Date.now(),
    };
  }

  function nastavHranice(postava, telo, duse, vliv) {
    postava.telo.hranice = telo; postava.telo.aktualni = telo;
    postava.duse.hranice = duse; postava.duse.aktualni = duse;
    postava.vliv.hranice = vliv; postava.vliv.aktualni = vliv;
  }

  return {
    noveId, novyKod, hod, hodVice, provedHod, mulberry32, rngBunky, hashCisla,
    TEREN, TEREN_KODY, terenNaKod, kodNaTeren,
    novaMapa, novaDivocina, vygenerujDivocinu, novaVesnice, vygenerujVesnici, indexPole, terenNaPoli, zahalenoNaPoli, platnyBod, nastavTeren, odhalOblast,
    DRUH_FIGURKY, novaFigurka,
    RASA, POVOLANI, POVOLANI_ZAKLADNI, POVOLANI_POKROCILA, POVOLANI_SKUPINY,
    SOUCET_BODU_VLASTNOSTI, MIN_HRANICE,
    novaPostava, nastavHranice,
  };
})();
