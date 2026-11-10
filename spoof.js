// US Guard — timezone spoof (MAIN world, document_start)
// Reports US Eastern Time (America/New_York) to every website.
// The real system clock is never touched.

(() => {
  if (window.__usGuardTzSpoofed) return;
  window.__usGuardTzSpoofed = true;

  const TZ = "America/Los_Angeles";
  const TZ_LABEL = "Pacific Time";

  const OrigDate = Date;
  const OrigDTF = Intl.DateTimeFormat;

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  // Compute New York's current offset from UTC, in minutes, in the
  // getTimezoneOffset() convention (east of UTC = negative).
  // Example: EST (UTC-5) -> 300, EDT (UTC-4) -> 240.
  function nyOffsetMinutes(date) {
    try {
      // Method 1: 'longOffset' gives e.g. "GMT-05:00"
      const dtf = new OrigDTF("en-US", { timeZone: TZ, timeZoneName: "longOffset" });
      const part = dtf.formatToParts(date).find((p) => p.type === "timeZoneName");
      const m = part && part.value.match(/GMT([+-])(\d{1,2}):(\d{2})/);
      if (m) {
        const mins = parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
        return m[1] === "-" ? mins : -mins;
      }
    } catch (e) {
      // fall through
    }
    try {
      // Method 2: compare NY hour vs UTC hour
      const dtf = new OrigDTF("en-US", { timeZone: TZ, hour: "numeric" });
      const part = dtf.formatToParts(date).find((p) => p.type === "hour");
      const nyHour = parseInt(part.value, 10) % 24;
      const utcHour = date.getUTCHours();
      let diff = nyHour - utcHour; // e.g. 8 - 13 = -5 for EST
      if (diff > 12) diff -= 24;
      if (diff < -12) diff += 24;
      return -diff * 60;
    } catch (e) {
      // fall through
    }
    return 300; // hard fallback: EST (UTC-5)
  }

  // A fake date whose UTC fields equal NY's local fields.
  function shifted(d) {
    return new OrigDate(d.getTime() - nyOffsetMinutes(d) * 60000);
  }

  // ---- Date.prototype patches -------------------------------------------

  Date.prototype.getTimezoneOffset = function () {
    return nyOffsetMinutes(this);
  };

  Date.prototype.toString = function () {
    const d = shifted(this);
    const off = nyOffsetMinutes(this);
    const sign = off >= 0 ? "+" : "-";
    const abs = Math.abs(off);
    const gmt =
      "GMT" + sign + pad(Math.floor(abs / 60)) + pad(abs % 60);
    return (
      DAYS[d.getUTCDay()] + " " +
      MONTHS[d.getUTCMonth()] + " " +
      pad(d.getUTCDate()) + " " +
      d.getUTCFullYear() + " " +
      pad(d.getUTCHours()) + ":" +
      pad(d.getUTCMinutes()) + ":" +
      pad(d.getUTCSeconds()) + " " +
      gmt + " (" + TZ_LABEL + ")"
    );
  };

  Date.prototype.toTimeString = function () {
    return this.toString().slice(this.toString().indexOf(" ") + 1) === ""
      ? this.toString()
      : this.toString().split(" ").slice(4).join(" ");
  };

  Date.prototype.toLocaleString = function (locale, options) {
    const opts = Object.assign({}, options || {}, { timeZone: TZ });
    return new OrigDTF(locale || "en-US", opts).format(this);
  };

  Date.prototype.toLocaleDateString = function (locale, options) {
    const opts = Object.assign({}, options || {}, { timeZone: TZ });
    return new OrigDTF(locale || "en-US", opts).format(this);
  };

  Date.prototype.toLocaleTimeString = function (locale, options) {
    const opts = Object.assign({}, options || {}, { timeZone: TZ });
    return new OrigDTF(locale || "en-US", opts).format(this);
  };

  // Local-time getters, computed in New York terms.
  Date.prototype.getFullYear = function () { return shifted(this).getUTCFullYear(); };
  Date.prototype.getMonth = function () { return shifted(this).getUTCMonth(); };
  Date.prototype.getDate = function () { return shifted(this).getUTCDate(); };
  Date.prototype.getDay = function () { return shifted(this).getUTCDay(); };
  Date.prototype.getHours = function () { return shifted(this).getUTCHours(); };
  Date.prototype.getMinutes = function () { return shifted(this).getUTCMinutes(); };
  Date.prototype.getSeconds = function () { return shifted(this).getUTCSeconds(); };

  // NOTE: getTime(), Date.now(), valueOf(), performance.now() are untouched.
  // They carry real UTC epochs, which are timezone-neutral. Websites'
  // "your clock is accurate" checks will still pass.

  // ---- Intl patch ---------------------------------------------------------

  // Any Intl.DateTimeFormat created WITHOUT an explicit timeZone now
  // defaults to New York. Instances that explicitly request another zone
  // (e.g. Europe/Rome) still work, but resolvedOptions below hides the
  // system zone anyway.
  function PatchedDTF(locale, options) {
    const opts = Object.assign({}, options || {});
    if (!opts.timeZone) {
      opts.timeZone = TZ;
    }
    return new OrigDTF(locale, opts);
  }
  PatchedDTF.prototype = OrigDTF.prototype;
  Intl.DateTimeFormat = PatchedDTF;

  // Hard-hide the real zone even if a page somehow holds a real instance.
  const origResolved = OrigDTF.prototype.resolvedOptions;
  Object.defineProperty(OrigDTF.prototype, "resolvedOptions", {
    value: function () {
      const r = origResolved.call(this);
      r.timeZone = TZ;
      return r;
    },
    writable: true,
    configurable: true
  });
})();
