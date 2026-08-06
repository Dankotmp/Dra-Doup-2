// DrD.PeerSit — síťová vrstva appky přes WebRTC (knihovna PeerJS).
//
// PJ = "host": vytvoří Peer s ID odvozeným z kódu stolu, čeká na příchozí spojení.
// Hráč = "klient": vytvoří vlastní (náhodné) Peer ID a připojí se na hostovo ID.
// Spojení jde přímo mezi prohlížeči (přes PeerJS veřejný broker jen proběhne
// počáteční "seznámení" — samotná data pak tečou přímo mezi hráči).
//
// Žádný účet, žádný vlastní server, žádné API klíče.
window.DrD = window.DrD || {};

DrD.PeerSit = (function () {
  // Prefix odděluje appku od cizích PeerJS projektů na sdíleném veřejném brokeru.
  const PREFIX = "drdstul-9k2-";
  const CAS_PRIPOJENI_MS = 15000;

  // PeerJS cloud broker sám o sobě poskytuje jen signalizaci a STUN, ne TURN.
  // Bez TURN serveru spojení selže pokaždé, když jsou oba hráči za "těžším"
  // typem NAT (běžné třeba u mobilních dat) — funguje to pak jen v jedné síti
  // (stejná wifi) nebo na stejném zařízení. TURN přidává zálohu přes relay.
  const ICE_KONFIGURACE = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.relay.metered.ca:80" },
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    ],
  };

  function vytvorHosta(kod) {
    return new Promise((resolve, reject) => {
      let vyreseno = false;
      const peer = new Peer(PREFIX + kod, { debug: 0, config: ICE_KONFIGURACE });
      const spojeni = new Map();
      const posluchaceZpravy = [];
      const posluchacePripojeni = [];
      const posluchaceOdpojeni = [];
      const posluchaceStavu = [];
      let pokusyReconnect = 0;

      const casovac = setTimeout(() => {
        if (!vyreseno) { vyreseno = true; try { peer.destroy(); } catch (e) {} reject({ type: "timeout" }); }
      }, CAS_PRIPOJENI_MS);

      peer.on("open", () => {
        if (vyreseno) return;
        vyreseno = true;
        clearTimeout(casovac);
        pokusyReconnect = 0;
        resolve(rozhrani);
      });

      // Signalizační spojení (jen "seznamovací" kanál, ne samotný P2P přenos dat)
      // umí na mobilu/při přepnutí sítě spadnout. Bez tohohle by stůl přestal
      // být "vidět" pro nově připojující se hráče, i když appka vypadá živě.
      peer.on("disconnected", () => {
        if (!vyreseno) return;
        posluchaceStavu.forEach((fn) => fn("obnovuji"));
        pokusyReconnect++;
        setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, Math.min(5000, 500 * pokusyReconnect));
      });
      peer.on("close", () => { posluchaceStavu.forEach((fn) => fn("ukonceno")); });

      peer.on("error", (chyba) => {
        if (!vyreseno) { vyreseno = true; clearTimeout(casovac); try { peer.destroy(); } catch (e) {} reject(chyba); return; }
        console.warn("PeerJS chyba (host):", chyba);
        if (chyba && chyba.type === "unavailable-id") posluchaceStavu.forEach((fn) => fn("obnoveno"));
      });

      peer.on("connection", (conn) => {
        conn.on("open", () => {
          spojeni.set(conn.peer, conn);
          posluchacePripojeni.forEach((fn) => fn(conn));
        });
        conn.on("data", (data) => { posluchaceZpravy.forEach((fn) => fn(conn, data)); });
        const naOdpojeni = () => {
          if (!spojeni.has(conn.peer)) return;
          spojeni.delete(conn.peer);
          posluchaceOdpojeni.forEach((fn) => fn(conn));
        };
        conn.on("close", naOdpojeni);
        conn.on("error", naOdpojeni);
      });

      const rozhrani = {
        peer,
        pocetPripojenych: () => spojeni.size,
        vysilej: (zprava) => { for (const c of spojeni.values()) { try { c.send(zprava); } catch (e) {} } },
        posliKlientovi: (conn, zprava) => { try { conn.send(zprava); } catch (e) {} },
        naZpravu: (fn) => posluchaceZpravy.push(fn),
        naPripojeni: (fn) => posluchacePripojeni.push(fn),
        naOdpojeni: (fn) => posluchaceOdpojeni.push(fn),
        naZmenuStavu: (fn) => posluchaceStavu.push(fn),
        zavri: () => { try { peer.destroy(); } catch (e) {} },
      };
    });
  }

  function pripojSeKHostovi(kod) {
    return new Promise((resolve, reject) => {
      let vyreseno = false;
      const peer = new Peer(undefined, { debug: 0, config: ICE_KONFIGURACE });
      const posluchaceZpravy = [];
      const posluchaceOdpojeni = [];
      let conn = null;

      const casovac = setTimeout(() => {
        if (!vyreseno) { vyreseno = true; try { peer.destroy(); } catch (e) {} reject({ type: "timeout" }); }
      }, CAS_PRIPOJENI_MS);

      peer.on("open", () => {
        conn = peer.connect(PREFIX + kod, { reliable: true });

        conn.on("open", () => {
          if (vyreseno) return;
          vyreseno = true;
          clearTimeout(casovac);
          resolve(rozhrani);
        });
        conn.on("data", (data) => { posluchaceZpravy.forEach((fn) => fn(data)); });
        const naOdpojeni = () => { posluchaceOdpojeni.forEach((fn) => fn()); };
        conn.on("close", naOdpojeni);
        conn.on("error", naOdpojeni);
      });

      peer.on("disconnected", () => {
        if (!vyreseno) return; // za spojení (po úspěšném handshake) se ještě nemá cenu snažit reconnectovat konverzaci
        try { peer.reconnect(); } catch (e) {}
      });

      peer.on("error", (chyba) => {
        if (!vyreseno) { vyreseno = true; clearTimeout(casovac); try { peer.destroy(); } catch (e) {} reject(chyba); return; }
        console.warn("PeerJS chyba (klient):", chyba);
      });

      const rozhrani = {
        peer,
        posli: (zprava) => { if (conn) { try { conn.send(zprava); } catch (e) {} } },
        naZpravu: (fn) => posluchaceZpravy.push(fn),
        naOdpojeni: (fn) => posluchaceOdpojeni.push(fn),
        zavri: () => { try { peer.destroy(); } catch (e) {} },
      };
    });
  }

  return { vytvorHosta, pripojSeKHostovi };
})();
