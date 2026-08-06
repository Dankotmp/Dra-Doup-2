// Service worker pro Dračí doupě — Virtuální stůl.
// Cachuje jen statickou appku (HTML/CSS/JS/ikony), aby appka naskočila okamžitě
// i při slabém signálu a šla otevřít i offline. Samotné P2P spojení (PeerJS)
// tímto cache neprochází — jde vždy napřímo přes síť.

const CACHE = "drd-stul-v9";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./dokumenty/rychla-pravidla.pdf",
  "./css/styl.css",
  "./js/util.js",
  "./js/modely.js",
  "./js/portret.js",
  "./js/ikony.js",
  "./js/peer-sit.js",
  "./js/mapa-platno.js",
  "./js/ui-spolecne.js",
  "./js/stav.js",
  "./js/obrazovky-pj.js",
  "./js/obrazovky-hrac.js",
  "./js/herni-stul.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./img/hrdinove/barbarian.png",
  "./img/hrdinove/crusader.png",
  "./img/hrdinove/dwarf.png",
  "./img/hrdinove/elf_female.png",
  "./img/hrdinove/elf_male.png",
  "./img/hrdinove/fairy.png",
  "./img/hrdinove/gnome.png",
  "./img/hrdinove/halfling.png",
  "./img/hrdinove/knight.png",
  "./img/hrdinove/mage.png",
  "./img/hrdinove/monk.png",
  "./img/hrdinove/seer.png",
  "./img/hrdinove/shaman.png",
  "./img/hrdinove/witch_hunter.png",
  "./img/hrdinove/wizard.png",
  "./img/netvori/dark_elf.png",
  "./img/netvori/ghoul.png",
  "./img/netvori/giant_troll.png",
  "./img/netvori/goblin.png",
  "./img/netvori/golem.png",
  "./img/netvori/imp.png",
  "./img/netvori/lich.png",
  "./img/netvori/ogre.png",
  "./img/netvori/orc.png",
  "./img/netvori/troll.png",
  "./img/netvori/undead.png",
  "./img/netvori/vampire.png",
  "./img/netvori/warlock.png",
  "./img/netvori/witch.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((klice) => Promise.all(klice.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cizí domény (PeerJS broker, Google fonty…) necháváme jít vždy přímo na síť.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((zCache) => {
      const zeSite = fetch(event.request)
        .then((odpoved) => {
          if (odpoved && odpoved.ok) {
            const kopie = odpoved.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, kopie));
          }
          return odpoved;
        })
        .catch(() => zCache);
      return zCache || zeSite;
    })
  );
});
