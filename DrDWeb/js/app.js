// DrD.App — bootstrap: propojí Stav s obrazovkami a spustí první vykreslení.
window.DrD = window.DrD || {};

(function () {
  const St = DrD.Stav;
  const root = document.getElementById("app");

  const OBRAZOVKY = {
    menu: DrD.ObrazovkyPJ.menu,
    vytvoreniSveta: DrD.ObrazovkyPJ.tvorbaSveta,
    editorMapy: DrD.ObrazovkyPJ.editorMapy,
    lobbyPJ: DrD.ObrazovkyPJ.lobbyPJ,
    pripojeni: DrD.ObrazovkyHrac.pripojeni,
    vyberPostavy: DrD.ObrazovkyHrac.vyberPostavy,
    tvorbaPostavy: DrD.ObrazovkyHrac.tvorbaPostavy,
    stul: DrD.HerniStul.vykresli,
  };

  function vykresli() {
    const fn = OBRAZOVKY[St.S.obrazovka] || OBRAZOVKY.menu;
    fn(root);
    root.scrollTop = 0;
  }

  St.naStrukturalniZmenu(vykresli);
  vykresli();

  window.addEventListener("beforeunload", () => {
    // Slušně ukončit P2P spojení při zavření záložky (hráče to rovnou odpojí,
    // místo aby čekali na timeout).
    St.zastavSit();
  });
})();
