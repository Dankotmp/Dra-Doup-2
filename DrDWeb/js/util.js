// DrD.Util — drobné sdílené pomocné funkce.
window.DrD = window.DrD || {};

DrD.Util = (function () {
  function esc(text) {
    const d = document.createElement("div");
    d.textContent = text === undefined || text === null ? "" : String(text);
    return d.innerHTML;
  }

  function formatCas(hodnota) {
    let d;
    if (!hodnota) return "";
    d = new Date(hodnota);
    if (isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function debounceFn(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  return { esc, formatCas, debounceFn };
})();
