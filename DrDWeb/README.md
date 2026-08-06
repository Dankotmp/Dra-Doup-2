# Dračí doupě — Virtuální stůl

Webová appka bez serveru, bez databáze, bez účtu. PJ otevře appku, dostane
6místný kód, hráči otevřou tu samou appku a kódem se připojí **přímo k jeho
prohlížeči** (technologie WebRTC — stejný princip, na jakém běží třeba
sdílení obrazovky v Google Meet). Nikdo nic neinstaluje, appka se jen otevře
v prohlížeči.

## Jak appka funguje

- **PJ = hostitel.** Jeho prohlížeč drží aktuální stav světa (mapu, postavy,
  kroniku) po celou dobu hraní.
- **Hráči = klienti.** Připojí se kódem přímo k PJ, jejich akce (pohyb,
  hláška, změna života) putují k PJ, který je potvrdí a pošle zpět všem.
- Appka se průběžně sama ukládá v PJově prohlížeči (localStorage), takže i
  po zavření appky zůstane svět dostupný k pokračování — viz níže.
- Žádná databáze, žádný účet, žádné API klíče. Jediná externí služba, na
  které appka závisí, je veřejný bezplatný signalizační server knihovny
  [PeerJS](https://peerjs.com) — ten jen na začátku "seznámí" dva
  prohlížeče, samotná hra pak jede přímo mezi nimi.

## Co to v praxi znamená (přečti si, ať tě to nepřekvapí)

- **PJ musí mít appku otevřenou** po dobu, kdy se hraje — je to jeho
  prohlížeč, kdo hru "drží". Zavření záložky = konec sezení pro všechny
  (ne nabourání dat — viz Pokračování níže).
- Naprostá většina domácích a mobilních připojení funguje bez problémů.
  Velmi omezené sítě (některé firemní/školní wifi s přísným firewallem)
  mohou WebRTC spojení blokovat — pro hraní s partou z domova se tím není
  potřeba zabývat.
- Appka spoléhá na to, že veřejný PeerJS broker (`0.peerjs.com`) běží — je to
  zavedená, roky používaná bezplatná služba, ale nemá formální garanci
  dostupnosti. Kdyby jednou nešla, appka nahlásí, že se stůl nepodařilo
  spustit/najít.

## Jak appku pustit

Appka je jen sada statických souborů (HTML/CSS/JS) — žádný build krok.

**Nejjednodušší pro sdílení s partou:** nahraj celou složku na libovolný
zdarma static hosting a pošli všem odkaz — nikdo nic nestahuje, jen otevře
stránku:

- **[app.netlify.com/drop](https://app.netlify.com/drop)** — přetáhni tam
  složku myší, za pár vteřin dostaneš veřejnou adresu. Bez účtu.
- **GitHub Pages** — nahraj složku do repozitáře → *Settings ▸ Pages*.
- **Firebase Hosting** — `npm install -g firebase-tools && firebase login && firebase init hosting && firebase deploy`
  (jen hosting statických souborů, žádná databáze se tu nezakládá).

**Nebo úplně bez hostingu:** appka jde otevřít i přímo dvojklikem na
`index.html` z disku — funguje to v Chrome/Edge. Každý hráč (včetně PJ) by
ale musel mít appku staženou zvlášť u sebe, takže pro partu je jednodušší
appku nahrát jednou (viz výše) a poslat odkaz.

## Instalace jako appka (PWA)

Appka má manifest a service worker — po otevření na `https://` adrese
(tedy po nasazení výše) jde **nainstalovat**: dostane vlastní ikonu a
otevírá se ve vlastním okně bez adresního řádku prohlížeče.

- **Windows (Edge/Chrome):** ikona instalace (⊕) v adresním řádku, nebo
  *nabídka ⋮ ▸ Nainstalovat aplikaci*.
- **Android (Chrome):** banner *„Přidat na plochu"*, nebo *nabídka ⋮ ▸
  Nainstalovat aplikaci*.
- **iPhone/iPad (Safari):** *Sdílet ▸ Přidat na plochu*.

## Pokračování příště

Appka nemá server, takže starý kód po zavření appky přestává platit. Ale o
data se nepřijde:

1. **Automaticky** — appka si svět průběžně ukládá v PJově prohlížeči. Na
   úvodní obrazovce v sekci **„Moje světy"** stačí kliknout na uložený svět
   → appka ho znovu nahodí s **novým** kódem, který pošleš hráčům.
2. **Soubor jako záloha** — v záložce **PJ ▸ Konec sezení** jde svět kdykoli
   stáhnout do `.json` souboru (mapy, postavy, kronika, vše). Ten pak jde
   nahrát přes **„Nahrát svět ze souboru"** v menu — třeba když hraješ z
   jiného počítače nebo si appku vyčistil prohlížeč.

Postavy hráčů zůstávají zachované — při připojení novým kódem si je v kroku
*Pokračovat s postavou* jednoduše vezmou zpátky.

## Struktura projektu

```
index.html              hlavní HTML shell
manifest.json / sw.js   instalovatelnost appky (PWA)
icons/                  ikony appky
img/hrdinove/           ilustrace hrdinů (galerie pro tvorbu postavy)
img/netvori/            ilustrace netvorů (galerie pro PJ formulář na mapě)
css/styl.css            pergamenový vizuální styl
js/util.js              escapování HTML, formátování času
js/modely.js            terén, rasy, povolání, postava, generátor mapy — čistá herní logika
js/portret.js           výběr vzhledu postavy z galerie ilustrací (viz img/)
js/ikony.js             sada vlastních SVG ikon (náhrada emoji)
js/peer-sit.js          síťová vrstva přes WebRTC/PeerJS
js/mapa-platno.js       canvas komponenta mapy (ilustrovaný terén, gesta, zoom)
js/ui-spolecne.js       sdílené kousky UI
js/stav.js              centrální stav appky + herní akce (DrD.Stav)
js/obrazovky-pj.js      menu, tvorba světa, editor mapy, lobby PJ
js/obrazovky-hrac.js    připojení kódem, výběr/tvorba postavy
js/herni-stul.js        hlavní herní obrazovka se záložkami + deník postavy
js/app.js               router mezi obrazovkami
```

Rasy, povolání a terény jsou celé na jednom místě v `js/modely.js`.

## Poznámka k pravidlům hry

Appka vychází ze základních pravidel **Dračího doupěte II** (ISBN
978-80-85979-73-2): 5 ras (Člověk, Elf, Trpaslík, Hobit, Kroll) bez
mechanických modifikátorů, vlastnosti Tělo/Duše/Vliv rozdělované 15 body při
tvorbě postavy, 5 základních povolání (Bojovník, Lovec, Kejklíř, Mastičkář,
Zaříkávač) a 10 z nich odvozených pokročilých. Appka nevynucuje softwarově
předpoklady pro pokročilá povolání ani přesný vzorec zkušeností — je to
nástroj k vedení hry a zápisník postavy, ne náhrada příručky nebo simulace
celého pravidlového aparátu.

## Generovaná mapa a vzhled postav

Nová mapa (i tlačítko „Vygenerovat znovu" v editoru) vytvoří přírodní
krajinu — pohoří, lesy, řeku, občas jezero nebo bažinu a cestu — místo
prázdné plochy. Vzhled terénu (šrafované hory, chomáče lesa, vlnky na vodě…)
je ručně-ilustrovaný a deterministický podle čísla uloženého v `mapa.seed`,
takže vypadá stejně u všech hráčů, aniž by appka musela posílat po síti
každý detail kresby.

Vzhled postav a netvorů appka nekreslí — vybírá z **galerie hotových
ilustrací** (`img/hrdinove/`, `img/netvori/`, zakoupené na Etsy, licencované
k použití v appce). Při tvorbě postavy appka podle zvolené rasy vylosuje
ilustraci z odpovídající sady; tlačítko „Přehodit vzhled" vylosuje jinou v
rámci stejné rasy. PJ obdobně vybírá vzhled netvora z galerie ve formuláři
„Přidat na mapu". Appka si pamatuje jen odkaz na soubor (`portret.klic`),
ne obrázek samotný — takže i tahle volba se mezi PJ a hráči synchronizuje
jako pár bajtů, ne jako obrázek.
