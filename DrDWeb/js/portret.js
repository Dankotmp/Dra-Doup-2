// DrD.Portret — výběr vzhledu postavy z GALERIE hotových ilustrací (zakoupené
// na Etsy, licencované k použití v appce), ne procedurální kresba. Appka jen
// vybírá a skládá odkaz na obrázek — samotná ilustrace je statický soubor
// v img/hrdinove nebo img/netvori. Vzhled je čistě kosmetický.
window.DrD = window.DrD || {};

DrD.Portret = (function () {
  // ---------- Galerie hrdinů (pro hráčské postavy), podle rasy ----------
  // Appka nemá pro každou rasu z DrD II samostatnou vlastní ilustraci — proto
  // je pár klíčů galerie sdílených napříč rasami (typicky lidské/obecné
  // postavy se hodí pro Člověka i Trpaslíka apod.) a Elf/Hobit mají svoje
  // přesnější varianty tam, kde galerie skutečně elfí/malou postavu nabízí.
  const HRDINA_CESTA = "img/hrdinove/";
  const GALERIE_HRDINA = {
    clovek:   ["knight", "barbarian", "crusader", "monk", "witch_hunter", "seer", "mage"],
    elf:      ["elf_male", "elf_female"],
    trpaslik: ["dwarf"],
    hobit:    ["halfling", "gnome"],
    kroll:    ["barbarian", "crusader"],
  };
  const HRDINA_VSECHNY = ["barbarian", "crusader", "dwarf", "elf_female", "elf_male", "fairy", "gnome",
    "halfling", "knight", "mage", "monk", "seer", "shaman", "witch_hunter", "wizard"];

  // ---------- Galerie netvorů (pro PJ tokeny na mapě) ----------
  const NETVOR_CESTA = "img/netvori/";
  const GALERIE_NETVOR = ["dark_elf", "ghoul", "giant_troll", "goblin", "golem", "imp", "lich",
    "ogre", "orc", "troll", "undead", "vampire", "warlock", "witch"];

  const NAZVY = {
    knight: "Rytíř", barbarian: "Barbar", crusader: "Křižák", monk: "Mnich", witch_hunter: "Lovec čarodějnic",
    seer: "Věštkyně", mage: "Mág", elf_male: "Elf", elf_female: "Elfka", dwarf: "Trpaslík",
    halfling: "Půlčík", gnome: "Skřítek", fairy: "Víla", shaman: "Šaman", wizard: "Čaroděj",
    dark_elf: "Temný elf", ghoul: "Ghúl", giant_troll: "Obří troll", goblin: "Skřet", golem: "Golem",
    imp: "Zloduch", lich: "Lich", ogre: "Zlobr", orc: "Ork", troll: "Troll", undead: "Nemrtvý",
    vampire: "Upír", warlock: "Černokněžník", witch: "Čarodějnice",
  };

  function vyber(seznam, rnd) { return seznam[Math.floor(rnd() * seznam.length)]; }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Lehký nádech barvy přes ilustraci (pozadí rámečku) — jediná "randomizace"
  // navíc kromě výběru postavičky, ať i při stejné ilustraci mají různé
  // postavy alespoň jinak zbarvený rámeček/odznak.
  const RAMECEK_BARVY = ["#B3872E", "#8F211C", "#365433", "#5C4530", "#3E5C7A", "#6B4A7A"];

  function nahodnyPortret(rasaKlic) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    return sestavZeSeedu(seed, rasaKlic);
  }

  function sestavZeSeedu(seed, rasaKlic) {
    const rnd = mulberry32(seed);
    const rasa = GALERIE_HRDINA[rasaKlic] ? rasaKlic : "clovek";
    const klic = vyber(GALERIE_HRDINA[rasa] || HRDINA_VSECHNY, rnd);
    return {
      seed, rasa, klic,
      sada: "hrdina",
      ramecekBarva: vyber(RAMECEK_BARVY, rnd),
    };
  }

  // Reroll v RÁMCI stejné rasy — vybere jinou ilustraci z galerie té rasy
  // (pokud galerie pro danou rasu má víc než jednu možnost); jinak jen
  // přehodí barvu rámečku, ať tlačítko vždy udělá viditelnou změnu.
  function znovuVygenerovat(existujiciSeed, rasaKlic) {
    let novySeed;
    do { novySeed = Math.floor(Math.random() * 2 ** 31); } while (novySeed === existujiciSeed);
    return sestavZeSeedu(novySeed, rasaKlic);
  }

  // Portrét konkrétního netvora pro PJ (mimo postavy hráčů) — appka tohle
  // volá z PJ formuláře "Přidat na mapu" podle vybraného druhu z galerie.
  function netvorPortret(klic) {
    if (!NETVOR_CESTA) return null;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const rnd = mulberry32(seed);
    return { seed, klic, sada: "netvor", ramecekBarva: vyber(RAMECEK_BARVY, rnd) };
  }

  function cestaKObrazku(p) {
    if (!p || !p.klic) return null;
    return (p.sada === "netvor" ? NETVOR_CESTA : HRDINA_CESTA) + p.klic + ".png";
  }

  function nazevPostavy(p) {
    if (!p || !p.klic) return "";
    return NAZVY[p.klic] || p.klic;
  }

  // ---------- Veřejné vykreslení ----------
  // rezim "bysta": malý kulatý odznak (seznamy, tokeny) — ilustrace je
  // ořezaná do kruhu a přiblížená na horní (obličejovou) část.
  // rezim "postava" (výchozí): celá ilustrace v obdélníkovém rámu.

  function svgPortret(p, opts) {
    opts = opts || {};
    const ramecek = opts.ramecek !== false;
    const rezim = opts.rezim || "postava";
    const cesta = cestaKObrazku(p);
    if (!cesta) return "";
    const barva = (p && p.ramecekBarva) || "#B3872E";

    if (rezim === "bysta") {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <defs>
          <clipPath id="oriz-${p.seed}"><circle cx="100" cy="100" r="96"/></clipPath>
          <radialGradient id="pozadi-${p.seed}" cx="50%" cy="30%" r="80%">
            <stop offset="0%" stop-color="#F3E7C8"/><stop offset="100%" stop-color="#D8C296"/>
          </radialGradient>
        </defs>
        <g clip-path="url(#oriz-${p.seed})">
          <rect width="200" height="200" fill="url(#pozadi-${p.seed})"/>
          <image href="${esc(cesta)}" x="6" y="-24" width="188" height="235" preserveAspectRatio="xMidYMin slice"/>
        </g>
        ${ramecek ? `
          <circle cx="100" cy="100" r="96" fill="none" stroke="#3E0E0B" stroke-width="5" opacity="0.35"/>
          <circle cx="100" cy="100" r="93" fill="none" stroke="${barva}" stroke-width="6"/>
          <circle cx="100" cy="100" r="83" fill="none" stroke="#D4AA55" stroke-width="1.6" stroke-dasharray="3 6" opacity="0.6"/>` : ""}
      </svg>`;
    }

    const VW = 220, VH = 350;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}">
      <defs>
        <radialGradient id="pozadi-${p.seed}" cx="50%" cy="30%" r="80%">
          <stop offset="0%" stop-color="#F3E7C8"/><stop offset="100%" stop-color="#D8C296"/>
        </radialGradient>
      </defs>
      <rect width="${VW}" height="${VH}" fill="url(#pozadi-${p.seed})"/>
      <image href="${esc(cesta)}" x="10" y="14" width="${VW - 20}" height="${VH - 40}" preserveAspectRatio="xMidYMax meet"/>
      ${ramecek ? `
        <rect x="4" y="4" width="${VW - 8}" height="${VH - 8}" rx="10" fill="none" stroke="#3E0E0B" stroke-width="4" opacity="0.3"/>
        <rect x="8" y="8" width="${VW - 16}" height="${VH - 16}" rx="8" fill="none" stroke="${barva}" stroke-width="4"/>` : ""}
    </svg>`;
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

  function dataUrl(p, opts) {
    const svg = svgPortret(p, opts);
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  }

  // ---------- Cache obrázků pro canvas (mapa) ----------
  // Canvas potřebuje skutečný <img>, ne SVG string. Kruhové oříznutí na mapě
  // dělá samotný canvas (ctx.clip), takže sem jde přímo PNG ilustrace —
  // obalování do SVG/data-URI je zbytečné a u relativní cesty k obrázku
  // uvnitř data-URI navíc nespolehlivé (prohlížeč ji nemusí umět dohledat).

  const _cache = new Map();
  function obrazekPro(p, kdyzPripraven) {
    const cesta = cestaKObrazku(p);
    if (!cesta) return null;
    if (_cache.has(cesta)) return _cache.get(cesta);
    const img = new Image();
    img.src = cesta;
    _cache.set(cesta, img);
    if (kdyzPripraven) img.onload = kdyzPripraven;
    return img;
  }

  return {
    nahodnyPortret, znovuVygenerovat, svgPortret, dataUrl, obrazekPro,
    netvorPortret, cestaKObrazku, nazevPostavy,
    GALERIE_HRDINA, GALERIE_NETVOR, HRDINA_VSECHNY, NAZVY,
  };
})();
