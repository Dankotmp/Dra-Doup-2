// DrD.Ikony — malá sada ručně kreslených linkových SVG ikon (styl "inkoust
// na pergamenu"), která nahrazuje emoji v celém rozhraní appky. Ikony dědí
// barvu z CSS (stroke="currentColor"), takže sedí do jakéhokoli panelu.
window.DrD = window.DrD || {};

DrD.Ikony = (function () {
  const OBAL_START = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const OBAL_KONEC = '</svg>';

  const CESTY = {
    drak: '<path d="M3 15c2-5 5-8 9-9 1 3-1 5-3 6 3 0 6 1 8 4-3 0-5-1-7 0 2 1 3 3 3 5-2-1-4-3-5-5-1 2-1 4 0 6-2-1-4-4-4-7-2 1-3 3-3 5-1-2-1-4 0-6-2 0-4 0-6 1z"/>',
    svitek: '<path d="M6 4h9a2 2 0 0 1 2 2v13a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V4Z"/><path d="M6 4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2"/><path d="M9 9h6M9 13h6"/>',
    kostka: '<path d="M12 2 3 7v10l9 5 9-5V7Z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
    stit: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
    koruna: '<path d="M3 8l4 3 5-6 5 6 4-3-2 10H5Z"/><path d="M5 18h14"/>',
    mapa: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    klic: '<circle cx="7" cy="15" r="4"/><path d="m10 12 9-9M17 5l2 2M14 8l2 2"/>',
    batoh: '<path d="M8 8V6a4 4 0 0 1 8 0v2"/><path d="M6 8h12a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1Z"/><path d="M9 12h6M9 16h6"/>',
    postava: '<circle cx="12" cy="7" r="4"/><path d="M4 21c1.5-5 5-7 8-7s6.5 2 8 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    zpet: '<path d="M15 5 8 12l7 7"/>',
    lupaPlus: '<circle cx="10" cy="10" r="6"/><path d="m21 21-5.2-5.2M10 7v6M7 10h6"/>',
    lupaMinus: '<circle cx="10" cy="10" r="6"/><path d="m21 21-5.2-5.2M7 10h6"/>',
    ruka: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4"/><path d="M10 10V5a1.5 1.5 0 0 1 3 0v5"/><path d="M13 10V6a1.5 1.5 0 0 1 3 0v6"/><path d="M16 11V9a1.5 1.5 0 0 1 3 0v5c0 3.5-2 7-6.5 7C8 21 6 18 5 15.5L3.2 12A1.4 1.4 0 0 1 5.6 10.5L7 12.5"/>',
    stetec: '<path d="M15 4c2 0 4 2 4 4-3 1-5 3-6 6l-3-3c1-3 3-5 5-7Z"/><path d="M9 15c-1 1-1 3-3 4-1 .3-2 0-2-1 1-2 2-2 3-3"/>',
    oko: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    okoZavrene: '<path d="M3 12s4 6 9 6 9-6 9-6"/><path d="M3 12s4-6 9-6 9 6 9 6"/><path d="M4 4l16 16" stroke-width="2"/>',
    odeslat: '<path d="m3 12 18-8-8 18-2-8-8-2Z"/>',
    stahnout: '<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M5 19h14"/>',
    import: '<path d="M12 15V4m0 0-4 4m4-4 4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    kos: '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
    znovu: '<path d="M4 12a8 8 0 0 1 14-5.3M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3M4 20v-5h5"/>',
    sdilet: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
    kopie: '<rect x="9" y="9" width="12" height="12" rx="1.5"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    zavrit: '<path d="M6 6l12 12M18 6 6 18"/>',
    telo: '<circle cx="12" cy="6" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/>',
    duse: '<path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z"/>',
    vliv: '<path d="M4 13c0-4 3.5-9 8-9s8 5 8 9c-2 2-5 3-8 3s-6-1-8-3Z"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>',
    mince: '<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.3-2.5 1.8-2.5.8-2.5 1.8 1 1.8 2.5 1.8 2.5-.8 2.5-1.8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.5"/>',
    kniha: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z"/><path d="M4 5.5v16"/>',
    ohen: '<path d="M12 3c1 3-1 4-2 6-1.5 2.5 0 4 1 5-1-.5-2-1.5-2-3-2 2-2 5 0 7 4 2 8-1 8-5 0-3-2-4-3-6 0 1.5-1 2-2 2 1-2 1-4 0-6Z"/>',
    kladivo: '<path d="m14.5 9.5-8 8a1.5 1.5 0 0 1-2-2l8-8Z"/><path d="M13 4l7 7-2 2-7-7Z"/>',
    napoveda: '<path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-2.5 3"/><path d="M12 16.5v.1"/><circle cx="12" cy="12" r="9"/>',
    zamek: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    hrad: '<path d="M4 21V9l3-2 2 2 3-2 3 2 2-2 3 2v12Z"/><path d="M4 9h16"/><path d="M9 21v-6h6v6"/>',
  };

  function svg(nazev, trida) {
    const cesta = CESTY[nazev] || CESTY.info;
    return `${OBAL_START}${cesta}${OBAL_KONEC}`.replace("<svg ", `<svg class="ikona-svg ${trida || ""}" `);
  }

  return { svg, CESTY };
})();
