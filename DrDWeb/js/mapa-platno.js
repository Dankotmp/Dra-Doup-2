// DrD.MapaPlatno — canvas komponenta mapy. Terén se kreslí jako ručně ilustrovaná
// textura (šrafované hory, chomáče lesa, vlnky na vodě…), ne jako mřížka emoji.
// Vzhled je deterministický podle mapa.seed, takže vypadá stejně u všech hráčů.
window.DrD = window.DrD || {};

DrD.MapaPlatno = class MapaPlatno {
  constructor(kontejner) {
    this.kontejner = kontejner;
    this.kontejner.innerHTML = "";

    this.obalScroll = document.createElement("div");
    this.obalScroll.className = "mapa-scroll";

    this.platno = document.createElement("canvas");
    this.obalScroll.appendChild(this.platno);
    this.kontejner.appendChild(this.obalScroll);

    this.bunka = 30;
    this.mapa = null;
    this.tokeny = [];
    this.jePJ = false;
    this.rezim = "vyber";
    this.vybranaFigurkaId = null;
    this.onPolicko = null;

    this._malujeSe = false;
    this._naposledy = null;
    this._napojGesta();
  }

  zoom(delta) {
    this.bunka = Math.max(10, Math.min(64, this.bunka + delta));
    this._prekresli();
  }

  aktualizuj(opts) {
    this.mapa = opts.mapa;
    this.tokeny = opts.tokeny || [];
    this.jePJ = !!opts.jePJ;
    this.rezim = opts.rezim || "vyber";
    this.vybranaFigurkaId = opts.vybranaFigurkaId || null;
    this.onPolicko = opts.onPolicko || null;
    this.obalScroll.style.overflow = this.rezim === "kresleni" ? "hidden" : "auto";
    this._prekresli();
  }

  _bodZUdalosti(e) {
    const rect = this.platno.getBoundingClientRect();
    const bodX = (e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX)) - rect.left;
    const bodY = (e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY)) - rect.top;
    return { x: Math.floor(bodX / this.bunka), y: Math.floor(bodY / this.bunka) };
  }

  _napojGesta() {
    this.platno.addEventListener("pointerdown", (e) => {
      if (!this.mapa || this.rezim !== "kresleni") return;
      this._malujeSe = true;
      this.platno.setPointerCapture(e.pointerId);
      const b = this._bodZUdalosti(e);
      if (DrD.Modely.platnyBod(this.mapa, b.x, b.y)) { this._naposledy = b.x + "," + b.y; this.onPolicko && this.onPolicko(b); }
    });
    this.platno.addEventListener("pointermove", (e) => {
      if (!this._malujeSe || !this.mapa) return;
      const b = this._bodZUdalosti(e);
      if (!DrD.Modely.platnyBod(this.mapa, b.x, b.y)) return;
      const klic = b.x + "," + b.y;
      if (klic !== this._naposledy) { this._naposledy = klic; this.onPolicko && this.onPolicko(b); }
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((typ) => {
      this.platno.addEventListener(typ, () => { this._malujeSe = false; this._naposledy = null; });
    });
    this.platno.addEventListener("click", (e) => {
      if (!this.mapa || this.rezim === "kresleni") return;
      const b = this._bodZUdalosti(e);
      if (DrD.Modely.platnyBod(this.mapa, b.x, b.y)) this.onPolicko && this.onPolicko(b);
    });
  }

  // ---------- Vykreslení ----------

  _prekresli() {
    if (!this.mapa) return;
    const M = DrD.Modely;
    const mapa = this.mapa;
    const sirkaPx = mapa.sirka * this.bunka;
    const vyskaPx = mapa.vyska * this.bunka;
    const dpr = window.devicePixelRatio || 1;

    this.platno.style.width = sirkaPx + "px";
    this.platno.style.height = vyskaPx + "px";
    this.platno.width = Math.round(sirkaPx * dpr);
    this.platno.height = Math.round(vyskaPx * dpr);

    const ctx = this.platno.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sirkaPx, vyskaPx);

    const b = this.bunka;
    const seed = mapa.seed || 1;

    if (mapa.obrazek) {
      this._kresliObrazekMapy(ctx, M, mapa, b, sirkaPx, vyskaPx);
    } else {
      // Podmalba (pergamen + měkký barevný nádech) se maluje na pomocné
      // plátno a pak se vykreslí RO ROZMAZANĚ — akvarelový efekt, který
      // rozbije ostré hranice mřížky. Inkoustová textura jde navrch ostrá.
      if (!this._offscreen) this._offscreen = document.createElement("canvas");
      this._offscreen.width = this.platno.width;
      this._offscreen.height = this.platno.height;
      const octx = this._offscreen.getContext("2d");
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this._kresliPergamenovyPodklad(octx, M, seed, sirkaPx, vyskaPx);
      for (let y = 0; y < mapa.vyska; y++) {
        for (let x = 0; x < mapa.sirka; x++) {
          if (M.zahalenoNaPoli(mapa, x, y) && !this.jePJ) continue;
          this._nadechBunky(octx, M, mapa, x, y, b, seed);
        }
      }

      ctx.save();
      ctx.filter = `blur(${Math.max(1.5, b * 0.14)}px)`;
      ctx.drawImage(this._offscreen, 0, 0, sirkaPx, vyskaPx);
      ctx.restore();

      for (let y = 0; y < mapa.vyska; y++) {
        for (let x = 0; x < mapa.sirka; x++) {
          if (M.zahalenoNaPoli(mapa, x, y) && !this.jePJ) continue;
          this._kresliBunku(ctx, M, mapa, x, y, b, seed);
        }
      }
    }

    this._kresliMlhu(ctx, M, mapa, b);
    this._kresliMrizku(ctx, mapa, b, sirkaPx, vyskaPx);
    this._kresliFigurky(ctx, M, b);
  }

  // Vlastní nahraná mapa (PNG/JPG): obrázek jako podklad + tenký překryv
  // jen na políčkách, která PJ ručně obarvil štětcem (např. zeď pro kolize).
  _kresliObrazekMapy(ctx, M, mapa, b, sirkaPx, vyskaPx) {
    if (!this._cacheObrazku || this._cacheObrazku.src !== mapa.obrazek) {
      const img = new Image();
      img.onload = () => this._prekresli();
      img.src = mapa.obrazek;
      this._cacheObrazku = img;
    }
    const img = this._cacheObrazku;
    if (img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, sirkaPx, vyskaPx);
    else { ctx.fillStyle = "#D8C79E"; ctx.fillRect(0, 0, sirkaPx, vyskaPx); }

    // Překryv pro KAŽDÉ ručně domalované políčko (cokoli jiného než výchozí
    // "trava" — tou appka mlčky značí "nedotčeno, jen podkladový obrázek").
    // Barva se bere přímo z terénu, takže sedí štětec s paletou i nová "trava".
    ctx.save();
    for (let y = 0; y < mapa.vyska; y++) {
      for (let x = 0; x < mapa.sirka; x++) {
        if (M.zahalenoNaPoli(mapa, x, y) && !this.jePJ) continue;
        const klic = M.terenNaPoli(mapa, x, y);
        if (klic === "trava") continue;
        ctx.fillStyle = M.TEREN[klic] ? M.TEREN[klic].barva : "#8CA861";
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x * b, y * b, b, b);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(20,15,10,0.35)"; ctx.lineWidth = 1;
        ctx.strokeRect(x * b + 0.5, y * b + 0.5, b - 1, b - 1);
      }
    }
    ctx.restore();
  }

  _kresliPergamenovyPodklad(ctx, M, seed, w, h) {
    ctx.fillStyle = "#D8C79E";
    ctx.fillRect(0, 0, w, h);
    const skvrn = Math.max(14, Math.round((w * h) / 9000));
    for (let i = 0; i < skvrn; i++) {
      const r1 = M.rngBunky(seed, i, 501, 1), r2 = M.rngBunky(seed, i, 502, 2), r3 = M.rngBunky(seed, i, 503, 3);
      const cx = r1 * w, cy = r2 * h, rad = 40 + r3 * 110;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const tmava = M.rngBunky(seed, i, 504, 4) > 0.5;
      grad.addColorStop(0, tmava ? "rgba(120,95,55,0.10)" : "rgba(235,215,165,0.16)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Měkký, mírně přetažený barevný nádech buňky (zaobleně, s přesahem přes
  // okraj) — sousední stejný terén díky přesahu vizuálně splyne do plochy.
  _nadechBunky(ctx, M, mapa, x, y, b, seed) {
    const klic = M.terenNaPoli(mapa, x, y);
    const barvy = {
      trava: "rgba(140,150,85,0.16)", les: "rgba(70,95,55,0.30)", hory: "rgba(95,80,65,0.22)",
      voda: "rgba(95,120,120,0.28)", cesta: "rgba(160,120,70,0.16)", pisek: "rgba(190,160,95,0.20)",
      bazina: "rgba(75,80,50,0.28)", zed: "rgba(50,40,32,0.55)", podlaha: "rgba(150,130,100,0.20)",
      kamen: "rgba(110,100,90,0.18)", snih: "rgba(225,230,225,0.35)", lava: "rgba(180,70,20,0.45)",
    };
    const barva = barvy[klic] || barvy.trava;
    const px = x * b + b / 2, py = y * b + b / 2;
    const r1 = M.rngBunky(seed, x, y, 9);
    ctx.fillStyle = barva;
    ctx.beginPath();
    ctx.ellipse(px, py, b * (0.68 + r1 * 0.14), b * (0.68 + r1 * 0.14), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _kresliBunku(ctx, M, mapa, x, y, b, seed) {
    const klic = M.terenNaPoli(mapa, x, y);
    const px = x * b, py = y * b;
    const r1 = M.rngBunky(seed, x, y, 1), r2 = M.rngBunky(seed, x, y, 2), r3 = M.rngBunky(seed, x, y, 3);

    ctx.save();
    ctx.beginPath();
    ctx.rect(px - 0.5, py - 0.5, b + 1, b + 1);
    ctx.clip();

    switch (klic) {
      case "les": this._kresliLes(ctx, px, py, b, r1, r2, r3); break;
      case "hory": this._kresliHory(ctx, M, mapa, x, y, px, py, b, seed); break;
      case "voda": this._kresliVodu(ctx, px, py, b, r1, r2); break;
      case "bazina": this._kresliBazinu(ctx, px, py, b, r1, r2); break;
      case "snih": this._kresliSnih(ctx, px, py, b, r1, r2); break;
      case "pisek": this._kresliPisek(ctx, px, py, b, r1, r2); break;
      case "cesta": this._kresliCestu(ctx, px, py, b, r1, r2); break;
      case "zed": this._kresliZed(ctx, px, py, b); break;
      case "podlaha": this._kresliPodlahu(ctx, px, py, b, r1); break;
      case "kamen": this._kresliKamen(ctx, px, py, b, r1, r2); break;
      case "lava": this._kresliLavu(ctx, px, py, b, r1, r2); break;
      case "dlazba": this._kresliDlazbu(ctx, px, py, b, r1, r2); break;
      case "strecha": this._kresliStrechu(ctx, px, py, b, r1, r2); break;
      default: this._kresliTravu(ctx, px, py, b, r1, r2, r3); break;
    }
    ctx.restore();
  }

  _kresliTravu(ctx, px, py, b, r1, r2, r3) {
    if (r1 > 0.8) {
      ctx.strokeStyle = "rgba(75,70,40,0.35)"; ctx.lineWidth = Math.max(0.5, b * 0.03);
      const cx = px + b * (0.25 + 0.5 * r2);
      const cy = py + b * (0.4 + 0.4 * r3);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + b * 0.04, cy - b * 0.13, cx + b * 0.015, cy - b * 0.22);
      ctx.stroke();
    }
  }

  _kresliLes(ctx, px, py, b, r1, r2, r3) {
    const pocet = 5 + Math.floor(r1 * 5);
    for (let i = 0; i < pocet; i++) {
      const rr = DrD.Modely.rngBunky(Math.round(r2 * 99991), i, 11, 22);
      const rr2 = DrD.Modely.rngBunky(Math.round(r3 * 99991), i, 33, 44);
      const cx = px + b * (0.1 + rr * 0.8);
      const cy = py + b * (0.1 + rr2 * 0.8);
      const rad = b * (0.05 + rr * 0.045);
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(40,50,25,0.55)"; ctx.fill();
      ctx.lineWidth = Math.max(0.5, b * 0.02); ctx.strokeStyle = "rgba(30,35,18,0.5)"; ctx.stroke();
    }
  }

  // Hory: shluk malých obrysových vrcholků (jako na staré mapě) + šrafování
  // na stinné straně — čte se to jako silueta štítů, ne jako náhodné škrábance.
  _kresliHory(ctx, M, mapa, x, y, px, py, b, seed) {
    const pocet = 2 + Math.floor(M.rngBunky(seed, x, y, 61) * 2);
    for (let i = 0; i < pocet; i++) {
      const r1 = M.rngBunky(seed, x, y, 100 + i * 5);
      const r2 = M.rngBunky(seed, x, y, 200 + i * 5);
      const r3 = M.rngBunky(seed, x, y, 300 + i * 5);
      const cx = px + b * (0.2 + r1 * 0.6);
      const cyZaklad = py + b * (0.62 + r2 * 0.24);
      const sirka = b * (0.34 + r3 * 0.24);
      const vyska = b * (0.42 + r2 * 0.3);

      ctx.beginPath();
      ctx.moveTo(cx - sirka / 2, cyZaklad);
      ctx.lineTo(cx - sirka * 0.08, cyZaklad - vyska);
      ctx.lineTo(cx + sirka / 2, cyZaklad);
      ctx.strokeStyle = "rgba(45,35,25,0.8)";
      ctx.lineWidth = Math.max(0.7, b * 0.028);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.stroke();
      ctx.fillStyle = "rgba(70,60,48,0.16)";
      ctx.fill();

      // šrafy na stinné (pravé) straně vrcholu
      ctx.strokeStyle = "rgba(45,35,25,0.55)";
      ctx.lineWidth = Math.max(0.5, b * 0.016);
      const sHrafu = 3;
      for (let s = 1; s <= sHrafu; s++) {
        const t = s / (sHrafu + 1);
        const hx = cx - sirka * 0.08 + (sirka * 0.5 - sirka * 0.08) * t;
        const hy = cyZaklad - vyska * (1 - t);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + sirka * 0.09, hy + b * 0.05);
        ctx.stroke();
      }
      // sněhový/světlý vrchol
      if (M.rngBunky(seed, x, y, 70 + i) > 0.4) {
        ctx.strokeStyle = "rgba(235,225,205,0.65)";
        ctx.lineWidth = Math.max(0.6, b * 0.022);
        ctx.beginPath();
        ctx.moveTo(cx - sirka * 0.14, cyZaklad - vyska * 0.72);
        ctx.lineTo(cx - sirka * 0.08, cyZaklad - vyska);
        ctx.lineTo(cx + sirka * 0.02, cyZaklad - vyska * 0.7);
        ctx.stroke();
      }
    }
  }

  _kresliVodu(ctx, px, py, b, r1, r2) {
    ctx.strokeStyle = "rgba(60,70,65,0.55)"; ctx.lineWidth = Math.max(0.6, b * 0.035);
    const n = 1 + Math.floor(r1 * 2);
    for (let i = 0; i < n; i++) {
      const yy = py + b * (0.25 + 0.5 * DrD.Modely.rngBunky(9, i, Math.round(r2 * 999), 12));
      ctx.beginPath();
      ctx.moveTo(px + b * 0.12, yy);
      ctx.quadraticCurveTo(px + b * 0.5, yy - b * 0.1, px + b * 0.88, yy);
      ctx.stroke();
    }
  }

  _kresliBazinu(ctx, px, py, b, r1, r2) {
    ctx.strokeStyle = "rgba(40,38,20,0.5)"; ctx.lineWidth = Math.max(0.6, b * 0.03);
    const n = 2 + Math.floor(r1 * 2);
    for (let i = 0; i < n; i++) {
      const cx = px + b * (0.2 + 0.6 * DrD.Modely.rngBunky(15, i, Math.round(r2 * 999), 3));
      const cy = py + b * (0.5 + 0.4 * DrD.Modely.rngBunky(16, i, Math.round(r1 * 999), 4));
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - b * 0.03, cy - b * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + b * 0.05, cy); ctx.lineTo(cx + b * 0.08, cy - b * 0.16); ctx.stroke();
    }
  }

  _kresliSnih(ctx, px, py, b, r1, r2) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    const n = 2 + Math.floor(r2 * 3);
    for (let i = 0; i < n; i++) {
      const cx = px + b * DrD.Modely.rngBunky(21, i, Math.round(r1 * 999), 1);
      const cy = py + b * DrD.Modely.rngBunky(22, i, Math.round(r2 * 999), 2);
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, b * 0.02), 0, Math.PI * 2); ctx.fill();
    }
  }

  _kresliPisek(ctx, px, py, b, r1, r2) {
    ctx.fillStyle = "rgba(120,95,55,0.35)";
    const n = 4 + Math.floor(r1 * 5);
    for (let i = 0; i < n; i++) {
      const cx = px + b * DrD.Modely.rngBunky(31, i, Math.round(r1 * 999), 1);
      const cy = py + b * DrD.Modely.rngBunky(32, i, Math.round(r2 * 999), 2);
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.4, b * 0.014), 0, Math.PI * 2); ctx.fill();
    }
  }

  _kresliCestu(ctx, px, py, b, r1, r2) {
    ctx.strokeStyle = "rgba(90,65,35,0.4)"; ctx.lineWidth = Math.max(0.6, b * 0.05);
    ctx.setLineDash([b * 0.12, b * 0.1]);
    ctx.beginPath(); ctx.moveTo(px, py + b * 0.5); ctx.lineTo(px + b, py + b * 0.5); ctx.stroke();
    ctx.setLineDash([]);
  }

  _kresliDlazbu(ctx, px, py, b, r1, r2) {
    ctx.strokeStyle = "rgba(70,60,45,0.5)"; ctx.lineWidth = Math.max(0.5, b * 0.025);
    ctx.strokeRect(px + b * 0.08, py + b * 0.08, b * 0.4, b * 0.4);
    ctx.strokeRect(px + b * 0.52, py + b * 0.08, b * 0.4, b * 0.4);
    ctx.strokeRect(px + b * 0.08, py + b * 0.52, b * 0.4, b * 0.4);
    ctx.strokeRect(px + b * 0.52, py + b * 0.52, b * 0.4, b * 0.4);
  }

  _kresliZed(ctx, px, py, b) {
    ctx.fillStyle = "rgba(45,36,28,0.75)"; ctx.fillRect(px, py, b, b);
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, b - 2, b - 2);
    ctx.beginPath(); ctx.moveTo(px, py + b / 2); ctx.lineTo(px + b, py + b / 2); ctx.stroke();
  }

  _kresliStrechu(ctx, px, py, b, r1, r2) {
    ctx.fillStyle = "rgba(110,55,40,0.55)"; ctx.fillRect(px, py, b, b);
    ctx.strokeStyle = "rgba(60,25,18,0.6)"; ctx.lineWidth = Math.max(0.6, b * 0.03);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + b, py + b); ctx.moveTo(px + b, py); ctx.lineTo(px, py + b); ctx.stroke();
  }

  _kresliPodlahu(ctx, px, py, b, r1) {
    ctx.strokeStyle = "rgba(90,75,55,0.3)"; ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, b - 1, b - 1);
  }

  _kresliKamen(ctx, px, py, b, r1, r2) {
    ctx.strokeStyle = "rgba(60,50,40,0.4)"; ctx.lineWidth = Math.max(0.5, b * 0.02);
    const n = 2 + Math.floor(r1 * 3);
    for (let i = 0; i < n; i++) {
      const cx = px + b * DrD.Modely.rngBunky(51, i, Math.round(r1 * 999), 1);
      const cy = py + b * DrD.Modely.rngBunky(52, i, Math.round(r2 * 999), 2);
      ctx.beginPath(); ctx.arc(cx, cy, b * 0.06, 0, Math.PI * 2); ctx.stroke();
    }
  }

  _kresliLavu(ctx, px, py, b, r1, r2) {
    ctx.strokeStyle = "rgba(40,15,8,0.6)"; ctx.lineWidth = Math.max(0.6, b * 0.035);
    ctx.beginPath();
    ctx.moveTo(px + b * 0.15, py + b * 0.2);
    ctx.lineTo(px + b * 0.5, py + b * 0.55);
    ctx.lineTo(px + b * 0.3, py + b * 0.85);
    ctx.stroke();
  }

  _kresliMlhu(ctx, M, mapa, b) {
    if (!mapa.pouzitMlhu) return;
    ctx.save();
    for (let y = 0; y < mapa.vyska; y++) {
      for (let x = 0; x < mapa.sirka; x++) {
        const zahaleno = M.zahalenoNaPoli(mapa, x, y);
        if (!zahaleno) continue;
        const px = x * b, py = y * b;
        if (this.jePJ) {
          ctx.fillStyle = "rgba(20,16,12,0.55)";
          ctx.fillRect(px - 0.5, py - 0.5, b + 1, b + 1);
        } else {
          ctx.fillStyle = "#1b1712";
          ctx.fillRect(px - 0.5, py - 0.5, b + 1, b + 1);
        }
      }
    }
    ctx.restore();
  }

  _kresliMrizku(ctx, mapa, b, sirkaPx, vyskaPx) {
    ctx.strokeStyle = "rgba(41,28,18,0.045)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let x = 0; x <= mapa.sirka; x++) { ctx.moveTo(x * b, 0); ctx.lineTo(x * b, vyskaPx); }
    for (let y = 0; y <= mapa.vyska; y++) { ctx.moveTo(0, y * b); ctx.lineTo(sirkaPx, y * b); }
    ctx.stroke();
  }

  // ---------- Figurky ----------

  _kresliFigurky(ctx, M, b) {
    for (const f of this.tokeny) {
      if (f.skryta && !this.jePJ) continue;
      if (M.zahalenoNaPoli(this.mapa, f.x, f.y) && !this.jePJ) continue;
      const cx = f.x * b + b / 2, cy = f.y * b + b / 2, r = b * 0.42;
      const vybrana = f.id === this.vybranaFigurkaId;

      ctx.save();
      ctx.globalAlpha = f.skryta ? 0.45 : 1;

      if (f.druh === "hrdina" && f.portret && DrD.Portret) {
        const img = DrD.Portret.obrazekPro(f.portret, () => this._prekresli());
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        if (img && img.complete && img.naturalWidth) {
          // Ilustrace je celá postava od hlavy k patě — na malém tokenu
          // chceme jen horní (obličejovou) část, ne celou zmenšenou postavu.
          const sw = img.naturalWidth, sh = img.naturalHeight;
          const vyrezH = sh * 0.32; // horní část (hlava + kousek ramen)
          const meritko = (r * 2.3) / sw;
          const cilH = vyrezH * meritko;
          ctx.drawImage(img, 0, 0, sw, vyrezH, cx - r * 1.15, cy - cilH * 0.62, r * 2.3, cilH);
        } else {
          ctx.fillStyle = DrD.Modely.DRUH_FIGURKY.hrdina.barva; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
        ctx.restore();
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = vybrana ? 3 : 1.4;
        ctx.strokeStyle = vybrana ? "#B3872E" : "#2A1D12";
        ctx.stroke();
      } else if (f.druh !== "hrdina" && f.portret && DrD.Portret) {
        // netvor/npc s vybranou ilustrací z galerie (viz PJ formulář)
        const img = DrD.Portret.obrazekPro(f.portret, () => this._prekresli());
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        if (img && img.complete && img.naturalWidth) {
          const sw = img.naturalWidth, sh = img.naturalHeight;
          const vyrezH = sh * 0.38;
          const meritko = (r * 2.3) / sw;
          const cilH = vyrezH * meritko;
          ctx.drawImage(img, 0, 0, sw, vyrezH, cx - r * 1.15, cy - cilH * 0.58, r * 2.3, cilH);
        } else {
          this._kresliZnacku(ctx, f.druh, cx, cy, r, vybrana);
        }
        ctx.restore();
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = vybrana ? 3 : 1.4;
        ctx.strokeStyle = vybrana ? "#B3872E" : "#2A1D12";
        ctx.stroke();
      } else {
        this._kresliZnacku(ctx, f.druh, cx, cy, r, vybrana);
      }

      if (f.zivotyMax > 0 && b > 12) {
        const podil = Math.max(0, Math.min(1, f.zivotyAktualni / f.zivotyMax));
        const sirkaBar = b * 0.8;
        const bx = cx - sirkaBar / 2, by = cy + r + 2;
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(bx, by, sirkaBar, 3);
        ctx.fillStyle = podil > 0.5 ? "#3D7A3A" : (podil > 0.25 ? "#C9A227" : "#A8291E");
        ctx.fillRect(bx, by, sirkaBar * podil, 3);
      }
      ctx.restore();
    }
  }

  _kresliZnacku(ctx, druh, cx, cy, r, vybrana) {
    const barva = (DrD.Modely.DRUH_FIGURKY[druh] || DrD.Modely.DRUH_FIGURKY.netvor).barva;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx + r, cy - r, cx + r, cy);
    ctx.quadraticCurveTo(cx + r, cy + r * 0.9, cx, cy + r);
    ctx.quadraticCurveTo(cx - r, cy + r * 0.9, cx - r, cy);
    ctx.quadraticCurveTo(cx - r, cy - r, cx, cy - r);
    ctx.closePath();
    ctx.fillStyle = barva; ctx.fill();
    ctx.lineWidth = vybrana ? 3 : 1.2;
    ctx.strokeStyle = vybrana ? "#B3872E" : "rgba(0,0,0,0.55)";
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = Math.max(1, r * 0.14); ctx.lineCap = "round";
    const s = r * 0.4;
    if (druh === "netvor") {
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx - s + i * s * 0.5, cy - s); ctx.lineTo(cx + i * s * 0.5, cy + s * 0.6); ctx.stroke(); }
    } else if (druh === "npc") {
      ctx.strokeRect(cx - s * 0.8, cy - s * 0.6, s * 1.6, s * 1.1);
      ctx.beginPath(); ctx.arc(cx - s * 0.3, cy - s * 0.1, 1, 0, Math.PI * 2); ctx.arc(cx + s * 0.3, cy - s * 0.1, 1, 0, Math.PI * 2); ctx.stroke();
    } else if (druh === "predmet") {
      ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy); ctx.closePath(); ctx.stroke();
    } else if (druh === "past") {
      for (let i = 0; i < 6; i++) {
        const uhel = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(uhel) * s, cy + Math.sin(uhel) * s); ctx.stroke();
      }
    } else if (druh === "vchod") {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.7, cy + s);
      ctx.lineTo(cx - s * 0.7, cy - s * 0.2);
      ctx.arc(cx, cy - s * 0.2, s * 0.7, Math.PI, 0);
      ctx.lineTo(cx + s * 0.7, cy + s);
      ctx.stroke();
    }
  }
};
