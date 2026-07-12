"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __knownSymbol = (name5, symbol) => (symbol = Symbol[name5]) ? symbol : Symbol.for("Symbol." + name5);
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name5 in all)
      __defProp(target, name5, { get: all[name5], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };
  var __forAwait = (obj, it, method) => (it = obj[__knownSymbol("asyncIterator")]) ? it.call(obj) : (obj = obj[__knownSymbol("iterator")](), it = {}, method = (key, fn) => (fn = obj[key]) && (it[key] = (arg) => new Promise((yes, no, done) => (arg = fn.call(obj, arg), done = arg.done, Promise.resolve(arg.value).then((value) => yes({ value, done }), no)))), method("next"), method("return"), it);

  // node_modules/jszip/dist/jszip.min.js
  var require_jszip_min = __commonJS({
    "node_modules/jszip/dist/jszip.min.js"(exports, module) {
      !(function(e) {
        if ("object" == typeof exports && "undefined" != typeof module) module.exports = e();
        else if ("function" == typeof define && define.amd) define([], e);
        else {
          ("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).JSZip = e();
        }
      })(function() {
        return (/* @__PURE__ */ __name(function s(a, o, h) {
          function u(r, e2) {
            if (!o[r]) {
              if (!a[r]) {
                var t = "function" == typeof __require && __require;
                if (!e2 && t) return t(r, true);
                if (l) return l(r, true);
                var n = new Error("Cannot find module '" + r + "'");
                throw n.code = "MODULE_NOT_FOUND", n;
              }
              var i = o[r] = { exports: {} };
              a[r][0].call(i.exports, function(e3) {
                var t2 = a[r][1][e3];
                return u(t2 || e3);
              }, i, i.exports, s, a, o, h);
            }
            return o[r].exports;
          }
          __name(u, "u");
          for (var l = "function" == typeof __require && __require, e = 0; e < h.length; e++) u(h[e]);
          return u;
        }, "s"))({ 1: [function(e, t, r) {
          "use strict";
          var d = e("./utils"), c = e("./support"), p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
          r.encode = function(e2) {
            for (var t2, r2, n, i, s, a, o, h = [], u = 0, l = e2.length, f = l, c2 = "string" !== d.getTypeOf(e2); u < e2.length; ) f = l - u, n = c2 ? (t2 = e2[u++], r2 = u < l ? e2[u++] : 0, u < l ? e2[u++] : 0) : (t2 = e2.charCodeAt(u++), r2 = u < l ? e2.charCodeAt(u++) : 0, u < l ? e2.charCodeAt(u++) : 0), i = t2 >> 2, s = (3 & t2) << 4 | r2 >> 4, a = 1 < f ? (15 & r2) << 2 | n >> 6 : 64, o = 2 < f ? 63 & n : 64, h.push(p.charAt(i) + p.charAt(s) + p.charAt(a) + p.charAt(o));
            return h.join("");
          }, r.decode = function(e2) {
            var t2, r2, n, i, s, a, o = 0, h = 0, u = "data:";
            if (e2.substr(0, u.length) === u) throw new Error("Invalid base64 input, it looks like a data url.");
            var l, f = 3 * (e2 = e2.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
            if (e2.charAt(e2.length - 1) === p.charAt(64) && f--, e2.charAt(e2.length - 2) === p.charAt(64) && f--, f % 1 != 0) throw new Error("Invalid base64 input, bad content length.");
            for (l = c.uint8array ? new Uint8Array(0 | f) : new Array(0 | f); o < e2.length; ) t2 = p.indexOf(e2.charAt(o++)) << 2 | (i = p.indexOf(e2.charAt(o++))) >> 4, r2 = (15 & i) << 4 | (s = p.indexOf(e2.charAt(o++))) >> 2, n = (3 & s) << 6 | (a = p.indexOf(e2.charAt(o++))), l[h++] = t2, 64 !== s && (l[h++] = r2), 64 !== a && (l[h++] = n);
            return l;
          };
        }, { "./support": 30, "./utils": 32 }], 2: [function(e, t, r) {
          "use strict";
          var n = e("./external"), i = e("./stream/DataWorker"), s = e("./stream/Crc32Probe"), a = e("./stream/DataLengthProbe");
          function o(e2, t2, r2, n2, i2) {
            this.compressedSize = e2, this.uncompressedSize = t2, this.crc32 = r2, this.compression = n2, this.compressedContent = i2;
          }
          __name(o, "o");
          o.prototype = { getContentWorker: /* @__PURE__ */ __name(function() {
            var e2 = new i(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a("data_length")), t2 = this;
            return e2.on("end", function() {
              if (this.streamInfo.data_length !== t2.uncompressedSize) throw new Error("Bug : uncompressed data size mismatch");
            }), e2;
          }, "getContentWorker"), getCompressedWorker: /* @__PURE__ */ __name(function() {
            return new i(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
          }, "getCompressedWorker") }, o.createWorkerFrom = function(e2, t2, r2) {
            return e2.pipe(new s()).pipe(new a("uncompressedSize")).pipe(t2.compressWorker(r2)).pipe(new a("compressedSize")).withStreamInfo("compression", t2);
          }, t.exports = o;
        }, { "./external": 6, "./stream/Crc32Probe": 25, "./stream/DataLengthProbe": 26, "./stream/DataWorker": 27 }], 3: [function(e, t, r) {
          "use strict";
          var n = e("./stream/GenericWorker");
          r.STORE = { magic: "\0\0", compressWorker: /* @__PURE__ */ __name(function() {
            return new n("STORE compression");
          }, "compressWorker"), uncompressWorker: /* @__PURE__ */ __name(function() {
            return new n("STORE decompression");
          }, "uncompressWorker") }, r.DEFLATE = e("./flate");
        }, { "./flate": 7, "./stream/GenericWorker": 28 }], 4: [function(e, t, r) {
          "use strict";
          var n = e("./utils");
          var o = (function() {
            for (var e2, t2 = [], r2 = 0; r2 < 256; r2++) {
              e2 = r2;
              for (var n2 = 0; n2 < 8; n2++) e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
              t2[r2] = e2;
            }
            return t2;
          })();
          t.exports = function(e2, t2) {
            return void 0 !== e2 && e2.length ? "string" !== n.getTypeOf(e2) ? (function(e3, t3, r2, n2) {
              var i = o, s = n2 + r2;
              e3 ^= -1;
              for (var a = n2; a < s; a++) e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3[a])];
              return -1 ^ e3;
            })(0 | t2, e2, e2.length, 0) : (function(e3, t3, r2, n2) {
              var i = o, s = n2 + r2;
              e3 ^= -1;
              for (var a = n2; a < s; a++) e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3.charCodeAt(a))];
              return -1 ^ e3;
            })(0 | t2, e2, e2.length, 0) : 0;
          };
        }, { "./utils": 32 }], 5: [function(e, t, r) {
          "use strict";
          r.base64 = false, r.binary = false, r.dir = false, r.createFolders = true, r.date = null, r.compression = null, r.compressionOptions = null, r.comment = null, r.unixPermissions = null, r.dosPermissions = null;
        }, {}], 6: [function(e, t, r) {
          "use strict";
          var n = null;
          n = "undefined" != typeof Promise ? Promise : e("lie"), t.exports = { Promise: n };
        }, { lie: 37 }], 7: [function(e, t, r) {
          "use strict";
          var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Uint32Array, i = e("pako"), s = e("./utils"), a = e("./stream/GenericWorker"), o = n ? "uint8array" : "array";
          function h(e2, t2) {
            a.call(this, "FlateWorker/" + e2), this._pako = null, this._pakoAction = e2, this._pakoOptions = t2, this.meta = {};
          }
          __name(h, "h");
          r.magic = "\b\0", s.inherits(h, a), h.prototype.processChunk = function(e2) {
            this.meta = e2.meta, null === this._pako && this._createPako(), this._pako.push(s.transformTo(o, e2.data), false);
          }, h.prototype.flush = function() {
            a.prototype.flush.call(this), null === this._pako && this._createPako(), this._pako.push([], true);
          }, h.prototype.cleanUp = function() {
            a.prototype.cleanUp.call(this), this._pako = null;
          }, h.prototype._createPako = function() {
            this._pako = new i[this._pakoAction]({ raw: true, level: this._pakoOptions.level || -1 });
            var t2 = this;
            this._pako.onData = function(e2) {
              t2.push({ data: e2, meta: t2.meta });
            };
          }, r.compressWorker = function(e2) {
            return new h("Deflate", e2);
          }, r.uncompressWorker = function() {
            return new h("Inflate", {});
          };
        }, { "./stream/GenericWorker": 28, "./utils": 32, pako: 38 }], 8: [function(e, t, r) {
          "use strict";
          function A(e2, t2) {
            var r2, n2 = "";
            for (r2 = 0; r2 < t2; r2++) n2 += String.fromCharCode(255 & e2), e2 >>>= 8;
            return n2;
          }
          __name(A, "A");
          function n(e2, t2, r2, n2, i2, s2) {
            var a, o, h = e2.file, u = e2.compression, l = s2 !== O.utf8encode, f = I.transformTo("string", s2(h.name)), c = I.transformTo("string", O.utf8encode(h.name)), d = h.comment, p = I.transformTo("string", s2(d)), m = I.transformTo("string", O.utf8encode(d)), _ = c.length !== h.name.length, g = m.length !== d.length, b = "", v = "", y = "", w = h.dir, k = h.date, x = { crc32: 0, compressedSize: 0, uncompressedSize: 0 };
            t2 && !r2 || (x.crc32 = e2.crc32, x.compressedSize = e2.compressedSize, x.uncompressedSize = e2.uncompressedSize);
            var S = 0;
            t2 && (S |= 8), l || !_ && !g || (S |= 2048);
            var z = 0, C = 0;
            w && (z |= 16), "UNIX" === i2 ? (C = 798, z |= (function(e3, t3) {
              var r3 = e3;
              return e3 || (r3 = t3 ? 16893 : 33204), (65535 & r3) << 16;
            })(h.unixPermissions, w)) : (C = 20, z |= (function(e3) {
              return 63 & (e3 || 0);
            })(h.dosPermissions)), a = k.getUTCHours(), a <<= 6, a |= k.getUTCMinutes(), a <<= 5, a |= k.getUTCSeconds() / 2, o = k.getUTCFullYear() - 1980, o <<= 4, o |= k.getUTCMonth() + 1, o <<= 5, o |= k.getUTCDate(), _ && (v = A(1, 1) + A(B(f), 4) + c, b += "up" + A(v.length, 2) + v), g && (y = A(1, 1) + A(B(p), 4) + m, b += "uc" + A(y.length, 2) + y);
            var E = "";
            return E += "\n\0", E += A(S, 2), E += u.magic, E += A(a, 2), E += A(o, 2), E += A(x.crc32, 4), E += A(x.compressedSize, 4), E += A(x.uncompressedSize, 4), E += A(f.length, 2), E += A(b.length, 2), { fileRecord: R.LOCAL_FILE_HEADER + E + f + b, dirRecord: R.CENTRAL_FILE_HEADER + A(C, 2) + E + A(p.length, 2) + "\0\0\0\0" + A(z, 4) + A(n2, 4) + f + b + p };
          }
          __name(n, "n");
          var I = e("../utils"), i = e("../stream/GenericWorker"), O = e("../utf8"), B = e("../crc32"), R = e("../signature");
          function s(e2, t2, r2, n2) {
            i.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t2, this.zipPlatform = r2, this.encodeFileName = n2, this.streamFiles = e2, this.accumulate = false, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
          }
          __name(s, "s");
          I.inherits(s, i), s.prototype.push = function(e2) {
            var t2 = e2.meta.percent || 0, r2 = this.entriesCount, n2 = this._sources.length;
            this.accumulate ? this.contentBuffer.push(e2) : (this.bytesWritten += e2.data.length, i.prototype.push.call(this, { data: e2.data, meta: { currentFile: this.currentFile, percent: r2 ? (t2 + 100 * (r2 - n2 - 1)) / r2 : 100 } }));
          }, s.prototype.openedSource = function(e2) {
            this.currentSourceOffset = this.bytesWritten, this.currentFile = e2.file.name;
            var t2 = this.streamFiles && !e2.file.dir;
            if (t2) {
              var r2 = n(e2, t2, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
              this.push({ data: r2.fileRecord, meta: { percent: 0 } });
            } else this.accumulate = true;
          }, s.prototype.closedSource = function(e2) {
            this.accumulate = false;
            var t2 = this.streamFiles && !e2.file.dir, r2 = n(e2, t2, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
            if (this.dirRecords.push(r2.dirRecord), t2) this.push({ data: (function(e3) {
              return R.DATA_DESCRIPTOR + A(e3.crc32, 4) + A(e3.compressedSize, 4) + A(e3.uncompressedSize, 4);
            })(e2), meta: { percent: 100 } });
            else for (this.push({ data: r2.fileRecord, meta: { percent: 0 } }); this.contentBuffer.length; ) this.push(this.contentBuffer.shift());
            this.currentFile = null;
          }, s.prototype.flush = function() {
            for (var e2 = this.bytesWritten, t2 = 0; t2 < this.dirRecords.length; t2++) this.push({ data: this.dirRecords[t2], meta: { percent: 100 } });
            var r2 = this.bytesWritten - e2, n2 = (function(e3, t3, r3, n3, i2) {
              var s2 = I.transformTo("string", i2(n3));
              return R.CENTRAL_DIRECTORY_END + "\0\0\0\0" + A(e3, 2) + A(e3, 2) + A(t3, 4) + A(r3, 4) + A(s2.length, 2) + s2;
            })(this.dirRecords.length, r2, e2, this.zipComment, this.encodeFileName);
            this.push({ data: n2, meta: { percent: 100 } });
          }, s.prototype.prepareNextSource = function() {
            this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
          }, s.prototype.registerPrevious = function(e2) {
            this._sources.push(e2);
            var t2 = this;
            return e2.on("data", function(e3) {
              t2.processChunk(e3);
            }), e2.on("end", function() {
              t2.closedSource(t2.previous.streamInfo), t2._sources.length ? t2.prepareNextSource() : t2.end();
            }), e2.on("error", function(e3) {
              t2.error(e3);
            }), this;
          }, s.prototype.resume = function() {
            return !!i.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), true) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(), true));
          }, s.prototype.error = function(e2) {
            var t2 = this._sources;
            if (!i.prototype.error.call(this, e2)) return false;
            for (var r2 = 0; r2 < t2.length; r2++) try {
              t2[r2].error(e2);
            } catch (e3) {
            }
            return true;
          }, s.prototype.lock = function() {
            i.prototype.lock.call(this);
            for (var e2 = this._sources, t2 = 0; t2 < e2.length; t2++) e2[t2].lock();
          }, t.exports = s;
        }, { "../crc32": 4, "../signature": 23, "../stream/GenericWorker": 28, "../utf8": 31, "../utils": 32 }], 9: [function(e, t, r) {
          "use strict";
          var u = e("../compressions"), n = e("./ZipFileWorker");
          r.generateWorker = function(e2, a, t2) {
            var o = new n(a.streamFiles, t2, a.platform, a.encodeFileName), h = 0;
            try {
              e2.forEach(function(e3, t3) {
                h++;
                var r2 = (function(e4, t4) {
                  var r3 = e4 || t4, n3 = u[r3];
                  if (!n3) throw new Error(r3 + " is not a valid compression method !");
                  return n3;
                })(t3.options.compression, a.compression), n2 = t3.options.compressionOptions || a.compressionOptions || {}, i = t3.dir, s = t3.date;
                t3._compressWorker(r2, n2).withStreamInfo("file", { name: e3, dir: i, date: s, comment: t3.comment || "", unixPermissions: t3.unixPermissions, dosPermissions: t3.dosPermissions }).pipe(o);
              }), o.entriesCount = h;
            } catch (e3) {
              o.error(e3);
            }
            return o;
          };
        }, { "../compressions": 3, "./ZipFileWorker": 8 }], 10: [function(e, t, r) {
          "use strict";
          function n() {
            if (!(this instanceof n)) return new n();
            if (arguments.length) throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
            this.files = /* @__PURE__ */ Object.create(null), this.comment = null, this.root = "", this.clone = function() {
              var e2 = new n();
              for (var t2 in this) "function" != typeof this[t2] && (e2[t2] = this[t2]);
              return e2;
            };
          }
          __name(n, "n");
          (n.prototype = e("./object")).loadAsync = e("./load"), n.support = e("./support"), n.defaults = e("./defaults"), n.version = "3.10.1", n.loadAsync = function(e2, t2) {
            return new n().loadAsync(e2, t2);
          }, n.external = e("./external"), t.exports = n;
        }, { "./defaults": 5, "./external": 6, "./load": 11, "./object": 15, "./support": 30 }], 11: [function(e, t, r) {
          "use strict";
          var u = e("./utils"), i = e("./external"), n = e("./utf8"), s = e("./zipEntries"), a = e("./stream/Crc32Probe"), l = e("./nodejsUtils");
          function f(n2) {
            return new i.Promise(function(e2, t2) {
              var r2 = n2.decompressed.getContentWorker().pipe(new a());
              r2.on("error", function(e3) {
                t2(e3);
              }).on("end", function() {
                r2.streamInfo.crc32 !== n2.decompressed.crc32 ? t2(new Error("Corrupted zip : CRC32 mismatch")) : e2();
              }).resume();
            });
          }
          __name(f, "f");
          t.exports = function(e2, o) {
            var h = this;
            return o = u.extend(o || {}, { base64: false, checkCRC32: false, optimizedBinaryString: false, createFolders: false, decodeFileName: n.utf8decode }), l.isNode && l.isStream(e2) ? i.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : u.prepareContent("the loaded zip file", e2, true, o.optimizedBinaryString, o.base64).then(function(e3) {
              var t2 = new s(o);
              return t2.load(e3), t2;
            }).then(function(e3) {
              var t2 = [i.Promise.resolve(e3)], r2 = e3.files;
              if (o.checkCRC32) for (var n2 = 0; n2 < r2.length; n2++) t2.push(f(r2[n2]));
              return i.Promise.all(t2);
            }).then(function(e3) {
              for (var t2 = e3.shift(), r2 = t2.files, n2 = 0; n2 < r2.length; n2++) {
                var i2 = r2[n2], s2 = i2.fileNameStr, a2 = u.resolve(i2.fileNameStr);
                h.file(a2, i2.decompressed, { binary: true, optimizedBinaryString: true, date: i2.date, dir: i2.dir, comment: i2.fileCommentStr.length ? i2.fileCommentStr : null, unixPermissions: i2.unixPermissions, dosPermissions: i2.dosPermissions, createFolders: o.createFolders }), i2.dir || (h.file(a2).unsafeOriginalName = s2);
              }
              return t2.zipComment.length && (h.comment = t2.zipComment), h;
            });
          };
        }, { "./external": 6, "./nodejsUtils": 14, "./stream/Crc32Probe": 25, "./utf8": 31, "./utils": 32, "./zipEntries": 33 }], 12: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("../stream/GenericWorker");
          function s(e2, t2) {
            i.call(this, "Nodejs stream input adapter for " + e2), this._upstreamEnded = false, this._bindStream(t2);
          }
          __name(s, "s");
          n.inherits(s, i), s.prototype._bindStream = function(e2) {
            var t2 = this;
            (this._stream = e2).pause(), e2.on("data", function(e3) {
              t2.push({ data: e3, meta: { percent: 0 } });
            }).on("error", function(e3) {
              t2.isPaused ? this.generatedError = e3 : t2.error(e3);
            }).on("end", function() {
              t2.isPaused ? t2._upstreamEnded = true : t2.end();
            });
          }, s.prototype.pause = function() {
            return !!i.prototype.pause.call(this) && (this._stream.pause(), true);
          }, s.prototype.resume = function() {
            return !!i.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), true);
          }, t.exports = s;
        }, { "../stream/GenericWorker": 28, "../utils": 32 }], 13: [function(e, t, r) {
          "use strict";
          var i = e("readable-stream").Readable;
          function n(e2, t2, r2) {
            i.call(this, t2), this._helper = e2;
            var n2 = this;
            e2.on("data", function(e3, t3) {
              n2.push(e3) || n2._helper.pause(), r2 && r2(t3);
            }).on("error", function(e3) {
              n2.emit("error", e3);
            }).on("end", function() {
              n2.push(null);
            });
          }
          __name(n, "n");
          e("../utils").inherits(n, i), n.prototype._read = function() {
            this._helper.resume();
          }, t.exports = n;
        }, { "../utils": 32, "readable-stream": 16 }], 14: [function(e, t, r) {
          "use strict";
          t.exports = { isNode: "undefined" != typeof Buffer, newBufferFrom: /* @__PURE__ */ __name(function(e2, t2) {
            if (Buffer.from && Buffer.from !== Uint8Array.from) return Buffer.from(e2, t2);
            if ("number" == typeof e2) throw new Error('The "data" argument must not be a number');
            return new Buffer(e2, t2);
          }, "newBufferFrom"), allocBuffer: /* @__PURE__ */ __name(function(e2) {
            if (Buffer.alloc) return Buffer.alloc(e2);
            var t2 = new Buffer(e2);
            return t2.fill(0), t2;
          }, "allocBuffer"), isBuffer: /* @__PURE__ */ __name(function(e2) {
            return Buffer.isBuffer(e2);
          }, "isBuffer"), isStream: /* @__PURE__ */ __name(function(e2) {
            return e2 && "function" == typeof e2.on && "function" == typeof e2.pause && "function" == typeof e2.resume;
          }, "isStream") };
        }, {}], 15: [function(e, t, r) {
          "use strict";
          function s(e2, t2, r2) {
            var n2, i2 = u.getTypeOf(t2), s2 = u.extend(r2 || {}, f);
            s2.date = s2.date || /* @__PURE__ */ new Date(), null !== s2.compression && (s2.compression = s2.compression.toUpperCase()), "string" == typeof s2.unixPermissions && (s2.unixPermissions = parseInt(s2.unixPermissions, 8)), s2.unixPermissions && 16384 & s2.unixPermissions && (s2.dir = true), s2.dosPermissions && 16 & s2.dosPermissions && (s2.dir = true), s2.dir && (e2 = g(e2)), s2.createFolders && (n2 = _(e2)) && b.call(this, n2, true);
            var a2 = "string" === i2 && false === s2.binary && false === s2.base64;
            r2 && void 0 !== r2.binary || (s2.binary = !a2), (t2 instanceof c && 0 === t2.uncompressedSize || s2.dir || !t2 || 0 === t2.length) && (s2.base64 = false, s2.binary = true, t2 = "", s2.compression = "STORE", i2 = "string");
            var o2 = null;
            o2 = t2 instanceof c || t2 instanceof l ? t2 : p.isNode && p.isStream(t2) ? new m(e2, t2) : u.prepareContent(e2, t2, s2.binary, s2.optimizedBinaryString, s2.base64);
            var h2 = new d(e2, o2, s2);
            this.files[e2] = h2;
          }
          __name(s, "s");
          var i = e("./utf8"), u = e("./utils"), l = e("./stream/GenericWorker"), a = e("./stream/StreamHelper"), f = e("./defaults"), c = e("./compressedObject"), d = e("./zipObject"), o = e("./generate"), p = e("./nodejsUtils"), m = e("./nodejs/NodejsStreamInputAdapter"), _ = /* @__PURE__ */ __name(function(e2) {
            "/" === e2.slice(-1) && (e2 = e2.substring(0, e2.length - 1));
            var t2 = e2.lastIndexOf("/");
            return 0 < t2 ? e2.substring(0, t2) : "";
          }, "_"), g = /* @__PURE__ */ __name(function(e2) {
            return "/" !== e2.slice(-1) && (e2 += "/"), e2;
          }, "g"), b = /* @__PURE__ */ __name(function(e2, t2) {
            return t2 = void 0 !== t2 ? t2 : f.createFolders, e2 = g(e2), this.files[e2] || s.call(this, e2, null, { dir: true, createFolders: t2 }), this.files[e2];
          }, "b");
          function h(e2) {
            return "[object RegExp]" === Object.prototype.toString.call(e2);
          }
          __name(h, "h");
          var n = { load: /* @__PURE__ */ __name(function() {
            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
          }, "load"), forEach: /* @__PURE__ */ __name(function(e2) {
            var t2, r2, n2;
            for (t2 in this.files) n2 = this.files[t2], (r2 = t2.slice(this.root.length, t2.length)) && t2.slice(0, this.root.length) === this.root && e2(r2, n2);
          }, "forEach"), filter: /* @__PURE__ */ __name(function(r2) {
            var n2 = [];
            return this.forEach(function(e2, t2) {
              r2(e2, t2) && n2.push(t2);
            }), n2;
          }, "filter"), file: /* @__PURE__ */ __name(function(e2, t2, r2) {
            if (1 !== arguments.length) return e2 = this.root + e2, s.call(this, e2, t2, r2), this;
            if (h(e2)) {
              var n2 = e2;
              return this.filter(function(e3, t3) {
                return !t3.dir && n2.test(e3);
              });
            }
            var i2 = this.files[this.root + e2];
            return i2 && !i2.dir ? i2 : null;
          }, "file"), folder: /* @__PURE__ */ __name(function(r2) {
            if (!r2) return this;
            if (h(r2)) return this.filter(function(e3, t3) {
              return t3.dir && r2.test(e3);
            });
            var e2 = this.root + r2, t2 = b.call(this, e2), n2 = this.clone();
            return n2.root = t2.name, n2;
          }, "folder"), remove: /* @__PURE__ */ __name(function(r2) {
            r2 = this.root + r2;
            var e2 = this.files[r2];
            if (e2 || ("/" !== r2.slice(-1) && (r2 += "/"), e2 = this.files[r2]), e2 && !e2.dir) delete this.files[r2];
            else for (var t2 = this.filter(function(e3, t3) {
              return t3.name.slice(0, r2.length) === r2;
            }), n2 = 0; n2 < t2.length; n2++) delete this.files[t2[n2].name];
            return this;
          }, "remove"), generate: /* @__PURE__ */ __name(function() {
            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
          }, "generate"), generateInternalStream: /* @__PURE__ */ __name(function(e2) {
            var t2, r2 = {};
            try {
              if ((r2 = u.extend(e2 || {}, { streamFiles: false, compression: "STORE", compressionOptions: null, type: "", platform: "DOS", comment: null, mimeType: "application/zip", encodeFileName: i.utf8encode })).type = r2.type.toLowerCase(), r2.compression = r2.compression.toUpperCase(), "binarystring" === r2.type && (r2.type = "string"), !r2.type) throw new Error("No output type specified.");
              u.checkSupport(r2.type), "darwin" !== r2.platform && "freebsd" !== r2.platform && "linux" !== r2.platform && "sunos" !== r2.platform || (r2.platform = "UNIX"), "win32" === r2.platform && (r2.platform = "DOS");
              var n2 = r2.comment || this.comment || "";
              t2 = o.generateWorker(this, r2, n2);
            } catch (e3) {
              (t2 = new l("error")).error(e3);
            }
            return new a(t2, r2.type || "string", r2.mimeType);
          }, "generateInternalStream"), generateAsync: /* @__PURE__ */ __name(function(e2, t2) {
            return this.generateInternalStream(e2).accumulate(t2);
          }, "generateAsync"), generateNodeStream: /* @__PURE__ */ __name(function(e2, t2) {
            return (e2 = e2 || {}).type || (e2.type = "nodebuffer"), this.generateInternalStream(e2).toNodejsStream(t2);
          }, "generateNodeStream") };
          t.exports = n;
        }, { "./compressedObject": 2, "./defaults": 5, "./generate": 9, "./nodejs/NodejsStreamInputAdapter": 12, "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31, "./utils": 32, "./zipObject": 35 }], 16: [function(e, t, r) {
          "use strict";
          t.exports = e("stream");
        }, { stream: void 0 }], 17: [function(e, t, r) {
          "use strict";
          var n = e("./DataReader");
          function i(e2) {
            n.call(this, e2);
            for (var t2 = 0; t2 < this.data.length; t2++) e2[t2] = 255 & e2[t2];
          }
          __name(i, "i");
          e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
            return this.data[this.zero + e2];
          }, i.prototype.lastIndexOfSignature = function(e2) {
            for (var t2 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.length - 4; 0 <= s; --s) if (this.data[s] === t2 && this.data[s + 1] === r2 && this.data[s + 2] === n2 && this.data[s + 3] === i2) return s - this.zero;
            return -1;
          }, i.prototype.readAndCheckSignature = function(e2) {
            var t2 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.readData(4);
            return t2 === s[0] && r2 === s[1] && n2 === s[2] && i2 === s[3];
          }, i.prototype.readData = function(e2) {
            if (this.checkOffset(e2), 0 === e2) return [];
            var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./DataReader": 18 }], 18: [function(e, t, r) {
          "use strict";
          var n = e("../utils");
          function i(e2) {
            this.data = e2, this.length = e2.length, this.index = 0, this.zero = 0;
          }
          __name(i, "i");
          i.prototype = { checkOffset: /* @__PURE__ */ __name(function(e2) {
            this.checkIndex(this.index + e2);
          }, "checkOffset"), checkIndex: /* @__PURE__ */ __name(function(e2) {
            if (this.length < this.zero + e2 || e2 < 0) throw new Error("End of data reached (data length = " + this.length + ", asked index = " + e2 + "). Corrupted zip ?");
          }, "checkIndex"), setIndex: /* @__PURE__ */ __name(function(e2) {
            this.checkIndex(e2), this.index = e2;
          }, "setIndex"), skip: /* @__PURE__ */ __name(function(e2) {
            this.setIndex(this.index + e2);
          }, "skip"), byteAt: /* @__PURE__ */ __name(function() {
          }, "byteAt"), readInt: /* @__PURE__ */ __name(function(e2) {
            var t2, r2 = 0;
            for (this.checkOffset(e2), t2 = this.index + e2 - 1; t2 >= this.index; t2--) r2 = (r2 << 8) + this.byteAt(t2);
            return this.index += e2, r2;
          }, "readInt"), readString: /* @__PURE__ */ __name(function(e2) {
            return n.transformTo("string", this.readData(e2));
          }, "readString"), readData: /* @__PURE__ */ __name(function() {
          }, "readData"), lastIndexOfSignature: /* @__PURE__ */ __name(function() {
          }, "lastIndexOfSignature"), readAndCheckSignature: /* @__PURE__ */ __name(function() {
          }, "readAndCheckSignature"), readDate: /* @__PURE__ */ __name(function() {
            var e2 = this.readInt(4);
            return new Date(Date.UTC(1980 + (e2 >> 25 & 127), (e2 >> 21 & 15) - 1, e2 >> 16 & 31, e2 >> 11 & 31, e2 >> 5 & 63, (31 & e2) << 1));
          }, "readDate") }, t.exports = i;
        }, { "../utils": 32 }], 19: [function(e, t, r) {
          "use strict";
          var n = e("./Uint8ArrayReader");
          function i(e2) {
            n.call(this, e2);
          }
          __name(i, "i");
          e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
            this.checkOffset(e2);
            var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./Uint8ArrayReader": 21 }], 20: [function(e, t, r) {
          "use strict";
          var n = e("./DataReader");
          function i(e2) {
            n.call(this, e2);
          }
          __name(i, "i");
          e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
            return this.data.charCodeAt(this.zero + e2);
          }, i.prototype.lastIndexOfSignature = function(e2) {
            return this.data.lastIndexOf(e2) - this.zero;
          }, i.prototype.readAndCheckSignature = function(e2) {
            return e2 === this.readData(4);
          }, i.prototype.readData = function(e2) {
            this.checkOffset(e2);
            var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./DataReader": 18 }], 21: [function(e, t, r) {
          "use strict";
          var n = e("./ArrayReader");
          function i(e2) {
            n.call(this, e2);
          }
          __name(i, "i");
          e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
            if (this.checkOffset(e2), 0 === e2) return new Uint8Array(0);
            var t2 = this.data.subarray(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./ArrayReader": 17 }], 22: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("../support"), s = e("./ArrayReader"), a = e("./StringReader"), o = e("./NodeBufferReader"), h = e("./Uint8ArrayReader");
          t.exports = function(e2) {
            var t2 = n.getTypeOf(e2);
            return n.checkSupport(t2), "string" !== t2 || i.uint8array ? "nodebuffer" === t2 ? new o(e2) : i.uint8array ? new h(n.transformTo("uint8array", e2)) : new s(n.transformTo("array", e2)) : new a(e2);
          };
        }, { "../support": 30, "../utils": 32, "./ArrayReader": 17, "./NodeBufferReader": 19, "./StringReader": 20, "./Uint8ArrayReader": 21 }], 23: [function(e, t, r) {
          "use strict";
          r.LOCAL_FILE_HEADER = "PK", r.CENTRAL_FILE_HEADER = "PK", r.CENTRAL_DIRECTORY_END = "PK", r.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07", r.ZIP64_CENTRAL_DIRECTORY_END = "PK", r.DATA_DESCRIPTOR = "PK\x07\b";
        }, {}], 24: [function(e, t, r) {
          "use strict";
          var n = e("./GenericWorker"), i = e("../utils");
          function s(e2) {
            n.call(this, "ConvertWorker to " + e2), this.destType = e2;
          }
          __name(s, "s");
          i.inherits(s, n), s.prototype.processChunk = function(e2) {
            this.push({ data: i.transformTo(this.destType, e2.data), meta: e2.meta });
          }, t.exports = s;
        }, { "../utils": 32, "./GenericWorker": 28 }], 25: [function(e, t, r) {
          "use strict";
          var n = e("./GenericWorker"), i = e("../crc32");
          function s() {
            n.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
          }
          __name(s, "s");
          e("../utils").inherits(s, n), s.prototype.processChunk = function(e2) {
            this.streamInfo.crc32 = i(e2.data, this.streamInfo.crc32 || 0), this.push(e2);
          }, t.exports = s;
        }, { "../crc32": 4, "../utils": 32, "./GenericWorker": 28 }], 26: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("./GenericWorker");
          function s(e2) {
            i.call(this, "DataLengthProbe for " + e2), this.propName = e2, this.withStreamInfo(e2, 0);
          }
          __name(s, "s");
          n.inherits(s, i), s.prototype.processChunk = function(e2) {
            if (e2) {
              var t2 = this.streamInfo[this.propName] || 0;
              this.streamInfo[this.propName] = t2 + e2.data.length;
            }
            i.prototype.processChunk.call(this, e2);
          }, t.exports = s;
        }, { "../utils": 32, "./GenericWorker": 28 }], 27: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("./GenericWorker");
          function s(e2) {
            i.call(this, "DataWorker");
            var t2 = this;
            this.dataIsReady = false, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = false, e2.then(function(e3) {
              t2.dataIsReady = true, t2.data = e3, t2.max = e3 && e3.length || 0, t2.type = n.getTypeOf(e3), t2.isPaused || t2._tickAndRepeat();
            }, function(e3) {
              t2.error(e3);
            });
          }
          __name(s, "s");
          n.inherits(s, i), s.prototype.cleanUp = function() {
            i.prototype.cleanUp.call(this), this.data = null;
          }, s.prototype.resume = function() {
            return !!i.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = true, n.delay(this._tickAndRepeat, [], this)), true);
          }, s.prototype._tickAndRepeat = function() {
            this._tickScheduled = false, this.isPaused || this.isFinished || (this._tick(), this.isFinished || (n.delay(this._tickAndRepeat, [], this), this._tickScheduled = true));
          }, s.prototype._tick = function() {
            if (this.isPaused || this.isFinished) return false;
            var e2 = null, t2 = Math.min(this.max, this.index + 16384);
            if (this.index >= this.max) return this.end();
            switch (this.type) {
              case "string":
                e2 = this.data.substring(this.index, t2);
                break;
              case "uint8array":
                e2 = this.data.subarray(this.index, t2);
                break;
              case "array":
              case "nodebuffer":
                e2 = this.data.slice(this.index, t2);
            }
            return this.index = t2, this.push({ data: e2, meta: { percent: this.max ? this.index / this.max * 100 : 0 } });
          }, t.exports = s;
        }, { "../utils": 32, "./GenericWorker": 28 }], 28: [function(e, t, r) {
          "use strict";
          function n(e2) {
            this.name = e2 || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = true, this.isFinished = false, this.isLocked = false, this._listeners = { data: [], end: [], error: [] }, this.previous = null;
          }
          __name(n, "n");
          n.prototype = { push: /* @__PURE__ */ __name(function(e2) {
            this.emit("data", e2);
          }, "push"), end: /* @__PURE__ */ __name(function() {
            if (this.isFinished) return false;
            this.flush();
            try {
              this.emit("end"), this.cleanUp(), this.isFinished = true;
            } catch (e2) {
              this.emit("error", e2);
            }
            return true;
          }, "end"), error: /* @__PURE__ */ __name(function(e2) {
            return !this.isFinished && (this.isPaused ? this.generatedError = e2 : (this.isFinished = true, this.emit("error", e2), this.previous && this.previous.error(e2), this.cleanUp()), true);
          }, "error"), on: /* @__PURE__ */ __name(function(e2, t2) {
            return this._listeners[e2].push(t2), this;
          }, "on"), cleanUp: /* @__PURE__ */ __name(function() {
            this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
          }, "cleanUp"), emit: /* @__PURE__ */ __name(function(e2, t2) {
            if (this._listeners[e2]) for (var r2 = 0; r2 < this._listeners[e2].length; r2++) this._listeners[e2][r2].call(this, t2);
          }, "emit"), pipe: /* @__PURE__ */ __name(function(e2) {
            return e2.registerPrevious(this);
          }, "pipe"), registerPrevious: /* @__PURE__ */ __name(function(e2) {
            if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
            this.streamInfo = e2.streamInfo, this.mergeStreamInfo(), this.previous = e2;
            var t2 = this;
            return e2.on("data", function(e3) {
              t2.processChunk(e3);
            }), e2.on("end", function() {
              t2.end();
            }), e2.on("error", function(e3) {
              t2.error(e3);
            }), this;
          }, "registerPrevious"), pause: /* @__PURE__ */ __name(function() {
            return !this.isPaused && !this.isFinished && (this.isPaused = true, this.previous && this.previous.pause(), true);
          }, "pause"), resume: /* @__PURE__ */ __name(function() {
            if (!this.isPaused || this.isFinished) return false;
            var e2 = this.isPaused = false;
            return this.generatedError && (this.error(this.generatedError), e2 = true), this.previous && this.previous.resume(), !e2;
          }, "resume"), flush: /* @__PURE__ */ __name(function() {
          }, "flush"), processChunk: /* @__PURE__ */ __name(function(e2) {
            this.push(e2);
          }, "processChunk"), withStreamInfo: /* @__PURE__ */ __name(function(e2, t2) {
            return this.extraStreamInfo[e2] = t2, this.mergeStreamInfo(), this;
          }, "withStreamInfo"), mergeStreamInfo: /* @__PURE__ */ __name(function() {
            for (var e2 in this.extraStreamInfo) Object.prototype.hasOwnProperty.call(this.extraStreamInfo, e2) && (this.streamInfo[e2] = this.extraStreamInfo[e2]);
          }, "mergeStreamInfo"), lock: /* @__PURE__ */ __name(function() {
            if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
            this.isLocked = true, this.previous && this.previous.lock();
          }, "lock"), toString: /* @__PURE__ */ __name(function() {
            var e2 = "Worker " + this.name;
            return this.previous ? this.previous + " -> " + e2 : e2;
          }, "toString") }, t.exports = n;
        }, {}], 29: [function(e, t, r) {
          "use strict";
          var h = e("../utils"), i = e("./ConvertWorker"), s = e("./GenericWorker"), u = e("../base64"), n = e("../support"), a = e("../external"), o = null;
          if (n.nodestream) try {
            o = e("../nodejs/NodejsStreamOutputAdapter");
          } catch (e2) {
          }
          function l(e2, o2) {
            return new a.Promise(function(t2, r2) {
              var n2 = [], i2 = e2._internalType, s2 = e2._outputType, a2 = e2._mimeType;
              e2.on("data", function(e3, t3) {
                n2.push(e3), o2 && o2(t3);
              }).on("error", function(e3) {
                n2 = [], r2(e3);
              }).on("end", function() {
                try {
                  var e3 = (function(e4, t3, r3) {
                    switch (e4) {
                      case "blob":
                        return h.newBlob(h.transformTo("arraybuffer", t3), r3);
                      case "base64":
                        return u.encode(t3);
                      default:
                        return h.transformTo(e4, t3);
                    }
                  })(s2, (function(e4, t3) {
                    var r3, n3 = 0, i3 = null, s3 = 0;
                    for (r3 = 0; r3 < t3.length; r3++) s3 += t3[r3].length;
                    switch (e4) {
                      case "string":
                        return t3.join("");
                      case "array":
                        return Array.prototype.concat.apply([], t3);
                      case "uint8array":
                        for (i3 = new Uint8Array(s3), r3 = 0; r3 < t3.length; r3++) i3.set(t3[r3], n3), n3 += t3[r3].length;
                        return i3;
                      case "nodebuffer":
                        return Buffer.concat(t3);
                      default:
                        throw new Error("concat : unsupported type '" + e4 + "'");
                    }
                  })(i2, n2), a2);
                  t2(e3);
                } catch (e4) {
                  r2(e4);
                }
                n2 = [];
              }).resume();
            });
          }
          __name(l, "l");
          function f(e2, t2, r2) {
            var n2 = t2;
            switch (t2) {
              case "blob":
              case "arraybuffer":
                n2 = "uint8array";
                break;
              case "base64":
                n2 = "string";
            }
            try {
              this._internalType = n2, this._outputType = t2, this._mimeType = r2, h.checkSupport(n2), this._worker = e2.pipe(new i(n2)), e2.lock();
            } catch (e3) {
              this._worker = new s("error"), this._worker.error(e3);
            }
          }
          __name(f, "f");
          f.prototype = { accumulate: /* @__PURE__ */ __name(function(e2) {
            return l(this, e2);
          }, "accumulate"), on: /* @__PURE__ */ __name(function(e2, t2) {
            var r2 = this;
            return "data" === e2 ? this._worker.on(e2, function(e3) {
              t2.call(r2, e3.data, e3.meta);
            }) : this._worker.on(e2, function() {
              h.delay(t2, arguments, r2);
            }), this;
          }, "on"), resume: /* @__PURE__ */ __name(function() {
            return h.delay(this._worker.resume, [], this._worker), this;
          }, "resume"), pause: /* @__PURE__ */ __name(function() {
            return this._worker.pause(), this;
          }, "pause"), toNodejsStream: /* @__PURE__ */ __name(function(e2) {
            if (h.checkSupport("nodestream"), "nodebuffer" !== this._outputType) throw new Error(this._outputType + " is not supported by this method");
            return new o(this, { objectMode: "nodebuffer" !== this._outputType }, e2);
          }, "toNodejsStream") }, t.exports = f;
        }, { "../base64": 1, "../external": 6, "../nodejs/NodejsStreamOutputAdapter": 13, "../support": 30, "../utils": 32, "./ConvertWorker": 24, "./GenericWorker": 28 }], 30: [function(e, t, r) {
          "use strict";
          if (r.base64 = true, r.array = true, r.string = true, r.arraybuffer = "undefined" != typeof ArrayBuffer && "undefined" != typeof Uint8Array, r.nodebuffer = "undefined" != typeof Buffer, r.uint8array = "undefined" != typeof Uint8Array, "undefined" == typeof ArrayBuffer) r.blob = false;
          else {
            var n = new ArrayBuffer(0);
            try {
              r.blob = 0 === new Blob([n], { type: "application/zip" }).size;
            } catch (e2) {
              try {
                var i = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
                i.append(n), r.blob = 0 === i.getBlob("application/zip").size;
              } catch (e3) {
                r.blob = false;
              }
            }
          }
          try {
            r.nodestream = !!e("readable-stream").Readable;
          } catch (e2) {
            r.nodestream = false;
          }
        }, { "readable-stream": 16 }], 31: [function(e, t, s) {
          "use strict";
          for (var o = e("./utils"), h = e("./support"), r = e("./nodejsUtils"), n = e("./stream/GenericWorker"), u = new Array(256), i = 0; i < 256; i++) u[i] = 252 <= i ? 6 : 248 <= i ? 5 : 240 <= i ? 4 : 224 <= i ? 3 : 192 <= i ? 2 : 1;
          u[254] = u[254] = 1;
          function a() {
            n.call(this, "utf-8 decode"), this.leftOver = null;
          }
          __name(a, "a");
          function l() {
            n.call(this, "utf-8 encode");
          }
          __name(l, "l");
          s.utf8encode = function(e2) {
            return h.nodebuffer ? r.newBufferFrom(e2, "utf-8") : (function(e3) {
              var t2, r2, n2, i2, s2, a2 = e3.length, o2 = 0;
              for (i2 = 0; i2 < a2; i2++) 55296 == (64512 & (r2 = e3.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o2 += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
              for (t2 = h.uint8array ? new Uint8Array(o2) : new Array(o2), i2 = s2 = 0; s2 < o2; i2++) 55296 == (64512 & (r2 = e3.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t2[s2++] = r2 : (r2 < 2048 ? t2[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t2[s2++] = 224 | r2 >>> 12 : (t2[s2++] = 240 | r2 >>> 18, t2[s2++] = 128 | r2 >>> 12 & 63), t2[s2++] = 128 | r2 >>> 6 & 63), t2[s2++] = 128 | 63 & r2);
              return t2;
            })(e2);
          }, s.utf8decode = function(e2) {
            return h.nodebuffer ? o.transformTo("nodebuffer", e2).toString("utf-8") : (function(e3) {
              var t2, r2, n2, i2, s2 = e3.length, a2 = new Array(2 * s2);
              for (t2 = r2 = 0; t2 < s2; ) if ((n2 = e3[t2++]) < 128) a2[r2++] = n2;
              else if (4 < (i2 = u[n2])) a2[r2++] = 65533, t2 += i2 - 1;
              else {
                for (n2 &= 2 === i2 ? 31 : 3 === i2 ? 15 : 7; 1 < i2 && t2 < s2; ) n2 = n2 << 6 | 63 & e3[t2++], i2--;
                1 < i2 ? a2[r2++] = 65533 : n2 < 65536 ? a2[r2++] = n2 : (n2 -= 65536, a2[r2++] = 55296 | n2 >> 10 & 1023, a2[r2++] = 56320 | 1023 & n2);
              }
              return a2.length !== r2 && (a2.subarray ? a2 = a2.subarray(0, r2) : a2.length = r2), o.applyFromCharCode(a2);
            })(e2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2));
          }, o.inherits(a, n), a.prototype.processChunk = function(e2) {
            var t2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2.data);
            if (this.leftOver && this.leftOver.length) {
              if (h.uint8array) {
                var r2 = t2;
                (t2 = new Uint8Array(r2.length + this.leftOver.length)).set(this.leftOver, 0), t2.set(r2, this.leftOver.length);
              } else t2 = this.leftOver.concat(t2);
              this.leftOver = null;
            }
            var n2 = (function(e3, t3) {
              var r3;
              for ((t3 = t3 || e3.length) > e3.length && (t3 = e3.length), r3 = t3 - 1; 0 <= r3 && 128 == (192 & e3[r3]); ) r3--;
              return r3 < 0 ? t3 : 0 === r3 ? t3 : r3 + u[e3[r3]] > t3 ? r3 : t3;
            })(t2), i2 = t2;
            n2 !== t2.length && (h.uint8array ? (i2 = t2.subarray(0, n2), this.leftOver = t2.subarray(n2, t2.length)) : (i2 = t2.slice(0, n2), this.leftOver = t2.slice(n2, t2.length))), this.push({ data: s.utf8decode(i2), meta: e2.meta });
          }, a.prototype.flush = function() {
            this.leftOver && this.leftOver.length && (this.push({ data: s.utf8decode(this.leftOver), meta: {} }), this.leftOver = null);
          }, s.Utf8DecodeWorker = a, o.inherits(l, n), l.prototype.processChunk = function(e2) {
            this.push({ data: s.utf8encode(e2.data), meta: e2.meta });
          }, s.Utf8EncodeWorker = l;
        }, { "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./support": 30, "./utils": 32 }], 32: [function(e, t, a) {
          "use strict";
          var o = e("./support"), h = e("./base64"), r = e("./nodejsUtils"), u = e("./external");
          function n(e2) {
            return e2;
          }
          __name(n, "n");
          function l(e2, t2) {
            for (var r2 = 0; r2 < e2.length; ++r2) t2[r2] = 255 & e2.charCodeAt(r2);
            return t2;
          }
          __name(l, "l");
          e("setimmediate"), a.newBlob = function(t2, r2) {
            a.checkSupport("blob");
            try {
              return new Blob([t2], { type: r2 });
            } catch (e2) {
              try {
                var n2 = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
                return n2.append(t2), n2.getBlob(r2);
              } catch (e3) {
                throw new Error("Bug : can't construct the Blob.");
              }
            }
          };
          var i = { stringifyByChunk: /* @__PURE__ */ __name(function(e2, t2, r2) {
            var n2 = [], i2 = 0, s2 = e2.length;
            if (s2 <= r2) return String.fromCharCode.apply(null, e2);
            for (; i2 < s2; ) "array" === t2 || "nodebuffer" === t2 ? n2.push(String.fromCharCode.apply(null, e2.slice(i2, Math.min(i2 + r2, s2)))) : n2.push(String.fromCharCode.apply(null, e2.subarray(i2, Math.min(i2 + r2, s2)))), i2 += r2;
            return n2.join("");
          }, "stringifyByChunk"), stringifyByChar: /* @__PURE__ */ __name(function(e2) {
            for (var t2 = "", r2 = 0; r2 < e2.length; r2++) t2 += String.fromCharCode(e2[r2]);
            return t2;
          }, "stringifyByChar"), applyCanBeUsed: { uint8array: (function() {
            try {
              return o.uint8array && 1 === String.fromCharCode.apply(null, new Uint8Array(1)).length;
            } catch (e2) {
              return false;
            }
          })(), nodebuffer: (function() {
            try {
              return o.nodebuffer && 1 === String.fromCharCode.apply(null, r.allocBuffer(1)).length;
            } catch (e2) {
              return false;
            }
          })() } };
          function s(e2) {
            var t2 = 65536, r2 = a.getTypeOf(e2), n2 = true;
            if ("uint8array" === r2 ? n2 = i.applyCanBeUsed.uint8array : "nodebuffer" === r2 && (n2 = i.applyCanBeUsed.nodebuffer), n2) for (; 1 < t2; ) try {
              return i.stringifyByChunk(e2, r2, t2);
            } catch (e3) {
              t2 = Math.floor(t2 / 2);
            }
            return i.stringifyByChar(e2);
          }
          __name(s, "s");
          function f(e2, t2) {
            for (var r2 = 0; r2 < e2.length; r2++) t2[r2] = e2[r2];
            return t2;
          }
          __name(f, "f");
          a.applyFromCharCode = s;
          var c = {};
          c.string = { string: n, array: /* @__PURE__ */ __name(function(e2) {
            return l(e2, new Array(e2.length));
          }, "array"), arraybuffer: /* @__PURE__ */ __name(function(e2) {
            return c.string.uint8array(e2).buffer;
          }, "arraybuffer"), uint8array: /* @__PURE__ */ __name(function(e2) {
            return l(e2, new Uint8Array(e2.length));
          }, "uint8array"), nodebuffer: /* @__PURE__ */ __name(function(e2) {
            return l(e2, r.allocBuffer(e2.length));
          }, "nodebuffer") }, c.array = { string: s, array: n, arraybuffer: /* @__PURE__ */ __name(function(e2) {
            return new Uint8Array(e2).buffer;
          }, "arraybuffer"), uint8array: /* @__PURE__ */ __name(function(e2) {
            return new Uint8Array(e2);
          }, "uint8array"), nodebuffer: /* @__PURE__ */ __name(function(e2) {
            return r.newBufferFrom(e2);
          }, "nodebuffer") }, c.arraybuffer = { string: /* @__PURE__ */ __name(function(e2) {
            return s(new Uint8Array(e2));
          }, "string"), array: /* @__PURE__ */ __name(function(e2) {
            return f(new Uint8Array(e2), new Array(e2.byteLength));
          }, "array"), arraybuffer: n, uint8array: /* @__PURE__ */ __name(function(e2) {
            return new Uint8Array(e2);
          }, "uint8array"), nodebuffer: /* @__PURE__ */ __name(function(e2) {
            return r.newBufferFrom(new Uint8Array(e2));
          }, "nodebuffer") }, c.uint8array = { string: s, array: /* @__PURE__ */ __name(function(e2) {
            return f(e2, new Array(e2.length));
          }, "array"), arraybuffer: /* @__PURE__ */ __name(function(e2) {
            return e2.buffer;
          }, "arraybuffer"), uint8array: n, nodebuffer: /* @__PURE__ */ __name(function(e2) {
            return r.newBufferFrom(e2);
          }, "nodebuffer") }, c.nodebuffer = { string: s, array: /* @__PURE__ */ __name(function(e2) {
            return f(e2, new Array(e2.length));
          }, "array"), arraybuffer: /* @__PURE__ */ __name(function(e2) {
            return c.nodebuffer.uint8array(e2).buffer;
          }, "arraybuffer"), uint8array: /* @__PURE__ */ __name(function(e2) {
            return f(e2, new Uint8Array(e2.length));
          }, "uint8array"), nodebuffer: n }, a.transformTo = function(e2, t2) {
            if (t2 = t2 || "", !e2) return t2;
            a.checkSupport(e2);
            var r2 = a.getTypeOf(t2);
            return c[r2][e2](t2);
          }, a.resolve = function(e2) {
            for (var t2 = e2.split("/"), r2 = [], n2 = 0; n2 < t2.length; n2++) {
              var i2 = t2[n2];
              "." === i2 || "" === i2 && 0 !== n2 && n2 !== t2.length - 1 || (".." === i2 ? r2.pop() : r2.push(i2));
            }
            return r2.join("/");
          }, a.getTypeOf = function(e2) {
            return "string" == typeof e2 ? "string" : "[object Array]" === Object.prototype.toString.call(e2) ? "array" : o.nodebuffer && r.isBuffer(e2) ? "nodebuffer" : o.uint8array && e2 instanceof Uint8Array ? "uint8array" : o.arraybuffer && e2 instanceof ArrayBuffer ? "arraybuffer" : void 0;
          }, a.checkSupport = function(e2) {
            if (!o[e2.toLowerCase()]) throw new Error(e2 + " is not supported by this platform");
          }, a.MAX_VALUE_16BITS = 65535, a.MAX_VALUE_32BITS = -1, a.pretty = function(e2) {
            var t2, r2, n2 = "";
            for (r2 = 0; r2 < (e2 || "").length; r2++) n2 += "\\x" + ((t2 = e2.charCodeAt(r2)) < 16 ? "0" : "") + t2.toString(16).toUpperCase();
            return n2;
          }, a.delay = function(e2, t2, r2) {
            setImmediate(function() {
              e2.apply(r2 || null, t2 || []);
            });
          }, a.inherits = function(e2, t2) {
            function r2() {
            }
            __name(r2, "r");
            r2.prototype = t2.prototype, e2.prototype = new r2();
          }, a.extend = function() {
            var e2, t2, r2 = {};
            for (e2 = 0; e2 < arguments.length; e2++) for (t2 in arguments[e2]) Object.prototype.hasOwnProperty.call(arguments[e2], t2) && void 0 === r2[t2] && (r2[t2] = arguments[e2][t2]);
            return r2;
          }, a.prepareContent = function(r2, e2, n2, i2, s2) {
            return u.Promise.resolve(e2).then(function(n3) {
              return o.blob && (n3 instanceof Blob || -1 !== ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(n3))) && "undefined" != typeof FileReader ? new u.Promise(function(t2, r3) {
                var e3 = new FileReader();
                e3.onload = function(e4) {
                  t2(e4.target.result);
                }, e3.onerror = function(e4) {
                  r3(e4.target.error);
                }, e3.readAsArrayBuffer(n3);
              }) : n3;
            }).then(function(e3) {
              var t2 = a.getTypeOf(e3);
              return t2 ? ("arraybuffer" === t2 ? e3 = a.transformTo("uint8array", e3) : "string" === t2 && (s2 ? e3 = h.decode(e3) : n2 && true !== i2 && (e3 = (function(e4) {
                return l(e4, o.uint8array ? new Uint8Array(e4.length) : new Array(e4.length));
              })(e3))), e3) : u.Promise.reject(new Error("Can't read the data of '" + r2 + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
            });
          };
        }, { "./base64": 1, "./external": 6, "./nodejsUtils": 14, "./support": 30, setimmediate: 54 }], 33: [function(e, t, r) {
          "use strict";
          var n = e("./reader/readerFor"), i = e("./utils"), s = e("./signature"), a = e("./zipEntry"), o = e("./support");
          function h(e2) {
            this.files = [], this.loadOptions = e2;
          }
          __name(h, "h");
          h.prototype = { checkSignature: /* @__PURE__ */ __name(function(e2) {
            if (!this.reader.readAndCheckSignature(e2)) {
              this.reader.index -= 4;
              var t2 = this.reader.readString(4);
              throw new Error("Corrupted zip or bug: unexpected signature (" + i.pretty(t2) + ", expected " + i.pretty(e2) + ")");
            }
          }, "checkSignature"), isSignature: /* @__PURE__ */ __name(function(e2, t2) {
            var r2 = this.reader.index;
            this.reader.setIndex(e2);
            var n2 = this.reader.readString(4) === t2;
            return this.reader.setIndex(r2), n2;
          }, "isSignature"), readBlockEndOfCentral: /* @__PURE__ */ __name(function() {
            this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
            var e2 = this.reader.readData(this.zipCommentLength), t2 = o.uint8array ? "uint8array" : "array", r2 = i.transformTo(t2, e2);
            this.zipComment = this.loadOptions.decodeFileName(r2);
          }, "readBlockEndOfCentral"), readBlockZip64EndOfCentral: /* @__PURE__ */ __name(function() {
            this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
            for (var e2, t2, r2, n2 = this.zip64EndOfCentralSize - 44; 0 < n2; ) e2 = this.reader.readInt(2), t2 = this.reader.readInt(4), r2 = this.reader.readData(t2), this.zip64ExtensibleData[e2] = { id: e2, length: t2, value: r2 };
          }, "readBlockZip64EndOfCentral"), readBlockZip64EndOfCentralLocator: /* @__PURE__ */ __name(function() {
            if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), 1 < this.disksCount) throw new Error("Multi-volumes zip are not supported");
          }, "readBlockZip64EndOfCentralLocator"), readLocalFiles: /* @__PURE__ */ __name(function() {
            var e2, t2;
            for (e2 = 0; e2 < this.files.length; e2++) t2 = this.files[e2], this.reader.setIndex(t2.localHeaderOffset), this.checkSignature(s.LOCAL_FILE_HEADER), t2.readLocalPart(this.reader), t2.handleUTF8(), t2.processAttributes();
          }, "readLocalFiles"), readCentralDir: /* @__PURE__ */ __name(function() {
            var e2;
            for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(s.CENTRAL_FILE_HEADER); ) (e2 = new a({ zip64: this.zip64 }, this.loadOptions)).readCentralPart(this.reader), this.files.push(e2);
            if (this.centralDirRecords !== this.files.length && 0 !== this.centralDirRecords && 0 === this.files.length) throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
          }, "readCentralDir"), readEndOfCentral: /* @__PURE__ */ __name(function() {
            var e2 = this.reader.lastIndexOfSignature(s.CENTRAL_DIRECTORY_END);
            if (e2 < 0) throw !this.isSignature(0, s.LOCAL_FILE_HEADER) ? new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html") : new Error("Corrupted zip: can't find end of central directory");
            this.reader.setIndex(e2);
            var t2 = e2;
            if (this.checkSignature(s.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === i.MAX_VALUE_16BITS || this.diskWithCentralDirStart === i.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === i.MAX_VALUE_16BITS || this.centralDirRecords === i.MAX_VALUE_16BITS || this.centralDirSize === i.MAX_VALUE_32BITS || this.centralDirOffset === i.MAX_VALUE_32BITS) {
              if (this.zip64 = true, (e2 = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
              if (this.reader.setIndex(e2), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, s.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0)) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
              this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
            }
            var r2 = this.centralDirOffset + this.centralDirSize;
            this.zip64 && (r2 += 20, r2 += 12 + this.zip64EndOfCentralSize);
            var n2 = t2 - r2;
            if (0 < n2) this.isSignature(t2, s.CENTRAL_FILE_HEADER) || (this.reader.zero = n2);
            else if (n2 < 0) throw new Error("Corrupted zip: missing " + Math.abs(n2) + " bytes.");
          }, "readEndOfCentral"), prepareReader: /* @__PURE__ */ __name(function(e2) {
            this.reader = n(e2);
          }, "prepareReader"), load: /* @__PURE__ */ __name(function(e2) {
            this.prepareReader(e2), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
          }, "load") }, t.exports = h;
        }, { "./reader/readerFor": 22, "./signature": 23, "./support": 30, "./utils": 32, "./zipEntry": 34 }], 34: [function(e, t, r) {
          "use strict";
          var n = e("./reader/readerFor"), s = e("./utils"), i = e("./compressedObject"), a = e("./crc32"), o = e("./utf8"), h = e("./compressions"), u = e("./support");
          function l(e2, t2) {
            this.options = e2, this.loadOptions = t2;
          }
          __name(l, "l");
          l.prototype = { isEncrypted: /* @__PURE__ */ __name(function() {
            return 1 == (1 & this.bitFlag);
          }, "isEncrypted"), useUTF8: /* @__PURE__ */ __name(function() {
            return 2048 == (2048 & this.bitFlag);
          }, "useUTF8"), readLocalPart: /* @__PURE__ */ __name(function(e2) {
            var t2, r2;
            if (e2.skip(22), this.fileNameLength = e2.readInt(2), r2 = e2.readInt(2), this.fileName = e2.readData(this.fileNameLength), e2.skip(r2), -1 === this.compressedSize || -1 === this.uncompressedSize) throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
            if (null === (t2 = (function(e3) {
              for (var t3 in h) if (Object.prototype.hasOwnProperty.call(h, t3) && h[t3].magic === e3) return h[t3];
              return null;
            })(this.compressionMethod))) throw new Error("Corrupted zip : compression " + s.pretty(this.compressionMethod) + " unknown (inner file : " + s.transformTo("string", this.fileName) + ")");
            this.decompressed = new i(this.compressedSize, this.uncompressedSize, this.crc32, t2, e2.readData(this.compressedSize));
          }, "readLocalPart"), readCentralPart: /* @__PURE__ */ __name(function(e2) {
            this.versionMadeBy = e2.readInt(2), e2.skip(2), this.bitFlag = e2.readInt(2), this.compressionMethod = e2.readString(2), this.date = e2.readDate(), this.crc32 = e2.readInt(4), this.compressedSize = e2.readInt(4), this.uncompressedSize = e2.readInt(4);
            var t2 = e2.readInt(2);
            if (this.extraFieldsLength = e2.readInt(2), this.fileCommentLength = e2.readInt(2), this.diskNumberStart = e2.readInt(2), this.internalFileAttributes = e2.readInt(2), this.externalFileAttributes = e2.readInt(4), this.localHeaderOffset = e2.readInt(4), this.isEncrypted()) throw new Error("Encrypted zip are not supported");
            e2.skip(t2), this.readExtraFields(e2), this.parseZIP64ExtraField(e2), this.fileComment = e2.readData(this.fileCommentLength);
          }, "readCentralPart"), processAttributes: /* @__PURE__ */ __name(function() {
            this.unixPermissions = null, this.dosPermissions = null;
            var e2 = this.versionMadeBy >> 8;
            this.dir = !!(16 & this.externalFileAttributes), 0 == e2 && (this.dosPermissions = 63 & this.externalFileAttributes), 3 == e2 && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || "/" !== this.fileNameStr.slice(-1) || (this.dir = true);
          }, "processAttributes"), parseZIP64ExtraField: /* @__PURE__ */ __name(function() {
            if (this.extraFields[1]) {
              var e2 = n(this.extraFields[1].value);
              this.uncompressedSize === s.MAX_VALUE_32BITS && (this.uncompressedSize = e2.readInt(8)), this.compressedSize === s.MAX_VALUE_32BITS && (this.compressedSize = e2.readInt(8)), this.localHeaderOffset === s.MAX_VALUE_32BITS && (this.localHeaderOffset = e2.readInt(8)), this.diskNumberStart === s.MAX_VALUE_32BITS && (this.diskNumberStart = e2.readInt(4));
            }
          }, "parseZIP64ExtraField"), readExtraFields: /* @__PURE__ */ __name(function(e2) {
            var t2, r2, n2, i2 = e2.index + this.extraFieldsLength;
            for (this.extraFields || (this.extraFields = {}); e2.index + 4 < i2; ) t2 = e2.readInt(2), r2 = e2.readInt(2), n2 = e2.readData(r2), this.extraFields[t2] = { id: t2, length: r2, value: n2 };
            e2.setIndex(i2);
          }, "readExtraFields"), handleUTF8: /* @__PURE__ */ __name(function() {
            var e2 = u.uint8array ? "uint8array" : "array";
            if (this.useUTF8()) this.fileNameStr = o.utf8decode(this.fileName), this.fileCommentStr = o.utf8decode(this.fileComment);
            else {
              var t2 = this.findExtraFieldUnicodePath();
              if (null !== t2) this.fileNameStr = t2;
              else {
                var r2 = s.transformTo(e2, this.fileName);
                this.fileNameStr = this.loadOptions.decodeFileName(r2);
              }
              var n2 = this.findExtraFieldUnicodeComment();
              if (null !== n2) this.fileCommentStr = n2;
              else {
                var i2 = s.transformTo(e2, this.fileComment);
                this.fileCommentStr = this.loadOptions.decodeFileName(i2);
              }
            }
          }, "handleUTF8"), findExtraFieldUnicodePath: /* @__PURE__ */ __name(function() {
            var e2 = this.extraFields[28789];
            if (e2) {
              var t2 = n(e2.value);
              return 1 !== t2.readInt(1) ? null : a(this.fileName) !== t2.readInt(4) ? null : o.utf8decode(t2.readData(e2.length - 5));
            }
            return null;
          }, "findExtraFieldUnicodePath"), findExtraFieldUnicodeComment: /* @__PURE__ */ __name(function() {
            var e2 = this.extraFields[25461];
            if (e2) {
              var t2 = n(e2.value);
              return 1 !== t2.readInt(1) ? null : a(this.fileComment) !== t2.readInt(4) ? null : o.utf8decode(t2.readData(e2.length - 5));
            }
            return null;
          }, "findExtraFieldUnicodeComment") }, t.exports = l;
        }, { "./compressedObject": 2, "./compressions": 3, "./crc32": 4, "./reader/readerFor": 22, "./support": 30, "./utf8": 31, "./utils": 32 }], 35: [function(e, t, r) {
          "use strict";
          function n(e2, t2, r2) {
            this.name = e2, this.dir = r2.dir, this.date = r2.date, this.comment = r2.comment, this.unixPermissions = r2.unixPermissions, this.dosPermissions = r2.dosPermissions, this._data = t2, this._dataBinary = r2.binary, this.options = { compression: r2.compression, compressionOptions: r2.compressionOptions };
          }
          __name(n, "n");
          var s = e("./stream/StreamHelper"), i = e("./stream/DataWorker"), a = e("./utf8"), o = e("./compressedObject"), h = e("./stream/GenericWorker");
          n.prototype = { internalStream: /* @__PURE__ */ __name(function(e2) {
            var t2 = null, r2 = "string";
            try {
              if (!e2) throw new Error("No output type specified.");
              var n2 = "string" === (r2 = e2.toLowerCase()) || "text" === r2;
              "binarystring" !== r2 && "text" !== r2 || (r2 = "string"), t2 = this._decompressWorker();
              var i2 = !this._dataBinary;
              i2 && !n2 && (t2 = t2.pipe(new a.Utf8EncodeWorker())), !i2 && n2 && (t2 = t2.pipe(new a.Utf8DecodeWorker()));
            } catch (e3) {
              (t2 = new h("error")).error(e3);
            }
            return new s(t2, r2, "");
          }, "internalStream"), async: /* @__PURE__ */ __name(function(e2, t2) {
            return this.internalStream(e2).accumulate(t2);
          }, "async"), nodeStream: /* @__PURE__ */ __name(function(e2, t2) {
            return this.internalStream(e2 || "nodebuffer").toNodejsStream(t2);
          }, "nodeStream"), _compressWorker: /* @__PURE__ */ __name(function(e2, t2) {
            if (this._data instanceof o && this._data.compression.magic === e2.magic) return this._data.getCompressedWorker();
            var r2 = this._decompressWorker();
            return this._dataBinary || (r2 = r2.pipe(new a.Utf8EncodeWorker())), o.createWorkerFrom(r2, e2, t2);
          }, "_compressWorker"), _decompressWorker: /* @__PURE__ */ __name(function() {
            return this._data instanceof o ? this._data.getContentWorker() : this._data instanceof h ? this._data : new i(this._data);
          }, "_decompressWorker") };
          for (var u = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], l = function() {
            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
          }, f = 0; f < u.length; f++) n.prototype[u[f]] = l;
          t.exports = n;
        }, { "./compressedObject": 2, "./stream/DataWorker": 27, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31 }], 36: [function(e, l, t) {
          (function(t2) {
            "use strict";
            var r, n, e2 = t2.MutationObserver || t2.WebKitMutationObserver;
            if (e2) {
              var i = 0, s = new e2(u), a = t2.document.createTextNode("");
              s.observe(a, { characterData: true }), r = /* @__PURE__ */ __name(function() {
                a.data = i = ++i % 2;
              }, "r");
            } else if (t2.setImmediate || void 0 === t2.MessageChannel) r = "document" in t2 && "onreadystatechange" in t2.document.createElement("script") ? function() {
              var e3 = t2.document.createElement("script");
              e3.onreadystatechange = function() {
                u(), e3.onreadystatechange = null, e3.parentNode.removeChild(e3), e3 = null;
              }, t2.document.documentElement.appendChild(e3);
            } : function() {
              setTimeout(u, 0);
            };
            else {
              var o = new t2.MessageChannel();
              o.port1.onmessage = u, r = /* @__PURE__ */ __name(function() {
                o.port2.postMessage(0);
              }, "r");
            }
            var h = [];
            function u() {
              var e3, t3;
              n = true;
              for (var r2 = h.length; r2; ) {
                for (t3 = h, h = [], e3 = -1; ++e3 < r2; ) t3[e3]();
                r2 = h.length;
              }
              n = false;
            }
            __name(u, "u");
            l.exports = function(e3) {
              1 !== h.push(e3) || n || r();
            };
          }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
        }, {}], 37: [function(e, t, r) {
          "use strict";
          var i = e("immediate");
          function u() {
          }
          __name(u, "u");
          var l = {}, s = ["REJECTED"], a = ["FULFILLED"], n = ["PENDING"];
          function o(e2) {
            if ("function" != typeof e2) throw new TypeError("resolver must be a function");
            this.state = n, this.queue = [], this.outcome = void 0, e2 !== u && d(this, e2);
          }
          __name(o, "o");
          function h(e2, t2, r2) {
            this.promise = e2, "function" == typeof t2 && (this.onFulfilled = t2, this.callFulfilled = this.otherCallFulfilled), "function" == typeof r2 && (this.onRejected = r2, this.callRejected = this.otherCallRejected);
          }
          __name(h, "h");
          function f(t2, r2, n2) {
            i(function() {
              var e2;
              try {
                e2 = r2(n2);
              } catch (e3) {
                return l.reject(t2, e3);
              }
              e2 === t2 ? l.reject(t2, new TypeError("Cannot resolve promise with itself")) : l.resolve(t2, e2);
            });
          }
          __name(f, "f");
          function c(e2) {
            var t2 = e2 && e2.then;
            if (e2 && ("object" == typeof e2 || "function" == typeof e2) && "function" == typeof t2) return function() {
              t2.apply(e2, arguments);
            };
          }
          __name(c, "c");
          function d(t2, e2) {
            var r2 = false;
            function n2(e3) {
              r2 || (r2 = true, l.reject(t2, e3));
            }
            __name(n2, "n");
            function i2(e3) {
              r2 || (r2 = true, l.resolve(t2, e3));
            }
            __name(i2, "i");
            var s2 = p(function() {
              e2(i2, n2);
            });
            "error" === s2.status && n2(s2.value);
          }
          __name(d, "d");
          function p(e2, t2) {
            var r2 = {};
            try {
              r2.value = e2(t2), r2.status = "success";
            } catch (e3) {
              r2.status = "error", r2.value = e3;
            }
            return r2;
          }
          __name(p, "p");
          (t.exports = o).prototype.finally = function(t2) {
            if ("function" != typeof t2) return this;
            var r2 = this.constructor;
            return this.then(function(e2) {
              return r2.resolve(t2()).then(function() {
                return e2;
              });
            }, function(e2) {
              return r2.resolve(t2()).then(function() {
                throw e2;
              });
            });
          }, o.prototype.catch = function(e2) {
            return this.then(null, e2);
          }, o.prototype.then = function(e2, t2) {
            if ("function" != typeof e2 && this.state === a || "function" != typeof t2 && this.state === s) return this;
            var r2 = new this.constructor(u);
            this.state !== n ? f(r2, this.state === a ? e2 : t2, this.outcome) : this.queue.push(new h(r2, e2, t2));
            return r2;
          }, h.prototype.callFulfilled = function(e2) {
            l.resolve(this.promise, e2);
          }, h.prototype.otherCallFulfilled = function(e2) {
            f(this.promise, this.onFulfilled, e2);
          }, h.prototype.callRejected = function(e2) {
            l.reject(this.promise, e2);
          }, h.prototype.otherCallRejected = function(e2) {
            f(this.promise, this.onRejected, e2);
          }, l.resolve = function(e2, t2) {
            var r2 = p(c, t2);
            if ("error" === r2.status) return l.reject(e2, r2.value);
            var n2 = r2.value;
            if (n2) d(e2, n2);
            else {
              e2.state = a, e2.outcome = t2;
              for (var i2 = -1, s2 = e2.queue.length; ++i2 < s2; ) e2.queue[i2].callFulfilled(t2);
            }
            return e2;
          }, l.reject = function(e2, t2) {
            e2.state = s, e2.outcome = t2;
            for (var r2 = -1, n2 = e2.queue.length; ++r2 < n2; ) e2.queue[r2].callRejected(t2);
            return e2;
          }, o.resolve = function(e2) {
            if (e2 instanceof this) return e2;
            return l.resolve(new this(u), e2);
          }, o.reject = function(e2) {
            var t2 = new this(u);
            return l.reject(t2, e2);
          }, o.all = function(e2) {
            var r2 = this;
            if ("[object Array]" !== Object.prototype.toString.call(e2)) return this.reject(new TypeError("must be an array"));
            var n2 = e2.length, i2 = false;
            if (!n2) return this.resolve([]);
            var s2 = new Array(n2), a2 = 0, t2 = -1, o2 = new this(u);
            for (; ++t2 < n2; ) h2(e2[t2], t2);
            return o2;
            function h2(e3, t3) {
              r2.resolve(e3).then(function(e4) {
                s2[t3] = e4, ++a2 !== n2 || i2 || (i2 = true, l.resolve(o2, s2));
              }, function(e4) {
                i2 || (i2 = true, l.reject(o2, e4));
              });
            }
            __name(h2, "h");
          }, o.race = function(e2) {
            var t2 = this;
            if ("[object Array]" !== Object.prototype.toString.call(e2)) return this.reject(new TypeError("must be an array"));
            var r2 = e2.length, n2 = false;
            if (!r2) return this.resolve([]);
            var i2 = -1, s2 = new this(u);
            for (; ++i2 < r2; ) a2 = e2[i2], t2.resolve(a2).then(function(e3) {
              n2 || (n2 = true, l.resolve(s2, e3));
            }, function(e3) {
              n2 || (n2 = true, l.reject(s2, e3));
            });
            var a2;
            return s2;
          };
        }, { immediate: 36 }], 38: [function(e, t, r) {
          "use strict";
          var n = {};
          (0, e("./lib/utils/common").assign)(n, e("./lib/deflate"), e("./lib/inflate"), e("./lib/zlib/constants")), t.exports = n;
        }, { "./lib/deflate": 39, "./lib/inflate": 40, "./lib/utils/common": 41, "./lib/zlib/constants": 44 }], 39: [function(e, t, r) {
          "use strict";
          var a = e("./zlib/deflate"), o = e("./utils/common"), h = e("./utils/strings"), i = e("./zlib/messages"), s = e("./zlib/zstream"), u = Object.prototype.toString, l = 0, f = -1, c = 0, d = 8;
          function p(e2) {
            if (!(this instanceof p)) return new p(e2);
            this.options = o.assign({ level: f, method: d, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: c, to: "" }, e2 || {});
            var t2 = this.options;
            t2.raw && 0 < t2.windowBits ? t2.windowBits = -t2.windowBits : t2.gzip && 0 < t2.windowBits && t2.windowBits < 16 && (t2.windowBits += 16), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new s(), this.strm.avail_out = 0;
            var r2 = a.deflateInit2(this.strm, t2.level, t2.method, t2.windowBits, t2.memLevel, t2.strategy);
            if (r2 !== l) throw new Error(i[r2]);
            if (t2.header && a.deflateSetHeader(this.strm, t2.header), t2.dictionary) {
              var n2;
              if (n2 = "string" == typeof t2.dictionary ? h.string2buf(t2.dictionary) : "[object ArrayBuffer]" === u.call(t2.dictionary) ? new Uint8Array(t2.dictionary) : t2.dictionary, (r2 = a.deflateSetDictionary(this.strm, n2)) !== l) throw new Error(i[r2]);
              this._dict_set = true;
            }
          }
          __name(p, "p");
          function n(e2, t2) {
            var r2 = new p(t2);
            if (r2.push(e2, true), r2.err) throw r2.msg || i[r2.err];
            return r2.result;
          }
          __name(n, "n");
          p.prototype.push = function(e2, t2) {
            var r2, n2, i2 = this.strm, s2 = this.options.chunkSize;
            if (this.ended) return false;
            n2 = t2 === ~~t2 ? t2 : true === t2 ? 4 : 0, "string" == typeof e2 ? i2.input = h.string2buf(e2) : "[object ArrayBuffer]" === u.call(e2) ? i2.input = new Uint8Array(e2) : i2.input = e2, i2.next_in = 0, i2.avail_in = i2.input.length;
            do {
              if (0 === i2.avail_out && (i2.output = new o.Buf8(s2), i2.next_out = 0, i2.avail_out = s2), 1 !== (r2 = a.deflate(i2, n2)) && r2 !== l) return this.onEnd(r2), !(this.ended = true);
              0 !== i2.avail_out && (0 !== i2.avail_in || 4 !== n2 && 2 !== n2) || ("string" === this.options.to ? this.onData(h.buf2binstring(o.shrinkBuf(i2.output, i2.next_out))) : this.onData(o.shrinkBuf(i2.output, i2.next_out)));
            } while ((0 < i2.avail_in || 0 === i2.avail_out) && 1 !== r2);
            return 4 === n2 ? (r2 = a.deflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === l) : 2 !== n2 || (this.onEnd(l), !(i2.avail_out = 0));
          }, p.prototype.onData = function(e2) {
            this.chunks.push(e2);
          }, p.prototype.onEnd = function(e2) {
            e2 === l && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
          }, r.Deflate = p, r.deflate = n, r.deflateRaw = function(e2, t2) {
            return (t2 = t2 || {}).raw = true, n(e2, t2);
          }, r.gzip = function(e2, t2) {
            return (t2 = t2 || {}).gzip = true, n(e2, t2);
          };
        }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/deflate": 46, "./zlib/messages": 51, "./zlib/zstream": 53 }], 40: [function(e, t, r) {
          "use strict";
          var c = e("./zlib/inflate"), d = e("./utils/common"), p = e("./utils/strings"), m = e("./zlib/constants"), n = e("./zlib/messages"), i = e("./zlib/zstream"), s = e("./zlib/gzheader"), _ = Object.prototype.toString;
          function a(e2) {
            if (!(this instanceof a)) return new a(e2);
            this.options = d.assign({ chunkSize: 16384, windowBits: 0, to: "" }, e2 || {});
            var t2 = this.options;
            t2.raw && 0 <= t2.windowBits && t2.windowBits < 16 && (t2.windowBits = -t2.windowBits, 0 === t2.windowBits && (t2.windowBits = -15)), !(0 <= t2.windowBits && t2.windowBits < 16) || e2 && e2.windowBits || (t2.windowBits += 32), 15 < t2.windowBits && t2.windowBits < 48 && 0 == (15 & t2.windowBits) && (t2.windowBits |= 15), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new i(), this.strm.avail_out = 0;
            var r2 = c.inflateInit2(this.strm, t2.windowBits);
            if (r2 !== m.Z_OK) throw new Error(n[r2]);
            this.header = new s(), c.inflateGetHeader(this.strm, this.header);
          }
          __name(a, "a");
          function o(e2, t2) {
            var r2 = new a(t2);
            if (r2.push(e2, true), r2.err) throw r2.msg || n[r2.err];
            return r2.result;
          }
          __name(o, "o");
          a.prototype.push = function(e2, t2) {
            var r2, n2, i2, s2, a2, o2, h = this.strm, u = this.options.chunkSize, l = this.options.dictionary, f = false;
            if (this.ended) return false;
            n2 = t2 === ~~t2 ? t2 : true === t2 ? m.Z_FINISH : m.Z_NO_FLUSH, "string" == typeof e2 ? h.input = p.binstring2buf(e2) : "[object ArrayBuffer]" === _.call(e2) ? h.input = new Uint8Array(e2) : h.input = e2, h.next_in = 0, h.avail_in = h.input.length;
            do {
              if (0 === h.avail_out && (h.output = new d.Buf8(u), h.next_out = 0, h.avail_out = u), (r2 = c.inflate(h, m.Z_NO_FLUSH)) === m.Z_NEED_DICT && l && (o2 = "string" == typeof l ? p.string2buf(l) : "[object ArrayBuffer]" === _.call(l) ? new Uint8Array(l) : l, r2 = c.inflateSetDictionary(this.strm, o2)), r2 === m.Z_BUF_ERROR && true === f && (r2 = m.Z_OK, f = false), r2 !== m.Z_STREAM_END && r2 !== m.Z_OK) return this.onEnd(r2), !(this.ended = true);
              h.next_out && (0 !== h.avail_out && r2 !== m.Z_STREAM_END && (0 !== h.avail_in || n2 !== m.Z_FINISH && n2 !== m.Z_SYNC_FLUSH) || ("string" === this.options.to ? (i2 = p.utf8border(h.output, h.next_out), s2 = h.next_out - i2, a2 = p.buf2string(h.output, i2), h.next_out = s2, h.avail_out = u - s2, s2 && d.arraySet(h.output, h.output, i2, s2, 0), this.onData(a2)) : this.onData(d.shrinkBuf(h.output, h.next_out)))), 0 === h.avail_in && 0 === h.avail_out && (f = true);
            } while ((0 < h.avail_in || 0 === h.avail_out) && r2 !== m.Z_STREAM_END);
            return r2 === m.Z_STREAM_END && (n2 = m.Z_FINISH), n2 === m.Z_FINISH ? (r2 = c.inflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === m.Z_OK) : n2 !== m.Z_SYNC_FLUSH || (this.onEnd(m.Z_OK), !(h.avail_out = 0));
          }, a.prototype.onData = function(e2) {
            this.chunks.push(e2);
          }, a.prototype.onEnd = function(e2) {
            e2 === m.Z_OK && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = d.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
          }, r.Inflate = a, r.inflate = o, r.inflateRaw = function(e2, t2) {
            return (t2 = t2 || {}).raw = true, o(e2, t2);
          }, r.ungzip = o;
        }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/constants": 44, "./zlib/gzheader": 47, "./zlib/inflate": 49, "./zlib/messages": 51, "./zlib/zstream": 53 }], 41: [function(e, t, r) {
          "use strict";
          var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Int32Array;
          r.assign = function(e2) {
            for (var t2 = Array.prototype.slice.call(arguments, 1); t2.length; ) {
              var r2 = t2.shift();
              if (r2) {
                if ("object" != typeof r2) throw new TypeError(r2 + "must be non-object");
                for (var n2 in r2) r2.hasOwnProperty(n2) && (e2[n2] = r2[n2]);
              }
            }
            return e2;
          }, r.shrinkBuf = function(e2, t2) {
            return e2.length === t2 ? e2 : e2.subarray ? e2.subarray(0, t2) : (e2.length = t2, e2);
          };
          var i = { arraySet: /* @__PURE__ */ __name(function(e2, t2, r2, n2, i2) {
            if (t2.subarray && e2.subarray) e2.set(t2.subarray(r2, r2 + n2), i2);
            else for (var s2 = 0; s2 < n2; s2++) e2[i2 + s2] = t2[r2 + s2];
          }, "arraySet"), flattenChunks: /* @__PURE__ */ __name(function(e2) {
            var t2, r2, n2, i2, s2, a;
            for (t2 = n2 = 0, r2 = e2.length; t2 < r2; t2++) n2 += e2[t2].length;
            for (a = new Uint8Array(n2), t2 = i2 = 0, r2 = e2.length; t2 < r2; t2++) s2 = e2[t2], a.set(s2, i2), i2 += s2.length;
            return a;
          }, "flattenChunks") }, s = { arraySet: /* @__PURE__ */ __name(function(e2, t2, r2, n2, i2) {
            for (var s2 = 0; s2 < n2; s2++) e2[i2 + s2] = t2[r2 + s2];
          }, "arraySet"), flattenChunks: /* @__PURE__ */ __name(function(e2) {
            return [].concat.apply([], e2);
          }, "flattenChunks") };
          r.setTyped = function(e2) {
            e2 ? (r.Buf8 = Uint8Array, r.Buf16 = Uint16Array, r.Buf32 = Int32Array, r.assign(r, i)) : (r.Buf8 = Array, r.Buf16 = Array, r.Buf32 = Array, r.assign(r, s));
          }, r.setTyped(n);
        }, {}], 42: [function(e, t, r) {
          "use strict";
          var h = e("./common"), i = true, s = true;
          try {
            String.fromCharCode.apply(null, [0]);
          } catch (e2) {
            i = false;
          }
          try {
            String.fromCharCode.apply(null, new Uint8Array(1));
          } catch (e2) {
            s = false;
          }
          for (var u = new h.Buf8(256), n = 0; n < 256; n++) u[n] = 252 <= n ? 6 : 248 <= n ? 5 : 240 <= n ? 4 : 224 <= n ? 3 : 192 <= n ? 2 : 1;
          function l(e2, t2) {
            if (t2 < 65537 && (e2.subarray && s || !e2.subarray && i)) return String.fromCharCode.apply(null, h.shrinkBuf(e2, t2));
            for (var r2 = "", n2 = 0; n2 < t2; n2++) r2 += String.fromCharCode(e2[n2]);
            return r2;
          }
          __name(l, "l");
          u[254] = u[254] = 1, r.string2buf = function(e2) {
            var t2, r2, n2, i2, s2, a = e2.length, o = 0;
            for (i2 = 0; i2 < a; i2++) 55296 == (64512 & (r2 = e2.charCodeAt(i2))) && i2 + 1 < a && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
            for (t2 = new h.Buf8(o), i2 = s2 = 0; s2 < o; i2++) 55296 == (64512 & (r2 = e2.charCodeAt(i2))) && i2 + 1 < a && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t2[s2++] = r2 : (r2 < 2048 ? t2[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t2[s2++] = 224 | r2 >>> 12 : (t2[s2++] = 240 | r2 >>> 18, t2[s2++] = 128 | r2 >>> 12 & 63), t2[s2++] = 128 | r2 >>> 6 & 63), t2[s2++] = 128 | 63 & r2);
            return t2;
          }, r.buf2binstring = function(e2) {
            return l(e2, e2.length);
          }, r.binstring2buf = function(e2) {
            for (var t2 = new h.Buf8(e2.length), r2 = 0, n2 = t2.length; r2 < n2; r2++) t2[r2] = e2.charCodeAt(r2);
            return t2;
          }, r.buf2string = function(e2, t2) {
            var r2, n2, i2, s2, a = t2 || e2.length, o = new Array(2 * a);
            for (r2 = n2 = 0; r2 < a; ) if ((i2 = e2[r2++]) < 128) o[n2++] = i2;
            else if (4 < (s2 = u[i2])) o[n2++] = 65533, r2 += s2 - 1;
            else {
              for (i2 &= 2 === s2 ? 31 : 3 === s2 ? 15 : 7; 1 < s2 && r2 < a; ) i2 = i2 << 6 | 63 & e2[r2++], s2--;
              1 < s2 ? o[n2++] = 65533 : i2 < 65536 ? o[n2++] = i2 : (i2 -= 65536, o[n2++] = 55296 | i2 >> 10 & 1023, o[n2++] = 56320 | 1023 & i2);
            }
            return l(o, n2);
          }, r.utf8border = function(e2, t2) {
            var r2;
            for ((t2 = t2 || e2.length) > e2.length && (t2 = e2.length), r2 = t2 - 1; 0 <= r2 && 128 == (192 & e2[r2]); ) r2--;
            return r2 < 0 ? t2 : 0 === r2 ? t2 : r2 + u[e2[r2]] > t2 ? r2 : t2;
          };
        }, { "./common": 41 }], 43: [function(e, t, r) {
          "use strict";
          t.exports = function(e2, t2, r2, n) {
            for (var i = 65535 & e2 | 0, s = e2 >>> 16 & 65535 | 0, a = 0; 0 !== r2; ) {
              for (r2 -= a = 2e3 < r2 ? 2e3 : r2; s = s + (i = i + t2[n++] | 0) | 0, --a; ) ;
              i %= 65521, s %= 65521;
            }
            return i | s << 16 | 0;
          };
        }, {}], 44: [function(e, t, r) {
          "use strict";
          t.exports = { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8 };
        }, {}], 45: [function(e, t, r) {
          "use strict";
          var o = (function() {
            for (var e2, t2 = [], r2 = 0; r2 < 256; r2++) {
              e2 = r2;
              for (var n = 0; n < 8; n++) e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
              t2[r2] = e2;
            }
            return t2;
          })();
          t.exports = function(e2, t2, r2, n) {
            var i = o, s = n + r2;
            e2 ^= -1;
            for (var a = n; a < s; a++) e2 = e2 >>> 8 ^ i[255 & (e2 ^ t2[a])];
            return -1 ^ e2;
          };
        }, {}], 46: [function(e, t, r) {
          "use strict";
          var h, c = e("../utils/common"), u = e("./trees"), d = e("./adler32"), p = e("./crc32"), n = e("./messages"), l = 0, f = 4, m = 0, _ = -2, g = -1, b = 4, i = 2, v = 8, y = 9, s = 286, a = 30, o = 19, w = 2 * s + 1, k = 15, x = 3, S = 258, z = S + x + 1, C = 42, E = 113, A = 1, I = 2, O = 3, B = 4;
          function R(e2, t2) {
            return e2.msg = n[t2], t2;
          }
          __name(R, "R");
          function T(e2) {
            return (e2 << 1) - (4 < e2 ? 9 : 0);
          }
          __name(T, "T");
          function D(e2) {
            for (var t2 = e2.length; 0 <= --t2; ) e2[t2] = 0;
          }
          __name(D, "D");
          function F(e2) {
            var t2 = e2.state, r2 = t2.pending;
            r2 > e2.avail_out && (r2 = e2.avail_out), 0 !== r2 && (c.arraySet(e2.output, t2.pending_buf, t2.pending_out, r2, e2.next_out), e2.next_out += r2, t2.pending_out += r2, e2.total_out += r2, e2.avail_out -= r2, t2.pending -= r2, 0 === t2.pending && (t2.pending_out = 0));
          }
          __name(F, "F");
          function N(e2, t2) {
            u._tr_flush_block(e2, 0 <= e2.block_start ? e2.block_start : -1, e2.strstart - e2.block_start, t2), e2.block_start = e2.strstart, F(e2.strm);
          }
          __name(N, "N");
          function U(e2, t2) {
            e2.pending_buf[e2.pending++] = t2;
          }
          __name(U, "U");
          function P(e2, t2) {
            e2.pending_buf[e2.pending++] = t2 >>> 8 & 255, e2.pending_buf[e2.pending++] = 255 & t2;
          }
          __name(P, "P");
          function L(e2, t2) {
            var r2, n2, i2 = e2.max_chain_length, s2 = e2.strstart, a2 = e2.prev_length, o2 = e2.nice_match, h2 = e2.strstart > e2.w_size - z ? e2.strstart - (e2.w_size - z) : 0, u2 = e2.window, l2 = e2.w_mask, f2 = e2.prev, c2 = e2.strstart + S, d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
            e2.prev_length >= e2.good_match && (i2 >>= 2), o2 > e2.lookahead && (o2 = e2.lookahead);
            do {
              if (u2[(r2 = t2) + a2] === p2 && u2[r2 + a2 - 1] === d2 && u2[r2] === u2[s2] && u2[++r2] === u2[s2 + 1]) {
                s2 += 2, r2++;
                do {
                } while (u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && s2 < c2);
                if (n2 = S - (c2 - s2), s2 = c2 - S, a2 < n2) {
                  if (e2.match_start = t2, o2 <= (a2 = n2)) break;
                  d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
                }
              }
            } while ((t2 = f2[t2 & l2]) > h2 && 0 != --i2);
            return a2 <= e2.lookahead ? a2 : e2.lookahead;
          }
          __name(L, "L");
          function j(e2) {
            var t2, r2, n2, i2, s2, a2, o2, h2, u2, l2, f2 = e2.w_size;
            do {
              if (i2 = e2.window_size - e2.lookahead - e2.strstart, e2.strstart >= f2 + (f2 - z)) {
                for (c.arraySet(e2.window, e2.window, f2, f2, 0), e2.match_start -= f2, e2.strstart -= f2, e2.block_start -= f2, t2 = r2 = e2.hash_size; n2 = e2.head[--t2], e2.head[t2] = f2 <= n2 ? n2 - f2 : 0, --r2; ) ;
                for (t2 = r2 = f2; n2 = e2.prev[--t2], e2.prev[t2] = f2 <= n2 ? n2 - f2 : 0, --r2; ) ;
                i2 += f2;
              }
              if (0 === e2.strm.avail_in) break;
              if (a2 = e2.strm, o2 = e2.window, h2 = e2.strstart + e2.lookahead, u2 = i2, l2 = void 0, l2 = a2.avail_in, u2 < l2 && (l2 = u2), r2 = 0 === l2 ? 0 : (a2.avail_in -= l2, c.arraySet(o2, a2.input, a2.next_in, l2, h2), 1 === a2.state.wrap ? a2.adler = d(a2.adler, o2, l2, h2) : 2 === a2.state.wrap && (a2.adler = p(a2.adler, o2, l2, h2)), a2.next_in += l2, a2.total_in += l2, l2), e2.lookahead += r2, e2.lookahead + e2.insert >= x) for (s2 = e2.strstart - e2.insert, e2.ins_h = e2.window[s2], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + 1]) & e2.hash_mask; e2.insert && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + x - 1]) & e2.hash_mask, e2.prev[s2 & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = s2, s2++, e2.insert--, !(e2.lookahead + e2.insert < x)); ) ;
            } while (e2.lookahead < z && 0 !== e2.strm.avail_in);
          }
          __name(j, "j");
          function Z(e2, t2) {
            for (var r2, n2; ; ) {
              if (e2.lookahead < z) {
                if (j(e2), e2.lookahead < z && t2 === l) return A;
                if (0 === e2.lookahead) break;
              }
              if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 !== r2 && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2)), e2.match_length >= x) if (n2 = u._tr_tally(e2, e2.strstart - e2.match_start, e2.match_length - x), e2.lookahead -= e2.match_length, e2.match_length <= e2.max_lazy_match && e2.lookahead >= x) {
                for (e2.match_length--; e2.strstart++, e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart, 0 != --e2.match_length; ) ;
                e2.strstart++;
              } else e2.strstart += e2.match_length, e2.match_length = 0, e2.ins_h = e2.window[e2.strstart], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + 1]) & e2.hash_mask;
              else n2 = u._tr_tally(e2, 0, e2.window[e2.strstart]), e2.lookahead--, e2.strstart++;
              if (n2 && (N(e2, false), 0 === e2.strm.avail_out)) return A;
            }
            return e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
          }
          __name(Z, "Z");
          function W(e2, t2) {
            for (var r2, n2, i2; ; ) {
              if (e2.lookahead < z) {
                if (j(e2), e2.lookahead < z && t2 === l) return A;
                if (0 === e2.lookahead) break;
              }
              if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), e2.prev_length = e2.match_length, e2.prev_match = e2.match_start, e2.match_length = x - 1, 0 !== r2 && e2.prev_length < e2.max_lazy_match && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2), e2.match_length <= 5 && (1 === e2.strategy || e2.match_length === x && 4096 < e2.strstart - e2.match_start) && (e2.match_length = x - 1)), e2.prev_length >= x && e2.match_length <= e2.prev_length) {
                for (i2 = e2.strstart + e2.lookahead - x, n2 = u._tr_tally(e2, e2.strstart - 1 - e2.prev_match, e2.prev_length - x), e2.lookahead -= e2.prev_length - 1, e2.prev_length -= 2; ++e2.strstart <= i2 && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 != --e2.prev_length; ) ;
                if (e2.match_available = 0, e2.match_length = x - 1, e2.strstart++, n2 && (N(e2, false), 0 === e2.strm.avail_out)) return A;
              } else if (e2.match_available) {
                if ((n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1])) && N(e2, false), e2.strstart++, e2.lookahead--, 0 === e2.strm.avail_out) return A;
              } else e2.match_available = 1, e2.strstart++, e2.lookahead--;
            }
            return e2.match_available && (n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1]), e2.match_available = 0), e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
          }
          __name(W, "W");
          function M(e2, t2, r2, n2, i2) {
            this.good_length = e2, this.max_lazy = t2, this.nice_length = r2, this.max_chain = n2, this.func = i2;
          }
          __name(M, "M");
          function H() {
            this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = v, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new c.Buf16(2 * w), this.dyn_dtree = new c.Buf16(2 * (2 * a + 1)), this.bl_tree = new c.Buf16(2 * (2 * o + 1)), D(this.dyn_ltree), D(this.dyn_dtree), D(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new c.Buf16(k + 1), this.heap = new c.Buf16(2 * s + 1), D(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new c.Buf16(2 * s + 1), D(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
          }
          __name(H, "H");
          function G(e2) {
            var t2;
            return e2 && e2.state ? (e2.total_in = e2.total_out = 0, e2.data_type = i, (t2 = e2.state).pending = 0, t2.pending_out = 0, t2.wrap < 0 && (t2.wrap = -t2.wrap), t2.status = t2.wrap ? C : E, e2.adler = 2 === t2.wrap ? 0 : 1, t2.last_flush = l, u._tr_init(t2), m) : R(e2, _);
          }
          __name(G, "G");
          function K(e2) {
            var t2 = G(e2);
            return t2 === m && (function(e3) {
              e3.window_size = 2 * e3.w_size, D(e3.head), e3.max_lazy_match = h[e3.level].max_lazy, e3.good_match = h[e3.level].good_length, e3.nice_match = h[e3.level].nice_length, e3.max_chain_length = h[e3.level].max_chain, e3.strstart = 0, e3.block_start = 0, e3.lookahead = 0, e3.insert = 0, e3.match_length = e3.prev_length = x - 1, e3.match_available = 0, e3.ins_h = 0;
            })(e2.state), t2;
          }
          __name(K, "K");
          function Y(e2, t2, r2, n2, i2, s2) {
            if (!e2) return _;
            var a2 = 1;
            if (t2 === g && (t2 = 6), n2 < 0 ? (a2 = 0, n2 = -n2) : 15 < n2 && (a2 = 2, n2 -= 16), i2 < 1 || y < i2 || r2 !== v || n2 < 8 || 15 < n2 || t2 < 0 || 9 < t2 || s2 < 0 || b < s2) return R(e2, _);
            8 === n2 && (n2 = 9);
            var o2 = new H();
            return (e2.state = o2).strm = e2, o2.wrap = a2, o2.gzhead = null, o2.w_bits = n2, o2.w_size = 1 << o2.w_bits, o2.w_mask = o2.w_size - 1, o2.hash_bits = i2 + 7, o2.hash_size = 1 << o2.hash_bits, o2.hash_mask = o2.hash_size - 1, o2.hash_shift = ~~((o2.hash_bits + x - 1) / x), o2.window = new c.Buf8(2 * o2.w_size), o2.head = new c.Buf16(o2.hash_size), o2.prev = new c.Buf16(o2.w_size), o2.lit_bufsize = 1 << i2 + 6, o2.pending_buf_size = 4 * o2.lit_bufsize, o2.pending_buf = new c.Buf8(o2.pending_buf_size), o2.d_buf = 1 * o2.lit_bufsize, o2.l_buf = 3 * o2.lit_bufsize, o2.level = t2, o2.strategy = s2, o2.method = r2, K(e2);
          }
          __name(Y, "Y");
          h = [new M(0, 0, 0, 0, function(e2, t2) {
            var r2 = 65535;
            for (r2 > e2.pending_buf_size - 5 && (r2 = e2.pending_buf_size - 5); ; ) {
              if (e2.lookahead <= 1) {
                if (j(e2), 0 === e2.lookahead && t2 === l) return A;
                if (0 === e2.lookahead) break;
              }
              e2.strstart += e2.lookahead, e2.lookahead = 0;
              var n2 = e2.block_start + r2;
              if ((0 === e2.strstart || e2.strstart >= n2) && (e2.lookahead = e2.strstart - n2, e2.strstart = n2, N(e2, false), 0 === e2.strm.avail_out)) return A;
              if (e2.strstart - e2.block_start >= e2.w_size - z && (N(e2, false), 0 === e2.strm.avail_out)) return A;
            }
            return e2.insert = 0, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : (e2.strstart > e2.block_start && (N(e2, false), e2.strm.avail_out), A);
          }), new M(4, 4, 8, 4, Z), new M(4, 5, 16, 8, Z), new M(4, 6, 32, 32, Z), new M(4, 4, 16, 16, W), new M(8, 16, 32, 32, W), new M(8, 16, 128, 128, W), new M(8, 32, 128, 256, W), new M(32, 128, 258, 1024, W), new M(32, 258, 258, 4096, W)], r.deflateInit = function(e2, t2) {
            return Y(e2, t2, v, 15, 8, 0);
          }, r.deflateInit2 = Y, r.deflateReset = K, r.deflateResetKeep = G, r.deflateSetHeader = function(e2, t2) {
            return e2 && e2.state ? 2 !== e2.state.wrap ? _ : (e2.state.gzhead = t2, m) : _;
          }, r.deflate = function(e2, t2) {
            var r2, n2, i2, s2;
            if (!e2 || !e2.state || 5 < t2 || t2 < 0) return e2 ? R(e2, _) : _;
            if (n2 = e2.state, !e2.output || !e2.input && 0 !== e2.avail_in || 666 === n2.status && t2 !== f) return R(e2, 0 === e2.avail_out ? -5 : _);
            if (n2.strm = e2, r2 = n2.last_flush, n2.last_flush = t2, n2.status === C) if (2 === n2.wrap) e2.adler = 0, U(n2, 31), U(n2, 139), U(n2, 8), n2.gzhead ? (U(n2, (n2.gzhead.text ? 1 : 0) + (n2.gzhead.hcrc ? 2 : 0) + (n2.gzhead.extra ? 4 : 0) + (n2.gzhead.name ? 8 : 0) + (n2.gzhead.comment ? 16 : 0)), U(n2, 255 & n2.gzhead.time), U(n2, n2.gzhead.time >> 8 & 255), U(n2, n2.gzhead.time >> 16 & 255), U(n2, n2.gzhead.time >> 24 & 255), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 255 & n2.gzhead.os), n2.gzhead.extra && n2.gzhead.extra.length && (U(n2, 255 & n2.gzhead.extra.length), U(n2, n2.gzhead.extra.length >> 8 & 255)), n2.gzhead.hcrc && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending, 0)), n2.gzindex = 0, n2.status = 69) : (U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 3), n2.status = E);
            else {
              var a2 = v + (n2.w_bits - 8 << 4) << 8;
              a2 |= (2 <= n2.strategy || n2.level < 2 ? 0 : n2.level < 6 ? 1 : 6 === n2.level ? 2 : 3) << 6, 0 !== n2.strstart && (a2 |= 32), a2 += 31 - a2 % 31, n2.status = E, P(n2, a2), 0 !== n2.strstart && (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), e2.adler = 1;
            }
            if (69 === n2.status) if (n2.gzhead.extra) {
              for (i2 = n2.pending; n2.gzindex < (65535 & n2.gzhead.extra.length) && (n2.pending !== n2.pending_buf_size || (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending !== n2.pending_buf_size)); ) U(n2, 255 & n2.gzhead.extra[n2.gzindex]), n2.gzindex++;
              n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), n2.gzindex === n2.gzhead.extra.length && (n2.gzindex = 0, n2.status = 73);
            } else n2.status = 73;
            if (73 === n2.status) if (n2.gzhead.name) {
              i2 = n2.pending;
              do {
                if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                  s2 = 1;
                  break;
                }
                s2 = n2.gzindex < n2.gzhead.name.length ? 255 & n2.gzhead.name.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
              } while (0 !== s2);
              n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.gzindex = 0, n2.status = 91);
            } else n2.status = 91;
            if (91 === n2.status) if (n2.gzhead.comment) {
              i2 = n2.pending;
              do {
                if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                  s2 = 1;
                  break;
                }
                s2 = n2.gzindex < n2.gzhead.comment.length ? 255 & n2.gzhead.comment.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
              } while (0 !== s2);
              n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.status = 103);
            } else n2.status = 103;
            if (103 === n2.status && (n2.gzhead.hcrc ? (n2.pending + 2 > n2.pending_buf_size && F(e2), n2.pending + 2 <= n2.pending_buf_size && (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), e2.adler = 0, n2.status = E)) : n2.status = E), 0 !== n2.pending) {
              if (F(e2), 0 === e2.avail_out) return n2.last_flush = -1, m;
            } else if (0 === e2.avail_in && T(t2) <= T(r2) && t2 !== f) return R(e2, -5);
            if (666 === n2.status && 0 !== e2.avail_in) return R(e2, -5);
            if (0 !== e2.avail_in || 0 !== n2.lookahead || t2 !== l && 666 !== n2.status) {
              var o2 = 2 === n2.strategy ? (function(e3, t3) {
                for (var r3; ; ) {
                  if (0 === e3.lookahead && (j(e3), 0 === e3.lookahead)) {
                    if (t3 === l) return A;
                    break;
                  }
                  if (e3.match_length = 0, r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++, r3 && (N(e3, false), 0 === e3.strm.avail_out)) return A;
                }
                return e3.insert = 0, t3 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
              })(n2, t2) : 3 === n2.strategy ? (function(e3, t3) {
                for (var r3, n3, i3, s3, a3 = e3.window; ; ) {
                  if (e3.lookahead <= S) {
                    if (j(e3), e3.lookahead <= S && t3 === l) return A;
                    if (0 === e3.lookahead) break;
                  }
                  if (e3.match_length = 0, e3.lookahead >= x && 0 < e3.strstart && (n3 = a3[i3 = e3.strstart - 1]) === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3]) {
                    s3 = e3.strstart + S;
                    do {
                    } while (n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && i3 < s3);
                    e3.match_length = S - (s3 - i3), e3.match_length > e3.lookahead && (e3.match_length = e3.lookahead);
                  }
                  if (e3.match_length >= x ? (r3 = u._tr_tally(e3, 1, e3.match_length - x), e3.lookahead -= e3.match_length, e3.strstart += e3.match_length, e3.match_length = 0) : (r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++), r3 && (N(e3, false), 0 === e3.strm.avail_out)) return A;
                }
                return e3.insert = 0, t3 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
              })(n2, t2) : h[n2.level].func(n2, t2);
              if (o2 !== O && o2 !== B || (n2.status = 666), o2 === A || o2 === O) return 0 === e2.avail_out && (n2.last_flush = -1), m;
              if (o2 === I && (1 === t2 ? u._tr_align(n2) : 5 !== t2 && (u._tr_stored_block(n2, 0, 0, false), 3 === t2 && (D(n2.head), 0 === n2.lookahead && (n2.strstart = 0, n2.block_start = 0, n2.insert = 0))), F(e2), 0 === e2.avail_out)) return n2.last_flush = -1, m;
            }
            return t2 !== f ? m : n2.wrap <= 0 ? 1 : (2 === n2.wrap ? (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), U(n2, e2.adler >> 16 & 255), U(n2, e2.adler >> 24 & 255), U(n2, 255 & e2.total_in), U(n2, e2.total_in >> 8 & 255), U(n2, e2.total_in >> 16 & 255), U(n2, e2.total_in >> 24 & 255)) : (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), F(e2), 0 < n2.wrap && (n2.wrap = -n2.wrap), 0 !== n2.pending ? m : 1);
          }, r.deflateEnd = function(e2) {
            var t2;
            return e2 && e2.state ? (t2 = e2.state.status) !== C && 69 !== t2 && 73 !== t2 && 91 !== t2 && 103 !== t2 && t2 !== E && 666 !== t2 ? R(e2, _) : (e2.state = null, t2 === E ? R(e2, -3) : m) : _;
          }, r.deflateSetDictionary = function(e2, t2) {
            var r2, n2, i2, s2, a2, o2, h2, u2, l2 = t2.length;
            if (!e2 || !e2.state) return _;
            if (2 === (s2 = (r2 = e2.state).wrap) || 1 === s2 && r2.status !== C || r2.lookahead) return _;
            for (1 === s2 && (e2.adler = d(e2.adler, t2, l2, 0)), r2.wrap = 0, l2 >= r2.w_size && (0 === s2 && (D(r2.head), r2.strstart = 0, r2.block_start = 0, r2.insert = 0), u2 = new c.Buf8(r2.w_size), c.arraySet(u2, t2, l2 - r2.w_size, r2.w_size, 0), t2 = u2, l2 = r2.w_size), a2 = e2.avail_in, o2 = e2.next_in, h2 = e2.input, e2.avail_in = l2, e2.next_in = 0, e2.input = t2, j(r2); r2.lookahead >= x; ) {
              for (n2 = r2.strstart, i2 = r2.lookahead - (x - 1); r2.ins_h = (r2.ins_h << r2.hash_shift ^ r2.window[n2 + x - 1]) & r2.hash_mask, r2.prev[n2 & r2.w_mask] = r2.head[r2.ins_h], r2.head[r2.ins_h] = n2, n2++, --i2; ) ;
              r2.strstart = n2, r2.lookahead = x - 1, j(r2);
            }
            return r2.strstart += r2.lookahead, r2.block_start = r2.strstart, r2.insert = r2.lookahead, r2.lookahead = 0, r2.match_length = r2.prev_length = x - 1, r2.match_available = 0, e2.next_in = o2, e2.input = h2, e2.avail_in = a2, r2.wrap = s2, m;
          }, r.deflateInfo = "pako deflate (from Nodeca project)";
        }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./messages": 51, "./trees": 52 }], 47: [function(e, t, r) {
          "use strict";
          t.exports = function() {
            this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = false;
          };
        }, {}], 48: [function(e, t, r) {
          "use strict";
          t.exports = function(e2, t2) {
            var r2, n, i, s, a, o, h, u, l, f, c, d, p, m, _, g, b, v, y, w, k, x, S, z, C;
            r2 = e2.state, n = e2.next_in, z = e2.input, i = n + (e2.avail_in - 5), s = e2.next_out, C = e2.output, a = s - (t2 - e2.avail_out), o = s + (e2.avail_out - 257), h = r2.dmax, u = r2.wsize, l = r2.whave, f = r2.wnext, c = r2.window, d = r2.hold, p = r2.bits, m = r2.lencode, _ = r2.distcode, g = (1 << r2.lenbits) - 1, b = (1 << r2.distbits) - 1;
            e: do {
              p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = m[d & g];
              t: for (; ; ) {
                if (d >>>= y = v >>> 24, p -= y, 0 === (y = v >>> 16 & 255)) C[s++] = 65535 & v;
                else {
                  if (!(16 & y)) {
                    if (0 == (64 & y)) {
                      v = m[(65535 & v) + (d & (1 << y) - 1)];
                      continue t;
                    }
                    if (32 & y) {
                      r2.mode = 12;
                      break e;
                    }
                    e2.msg = "invalid literal/length code", r2.mode = 30;
                    break e;
                  }
                  w = 65535 & v, (y &= 15) && (p < y && (d += z[n++] << p, p += 8), w += d & (1 << y) - 1, d >>>= y, p -= y), p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = _[d & b];
                  r: for (; ; ) {
                    if (d >>>= y = v >>> 24, p -= y, !(16 & (y = v >>> 16 & 255))) {
                      if (0 == (64 & y)) {
                        v = _[(65535 & v) + (d & (1 << y) - 1)];
                        continue r;
                      }
                      e2.msg = "invalid distance code", r2.mode = 30;
                      break e;
                    }
                    if (k = 65535 & v, p < (y &= 15) && (d += z[n++] << p, (p += 8) < y && (d += z[n++] << p, p += 8)), h < (k += d & (1 << y) - 1)) {
                      e2.msg = "invalid distance too far back", r2.mode = 30;
                      break e;
                    }
                    if (d >>>= y, p -= y, (y = s - a) < k) {
                      if (l < (y = k - y) && r2.sane) {
                        e2.msg = "invalid distance too far back", r2.mode = 30;
                        break e;
                      }
                      if (S = c, (x = 0) === f) {
                        if (x += u - y, y < w) {
                          for (w -= y; C[s++] = c[x++], --y; ) ;
                          x = s - k, S = C;
                        }
                      } else if (f < y) {
                        if (x += u + f - y, (y -= f) < w) {
                          for (w -= y; C[s++] = c[x++], --y; ) ;
                          if (x = 0, f < w) {
                            for (w -= y = f; C[s++] = c[x++], --y; ) ;
                            x = s - k, S = C;
                          }
                        }
                      } else if (x += f - y, y < w) {
                        for (w -= y; C[s++] = c[x++], --y; ) ;
                        x = s - k, S = C;
                      }
                      for (; 2 < w; ) C[s++] = S[x++], C[s++] = S[x++], C[s++] = S[x++], w -= 3;
                      w && (C[s++] = S[x++], 1 < w && (C[s++] = S[x++]));
                    } else {
                      for (x = s - k; C[s++] = C[x++], C[s++] = C[x++], C[s++] = C[x++], 2 < (w -= 3); ) ;
                      w && (C[s++] = C[x++], 1 < w && (C[s++] = C[x++]));
                    }
                    break;
                  }
                }
                break;
              }
            } while (n < i && s < o);
            n -= w = p >> 3, d &= (1 << (p -= w << 3)) - 1, e2.next_in = n, e2.next_out = s, e2.avail_in = n < i ? i - n + 5 : 5 - (n - i), e2.avail_out = s < o ? o - s + 257 : 257 - (s - o), r2.hold = d, r2.bits = p;
          };
        }, {}], 49: [function(e, t, r) {
          "use strict";
          var I = e("../utils/common"), O = e("./adler32"), B = e("./crc32"), R = e("./inffast"), T = e("./inftrees"), D = 1, F = 2, N = 0, U = -2, P = 1, n = 852, i = 592;
          function L(e2) {
            return (e2 >>> 24 & 255) + (e2 >>> 8 & 65280) + ((65280 & e2) << 8) + ((255 & e2) << 24);
          }
          __name(L, "L");
          function s() {
            this.mode = 0, this.last = false, this.wrap = 0, this.havedict = false, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new I.Buf16(320), this.work = new I.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
          }
          __name(s, "s");
          function a(e2) {
            var t2;
            return e2 && e2.state ? (t2 = e2.state, e2.total_in = e2.total_out = t2.total = 0, e2.msg = "", t2.wrap && (e2.adler = 1 & t2.wrap), t2.mode = P, t2.last = 0, t2.havedict = 0, t2.dmax = 32768, t2.head = null, t2.hold = 0, t2.bits = 0, t2.lencode = t2.lendyn = new I.Buf32(n), t2.distcode = t2.distdyn = new I.Buf32(i), t2.sane = 1, t2.back = -1, N) : U;
          }
          __name(a, "a");
          function o(e2) {
            var t2;
            return e2 && e2.state ? ((t2 = e2.state).wsize = 0, t2.whave = 0, t2.wnext = 0, a(e2)) : U;
          }
          __name(o, "o");
          function h(e2, t2) {
            var r2, n2;
            return e2 && e2.state ? (n2 = e2.state, t2 < 0 ? (r2 = 0, t2 = -t2) : (r2 = 1 + (t2 >> 4), t2 < 48 && (t2 &= 15)), t2 && (t2 < 8 || 15 < t2) ? U : (null !== n2.window && n2.wbits !== t2 && (n2.window = null), n2.wrap = r2, n2.wbits = t2, o(e2))) : U;
          }
          __name(h, "h");
          function u(e2, t2) {
            var r2, n2;
            return e2 ? (n2 = new s(), (e2.state = n2).window = null, (r2 = h(e2, t2)) !== N && (e2.state = null), r2) : U;
          }
          __name(u, "u");
          var l, f, c = true;
          function j(e2) {
            if (c) {
              var t2;
              for (l = new I.Buf32(512), f = new I.Buf32(32), t2 = 0; t2 < 144; ) e2.lens[t2++] = 8;
              for (; t2 < 256; ) e2.lens[t2++] = 9;
              for (; t2 < 280; ) e2.lens[t2++] = 7;
              for (; t2 < 288; ) e2.lens[t2++] = 8;
              for (T(D, e2.lens, 0, 288, l, 0, e2.work, { bits: 9 }), t2 = 0; t2 < 32; ) e2.lens[t2++] = 5;
              T(F, e2.lens, 0, 32, f, 0, e2.work, { bits: 5 }), c = false;
            }
            e2.lencode = l, e2.lenbits = 9, e2.distcode = f, e2.distbits = 5;
          }
          __name(j, "j");
          function Z(e2, t2, r2, n2) {
            var i2, s2 = e2.state;
            return null === s2.window && (s2.wsize = 1 << s2.wbits, s2.wnext = 0, s2.whave = 0, s2.window = new I.Buf8(s2.wsize)), n2 >= s2.wsize ? (I.arraySet(s2.window, t2, r2 - s2.wsize, s2.wsize, 0), s2.wnext = 0, s2.whave = s2.wsize) : (n2 < (i2 = s2.wsize - s2.wnext) && (i2 = n2), I.arraySet(s2.window, t2, r2 - n2, i2, s2.wnext), (n2 -= i2) ? (I.arraySet(s2.window, t2, r2 - n2, n2, 0), s2.wnext = n2, s2.whave = s2.wsize) : (s2.wnext += i2, s2.wnext === s2.wsize && (s2.wnext = 0), s2.whave < s2.wsize && (s2.whave += i2))), 0;
          }
          __name(Z, "Z");
          r.inflateReset = o, r.inflateReset2 = h, r.inflateResetKeep = a, r.inflateInit = function(e2) {
            return u(e2, 15);
          }, r.inflateInit2 = u, r.inflate = function(e2, t2) {
            var r2, n2, i2, s2, a2, o2, h2, u2, l2, f2, c2, d, p, m, _, g, b, v, y, w, k, x, S, z, C = 0, E = new I.Buf8(4), A = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
            if (!e2 || !e2.state || !e2.output || !e2.input && 0 !== e2.avail_in) return U;
            12 === (r2 = e2.state).mode && (r2.mode = 13), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, f2 = o2, c2 = h2, x = N;
            e: for (; ; ) switch (r2.mode) {
              case P:
                if (0 === r2.wrap) {
                  r2.mode = 13;
                  break;
                }
                for (; l2 < 16; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (2 & r2.wrap && 35615 === u2) {
                  E[r2.check = 0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0), l2 = u2 = 0, r2.mode = 2;
                  break;
                }
                if (r2.flags = 0, r2.head && (r2.head.done = false), !(1 & r2.wrap) || (((255 & u2) << 8) + (u2 >> 8)) % 31) {
                  e2.msg = "incorrect header check", r2.mode = 30;
                  break;
                }
                if (8 != (15 & u2)) {
                  e2.msg = "unknown compression method", r2.mode = 30;
                  break;
                }
                if (l2 -= 4, k = 8 + (15 & (u2 >>>= 4)), 0 === r2.wbits) r2.wbits = k;
                else if (k > r2.wbits) {
                  e2.msg = "invalid window size", r2.mode = 30;
                  break;
                }
                r2.dmax = 1 << k, e2.adler = r2.check = 1, r2.mode = 512 & u2 ? 10 : 12, l2 = u2 = 0;
                break;
              case 2:
                for (; l2 < 16; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (r2.flags = u2, 8 != (255 & r2.flags)) {
                  e2.msg = "unknown compression method", r2.mode = 30;
                  break;
                }
                if (57344 & r2.flags) {
                  e2.msg = "unknown header flags set", r2.mode = 30;
                  break;
                }
                r2.head && (r2.head.text = u2 >> 8 & 1), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 3;
              case 3:
                for (; l2 < 32; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.head && (r2.head.time = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, E[2] = u2 >>> 16 & 255, E[3] = u2 >>> 24 & 255, r2.check = B(r2.check, E, 4, 0)), l2 = u2 = 0, r2.mode = 4;
              case 4:
                for (; l2 < 16; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.head && (r2.head.xflags = 255 & u2, r2.head.os = u2 >> 8), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 5;
              case 5:
                if (1024 & r2.flags) {
                  for (; l2 < 16; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  r2.length = u2, r2.head && (r2.head.extra_len = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0;
                } else r2.head && (r2.head.extra = null);
                r2.mode = 6;
              case 6:
                if (1024 & r2.flags && (o2 < (d = r2.length) && (d = o2), d && (r2.head && (k = r2.head.extra_len - r2.length, r2.head.extra || (r2.head.extra = new Array(r2.head.extra_len)), I.arraySet(r2.head.extra, n2, s2, d, k)), 512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, r2.length -= d), r2.length)) break e;
                r2.length = 0, r2.mode = 7;
              case 7:
                if (2048 & r2.flags) {
                  if (0 === o2) break e;
                  for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.name += String.fromCharCode(k)), k && d < o2; ) ;
                  if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k) break e;
                } else r2.head && (r2.head.name = null);
                r2.length = 0, r2.mode = 8;
              case 8:
                if (4096 & r2.flags) {
                  if (0 === o2) break e;
                  for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.comment += String.fromCharCode(k)), k && d < o2; ) ;
                  if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k) break e;
                } else r2.head && (r2.head.comment = null);
                r2.mode = 9;
              case 9:
                if (512 & r2.flags) {
                  for (; l2 < 16; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (u2 !== (65535 & r2.check)) {
                    e2.msg = "header crc mismatch", r2.mode = 30;
                    break;
                  }
                  l2 = u2 = 0;
                }
                r2.head && (r2.head.hcrc = r2.flags >> 9 & 1, r2.head.done = true), e2.adler = r2.check = 0, r2.mode = 12;
                break;
              case 10:
                for (; l2 < 32; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                e2.adler = r2.check = L(u2), l2 = u2 = 0, r2.mode = 11;
              case 11:
                if (0 === r2.havedict) return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, 2;
                e2.adler = r2.check = 1, r2.mode = 12;
              case 12:
                if (5 === t2 || 6 === t2) break e;
              case 13:
                if (r2.last) {
                  u2 >>>= 7 & l2, l2 -= 7 & l2, r2.mode = 27;
                  break;
                }
                for (; l2 < 3; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                switch (r2.last = 1 & u2, l2 -= 1, 3 & (u2 >>>= 1)) {
                  case 0:
                    r2.mode = 14;
                    break;
                  case 1:
                    if (j(r2), r2.mode = 20, 6 !== t2) break;
                    u2 >>>= 2, l2 -= 2;
                    break e;
                  case 2:
                    r2.mode = 17;
                    break;
                  case 3:
                    e2.msg = "invalid block type", r2.mode = 30;
                }
                u2 >>>= 2, l2 -= 2;
                break;
              case 14:
                for (u2 >>>= 7 & l2, l2 -= 7 & l2; l2 < 32; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if ((65535 & u2) != (u2 >>> 16 ^ 65535)) {
                  e2.msg = "invalid stored block lengths", r2.mode = 30;
                  break;
                }
                if (r2.length = 65535 & u2, l2 = u2 = 0, r2.mode = 15, 6 === t2) break e;
              case 15:
                r2.mode = 16;
              case 16:
                if (d = r2.length) {
                  if (o2 < d && (d = o2), h2 < d && (d = h2), 0 === d) break e;
                  I.arraySet(i2, n2, s2, d, a2), o2 -= d, s2 += d, h2 -= d, a2 += d, r2.length -= d;
                  break;
                }
                r2.mode = 12;
                break;
              case 17:
                for (; l2 < 14; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (r2.nlen = 257 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ndist = 1 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ncode = 4 + (15 & u2), u2 >>>= 4, l2 -= 4, 286 < r2.nlen || 30 < r2.ndist) {
                  e2.msg = "too many length or distance symbols", r2.mode = 30;
                  break;
                }
                r2.have = 0, r2.mode = 18;
              case 18:
                for (; r2.have < r2.ncode; ) {
                  for (; l2 < 3; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  r2.lens[A[r2.have++]] = 7 & u2, u2 >>>= 3, l2 -= 3;
                }
                for (; r2.have < 19; ) r2.lens[A[r2.have++]] = 0;
                if (r2.lencode = r2.lendyn, r2.lenbits = 7, S = { bits: r2.lenbits }, x = T(0, r2.lens, 0, 19, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                  e2.msg = "invalid code lengths set", r2.mode = 30;
                  break;
                }
                r2.have = 0, r2.mode = 19;
              case 19:
                for (; r2.have < r2.nlen + r2.ndist; ) {
                  for (; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (b < 16) u2 >>>= _, l2 -= _, r2.lens[r2.have++] = b;
                  else {
                    if (16 === b) {
                      for (z = _ + 2; l2 < z; ) {
                        if (0 === o2) break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      if (u2 >>>= _, l2 -= _, 0 === r2.have) {
                        e2.msg = "invalid bit length repeat", r2.mode = 30;
                        break;
                      }
                      k = r2.lens[r2.have - 1], d = 3 + (3 & u2), u2 >>>= 2, l2 -= 2;
                    } else if (17 === b) {
                      for (z = _ + 3; l2 < z; ) {
                        if (0 === o2) break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      l2 -= _, k = 0, d = 3 + (7 & (u2 >>>= _)), u2 >>>= 3, l2 -= 3;
                    } else {
                      for (z = _ + 7; l2 < z; ) {
                        if (0 === o2) break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      l2 -= _, k = 0, d = 11 + (127 & (u2 >>>= _)), u2 >>>= 7, l2 -= 7;
                    }
                    if (r2.have + d > r2.nlen + r2.ndist) {
                      e2.msg = "invalid bit length repeat", r2.mode = 30;
                      break;
                    }
                    for (; d--; ) r2.lens[r2.have++] = k;
                  }
                }
                if (30 === r2.mode) break;
                if (0 === r2.lens[256]) {
                  e2.msg = "invalid code -- missing end-of-block", r2.mode = 30;
                  break;
                }
                if (r2.lenbits = 9, S = { bits: r2.lenbits }, x = T(D, r2.lens, 0, r2.nlen, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                  e2.msg = "invalid literal/lengths set", r2.mode = 30;
                  break;
                }
                if (r2.distbits = 6, r2.distcode = r2.distdyn, S = { bits: r2.distbits }, x = T(F, r2.lens, r2.nlen, r2.ndist, r2.distcode, 0, r2.work, S), r2.distbits = S.bits, x) {
                  e2.msg = "invalid distances set", r2.mode = 30;
                  break;
                }
                if (r2.mode = 20, 6 === t2) break e;
              case 20:
                r2.mode = 21;
              case 21:
                if (6 <= o2 && 258 <= h2) {
                  e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, R(e2, c2), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, 12 === r2.mode && (r2.back = -1);
                  break;
                }
                for (r2.back = 0; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (g && 0 == (240 & g)) {
                  for (v = _, y = g, w = b; g = (C = r2.lencode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  u2 >>>= v, l2 -= v, r2.back += v;
                }
                if (u2 >>>= _, l2 -= _, r2.back += _, r2.length = b, 0 === g) {
                  r2.mode = 26;
                  break;
                }
                if (32 & g) {
                  r2.back = -1, r2.mode = 12;
                  break;
                }
                if (64 & g) {
                  e2.msg = "invalid literal/length code", r2.mode = 30;
                  break;
                }
                r2.extra = 15 & g, r2.mode = 22;
              case 22:
                if (r2.extra) {
                  for (z = r2.extra; l2 < z; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  r2.length += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
                }
                r2.was = r2.length, r2.mode = 23;
              case 23:
                for (; g = (C = r2.distcode[u2 & (1 << r2.distbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (0 == (240 & g)) {
                  for (v = _, y = g, w = b; g = (C = r2.distcode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  u2 >>>= v, l2 -= v, r2.back += v;
                }
                if (u2 >>>= _, l2 -= _, r2.back += _, 64 & g) {
                  e2.msg = "invalid distance code", r2.mode = 30;
                  break;
                }
                r2.offset = b, r2.extra = 15 & g, r2.mode = 24;
              case 24:
                if (r2.extra) {
                  for (z = r2.extra; l2 < z; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  r2.offset += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
                }
                if (r2.offset > r2.dmax) {
                  e2.msg = "invalid distance too far back", r2.mode = 30;
                  break;
                }
                r2.mode = 25;
              case 25:
                if (0 === h2) break e;
                if (d = c2 - h2, r2.offset > d) {
                  if ((d = r2.offset - d) > r2.whave && r2.sane) {
                    e2.msg = "invalid distance too far back", r2.mode = 30;
                    break;
                  }
                  p = d > r2.wnext ? (d -= r2.wnext, r2.wsize - d) : r2.wnext - d, d > r2.length && (d = r2.length), m = r2.window;
                } else m = i2, p = a2 - r2.offset, d = r2.length;
                for (h2 < d && (d = h2), h2 -= d, r2.length -= d; i2[a2++] = m[p++], --d; ) ;
                0 === r2.length && (r2.mode = 21);
                break;
              case 26:
                if (0 === h2) break e;
                i2[a2++] = r2.length, h2--, r2.mode = 21;
                break;
              case 27:
                if (r2.wrap) {
                  for (; l2 < 32; ) {
                    if (0 === o2) break e;
                    o2--, u2 |= n2[s2++] << l2, l2 += 8;
                  }
                  if (c2 -= h2, e2.total_out += c2, r2.total += c2, c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, a2 - c2) : O(r2.check, i2, c2, a2 - c2)), c2 = h2, (r2.flags ? u2 : L(u2)) !== r2.check) {
                    e2.msg = "incorrect data check", r2.mode = 30;
                    break;
                  }
                  l2 = u2 = 0;
                }
                r2.mode = 28;
              case 28:
                if (r2.wrap && r2.flags) {
                  for (; l2 < 32; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (u2 !== (4294967295 & r2.total)) {
                    e2.msg = "incorrect length check", r2.mode = 30;
                    break;
                  }
                  l2 = u2 = 0;
                }
                r2.mode = 29;
              case 29:
                x = 1;
                break e;
              case 30:
                x = -3;
                break e;
              case 31:
                return -4;
              case 32:
              default:
                return U;
            }
            return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, (r2.wsize || c2 !== e2.avail_out && r2.mode < 30 && (r2.mode < 27 || 4 !== t2)) && Z(e2, e2.output, e2.next_out, c2 - e2.avail_out) ? (r2.mode = 31, -4) : (f2 -= e2.avail_in, c2 -= e2.avail_out, e2.total_in += f2, e2.total_out += c2, r2.total += c2, r2.wrap && c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, e2.next_out - c2) : O(r2.check, i2, c2, e2.next_out - c2)), e2.data_type = r2.bits + (r2.last ? 64 : 0) + (12 === r2.mode ? 128 : 0) + (20 === r2.mode || 15 === r2.mode ? 256 : 0), (0 == f2 && 0 === c2 || 4 === t2) && x === N && (x = -5), x);
          }, r.inflateEnd = function(e2) {
            if (!e2 || !e2.state) return U;
            var t2 = e2.state;
            return t2.window && (t2.window = null), e2.state = null, N;
          }, r.inflateGetHeader = function(e2, t2) {
            var r2;
            return e2 && e2.state ? 0 == (2 & (r2 = e2.state).wrap) ? U : ((r2.head = t2).done = false, N) : U;
          }, r.inflateSetDictionary = function(e2, t2) {
            var r2, n2 = t2.length;
            return e2 && e2.state ? 0 !== (r2 = e2.state).wrap && 11 !== r2.mode ? U : 11 === r2.mode && O(1, t2, n2, 0) !== r2.check ? -3 : Z(e2, t2, n2, n2) ? (r2.mode = 31, -4) : (r2.havedict = 1, N) : U;
          }, r.inflateInfo = "pako inflate (from Nodeca project)";
        }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./inffast": 48, "./inftrees": 50 }], 50: [function(e, t, r) {
          "use strict";
          var D = e("../utils/common"), F = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], N = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], U = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0], P = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
          t.exports = function(e2, t2, r2, n, i, s, a, o) {
            var h, u, l, f, c, d, p, m, _, g = o.bits, b = 0, v = 0, y = 0, w = 0, k = 0, x = 0, S = 0, z = 0, C = 0, E = 0, A = null, I = 0, O = new D.Buf16(16), B = new D.Buf16(16), R = null, T = 0;
            for (b = 0; b <= 15; b++) O[b] = 0;
            for (v = 0; v < n; v++) O[t2[r2 + v]]++;
            for (k = g, w = 15; 1 <= w && 0 === O[w]; w--) ;
            if (w < k && (k = w), 0 === w) return i[s++] = 20971520, i[s++] = 20971520, o.bits = 1, 0;
            for (y = 1; y < w && 0 === O[y]; y++) ;
            for (k < y && (k = y), b = z = 1; b <= 15; b++) if (z <<= 1, (z -= O[b]) < 0) return -1;
            if (0 < z && (0 === e2 || 1 !== w)) return -1;
            for (B[1] = 0, b = 1; b < 15; b++) B[b + 1] = B[b] + O[b];
            for (v = 0; v < n; v++) 0 !== t2[r2 + v] && (a[B[t2[r2 + v]]++] = v);
            if (d = 0 === e2 ? (A = R = a, 19) : 1 === e2 ? (A = F, I -= 257, R = N, T -= 257, 256) : (A = U, R = P, -1), b = y, c = s, S = v = E = 0, l = -1, f = (C = 1 << (x = k)) - 1, 1 === e2 && 852 < C || 2 === e2 && 592 < C) return 1;
            for (; ; ) {
              for (p = b - S, _ = a[v] < d ? (m = 0, a[v]) : a[v] > d ? (m = R[T + a[v]], A[I + a[v]]) : (m = 96, 0), h = 1 << b - S, y = u = 1 << x; i[c + (E >> S) + (u -= h)] = p << 24 | m << 16 | _ | 0, 0 !== u; ) ;
              for (h = 1 << b - 1; E & h; ) h >>= 1;
              if (0 !== h ? (E &= h - 1, E += h) : E = 0, v++, 0 == --O[b]) {
                if (b === w) break;
                b = t2[r2 + a[v]];
              }
              if (k < b && (E & f) !== l) {
                for (0 === S && (S = k), c += y, z = 1 << (x = b - S); x + S < w && !((z -= O[x + S]) <= 0); ) x++, z <<= 1;
                if (C += 1 << x, 1 === e2 && 852 < C || 2 === e2 && 592 < C) return 1;
                i[l = E & f] = k << 24 | x << 16 | c - s | 0;
              }
            }
            return 0 !== E && (i[c + E] = b - S << 24 | 64 << 16 | 0), o.bits = k, 0;
          };
        }, { "../utils/common": 41 }], 51: [function(e, t, r) {
          "use strict";
          t.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" };
        }, {}], 52: [function(e, t, r) {
          "use strict";
          var i = e("../utils/common"), o = 0, h = 1;
          function n(e2) {
            for (var t2 = e2.length; 0 <= --t2; ) e2[t2] = 0;
          }
          __name(n, "n");
          var s = 0, a = 29, u = 256, l = u + 1 + a, f = 30, c = 19, _ = 2 * l + 1, g = 15, d = 16, p = 7, m = 256, b = 16, v = 17, y = 18, w = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0], k = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13], x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7], S = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], z = new Array(2 * (l + 2));
          n(z);
          var C = new Array(2 * f);
          n(C);
          var E = new Array(512);
          n(E);
          var A = new Array(256);
          n(A);
          var I = new Array(a);
          n(I);
          var O, B, R, T = new Array(f);
          function D(e2, t2, r2, n2, i2) {
            this.static_tree = e2, this.extra_bits = t2, this.extra_base = r2, this.elems = n2, this.max_length = i2, this.has_stree = e2 && e2.length;
          }
          __name(D, "D");
          function F(e2, t2) {
            this.dyn_tree = e2, this.max_code = 0, this.stat_desc = t2;
          }
          __name(F, "F");
          function N(e2) {
            return e2 < 256 ? E[e2] : E[256 + (e2 >>> 7)];
          }
          __name(N, "N");
          function U(e2, t2) {
            e2.pending_buf[e2.pending++] = 255 & t2, e2.pending_buf[e2.pending++] = t2 >>> 8 & 255;
          }
          __name(U, "U");
          function P(e2, t2, r2) {
            e2.bi_valid > d - r2 ? (e2.bi_buf |= t2 << e2.bi_valid & 65535, U(e2, e2.bi_buf), e2.bi_buf = t2 >> d - e2.bi_valid, e2.bi_valid += r2 - d) : (e2.bi_buf |= t2 << e2.bi_valid & 65535, e2.bi_valid += r2);
          }
          __name(P, "P");
          function L(e2, t2, r2) {
            P(e2, r2[2 * t2], r2[2 * t2 + 1]);
          }
          __name(L, "L");
          function j(e2, t2) {
            for (var r2 = 0; r2 |= 1 & e2, e2 >>>= 1, r2 <<= 1, 0 < --t2; ) ;
            return r2 >>> 1;
          }
          __name(j, "j");
          function Z(e2, t2, r2) {
            var n2, i2, s2 = new Array(g + 1), a2 = 0;
            for (n2 = 1; n2 <= g; n2++) s2[n2] = a2 = a2 + r2[n2 - 1] << 1;
            for (i2 = 0; i2 <= t2; i2++) {
              var o2 = e2[2 * i2 + 1];
              0 !== o2 && (e2[2 * i2] = j(s2[o2]++, o2));
            }
          }
          __name(Z, "Z");
          function W(e2) {
            var t2;
            for (t2 = 0; t2 < l; t2++) e2.dyn_ltree[2 * t2] = 0;
            for (t2 = 0; t2 < f; t2++) e2.dyn_dtree[2 * t2] = 0;
            for (t2 = 0; t2 < c; t2++) e2.bl_tree[2 * t2] = 0;
            e2.dyn_ltree[2 * m] = 1, e2.opt_len = e2.static_len = 0, e2.last_lit = e2.matches = 0;
          }
          __name(W, "W");
          function M(e2) {
            8 < e2.bi_valid ? U(e2, e2.bi_buf) : 0 < e2.bi_valid && (e2.pending_buf[e2.pending++] = e2.bi_buf), e2.bi_buf = 0, e2.bi_valid = 0;
          }
          __name(M, "M");
          function H(e2, t2, r2, n2) {
            var i2 = 2 * t2, s2 = 2 * r2;
            return e2[i2] < e2[s2] || e2[i2] === e2[s2] && n2[t2] <= n2[r2];
          }
          __name(H, "H");
          function G(e2, t2, r2) {
            for (var n2 = e2.heap[r2], i2 = r2 << 1; i2 <= e2.heap_len && (i2 < e2.heap_len && H(t2, e2.heap[i2 + 1], e2.heap[i2], e2.depth) && i2++, !H(t2, n2, e2.heap[i2], e2.depth)); ) e2.heap[r2] = e2.heap[i2], r2 = i2, i2 <<= 1;
            e2.heap[r2] = n2;
          }
          __name(G, "G");
          function K(e2, t2, r2) {
            var n2, i2, s2, a2, o2 = 0;
            if (0 !== e2.last_lit) for (; n2 = e2.pending_buf[e2.d_buf + 2 * o2] << 8 | e2.pending_buf[e2.d_buf + 2 * o2 + 1], i2 = e2.pending_buf[e2.l_buf + o2], o2++, 0 === n2 ? L(e2, i2, t2) : (L(e2, (s2 = A[i2]) + u + 1, t2), 0 !== (a2 = w[s2]) && P(e2, i2 -= I[s2], a2), L(e2, s2 = N(--n2), r2), 0 !== (a2 = k[s2]) && P(e2, n2 -= T[s2], a2)), o2 < e2.last_lit; ) ;
            L(e2, m, t2);
          }
          __name(K, "K");
          function Y(e2, t2) {
            var r2, n2, i2, s2 = t2.dyn_tree, a2 = t2.stat_desc.static_tree, o2 = t2.stat_desc.has_stree, h2 = t2.stat_desc.elems, u2 = -1;
            for (e2.heap_len = 0, e2.heap_max = _, r2 = 0; r2 < h2; r2++) 0 !== s2[2 * r2] ? (e2.heap[++e2.heap_len] = u2 = r2, e2.depth[r2] = 0) : s2[2 * r2 + 1] = 0;
            for (; e2.heap_len < 2; ) s2[2 * (i2 = e2.heap[++e2.heap_len] = u2 < 2 ? ++u2 : 0)] = 1, e2.depth[i2] = 0, e2.opt_len--, o2 && (e2.static_len -= a2[2 * i2 + 1]);
            for (t2.max_code = u2, r2 = e2.heap_len >> 1; 1 <= r2; r2--) G(e2, s2, r2);
            for (i2 = h2; r2 = e2.heap[1], e2.heap[1] = e2.heap[e2.heap_len--], G(e2, s2, 1), n2 = e2.heap[1], e2.heap[--e2.heap_max] = r2, e2.heap[--e2.heap_max] = n2, s2[2 * i2] = s2[2 * r2] + s2[2 * n2], e2.depth[i2] = (e2.depth[r2] >= e2.depth[n2] ? e2.depth[r2] : e2.depth[n2]) + 1, s2[2 * r2 + 1] = s2[2 * n2 + 1] = i2, e2.heap[1] = i2++, G(e2, s2, 1), 2 <= e2.heap_len; ) ;
            e2.heap[--e2.heap_max] = e2.heap[1], (function(e3, t3) {
              var r3, n3, i3, s3, a3, o3, h3 = t3.dyn_tree, u3 = t3.max_code, l2 = t3.stat_desc.static_tree, f2 = t3.stat_desc.has_stree, c2 = t3.stat_desc.extra_bits, d2 = t3.stat_desc.extra_base, p2 = t3.stat_desc.max_length, m2 = 0;
              for (s3 = 0; s3 <= g; s3++) e3.bl_count[s3] = 0;
              for (h3[2 * e3.heap[e3.heap_max] + 1] = 0, r3 = e3.heap_max + 1; r3 < _; r3++) p2 < (s3 = h3[2 * h3[2 * (n3 = e3.heap[r3]) + 1] + 1] + 1) && (s3 = p2, m2++), h3[2 * n3 + 1] = s3, u3 < n3 || (e3.bl_count[s3]++, a3 = 0, d2 <= n3 && (a3 = c2[n3 - d2]), o3 = h3[2 * n3], e3.opt_len += o3 * (s3 + a3), f2 && (e3.static_len += o3 * (l2[2 * n3 + 1] + a3)));
              if (0 !== m2) {
                do {
                  for (s3 = p2 - 1; 0 === e3.bl_count[s3]; ) s3--;
                  e3.bl_count[s3]--, e3.bl_count[s3 + 1] += 2, e3.bl_count[p2]--, m2 -= 2;
                } while (0 < m2);
                for (s3 = p2; 0 !== s3; s3--) for (n3 = e3.bl_count[s3]; 0 !== n3; ) u3 < (i3 = e3.heap[--r3]) || (h3[2 * i3 + 1] !== s3 && (e3.opt_len += (s3 - h3[2 * i3 + 1]) * h3[2 * i3], h3[2 * i3 + 1] = s3), n3--);
              }
            })(e2, t2), Z(s2, u2, e2.bl_count);
          }
          __name(Y, "Y");
          function X(e2, t2, r2) {
            var n2, i2, s2 = -1, a2 = t2[1], o2 = 0, h2 = 7, u2 = 4;
            for (0 === a2 && (h2 = 138, u2 = 3), t2[2 * (r2 + 1) + 1] = 65535, n2 = 0; n2 <= r2; n2++) i2 = a2, a2 = t2[2 * (n2 + 1) + 1], ++o2 < h2 && i2 === a2 || (o2 < u2 ? e2.bl_tree[2 * i2] += o2 : 0 !== i2 ? (i2 !== s2 && e2.bl_tree[2 * i2]++, e2.bl_tree[2 * b]++) : o2 <= 10 ? e2.bl_tree[2 * v]++ : e2.bl_tree[2 * y]++, s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4));
          }
          __name(X, "X");
          function V(e2, t2, r2) {
            var n2, i2, s2 = -1, a2 = t2[1], o2 = 0, h2 = 7, u2 = 4;
            for (0 === a2 && (h2 = 138, u2 = 3), n2 = 0; n2 <= r2; n2++) if (i2 = a2, a2 = t2[2 * (n2 + 1) + 1], !(++o2 < h2 && i2 === a2)) {
              if (o2 < u2) for (; L(e2, i2, e2.bl_tree), 0 != --o2; ) ;
              else 0 !== i2 ? (i2 !== s2 && (L(e2, i2, e2.bl_tree), o2--), L(e2, b, e2.bl_tree), P(e2, o2 - 3, 2)) : o2 <= 10 ? (L(e2, v, e2.bl_tree), P(e2, o2 - 3, 3)) : (L(e2, y, e2.bl_tree), P(e2, o2 - 11, 7));
              s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4);
            }
          }
          __name(V, "V");
          n(T);
          var q = false;
          function J(e2, t2, r2, n2) {
            P(e2, (s << 1) + (n2 ? 1 : 0), 3), (function(e3, t3, r3, n3) {
              M(e3), n3 && (U(e3, r3), U(e3, ~r3)), i.arraySet(e3.pending_buf, e3.window, t3, r3, e3.pending), e3.pending += r3;
            })(e2, t2, r2, true);
          }
          __name(J, "J");
          r._tr_init = function(e2) {
            q || ((function() {
              var e3, t2, r2, n2, i2, s2 = new Array(g + 1);
              for (n2 = r2 = 0; n2 < a - 1; n2++) for (I[n2] = r2, e3 = 0; e3 < 1 << w[n2]; e3++) A[r2++] = n2;
              for (A[r2 - 1] = n2, n2 = i2 = 0; n2 < 16; n2++) for (T[n2] = i2, e3 = 0; e3 < 1 << k[n2]; e3++) E[i2++] = n2;
              for (i2 >>= 7; n2 < f; n2++) for (T[n2] = i2 << 7, e3 = 0; e3 < 1 << k[n2] - 7; e3++) E[256 + i2++] = n2;
              for (t2 = 0; t2 <= g; t2++) s2[t2] = 0;
              for (e3 = 0; e3 <= 143; ) z[2 * e3 + 1] = 8, e3++, s2[8]++;
              for (; e3 <= 255; ) z[2 * e3 + 1] = 9, e3++, s2[9]++;
              for (; e3 <= 279; ) z[2 * e3 + 1] = 7, e3++, s2[7]++;
              for (; e3 <= 287; ) z[2 * e3 + 1] = 8, e3++, s2[8]++;
              for (Z(z, l + 1, s2), e3 = 0; e3 < f; e3++) C[2 * e3 + 1] = 5, C[2 * e3] = j(e3, 5);
              O = new D(z, w, u + 1, l, g), B = new D(C, k, 0, f, g), R = new D(new Array(0), x, 0, c, p);
            })(), q = true), e2.l_desc = new F(e2.dyn_ltree, O), e2.d_desc = new F(e2.dyn_dtree, B), e2.bl_desc = new F(e2.bl_tree, R), e2.bi_buf = 0, e2.bi_valid = 0, W(e2);
          }, r._tr_stored_block = J, r._tr_flush_block = function(e2, t2, r2, n2) {
            var i2, s2, a2 = 0;
            0 < e2.level ? (2 === e2.strm.data_type && (e2.strm.data_type = (function(e3) {
              var t3, r3 = 4093624447;
              for (t3 = 0; t3 <= 31; t3++, r3 >>>= 1) if (1 & r3 && 0 !== e3.dyn_ltree[2 * t3]) return o;
              if (0 !== e3.dyn_ltree[18] || 0 !== e3.dyn_ltree[20] || 0 !== e3.dyn_ltree[26]) return h;
              for (t3 = 32; t3 < u; t3++) if (0 !== e3.dyn_ltree[2 * t3]) return h;
              return o;
            })(e2)), Y(e2, e2.l_desc), Y(e2, e2.d_desc), a2 = (function(e3) {
              var t3;
              for (X(e3, e3.dyn_ltree, e3.l_desc.max_code), X(e3, e3.dyn_dtree, e3.d_desc.max_code), Y(e3, e3.bl_desc), t3 = c - 1; 3 <= t3 && 0 === e3.bl_tree[2 * S[t3] + 1]; t3--) ;
              return e3.opt_len += 3 * (t3 + 1) + 5 + 5 + 4, t3;
            })(e2), i2 = e2.opt_len + 3 + 7 >>> 3, (s2 = e2.static_len + 3 + 7 >>> 3) <= i2 && (i2 = s2)) : i2 = s2 = r2 + 5, r2 + 4 <= i2 && -1 !== t2 ? J(e2, t2, r2, n2) : 4 === e2.strategy || s2 === i2 ? (P(e2, 2 + (n2 ? 1 : 0), 3), K(e2, z, C)) : (P(e2, 4 + (n2 ? 1 : 0), 3), (function(e3, t3, r3, n3) {
              var i3;
              for (P(e3, t3 - 257, 5), P(e3, r3 - 1, 5), P(e3, n3 - 4, 4), i3 = 0; i3 < n3; i3++) P(e3, e3.bl_tree[2 * S[i3] + 1], 3);
              V(e3, e3.dyn_ltree, t3 - 1), V(e3, e3.dyn_dtree, r3 - 1);
            })(e2, e2.l_desc.max_code + 1, e2.d_desc.max_code + 1, a2 + 1), K(e2, e2.dyn_ltree, e2.dyn_dtree)), W(e2), n2 && M(e2);
          }, r._tr_tally = function(e2, t2, r2) {
            return e2.pending_buf[e2.d_buf + 2 * e2.last_lit] = t2 >>> 8 & 255, e2.pending_buf[e2.d_buf + 2 * e2.last_lit + 1] = 255 & t2, e2.pending_buf[e2.l_buf + e2.last_lit] = 255 & r2, e2.last_lit++, 0 === t2 ? e2.dyn_ltree[2 * r2]++ : (e2.matches++, t2--, e2.dyn_ltree[2 * (A[r2] + u + 1)]++, e2.dyn_dtree[2 * N(t2)]++), e2.last_lit === e2.lit_bufsize - 1;
          }, r._tr_align = function(e2) {
            P(e2, 2, 3), L(e2, m, z), (function(e3) {
              16 === e3.bi_valid ? (U(e3, e3.bi_buf), e3.bi_buf = 0, e3.bi_valid = 0) : 8 <= e3.bi_valid && (e3.pending_buf[e3.pending++] = 255 & e3.bi_buf, e3.bi_buf >>= 8, e3.bi_valid -= 8);
            })(e2);
          };
        }, { "../utils/common": 41 }], 53: [function(e, t, r) {
          "use strict";
          t.exports = function() {
            this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
          };
        }, {}], 54: [function(e, t, r) {
          (function(e2) {
            !(function(r2, n) {
              "use strict";
              if (!r2.setImmediate) {
                var i, s, t2, a, o = 1, h = {}, u = false, l = r2.document, e3 = Object.getPrototypeOf && Object.getPrototypeOf(r2);
                e3 = e3 && e3.setTimeout ? e3 : r2, i = "[object process]" === {}.toString.call(r2.process) ? function(e4) {
                  process.nextTick(function() {
                    c(e4);
                  });
                } : (function() {
                  if (r2.postMessage && !r2.importScripts) {
                    var e4 = true, t3 = r2.onmessage;
                    return r2.onmessage = function() {
                      e4 = false;
                    }, r2.postMessage("", "*"), r2.onmessage = t3, e4;
                  }
                })() ? (a = "setImmediate$" + Math.random() + "$", r2.addEventListener ? r2.addEventListener("message", d, false) : r2.attachEvent("onmessage", d), function(e4) {
                  r2.postMessage(a + e4, "*");
                }) : r2.MessageChannel ? ((t2 = new MessageChannel()).port1.onmessage = function(e4) {
                  c(e4.data);
                }, function(e4) {
                  t2.port2.postMessage(e4);
                }) : l && "onreadystatechange" in l.createElement("script") ? (s = l.documentElement, function(e4) {
                  var t3 = l.createElement("script");
                  t3.onreadystatechange = function() {
                    c(e4), t3.onreadystatechange = null, s.removeChild(t3), t3 = null;
                  }, s.appendChild(t3);
                }) : function(e4) {
                  setTimeout(c, 0, e4);
                }, e3.setImmediate = function(e4) {
                  "function" != typeof e4 && (e4 = new Function("" + e4));
                  for (var t3 = new Array(arguments.length - 1), r3 = 0; r3 < t3.length; r3++) t3[r3] = arguments[r3 + 1];
                  var n2 = { callback: e4, args: t3 };
                  return h[o] = n2, i(o), o++;
                }, e3.clearImmediate = f;
              }
              function f(e4) {
                delete h[e4];
              }
              __name(f, "f");
              function c(e4) {
                if (u) setTimeout(c, 0, e4);
                else {
                  var t3 = h[e4];
                  if (t3) {
                    u = true;
                    try {
                      !(function(e5) {
                        var t4 = e5.callback, r3 = e5.args;
                        switch (r3.length) {
                          case 0:
                            t4();
                            break;
                          case 1:
                            t4(r3[0]);
                            break;
                          case 2:
                            t4(r3[0], r3[1]);
                            break;
                          case 3:
                            t4(r3[0], r3[1], r3[2]);
                            break;
                          default:
                            t4.apply(n, r3);
                        }
                      })(t3);
                    } finally {
                      f(e4), u = false;
                    }
                  }
                }
              }
              __name(c, "c");
              function d(e4) {
                e4.source === r2 && "string" == typeof e4.data && 0 === e4.data.indexOf(a) && c(+e4.data.slice(a.length));
              }
              __name(d, "d");
            })("undefined" == typeof self ? void 0 === e2 ? this : e2 : self);
          }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
        }, {}] }, {}, [10])(10);
      });
    }
  });

  // node_modules/@firebase/util/dist/postinstall.mjs
  var getDefaultsFromPostinstall;
  var init_postinstall = __esm({
    "node_modules/@firebase/util/dist/postinstall.mjs"() {
      getDefaultsFromPostinstall = /* @__PURE__ */ __name(() => void 0, "getDefaultsFromPostinstall");
    }
  });

  // node_modules/@firebase/util/dist/index.esm.js
  function getGlobal() {
    if (typeof self !== "undefined") {
      return self;
    }
    if (typeof window !== "undefined") {
      return window;
    }
    if (typeof global !== "undefined") {
      return global;
    }
    throw new Error("Unable to locate global object.");
  }
  function isBrowser() {
    return typeof window !== "undefined" || isWebWorker();
  }
  function isWebWorker() {
    return typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope;
  }
  function isIndexedDBAvailable() {
    try {
      return typeof indexedDB === "object";
    } catch (e) {
      return false;
    }
  }
  function validateIndexedDBOpenable() {
    return new Promise((resolve, reject) => {
      try {
        let preExist = true;
        const DB_CHECK_NAME = "validate-browser-context-for-indexeddb-analytics-module";
        const request = self.indexedDB.open(DB_CHECK_NAME);
        request.onsuccess = () => {
          request.result.close();
          if (!preExist) {
            self.indexedDB.deleteDatabase(DB_CHECK_NAME);
          }
          resolve(true);
        };
        request.onupgradeneeded = () => {
          preExist = false;
        };
        request.onerror = () => {
          var _a2;
          reject(((_a2 = request.error) == null ? void 0 : _a2.message) || "");
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  function areCookiesEnabled() {
    if (typeof navigator === "undefined" || !navigator.cookieEnabled) {
      return false;
    }
    return true;
  }
  function replaceTemplate(template, data) {
    return template.replace(PATTERN, (_, key) => {
      const value = data[key];
      return value != null ? String(value) : `<${key}?>`;
    });
  }
  function deepEqual(a, b) {
    if (a === b) {
      return true;
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    for (const k of aKeys) {
      if (!bKeys.includes(k)) {
        return false;
      }
      const aProp = a[k];
      const bProp = b[k];
      if (isObject(aProp) && isObject(bProp)) {
        if (!deepEqual(aProp, bProp)) {
          return false;
        }
      } else if (aProp !== bProp) {
        return false;
      }
    }
    for (const k of bKeys) {
      if (!aKeys.includes(k)) {
        return false;
      }
    }
    return true;
  }
  function isObject(thing) {
    return thing !== null && typeof thing === "object";
  }
  function getModularInstance(service) {
    if (service && service._delegate) {
      return service._delegate;
    } else {
      return service;
    }
  }
  var stringToByteArray$1, byteArrayToString, base64, _DecodeBase64StringError, DecodeBase64StringError, base64Encode, base64urlEncodeWithoutPadding, base64Decode, getDefaultsFromGlobal, getDefaultsFromEnvVariable, getDefaultsFromCookie, getDefaults, getDefaultAppConfig, _Deferred, Deferred, ERROR_NAME, _FirebaseError, FirebaseError, _ErrorFactory, ErrorFactory, PATTERN, MAX_VALUE_MILLIS;
  var init_index_esm = __esm({
    "node_modules/@firebase/util/dist/index.esm.js"() {
      init_postinstall();
      stringToByteArray$1 = /* @__PURE__ */ __name(function(str) {
        const out = [];
        let p = 0;
        for (let i = 0; i < str.length; i++) {
          let c = str.charCodeAt(i);
          if (c < 128) {
            out[p++] = c;
          } else if (c < 2048) {
            out[p++] = c >> 6 | 192;
            out[p++] = c & 63 | 128;
          } else if ((c & 64512) === 55296 && i + 1 < str.length && (str.charCodeAt(i + 1) & 64512) === 56320) {
            c = 65536 + ((c & 1023) << 10) + (str.charCodeAt(++i) & 1023);
            out[p++] = c >> 18 | 240;
            out[p++] = c >> 12 & 63 | 128;
            out[p++] = c >> 6 & 63 | 128;
            out[p++] = c & 63 | 128;
          } else {
            out[p++] = c >> 12 | 224;
            out[p++] = c >> 6 & 63 | 128;
            out[p++] = c & 63 | 128;
          }
        }
        return out;
      }, "stringToByteArray$1");
      byteArrayToString = /* @__PURE__ */ __name(function(bytes) {
        const out = [];
        let pos = 0, c = 0;
        while (pos < bytes.length) {
          const c1 = bytes[pos++];
          if (c1 < 128) {
            out[c++] = String.fromCharCode(c1);
          } else if (c1 > 191 && c1 < 224) {
            const c2 = bytes[pos++];
            out[c++] = String.fromCharCode((c1 & 31) << 6 | c2 & 63);
          } else if (c1 > 239 && c1 < 365) {
            const c2 = bytes[pos++];
            const c3 = bytes[pos++];
            const c4 = bytes[pos++];
            const u = ((c1 & 7) << 18 | (c2 & 63) << 12 | (c3 & 63) << 6 | c4 & 63) - 65536;
            out[c++] = String.fromCharCode(55296 + (u >> 10));
            out[c++] = String.fromCharCode(56320 + (u & 1023));
          } else {
            const c2 = bytes[pos++];
            const c3 = bytes[pos++];
            out[c++] = String.fromCharCode((c1 & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
          }
        }
        return out.join("");
      }, "byteArrayToString");
      base64 = {
        /**
         * Maps bytes to characters.
         */
        byteToCharMap_: null,
        /**
         * Maps characters to bytes.
         */
        charToByteMap_: null,
        /**
         * Maps bytes to websafe characters.
         * @private
         */
        byteToCharMapWebSafe_: null,
        /**
         * Maps websafe characters to bytes.
         * @private
         */
        charToByteMapWebSafe_: null,
        /**
         * Our default alphabet, shared between
         * ENCODED_VALS and ENCODED_VALS_WEBSAFE
         */
        ENCODED_VALS_BASE: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        /**
         * Our default alphabet. Value 64 (=) is special; it means "nothing."
         */
        get ENCODED_VALS() {
          return this.ENCODED_VALS_BASE + "+/=";
        },
        /**
         * Our websafe alphabet.
         */
        get ENCODED_VALS_WEBSAFE() {
          return this.ENCODED_VALS_BASE + "-_.";
        },
        /**
         * Whether this browser supports the atob and btoa functions. This extension
         * started at Mozilla but is now implemented by many browsers. We use the
         * ASSUME_* variables to avoid pulling in the full useragent detection library
         * but still allowing the standard per-browser compilations.
         *
         */
        HAS_NATIVE_SUPPORT: typeof atob === "function",
        /**
         * Base64-encode an array of bytes.
         *
         * @param input An array of bytes (numbers with
         *     value in [0, 255]) to encode.
         * @param webSafe Boolean indicating we should use the
         *     alternative alphabet.
         * @return The base64 encoded string.
         */
        encodeByteArray(input, webSafe) {
          if (!Array.isArray(input)) {
            throw Error("encodeByteArray takes an array as a parameter");
          }
          this.init_();
          const byteToCharMap = webSafe ? this.byteToCharMapWebSafe_ : this.byteToCharMap_;
          const output = [];
          for (let i = 0; i < input.length; i += 3) {
            const byte1 = input[i];
            const haveByte2 = i + 1 < input.length;
            const byte2 = haveByte2 ? input[i + 1] : 0;
            const haveByte3 = i + 2 < input.length;
            const byte3 = haveByte3 ? input[i + 2] : 0;
            const outByte1 = byte1 >> 2;
            const outByte2 = (byte1 & 3) << 4 | byte2 >> 4;
            let outByte3 = (byte2 & 15) << 2 | byte3 >> 6;
            let outByte4 = byte3 & 63;
            if (!haveByte3) {
              outByte4 = 64;
              if (!haveByte2) {
                outByte3 = 64;
              }
            }
            output.push(byteToCharMap[outByte1], byteToCharMap[outByte2], byteToCharMap[outByte3], byteToCharMap[outByte4]);
          }
          return output.join("");
        },
        /**
         * Base64-encode a string.
         *
         * @param input A string to encode.
         * @param webSafe If true, we should use the
         *     alternative alphabet.
         * @return The base64 encoded string.
         */
        encodeString(input, webSafe) {
          if (this.HAS_NATIVE_SUPPORT && !webSafe) {
            return btoa(input);
          }
          return this.encodeByteArray(stringToByteArray$1(input), webSafe);
        },
        /**
         * Base64-decode a string.
         *
         * @param input to decode.
         * @param webSafe True if we should use the
         *     alternative alphabet.
         * @return string representing the decoded value.
         */
        decodeString(input, webSafe) {
          if (this.HAS_NATIVE_SUPPORT && !webSafe) {
            return atob(input);
          }
          return byteArrayToString(this.decodeStringToByteArray(input, webSafe));
        },
        /**
         * Base64-decode a string.
         *
         * In base-64 decoding, groups of four characters are converted into three
         * bytes.  If the encoder did not apply padding, the input length may not
         * be a multiple of 4.
         *
         * In this case, the last group will have fewer than 4 characters, and
         * padding will be inferred.  If the group has one or two characters, it decodes
         * to one byte.  If the group has three characters, it decodes to two bytes.
         *
         * @param input Input to decode.
         * @param webSafe True if we should use the web-safe alphabet.
         * @return bytes representing the decoded value.
         */
        decodeStringToByteArray(input, webSafe) {
          this.init_();
          const charToByteMap = webSafe ? this.charToByteMapWebSafe_ : this.charToByteMap_;
          const output = [];
          for (let i = 0; i < input.length; ) {
            const byte1 = charToByteMap[input.charAt(i++)];
            const haveByte2 = i < input.length;
            const byte2 = haveByte2 ? charToByteMap[input.charAt(i)] : 0;
            ++i;
            const haveByte3 = i < input.length;
            const byte3 = haveByte3 ? charToByteMap[input.charAt(i)] : 64;
            ++i;
            const haveByte4 = i < input.length;
            const byte4 = haveByte4 ? charToByteMap[input.charAt(i)] : 64;
            ++i;
            if (byte1 == null || byte2 == null || byte3 == null || byte4 == null) {
              throw new DecodeBase64StringError();
            }
            const outByte1 = byte1 << 2 | byte2 >> 4;
            output.push(outByte1);
            if (byte3 !== 64) {
              const outByte2 = byte2 << 4 & 240 | byte3 >> 2;
              output.push(outByte2);
              if (byte4 !== 64) {
                const outByte3 = byte3 << 6 & 192 | byte4;
                output.push(outByte3);
              }
            }
          }
          return output;
        },
        /**
         * Lazy static initialization function. Called before
         * accessing any of the static map variables.
         * @private
         */
        init_() {
          if (!this.byteToCharMap_) {
            this.byteToCharMap_ = {};
            this.charToByteMap_ = {};
            this.byteToCharMapWebSafe_ = {};
            this.charToByteMapWebSafe_ = {};
            for (let i = 0; i < this.ENCODED_VALS.length; i++) {
              this.byteToCharMap_[i] = this.ENCODED_VALS.charAt(i);
              this.charToByteMap_[this.byteToCharMap_[i]] = i;
              this.byteToCharMapWebSafe_[i] = this.ENCODED_VALS_WEBSAFE.charAt(i);
              this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[i]] = i;
              if (i >= this.ENCODED_VALS_BASE.length) {
                this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(i)] = i;
                this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(i)] = i;
              }
            }
          }
        }
      };
      _DecodeBase64StringError = class _DecodeBase64StringError extends Error {
        constructor() {
          super(...arguments);
          this.name = "DecodeBase64StringError";
        }
      };
      __name(_DecodeBase64StringError, "DecodeBase64StringError");
      DecodeBase64StringError = _DecodeBase64StringError;
      base64Encode = /* @__PURE__ */ __name(function(str) {
        const utf8Bytes = stringToByteArray$1(str);
        return base64.encodeByteArray(utf8Bytes, true);
      }, "base64Encode");
      base64urlEncodeWithoutPadding = /* @__PURE__ */ __name(function(str) {
        return base64Encode(str).replace(/\./g, "");
      }, "base64urlEncodeWithoutPadding");
      base64Decode = /* @__PURE__ */ __name(function(str) {
        try {
          return base64.decodeString(str, true);
        } catch (e) {
          console.error("base64Decode failed: ", e);
        }
        return null;
      }, "base64Decode");
      __name(getGlobal, "getGlobal");
      getDefaultsFromGlobal = /* @__PURE__ */ __name(() => getGlobal().__FIREBASE_DEFAULTS__, "getDefaultsFromGlobal");
      getDefaultsFromEnvVariable = /* @__PURE__ */ __name(() => {
        if (typeof process === "undefined" || typeof process.env === "undefined") {
          return;
        }
        const defaultsJsonString = process.env.__FIREBASE_DEFAULTS__;
        if (defaultsJsonString) {
          return JSON.parse(defaultsJsonString);
        }
      }, "getDefaultsFromEnvVariable");
      getDefaultsFromCookie = /* @__PURE__ */ __name(() => {
        if (typeof document === "undefined") {
          return;
        }
        let match;
        try {
          match = document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/);
        } catch (e) {
          return;
        }
        const decoded = match && base64Decode(match[1]);
        return decoded && JSON.parse(decoded);
      }, "getDefaultsFromCookie");
      getDefaults = /* @__PURE__ */ __name(() => {
        try {
          return getDefaultsFromPostinstall() || getDefaultsFromGlobal() || getDefaultsFromEnvVariable() || getDefaultsFromCookie();
        } catch (e) {
          console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);
          return;
        }
      }, "getDefaults");
      getDefaultAppConfig = /* @__PURE__ */ __name(() => {
        var _a2;
        return (_a2 = getDefaults()) == null ? void 0 : _a2.config;
      }, "getDefaultAppConfig");
      _Deferred = class _Deferred {
        constructor() {
          this.reject = () => {
          };
          this.resolve = () => {
          };
          this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
          });
        }
        /**
         * Our API internals are not promisified and cannot because our callback APIs have subtle expectations around
         * invoking promises inline, which Promises are forbidden to do. This method accepts an optional node-style callback
         * and returns a node-style callback which will resolve or reject the Deferred's promise.
         */
        wrapCallback(callback) {
          return (error, value) => {
            if (error) {
              this.reject(error);
            } else {
              this.resolve(value);
            }
            if (typeof callback === "function") {
              this.promise.catch(() => {
              });
              if (callback.length === 1) {
                callback(error);
              } else {
                callback(error, value);
              }
            }
          };
        }
      };
      __name(_Deferred, "Deferred");
      Deferred = _Deferred;
      __name(isBrowser, "isBrowser");
      __name(isWebWorker, "isWebWorker");
      __name(isIndexedDBAvailable, "isIndexedDBAvailable");
      __name(validateIndexedDBOpenable, "validateIndexedDBOpenable");
      __name(areCookiesEnabled, "areCookiesEnabled");
      ERROR_NAME = "FirebaseError";
      _FirebaseError = class _FirebaseError extends Error {
        constructor(code, message, customData) {
          super(message);
          this.code = code;
          this.customData = customData;
          this.name = ERROR_NAME;
          Object.setPrototypeOf(this, _FirebaseError.prototype);
          if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ErrorFactory.prototype.create);
          }
        }
      };
      __name(_FirebaseError, "FirebaseError");
      FirebaseError = _FirebaseError;
      _ErrorFactory = class _ErrorFactory {
        constructor(service, serviceName, errors) {
          this.service = service;
          this.serviceName = serviceName;
          this.errors = errors;
        }
        create(code, ...data) {
          const customData = data[0] || {};
          const fullCode = `${this.service}/${code}`;
          const template = this.errors[code];
          const message = template ? replaceTemplate(template, customData) : "Error";
          const fullMessage = `${this.serviceName}: ${message} (${fullCode}).`;
          const error = new FirebaseError(fullCode, fullMessage, customData);
          return error;
        }
      };
      __name(_ErrorFactory, "ErrorFactory");
      ErrorFactory = _ErrorFactory;
      __name(replaceTemplate, "replaceTemplate");
      PATTERN = /\{\$([^}]+)}/g;
      __name(deepEqual, "deepEqual");
      __name(isObject, "isObject");
      MAX_VALUE_MILLIS = 4 * 60 * 60 * 1e3;
      __name(getModularInstance, "getModularInstance");
    }
  });

  // node_modules/@firebase/component/dist/esm/index.esm.js
  function normalizeIdentifierForFactory(identifier) {
    return identifier === DEFAULT_ENTRY_NAME ? void 0 : identifier;
  }
  function isComponentEager(component) {
    return component.instantiationMode === "EAGER";
  }
  var _Component2, Component2, DEFAULT_ENTRY_NAME, _Provider, Provider, _ComponentContainer, ComponentContainer;
  var init_index_esm2 = __esm({
    "node_modules/@firebase/component/dist/esm/index.esm.js"() {
      init_index_esm();
      _Component2 = class _Component2 {
        /**
         *
         * @param name The public service name, e.g. app, auth, firestore, database
         * @param instanceFactory Service factory responsible for creating the public interface
         * @param type whether the service provided by the component is public or private
         */
        constructor(name5, instanceFactory, type) {
          this.name = name5;
          this.instanceFactory = instanceFactory;
          this.type = type;
          this.multipleInstances = false;
          this.serviceProps = {};
          this.instantiationMode = "LAZY";
          this.onInstanceCreated = null;
        }
        setInstantiationMode(mode) {
          this.instantiationMode = mode;
          return this;
        }
        setMultipleInstances(multipleInstances) {
          this.multipleInstances = multipleInstances;
          return this;
        }
        setServiceProps(props) {
          this.serviceProps = props;
          return this;
        }
        setInstanceCreatedCallback(callback) {
          this.onInstanceCreated = callback;
          return this;
        }
      };
      __name(_Component2, "Component");
      Component2 = _Component2;
      DEFAULT_ENTRY_NAME = "[DEFAULT]";
      _Provider = class _Provider {
        constructor(name5, container) {
          this.name = name5;
          this.container = container;
          this.component = null;
          this.instances = /* @__PURE__ */ new Map();
          this.instancesDeferred = /* @__PURE__ */ new Map();
          this.instancesOptions = /* @__PURE__ */ new Map();
          this.onInitCallbacks = /* @__PURE__ */ new Map();
        }
        /**
         * @param identifier A provider can provide multiple instances of a service
         * if this.component.multipleInstances is true.
         */
        get(identifier) {
          const normalizedIdentifier = this.normalizeInstanceIdentifier(identifier);
          if (!this.instancesDeferred.has(normalizedIdentifier)) {
            const deferred = new Deferred();
            this.instancesDeferred.set(normalizedIdentifier, deferred);
            if (this.isInitialized(normalizedIdentifier) || this.shouldAutoInitialize()) {
              try {
                const instance = this.getOrInitializeService({
                  instanceIdentifier: normalizedIdentifier
                });
                if (instance) {
                  deferred.resolve(instance);
                }
              } catch (e) {
              }
            }
          }
          return this.instancesDeferred.get(normalizedIdentifier).promise;
        }
        getImmediate(options) {
          var _a2;
          const normalizedIdentifier = this.normalizeInstanceIdentifier(options == null ? void 0 : options.identifier);
          const optional = (_a2 = options == null ? void 0 : options.optional) != null ? _a2 : false;
          if (this.isInitialized(normalizedIdentifier) || this.shouldAutoInitialize()) {
            try {
              return this.getOrInitializeService({
                instanceIdentifier: normalizedIdentifier
              });
            } catch (e) {
              if (optional) {
                return null;
              } else {
                throw e;
              }
            }
          } else {
            if (optional) {
              return null;
            } else {
              throw Error(`Service ${this.name} is not available`);
            }
          }
        }
        getComponent() {
          return this.component;
        }
        setComponent(component) {
          if (component.name !== this.name) {
            throw Error(`Mismatching Component ${component.name} for Provider ${this.name}.`);
          }
          if (this.component) {
            throw Error(`Component for ${this.name} has already been provided`);
          }
          this.component = component;
          if (!this.shouldAutoInitialize()) {
            return;
          }
          if (isComponentEager(component)) {
            try {
              this.getOrInitializeService({ instanceIdentifier: DEFAULT_ENTRY_NAME });
            } catch (e) {
            }
          }
          for (const [instanceIdentifier, instanceDeferred] of this.instancesDeferred.entries()) {
            const normalizedIdentifier = this.normalizeInstanceIdentifier(instanceIdentifier);
            try {
              const instance = this.getOrInitializeService({
                instanceIdentifier: normalizedIdentifier
              });
              instanceDeferred.resolve(instance);
            } catch (e) {
            }
          }
        }
        clearInstance(identifier = DEFAULT_ENTRY_NAME) {
          this.instancesDeferred.delete(identifier);
          this.instancesOptions.delete(identifier);
          this.instances.delete(identifier);
        }
        // app.delete() will call this method on every provider to delete the services
        // TODO: should we mark the provider as deleted?
        delete() {
          return __async(this, null, function* () {
            const services2 = Array.from(this.instances.values());
            yield Promise.all([
              ...services2.filter((service) => "INTERNAL" in service).map((service) => service.INTERNAL.delete()),
              ...services2.filter((service) => "_delete" in service).map((service) => service._delete())
            ]);
          });
        }
        isComponentSet() {
          return this.component != null;
        }
        isInitialized(identifier = DEFAULT_ENTRY_NAME) {
          return this.instances.has(identifier);
        }
        getOptions(identifier = DEFAULT_ENTRY_NAME) {
          return this.instancesOptions.get(identifier) || {};
        }
        initialize(opts = {}) {
          const { options = {} } = opts;
          const normalizedIdentifier = this.normalizeInstanceIdentifier(opts.instanceIdentifier);
          if (this.isInitialized(normalizedIdentifier)) {
            throw Error(`${this.name}(${normalizedIdentifier}) has already been initialized`);
          }
          if (!this.isComponentSet()) {
            throw Error(`Component ${this.name} has not been registered yet`);
          }
          const instance = this.getOrInitializeService({
            instanceIdentifier: normalizedIdentifier,
            options
          });
          for (const [instanceIdentifier, instanceDeferred] of this.instancesDeferred.entries()) {
            const normalizedDeferredIdentifier = this.normalizeInstanceIdentifier(instanceIdentifier);
            if (normalizedIdentifier === normalizedDeferredIdentifier) {
              instanceDeferred.resolve(instance);
            }
          }
          return instance;
        }
        /**
         *
         * @param callback - a function that will be invoked  after the provider has been initialized by calling provider.initialize().
         * The function is invoked SYNCHRONOUSLY, so it should not execute any longrunning tasks in order to not block the program.
         *
         * @param identifier An optional instance identifier
         * @returns a function to unregister the callback
         */
        onInit(callback, identifier) {
          var _a2;
          const normalizedIdentifier = this.normalizeInstanceIdentifier(identifier);
          const existingCallbacks = (_a2 = this.onInitCallbacks.get(normalizedIdentifier)) != null ? _a2 : /* @__PURE__ */ new Set();
          existingCallbacks.add(callback);
          this.onInitCallbacks.set(normalizedIdentifier, existingCallbacks);
          const existingInstance = this.instances.get(normalizedIdentifier);
          if (existingInstance) {
            callback(existingInstance, normalizedIdentifier);
          }
          return () => {
            existingCallbacks.delete(callback);
          };
        }
        /**
         * Invoke onInit callbacks synchronously
         * @param instance the service instance`
         */
        invokeOnInitCallbacks(instance, identifier) {
          const callbacks = this.onInitCallbacks.get(identifier);
          if (!callbacks) {
            return;
          }
          for (const callback of callbacks) {
            try {
              callback(instance, identifier);
            } catch (e) {
            }
          }
        }
        getOrInitializeService({ instanceIdentifier, options = {} }) {
          let instance = this.instances.get(instanceIdentifier);
          if (!instance && this.component) {
            instance = this.component.instanceFactory(this.container, {
              instanceIdentifier: normalizeIdentifierForFactory(instanceIdentifier),
              options
            });
            this.instances.set(instanceIdentifier, instance);
            this.instancesOptions.set(instanceIdentifier, options);
            this.invokeOnInitCallbacks(instance, instanceIdentifier);
            if (this.component.onInstanceCreated) {
              try {
                this.component.onInstanceCreated(this.container, instanceIdentifier, instance);
              } catch (e) {
              }
            }
          }
          return instance || null;
        }
        normalizeInstanceIdentifier(identifier = DEFAULT_ENTRY_NAME) {
          if (this.component) {
            return this.component.multipleInstances ? identifier : DEFAULT_ENTRY_NAME;
          } else {
            return identifier;
          }
        }
        shouldAutoInitialize() {
          return !!this.component && this.component.instantiationMode !== "EXPLICIT";
        }
      };
      __name(_Provider, "Provider");
      Provider = _Provider;
      __name(normalizeIdentifierForFactory, "normalizeIdentifierForFactory");
      __name(isComponentEager, "isComponentEager");
      _ComponentContainer = class _ComponentContainer {
        constructor(name5) {
          this.name = name5;
          this.providers = /* @__PURE__ */ new Map();
        }
        /**
         *
         * @param component Component being added
         * @param overwrite When a component with the same name has already been registered,
         * if overwrite is true: overwrite the existing component with the new component and create a new
         * provider with the new component. It can be useful in tests where you want to use different mocks
         * for different tests.
         * if overwrite is false: throw an exception
         */
        addComponent(component) {
          const provider = this.getProvider(component.name);
          if (provider.isComponentSet()) {
            throw new Error(`Component ${component.name} has already been registered with ${this.name}`);
          }
          provider.setComponent(component);
        }
        addOrOverwriteComponent(component) {
          const provider = this.getProvider(component.name);
          if (provider.isComponentSet()) {
            this.providers.delete(component.name);
          }
          this.addComponent(component);
        }
        /**
         * getProvider provides a type safe interface where it can only be called with a field name
         * present in NameServiceMapping interface.
         *
         * Firebase SDKs providing services should extend NameServiceMapping interface to register
         * themselves.
         */
        getProvider(name5) {
          if (this.providers.has(name5)) {
            return this.providers.get(name5);
          }
          const provider = new Provider(name5, this);
          this.providers.set(name5, provider);
          return provider;
        }
        getProviders() {
          return Array.from(this.providers.values());
        }
      };
      __name(_ComponentContainer, "ComponentContainer");
      ComponentContainer = _ComponentContainer;
    }
  });

  // node_modules/@firebase/logger/dist/esm/index.esm.js
  function setLogLevel(level) {
    instances2.forEach((inst) => {
      inst.setLogLevel(level);
    });
  }
  function setUserLogHandler(logCallback, options) {
    for (const instance of instances2) {
      let customLogLevel = null;
      if (options && options.level) {
        customLogLevel = levelStringToEnum[options.level];
      }
      if (logCallback === null) {
        instance.userLogHandler = null;
      } else {
        instance.userLogHandler = (instance2, level, ...args) => {
          const message = args.map((arg) => {
            if (arg == null) {
              return null;
            } else if (typeof arg === "string") {
              return arg;
            } else if (typeof arg === "number" || typeof arg === "boolean") {
              return arg.toString();
            } else if (arg instanceof Error) {
              return arg.message;
            } else {
              try {
                return JSON.stringify(arg);
              } catch (ignored) {
                return null;
              }
            }
          }).filter((arg) => arg).join(" ");
          if (level >= (customLogLevel != null ? customLogLevel : instance2.logLevel)) {
            logCallback({
              level: LogLevel[level].toLowerCase(),
              message,
              args,
              type: instance2.name
            });
          }
        };
      }
    }
  }
  var instances2, LogLevel, levelStringToEnum, defaultLogLevel, ConsoleMethod, defaultLogHandler, _Logger, Logger;
  var init_index_esm3 = __esm({
    "node_modules/@firebase/logger/dist/esm/index.esm.js"() {
      instances2 = [];
      (function(LogLevel2) {
        LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
        LogLevel2[LogLevel2["VERBOSE"] = 1] = "VERBOSE";
        LogLevel2[LogLevel2["INFO"] = 2] = "INFO";
        LogLevel2[LogLevel2["WARN"] = 3] = "WARN";
        LogLevel2[LogLevel2["ERROR"] = 4] = "ERROR";
        LogLevel2[LogLevel2["SILENT"] = 5] = "SILENT";
      })(LogLevel || (LogLevel = {}));
      levelStringToEnum = {
        "debug": LogLevel.DEBUG,
        "verbose": LogLevel.VERBOSE,
        "info": LogLevel.INFO,
        "warn": LogLevel.WARN,
        "error": LogLevel.ERROR,
        "silent": LogLevel.SILENT
      };
      defaultLogLevel = LogLevel.INFO;
      ConsoleMethod = {
        [LogLevel.DEBUG]: "log",
        [LogLevel.VERBOSE]: "log",
        [LogLevel.INFO]: "info",
        [LogLevel.WARN]: "warn",
        [LogLevel.ERROR]: "error"
      };
      defaultLogHandler = /* @__PURE__ */ __name((instance, logType, ...args) => {
        if (logType < instance.logLevel) {
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const method = ConsoleMethod[logType];
        if (method) {
          console[method](`[${now}]  ${instance.name}:`, ...args);
        } else {
          throw new Error(`Attempted to log a message with an invalid logType (value: ${logType})`);
        }
      }, "defaultLogHandler");
      _Logger = class _Logger {
        /**
         * Gives you an instance of a Logger to capture messages according to
         * Firebase's logging scheme.
         *
         * @param name The name that the logs will be associated with
         */
        constructor(name5) {
          this.name = name5;
          this._logLevel = defaultLogLevel;
          this._logHandler = defaultLogHandler;
          this._userLogHandler = null;
          instances2.push(this);
        }
        get logLevel() {
          return this._logLevel;
        }
        set logLevel(val) {
          if (!(val in LogLevel)) {
            throw new TypeError(`Invalid value "${val}" assigned to \`logLevel\``);
          }
          this._logLevel = val;
        }
        // Workaround for setter/getter having to be the same type.
        setLogLevel(val) {
          this._logLevel = typeof val === "string" ? levelStringToEnum[val] : val;
        }
        get logHandler() {
          return this._logHandler;
        }
        set logHandler(val) {
          if (typeof val !== "function") {
            throw new TypeError("Value assigned to `logHandler` must be a function");
          }
          this._logHandler = val;
        }
        get userLogHandler() {
          return this._userLogHandler;
        }
        set userLogHandler(val) {
          this._userLogHandler = val;
        }
        /**
         * The functions below are all based on the `console` interface
         */
        debug(...args) {
          this._userLogHandler && this._userLogHandler(this, LogLevel.DEBUG, ...args);
          this._logHandler(this, LogLevel.DEBUG, ...args);
        }
        log(...args) {
          this._userLogHandler && this._userLogHandler(this, LogLevel.VERBOSE, ...args);
          this._logHandler(this, LogLevel.VERBOSE, ...args);
        }
        info(...args) {
          this._userLogHandler && this._userLogHandler(this, LogLevel.INFO, ...args);
          this._logHandler(this, LogLevel.INFO, ...args);
        }
        warn(...args) {
          this._userLogHandler && this._userLogHandler(this, LogLevel.WARN, ...args);
          this._logHandler(this, LogLevel.WARN, ...args);
        }
        error(...args) {
          this._userLogHandler && this._userLogHandler(this, LogLevel.ERROR, ...args);
          this._logHandler(this, LogLevel.ERROR, ...args);
        }
      };
      __name(_Logger, "Logger");
      Logger = _Logger;
      __name(setLogLevel, "setLogLevel");
      __name(setUserLogHandler, "setUserLogHandler");
    }
  });

  // node_modules/idb/build/wrap-idb-value.js
  function getIdbProxyableTypes() {
    return idbProxyableTypes || (idbProxyableTypes = [
      IDBDatabase,
      IDBObjectStore,
      IDBIndex,
      IDBCursor,
      IDBTransaction
    ]);
  }
  function getCursorAdvanceMethods() {
    return cursorAdvanceMethods || (cursorAdvanceMethods = [
      IDBCursor.prototype.advance,
      IDBCursor.prototype.continue,
      IDBCursor.prototype.continuePrimaryKey
    ]);
  }
  function promisifyRequest(request) {
    const promise = new Promise((resolve, reject) => {
      const unlisten = /* @__PURE__ */ __name(() => {
        request.removeEventListener("success", success);
        request.removeEventListener("error", error);
      }, "unlisten");
      const success = /* @__PURE__ */ __name(() => {
        resolve(wrap(request.result));
        unlisten();
      }, "success");
      const error = /* @__PURE__ */ __name(() => {
        reject(request.error);
        unlisten();
      }, "error");
      request.addEventListener("success", success);
      request.addEventListener("error", error);
    });
    promise.then((value) => {
      if (value instanceof IDBCursor) {
        cursorRequestMap.set(value, request);
      }
    }).catch(() => {
    });
    reverseTransformCache.set(promise, request);
    return promise;
  }
  function cacheDonePromiseForTransaction(tx) {
    if (transactionDoneMap.has(tx))
      return;
    const done = new Promise((resolve, reject) => {
      const unlisten = /* @__PURE__ */ __name(() => {
        tx.removeEventListener("complete", complete);
        tx.removeEventListener("error", error);
        tx.removeEventListener("abort", error);
      }, "unlisten");
      const complete = /* @__PURE__ */ __name(() => {
        resolve();
        unlisten();
      }, "complete");
      const error = /* @__PURE__ */ __name(() => {
        reject(tx.error || new DOMException("AbortError", "AbortError"));
        unlisten();
      }, "error");
      tx.addEventListener("complete", complete);
      tx.addEventListener("error", error);
      tx.addEventListener("abort", error);
    });
    transactionDoneMap.set(tx, done);
  }
  function replaceTraps(callback) {
    idbProxyTraps = callback(idbProxyTraps);
  }
  function wrapFunction(func) {
    if (func === IDBDatabase.prototype.transaction && !("objectStoreNames" in IDBTransaction.prototype)) {
      return function(storeNames, ...args) {
        const tx = func.call(unwrap(this), storeNames, ...args);
        transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
        return wrap(tx);
      };
    }
    if (getCursorAdvanceMethods().includes(func)) {
      return function(...args) {
        func.apply(unwrap(this), args);
        return wrap(cursorRequestMap.get(this));
      };
    }
    return function(...args) {
      return wrap(func.apply(unwrap(this), args));
    };
  }
  function transformCachableValue(value) {
    if (typeof value === "function")
      return wrapFunction(value);
    if (value instanceof IDBTransaction)
      cacheDonePromiseForTransaction(value);
    if (instanceOfAny(value, getIdbProxyableTypes()))
      return new Proxy(value, idbProxyTraps);
    return value;
  }
  function wrap(value) {
    if (value instanceof IDBRequest)
      return promisifyRequest(value);
    if (transformCache.has(value))
      return transformCache.get(value);
    const newValue = transformCachableValue(value);
    if (newValue !== value) {
      transformCache.set(value, newValue);
      reverseTransformCache.set(newValue, value);
    }
    return newValue;
  }
  var instanceOfAny, idbProxyableTypes, cursorAdvanceMethods, cursorRequestMap, transactionDoneMap, transactionStoreNamesMap, transformCache, reverseTransformCache, idbProxyTraps, unwrap;
  var init_wrap_idb_value = __esm({
    "node_modules/idb/build/wrap-idb-value.js"() {
      instanceOfAny = /* @__PURE__ */ __name((object, constructors) => constructors.some((c) => object instanceof c), "instanceOfAny");
      __name(getIdbProxyableTypes, "getIdbProxyableTypes");
      __name(getCursorAdvanceMethods, "getCursorAdvanceMethods");
      cursorRequestMap = /* @__PURE__ */ new WeakMap();
      transactionDoneMap = /* @__PURE__ */ new WeakMap();
      transactionStoreNamesMap = /* @__PURE__ */ new WeakMap();
      transformCache = /* @__PURE__ */ new WeakMap();
      reverseTransformCache = /* @__PURE__ */ new WeakMap();
      __name(promisifyRequest, "promisifyRequest");
      __name(cacheDonePromiseForTransaction, "cacheDonePromiseForTransaction");
      idbProxyTraps = {
        get(target, prop, receiver) {
          if (target instanceof IDBTransaction) {
            if (prop === "done")
              return transactionDoneMap.get(target);
            if (prop === "objectStoreNames") {
              return target.objectStoreNames || transactionStoreNamesMap.get(target);
            }
            if (prop === "store") {
              return receiver.objectStoreNames[1] ? void 0 : receiver.objectStore(receiver.objectStoreNames[0]);
            }
          }
          return wrap(target[prop]);
        },
        set(target, prop, value) {
          target[prop] = value;
          return true;
        },
        has(target, prop) {
          if (target instanceof IDBTransaction && (prop === "done" || prop === "store")) {
            return true;
          }
          return prop in target;
        }
      };
      __name(replaceTraps, "replaceTraps");
      __name(wrapFunction, "wrapFunction");
      __name(transformCachableValue, "transformCachableValue");
      __name(wrap, "wrap");
      unwrap = /* @__PURE__ */ __name((value) => reverseTransformCache.get(value), "unwrap");
    }
  });

  // node_modules/idb/build/index.js
  function openDB(name5, version8, { blocked, upgrade, blocking, terminated } = {}) {
    const request = indexedDB.open(name5, version8);
    const openPromise = wrap(request);
    if (upgrade) {
      request.addEventListener("upgradeneeded", (event) => {
        upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
      });
    }
    if (blocked) {
      request.addEventListener("blocked", (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion,
        event.newVersion,
        event
      ));
    }
    openPromise.then((db) => {
      if (terminated)
        db.addEventListener("close", () => terminated());
      if (blocking) {
        db.addEventListener("versionchange", (event) => blocking(event.oldVersion, event.newVersion, event));
      }
    }).catch(() => {
    });
    return openPromise;
  }
  function deleteDB(name5, { blocked } = {}) {
    const request = indexedDB.deleteDatabase(name5);
    if (blocked) {
      request.addEventListener("blocked", (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion,
        event
      ));
    }
    return wrap(request).then(() => void 0);
  }
  function getMethod(target, prop) {
    if (!(target instanceof IDBDatabase && !(prop in target) && typeof prop === "string")) {
      return;
    }
    if (cachedMethods.get(prop))
      return cachedMethods.get(prop);
    const targetFuncName = prop.replace(/FromIndex$/, "");
    const useIndex = prop !== targetFuncName;
    const isWrite = writeMethods.includes(targetFuncName);
    if (
      // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
      !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) || !(isWrite || readMethods.includes(targetFuncName))
    ) {
      return;
    }
    const method = /* @__PURE__ */ __name(function(storeName, ...args) {
      return __async(this, null, function* () {
        const tx = this.transaction(storeName, isWrite ? "readwrite" : "readonly");
        let target2 = tx.store;
        if (useIndex)
          target2 = target2.index(args.shift());
        return (yield Promise.all([
          target2[targetFuncName](...args),
          isWrite && tx.done
        ]))[0];
      });
    }, "method");
    cachedMethods.set(prop, method);
    return method;
  }
  var readMethods, writeMethods, cachedMethods;
  var init_build = __esm({
    "node_modules/idb/build/index.js"() {
      init_wrap_idb_value();
      init_wrap_idb_value();
      __name(openDB, "openDB");
      __name(deleteDB, "deleteDB");
      readMethods = ["get", "getKey", "getAll", "getAllKeys", "count"];
      writeMethods = ["put", "add", "delete", "clear"];
      cachedMethods = /* @__PURE__ */ new Map();
      __name(getMethod, "getMethod");
      replaceTraps((oldTraps) => __spreadProps(__spreadValues({}, oldTraps), {
        get: /* @__PURE__ */ __name((target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver), "get"),
        has: /* @__PURE__ */ __name((target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop), "has")
      }));
    }
  });

  // node_modules/@firebase/app/dist/esm/index.esm.js
  function isVersionServiceProvider(provider) {
    const component = provider.getComponent();
    return (component == null ? void 0 : component.type) === "VERSION";
  }
  function _addComponent(app, component) {
    try {
      app.container.addComponent(component);
    } catch (e) {
      logger.debug(`Component ${component.name} failed to register with FirebaseApp ${app.name}`, e);
    }
  }
  function _addOrOverwriteComponent(app, component) {
    app.container.addOrOverwriteComponent(component);
  }
  function _registerComponent(component) {
    const componentName = component.name;
    if (_components.has(componentName)) {
      logger.debug(`There were multiple attempts to register component ${componentName}.`);
      return false;
    }
    _components.set(componentName, component);
    for (const app of _apps.values()) {
      _addComponent(app, component);
    }
    for (const serverApp of _serverApps.values()) {
      _addComponent(serverApp, component);
    }
    return true;
  }
  function _getProvider(app, name5) {
    const heartbeatController = app.container.getProvider("heartbeat").getImmediate({ optional: true });
    if (heartbeatController) {
      void heartbeatController.triggerHeartbeat();
    }
    return app.container.getProvider(name5);
  }
  function _removeServiceInstance(app, name5, instanceIdentifier = DEFAULT_ENTRY_NAME2) {
    _getProvider(app, name5).clearInstance(instanceIdentifier);
  }
  function _isFirebaseApp(obj) {
    return obj.options !== void 0;
  }
  function _isFirebaseServerAppSettings(obj) {
    if (_isFirebaseApp(obj)) {
      return false;
    }
    return "authIdToken" in obj || "appCheckToken" in obj || "releaseOnDeref" in obj || "automaticDataCollectionEnabled" in obj;
  }
  function _isFirebaseServerApp(obj) {
    if (obj === null || obj === void 0) {
      return false;
    }
    return obj.settings !== void 0;
  }
  function _clearComponents() {
    _components.clear();
  }
  function validateTokenTTL(base64Token, tokenName) {
    const secondPart = base64Decode(base64Token.split(".")[1]);
    if (secondPart === null) {
      console.error(`FirebaseServerApp ${tokenName} is invalid: second part could not be parsed.`);
      return;
    }
    const expClaim = JSON.parse(secondPart).exp;
    if (expClaim === void 0) {
      console.error(`FirebaseServerApp ${tokenName} is invalid: expiration claim could not be parsed`);
      return;
    }
    const exp = JSON.parse(secondPart).exp * 1e3;
    const now = (/* @__PURE__ */ new Date()).getTime();
    const diff = exp - now;
    if (diff <= 0) {
      console.error(`FirebaseServerApp ${tokenName} is invalid: the token has expired.`);
    }
  }
  function initializeApp(_options, rawConfig = {}) {
    let options = _options;
    if (typeof rawConfig !== "object") {
      const name6 = rawConfig;
      rawConfig = { name: name6 };
    }
    const config = __spreadValues({
      name: DEFAULT_ENTRY_NAME2,
      automaticDataCollectionEnabled: true
    }, rawConfig);
    const name5 = config.name;
    if (typeof name5 !== "string" || !name5) {
      throw ERROR_FACTORY.create("bad-app-name", {
        appName: String(name5)
      });
    }
    options || (options = getDefaultAppConfig());
    if (!options) {
      throw ERROR_FACTORY.create(
        "no-options"
        /* AppError.NO_OPTIONS */
      );
    }
    const existingApp = _apps.get(name5);
    if (existingApp) {
      if (deepEqual(options, existingApp.options) && deepEqual(config, existingApp.config)) {
        return existingApp;
      } else {
        throw ERROR_FACTORY.create("duplicate-app", { appName: name5 });
      }
    }
    const container = new ComponentContainer(name5);
    for (const component of _components.values()) {
      container.addComponent(component);
    }
    const newApp = new FirebaseAppImpl(options, config, container);
    _apps.set(name5, newApp);
    return newApp;
  }
  function initializeServerApp(_options, _serverAppConfig = {}) {
    if (isBrowser() && !isWebWorker()) {
      throw ERROR_FACTORY.create(
        "invalid-server-app-environment"
        /* AppError.INVALID_SERVER_APP_ENVIRONMENT */
      );
    }
    let firebaseOptions;
    let serverAppSettings = _serverAppConfig || {};
    if (_options) {
      if (_isFirebaseApp(_options)) {
        firebaseOptions = _options.options;
      } else if (_isFirebaseServerAppSettings(_options)) {
        serverAppSettings = _options;
      } else {
        firebaseOptions = _options;
      }
    }
    if (serverAppSettings.automaticDataCollectionEnabled === void 0) {
      serverAppSettings.automaticDataCollectionEnabled = true;
    }
    firebaseOptions || (firebaseOptions = getDefaultAppConfig());
    if (!firebaseOptions) {
      throw ERROR_FACTORY.create(
        "no-options"
        /* AppError.NO_OPTIONS */
      );
    }
    const nameObj = __spreadValues(__spreadValues({}, serverAppSettings), firebaseOptions);
    if (nameObj.releaseOnDeref !== void 0) {
      delete nameObj.releaseOnDeref;
    }
    const hashCode = /* @__PURE__ */ __name((s) => {
      return [...s].reduce((hash, c) => Math.imul(31, hash) + c.charCodeAt(0) | 0, 0);
    }, "hashCode");
    if (serverAppSettings.releaseOnDeref !== void 0) {
      if (typeof FinalizationRegistry === "undefined") {
        throw ERROR_FACTORY.create("finalization-registry-not-supported", {});
      }
    }
    const nameString = "" + hashCode(JSON.stringify(nameObj));
    const existingApp = _serverApps.get(nameString);
    if (existingApp) {
      existingApp.incRefCount(serverAppSettings.releaseOnDeref);
      return existingApp;
    }
    const container = new ComponentContainer(nameString);
    for (const component of _components.values()) {
      container.addComponent(component);
    }
    const newApp = new FirebaseServerAppImpl(firebaseOptions, serverAppSettings, nameString, container);
    _serverApps.set(nameString, newApp);
    return newApp;
  }
  function getApp(name5 = DEFAULT_ENTRY_NAME2) {
    const app = _apps.get(name5);
    if (!app && name5 === DEFAULT_ENTRY_NAME2 && getDefaultAppConfig()) {
      return initializeApp();
    }
    if (!app) {
      throw ERROR_FACTORY.create("no-app", { appName: name5 });
    }
    return app;
  }
  function getApps() {
    return Array.from(_apps.values());
  }
  function deleteApp(app) {
    return __async(this, null, function* () {
      let cleanupProviders = false;
      const name5 = app.name;
      if (_apps.has(name5)) {
        cleanupProviders = true;
        _apps.delete(name5);
      } else if (_serverApps.has(name5)) {
        const firebaseServerApp = app;
        if (firebaseServerApp.decRefCount() <= 0) {
          _serverApps.delete(name5);
          cleanupProviders = true;
        }
      }
      if (cleanupProviders) {
        yield Promise.all(app.container.getProviders().map((provider) => provider.delete()));
        app.isDeleted = true;
      }
    });
  }
  function registerVersion(libraryKeyOrName, version8, variant) {
    var _a2;
    let library = (_a2 = PLATFORM_LOG_STRING[libraryKeyOrName]) != null ? _a2 : libraryKeyOrName;
    if (variant) {
      library += `-${variant}`;
    }
    const libraryMismatch = library.match(/\s|\//);
    const versionMismatch = version8.match(/\s|\//);
    if (libraryMismatch || versionMismatch) {
      const warning = [
        `Unable to register library "${library}" with version "${version8}":`
      ];
      if (libraryMismatch) {
        warning.push(`library name "${library}" contains illegal characters (whitespace or "/")`);
      }
      if (libraryMismatch && versionMismatch) {
        warning.push("and");
      }
      if (versionMismatch) {
        warning.push(`version name "${version8}" contains illegal characters (whitespace or "/")`);
      }
      logger.warn(warning.join(" "));
      return;
    }
    _registerComponent(new Component2(
      `${library}-version`,
      () => ({ library, version: version8 }),
      "VERSION"
      /* ComponentType.VERSION */
    ));
  }
  function onLog(logCallback, options) {
    if (logCallback !== null && typeof logCallback !== "function") {
      throw ERROR_FACTORY.create(
        "invalid-log-argument"
        /* AppError.INVALID_LOG_ARGUMENT */
      );
    }
    setUserLogHandler(logCallback, options);
  }
  function setLogLevel2(logLevel) {
    setLogLevel(logLevel);
  }
  function getDbPromise() {
    if (!dbPromise) {
      dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade: /* @__PURE__ */ __name((db, oldVersion) => {
          switch (oldVersion) {
            case 0:
              try {
                db.createObjectStore(STORE_NAME);
              } catch (e) {
                console.warn(e);
              }
          }
        }, "upgrade")
      }).catch((e) => {
        throw ERROR_FACTORY.create("idb-open", {
          originalErrorMessage: e.message
        });
      });
    }
    return dbPromise;
  }
  function readHeartbeatsFromIndexedDB(app) {
    return __async(this, null, function* () {
      try {
        const db = yield getDbPromise();
        const tx = db.transaction(STORE_NAME);
        const result = yield tx.objectStore(STORE_NAME).get(computeKey(app));
        yield tx.done;
        return result;
      } catch (e) {
        if (e instanceof FirebaseError) {
          logger.warn(e.message);
        } else {
          const idbGetError = ERROR_FACTORY.create("idb-get", {
            originalErrorMessage: e == null ? void 0 : e.message
          });
          logger.warn(idbGetError.message);
        }
      }
    });
  }
  function writeHeartbeatsToIndexedDB(app, heartbeatObject) {
    return __async(this, null, function* () {
      try {
        const db = yield getDbPromise();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const objectStore = tx.objectStore(STORE_NAME);
        yield objectStore.put(heartbeatObject, computeKey(app));
        yield tx.done;
      } catch (e) {
        if (e instanceof FirebaseError) {
          logger.warn(e.message);
        } else {
          const idbGetError = ERROR_FACTORY.create("idb-set", {
            originalErrorMessage: e == null ? void 0 : e.message
          });
          logger.warn(idbGetError.message);
        }
      }
    });
  }
  function computeKey(app) {
    return `${app.name}!${app.options.appId}`;
  }
  function getUTCDateString() {
    const today = /* @__PURE__ */ new Date();
    return today.toISOString().substring(0, 10);
  }
  function extractHeartbeatsForHeader(heartbeatsCache, maxSize = MAX_HEADER_BYTES) {
    const heartbeatsToSend = [];
    let unsentEntries = heartbeatsCache.slice();
    for (const singleDateHeartbeat of heartbeatsCache) {
      const heartbeatEntry = heartbeatsToSend.find((hb) => hb.agent === singleDateHeartbeat.agent);
      if (!heartbeatEntry) {
        heartbeatsToSend.push({
          agent: singleDateHeartbeat.agent,
          dates: [singleDateHeartbeat.date]
        });
        if (countBytes(heartbeatsToSend) > maxSize) {
          heartbeatsToSend.pop();
          break;
        }
      } else {
        heartbeatEntry.dates.push(singleDateHeartbeat.date);
        if (countBytes(heartbeatsToSend) > maxSize) {
          heartbeatEntry.dates.pop();
          break;
        }
      }
      unsentEntries = unsentEntries.slice(1);
    }
    return {
      heartbeatsToSend,
      unsentEntries
    };
  }
  function countBytes(heartbeatsCache) {
    return base64urlEncodeWithoutPadding(
      // heartbeatsCache wrapper properties
      JSON.stringify({ version: 2, heartbeats: heartbeatsCache })
    ).length;
  }
  function getEarliestHeartbeatIdx(heartbeats) {
    if (heartbeats.length === 0) {
      return -1;
    }
    let earliestHeartbeatIdx = 0;
    let earliestHeartbeatDate = heartbeats[0].date;
    for (let i = 1; i < heartbeats.length; i++) {
      if (heartbeats[i].date < earliestHeartbeatDate) {
        earliestHeartbeatDate = heartbeats[i].date;
        earliestHeartbeatIdx = i;
      }
    }
    return earliestHeartbeatIdx;
  }
  function registerCoreComponents(variant) {
    _registerComponent(new Component2(
      "platform-logger",
      (container) => new PlatformLoggerServiceImpl(container),
      "PRIVATE"
      /* ComponentType.PRIVATE */
    ));
    _registerComponent(new Component2(
      "heartbeat",
      (container) => new HeartbeatServiceImpl(container),
      "PRIVATE"
      /* ComponentType.PRIVATE */
    ));
    registerVersion(name$q, version$1, variant);
    registerVersion(name$q, version$1, "esm2020");
    registerVersion("fire-js", "");
  }
  var _PlatformLoggerServiceImpl, PlatformLoggerServiceImpl, name$q, version$1, logger, name$p, name$o, name$n, name$m, name$l, name$k, name$j, name$i, name$h, name$g, name$f, name$e, name$d, name$c, name$b, name$a, name$9, name$8, name$7, name$6, name$5, name$4, name$3, name$2, name$1, name, version3, DEFAULT_ENTRY_NAME2, PLATFORM_LOG_STRING, _apps, _serverApps, _components, ERRORS, ERROR_FACTORY, _FirebaseAppImpl, FirebaseAppImpl, _FirebaseServerAppImpl, FirebaseServerAppImpl, SDK_VERSION, DB_NAME, DB_VERSION, STORE_NAME, dbPromise, MAX_HEADER_BYTES, MAX_NUM_STORED_HEARTBEATS, _HeartbeatServiceImpl, HeartbeatServiceImpl, _HeartbeatStorageImpl, HeartbeatStorageImpl;
  var init_index_esm4 = __esm({
    "node_modules/@firebase/app/dist/esm/index.esm.js"() {
      init_index_esm2();
      init_index_esm3();
      init_index_esm();
      init_index_esm();
      init_build();
      _PlatformLoggerServiceImpl = class _PlatformLoggerServiceImpl {
        constructor(container) {
          this.container = container;
        }
        // In initial implementation, this will be called by installations on
        // auth token refresh, and installations will send this string.
        getPlatformInfoString() {
          const providers = this.container.getProviders();
          return providers.map((provider) => {
            if (isVersionServiceProvider(provider)) {
              const service = provider.getImmediate();
              return `${service.library}/${service.version}`;
            } else {
              return null;
            }
          }).filter((logString) => logString).join(" ");
        }
      };
      __name(_PlatformLoggerServiceImpl, "PlatformLoggerServiceImpl");
      PlatformLoggerServiceImpl = _PlatformLoggerServiceImpl;
      __name(isVersionServiceProvider, "isVersionServiceProvider");
      name$q = "@firebase/app";
      version$1 = "0.14.0";
      logger = new Logger("@firebase/app");
      name$p = "@firebase/app-compat";
      name$o = "@firebase/analytics-compat";
      name$n = "@firebase/analytics";
      name$m = "@firebase/app-check-compat";
      name$l = "@firebase/app-check";
      name$k = "@firebase/auth";
      name$j = "@firebase/auth-compat";
      name$i = "@firebase/database";
      name$h = "@firebase/data-connect";
      name$g = "@firebase/database-compat";
      name$f = "@firebase/functions";
      name$e = "@firebase/functions-compat";
      name$d = "@firebase/installations";
      name$c = "@firebase/installations-compat";
      name$b = "@firebase/messaging";
      name$a = "@firebase/messaging-compat";
      name$9 = "@firebase/performance";
      name$8 = "@firebase/performance-compat";
      name$7 = "@firebase/remote-config";
      name$6 = "@firebase/remote-config-compat";
      name$5 = "@firebase/storage";
      name$4 = "@firebase/storage-compat";
      name$3 = "@firebase/firestore";
      name$2 = "@firebase/ai";
      name$1 = "@firebase/firestore-compat";
      name = "firebase";
      version3 = "12.0.0";
      DEFAULT_ENTRY_NAME2 = "[DEFAULT]";
      PLATFORM_LOG_STRING = {
        [name$q]: "fire-core",
        [name$p]: "fire-core-compat",
        [name$n]: "fire-analytics",
        [name$o]: "fire-analytics-compat",
        [name$l]: "fire-app-check",
        [name$m]: "fire-app-check-compat",
        [name$k]: "fire-auth",
        [name$j]: "fire-auth-compat",
        [name$i]: "fire-rtdb",
        [name$h]: "fire-data-connect",
        [name$g]: "fire-rtdb-compat",
        [name$f]: "fire-fn",
        [name$e]: "fire-fn-compat",
        [name$d]: "fire-iid",
        [name$c]: "fire-iid-compat",
        [name$b]: "fire-fcm",
        [name$a]: "fire-fcm-compat",
        [name$9]: "fire-perf",
        [name$8]: "fire-perf-compat",
        [name$7]: "fire-rc",
        [name$6]: "fire-rc-compat",
        [name$5]: "fire-gcs",
        [name$4]: "fire-gcs-compat",
        [name$3]: "fire-fst",
        [name$1]: "fire-fst-compat",
        [name$2]: "fire-vertex",
        "fire-js": "fire-js",
        // Platform identifier for JS SDK.
        [name]: "fire-js-all"
      };
      _apps = /* @__PURE__ */ new Map();
      _serverApps = /* @__PURE__ */ new Map();
      _components = /* @__PURE__ */ new Map();
      __name(_addComponent, "_addComponent");
      __name(_addOrOverwriteComponent, "_addOrOverwriteComponent");
      __name(_registerComponent, "_registerComponent");
      __name(_getProvider, "_getProvider");
      __name(_removeServiceInstance, "_removeServiceInstance");
      __name(_isFirebaseApp, "_isFirebaseApp");
      __name(_isFirebaseServerAppSettings, "_isFirebaseServerAppSettings");
      __name(_isFirebaseServerApp, "_isFirebaseServerApp");
      __name(_clearComponents, "_clearComponents");
      ERRORS = {
        [
          "no-app"
          /* AppError.NO_APP */
        ]: "No Firebase App '{$appName}' has been created - call initializeApp() first",
        [
          "bad-app-name"
          /* AppError.BAD_APP_NAME */
        ]: "Illegal App name: '{$appName}'",
        [
          "duplicate-app"
          /* AppError.DUPLICATE_APP */
        ]: "Firebase App named '{$appName}' already exists with different options or config",
        [
          "app-deleted"
          /* AppError.APP_DELETED */
        ]: "Firebase App named '{$appName}' already deleted",
        [
          "server-app-deleted"
          /* AppError.SERVER_APP_DELETED */
        ]: "Firebase Server App has been deleted",
        [
          "no-options"
          /* AppError.NO_OPTIONS */
        ]: "Need to provide options, when not being deployed to hosting via source.",
        [
          "invalid-app-argument"
          /* AppError.INVALID_APP_ARGUMENT */
        ]: "firebase.{$appName}() takes either no argument or a Firebase App instance.",
        [
          "invalid-log-argument"
          /* AppError.INVALID_LOG_ARGUMENT */
        ]: "First argument to `onLog` must be null or a function.",
        [
          "idb-open"
          /* AppError.IDB_OPEN */
        ]: "Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.",
        [
          "idb-get"
          /* AppError.IDB_GET */
        ]: "Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.",
        [
          "idb-set"
          /* AppError.IDB_WRITE */
        ]: "Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.",
        [
          "idb-delete"
          /* AppError.IDB_DELETE */
        ]: "Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.",
        [
          "finalization-registry-not-supported"
          /* AppError.FINALIZATION_REGISTRY_NOT_SUPPORTED */
        ]: "FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.",
        [
          "invalid-server-app-environment"
          /* AppError.INVALID_SERVER_APP_ENVIRONMENT */
        ]: "FirebaseServerApp is not for use in browser environments."
      };
      ERROR_FACTORY = new ErrorFactory("app", "Firebase", ERRORS);
      _FirebaseAppImpl = class _FirebaseAppImpl {
        constructor(options, config, container) {
          this._isDeleted = false;
          this._options = __spreadValues({}, options);
          this._config = __spreadValues({}, config);
          this._name = config.name;
          this._automaticDataCollectionEnabled = config.automaticDataCollectionEnabled;
          this._container = container;
          this.container.addComponent(new Component2(
            "app",
            () => this,
            "PUBLIC"
            /* ComponentType.PUBLIC */
          ));
        }
        get automaticDataCollectionEnabled() {
          this.checkDestroyed();
          return this._automaticDataCollectionEnabled;
        }
        set automaticDataCollectionEnabled(val) {
          this.checkDestroyed();
          this._automaticDataCollectionEnabled = val;
        }
        get name() {
          this.checkDestroyed();
          return this._name;
        }
        get options() {
          this.checkDestroyed();
          return this._options;
        }
        get config() {
          this.checkDestroyed();
          return this._config;
        }
        get container() {
          return this._container;
        }
        get isDeleted() {
          return this._isDeleted;
        }
        set isDeleted(val) {
          this._isDeleted = val;
        }
        /**
         * This function will throw an Error if the App has already been deleted -
         * use before performing API actions on the App.
         */
        checkDestroyed() {
          if (this.isDeleted) {
            throw ERROR_FACTORY.create("app-deleted", { appName: this._name });
          }
        }
      };
      __name(_FirebaseAppImpl, "FirebaseAppImpl");
      FirebaseAppImpl = _FirebaseAppImpl;
      __name(validateTokenTTL, "validateTokenTTL");
      _FirebaseServerAppImpl = class _FirebaseServerAppImpl extends FirebaseAppImpl {
        constructor(options, serverConfig, name5, container) {
          const automaticDataCollectionEnabled = serverConfig.automaticDataCollectionEnabled !== void 0 ? serverConfig.automaticDataCollectionEnabled : true;
          const config = {
            name: name5,
            automaticDataCollectionEnabled
          };
          if (options.apiKey !== void 0) {
            super(options, config, container);
          } else {
            const appImpl = options;
            super(appImpl.options, config, container);
          }
          this._serverConfig = __spreadValues({
            automaticDataCollectionEnabled
          }, serverConfig);
          if (this._serverConfig.authIdToken) {
            validateTokenTTL(this._serverConfig.authIdToken, "authIdToken");
          }
          if (this._serverConfig.appCheckToken) {
            validateTokenTTL(this._serverConfig.appCheckToken, "appCheckToken");
          }
          this._finalizationRegistry = null;
          if (typeof FinalizationRegistry !== "undefined") {
            this._finalizationRegistry = new FinalizationRegistry(() => {
              this.automaticCleanup();
            });
          }
          this._refCount = 0;
          this.incRefCount(this._serverConfig.releaseOnDeref);
          this._serverConfig.releaseOnDeref = void 0;
          serverConfig.releaseOnDeref = void 0;
          registerVersion(name$q, version$1, "serverapp");
        }
        toJSON() {
          return void 0;
        }
        get refCount() {
          return this._refCount;
        }
        // Increment the reference count of this server app. If an object is provided, register it
        // with the finalization registry.
        incRefCount(obj) {
          if (this.isDeleted) {
            return;
          }
          this._refCount++;
          if (obj !== void 0 && this._finalizationRegistry !== null) {
            this._finalizationRegistry.register(obj, this);
          }
        }
        // Decrement the reference count.
        decRefCount() {
          if (this.isDeleted) {
            return 0;
          }
          return --this._refCount;
        }
        // Invoked by the FinalizationRegistry callback to note that this app should go through its
        // reference counts and delete itself if no reference count remain. The coordinating logic that
        // handles this is in deleteApp(...).
        automaticCleanup() {
          void deleteApp(this);
        }
        get settings() {
          this.checkDestroyed();
          return this._serverConfig;
        }
        /**
         * This function will throw an Error if the App has already been deleted -
         * use before performing API actions on the App.
         */
        checkDestroyed() {
          if (this.isDeleted) {
            throw ERROR_FACTORY.create(
              "server-app-deleted"
              /* AppError.SERVER_APP_DELETED */
            );
          }
        }
      };
      __name(_FirebaseServerAppImpl, "FirebaseServerAppImpl");
      FirebaseServerAppImpl = _FirebaseServerAppImpl;
      SDK_VERSION = version3;
      __name(initializeApp, "initializeApp");
      __name(initializeServerApp, "initializeServerApp");
      __name(getApp, "getApp");
      __name(getApps, "getApps");
      __name(deleteApp, "deleteApp");
      __name(registerVersion, "registerVersion");
      __name(onLog, "onLog");
      __name(setLogLevel2, "setLogLevel");
      DB_NAME = "firebase-heartbeat-database";
      DB_VERSION = 1;
      STORE_NAME = "firebase-heartbeat-store";
      dbPromise = null;
      __name(getDbPromise, "getDbPromise");
      __name(readHeartbeatsFromIndexedDB, "readHeartbeatsFromIndexedDB");
      __name(writeHeartbeatsToIndexedDB, "writeHeartbeatsToIndexedDB");
      __name(computeKey, "computeKey");
      MAX_HEADER_BYTES = 1024;
      MAX_NUM_STORED_HEARTBEATS = 30;
      _HeartbeatServiceImpl = class _HeartbeatServiceImpl {
        constructor(container) {
          this.container = container;
          this._heartbeatsCache = null;
          const app = this.container.getProvider("app").getImmediate();
          this._storage = new HeartbeatStorageImpl(app);
          this._heartbeatsCachePromise = this._storage.read().then((result) => {
            this._heartbeatsCache = result;
            return result;
          });
        }
        /**
         * Called to report a heartbeat. The function will generate
         * a HeartbeatsByUserAgent object, update heartbeatsCache, and persist it
         * to IndexedDB.
         * Note that we only store one heartbeat per day. So if a heartbeat for today is
         * already logged, subsequent calls to this function in the same day will be ignored.
         */
        triggerHeartbeat() {
          return __async(this, null, function* () {
            var _a2, _b2;
            try {
              const platformLogger = this.container.getProvider("platform-logger").getImmediate();
              const agent = platformLogger.getPlatformInfoString();
              const date = getUTCDateString();
              if (((_a2 = this._heartbeatsCache) == null ? void 0 : _a2.heartbeats) == null) {
                this._heartbeatsCache = yield this._heartbeatsCachePromise;
                if (((_b2 = this._heartbeatsCache) == null ? void 0 : _b2.heartbeats) == null) {
                  return;
                }
              }
              if (this._heartbeatsCache.lastSentHeartbeatDate === date || this._heartbeatsCache.heartbeats.some((singleDateHeartbeat) => singleDateHeartbeat.date === date)) {
                return;
              } else {
                this._heartbeatsCache.heartbeats.push({ date, agent });
                if (this._heartbeatsCache.heartbeats.length > MAX_NUM_STORED_HEARTBEATS) {
                  const earliestHeartbeatIdx = getEarliestHeartbeatIdx(this._heartbeatsCache.heartbeats);
                  this._heartbeatsCache.heartbeats.splice(earliestHeartbeatIdx, 1);
                }
              }
              return this._storage.overwrite(this._heartbeatsCache);
            } catch (e) {
              logger.warn(e);
            }
          });
        }
        /**
         * Returns a base64 encoded string which can be attached to the heartbeat-specific header directly.
         * It also clears all heartbeats from memory as well as in IndexedDB.
         *
         * NOTE: Consuming product SDKs should not send the header if this method
         * returns an empty string.
         */
        getHeartbeatsHeader() {
          return __async(this, null, function* () {
            var _a2;
            try {
              if (this._heartbeatsCache === null) {
                yield this._heartbeatsCachePromise;
              }
              if (((_a2 = this._heartbeatsCache) == null ? void 0 : _a2.heartbeats) == null || this._heartbeatsCache.heartbeats.length === 0) {
                return "";
              }
              const date = getUTCDateString();
              const { heartbeatsToSend, unsentEntries } = extractHeartbeatsForHeader(this._heartbeatsCache.heartbeats);
              const headerString = base64urlEncodeWithoutPadding(JSON.stringify({ version: 2, heartbeats: heartbeatsToSend }));
              this._heartbeatsCache.lastSentHeartbeatDate = date;
              if (unsentEntries.length > 0) {
                this._heartbeatsCache.heartbeats = unsentEntries;
                yield this._storage.overwrite(this._heartbeatsCache);
              } else {
                this._heartbeatsCache.heartbeats = [];
                void this._storage.overwrite(this._heartbeatsCache);
              }
              return headerString;
            } catch (e) {
              logger.warn(e);
              return "";
            }
          });
        }
      };
      __name(_HeartbeatServiceImpl, "HeartbeatServiceImpl");
      HeartbeatServiceImpl = _HeartbeatServiceImpl;
      __name(getUTCDateString, "getUTCDateString");
      __name(extractHeartbeatsForHeader, "extractHeartbeatsForHeader");
      _HeartbeatStorageImpl = class _HeartbeatStorageImpl {
        constructor(app) {
          this.app = app;
          this._canUseIndexedDBPromise = this.runIndexedDBEnvironmentCheck();
        }
        runIndexedDBEnvironmentCheck() {
          return __async(this, null, function* () {
            if (!isIndexedDBAvailable()) {
              return false;
            } else {
              return validateIndexedDBOpenable().then(() => true).catch(() => false);
            }
          });
        }
        /**
         * Read all heartbeats.
         */
        read() {
          return __async(this, null, function* () {
            const canUseIndexedDB = yield this._canUseIndexedDBPromise;
            if (!canUseIndexedDB) {
              return { heartbeats: [] };
            } else {
              const idbHeartbeatObject = yield readHeartbeatsFromIndexedDB(this.app);
              if (idbHeartbeatObject == null ? void 0 : idbHeartbeatObject.heartbeats) {
                return idbHeartbeatObject;
              } else {
                return { heartbeats: [] };
              }
            }
          });
        }
        // overwrite the storage with the provided heartbeats
        overwrite(heartbeatsObject) {
          return __async(this, null, function* () {
            var _a2;
            const canUseIndexedDB = yield this._canUseIndexedDBPromise;
            if (!canUseIndexedDB) {
              return;
            } else {
              const existingHeartbeatsObject = yield this.read();
              return writeHeartbeatsToIndexedDB(this.app, {
                lastSentHeartbeatDate: (_a2 = heartbeatsObject.lastSentHeartbeatDate) != null ? _a2 : existingHeartbeatsObject.lastSentHeartbeatDate,
                heartbeats: heartbeatsObject.heartbeats
              });
            }
          });
        }
        // add heartbeats
        add(heartbeatsObject) {
          return __async(this, null, function* () {
            var _a2;
            const canUseIndexedDB = yield this._canUseIndexedDBPromise;
            if (!canUseIndexedDB) {
              return;
            } else {
              const existingHeartbeatsObject = yield this.read();
              return writeHeartbeatsToIndexedDB(this.app, {
                lastSentHeartbeatDate: (_a2 = heartbeatsObject.lastSentHeartbeatDate) != null ? _a2 : existingHeartbeatsObject.lastSentHeartbeatDate,
                heartbeats: [
                  ...existingHeartbeatsObject.heartbeats,
                  ...heartbeatsObject.heartbeats
                ]
              });
            }
          });
        }
      };
      __name(_HeartbeatStorageImpl, "HeartbeatStorageImpl");
      HeartbeatStorageImpl = _HeartbeatStorageImpl;
      __name(countBytes, "countBytes");
      __name(getEarliestHeartbeatIdx, "getEarliestHeartbeatIdx");
      __name(registerCoreComponents, "registerCoreComponents");
      registerCoreComponents("");
    }
  });

  // node_modules/firebase/app/dist/esm/index.esm.js
  var index_esm_exports = {};
  __export(index_esm_exports, {
    FirebaseError: () => FirebaseError,
    SDK_VERSION: () => SDK_VERSION,
    _DEFAULT_ENTRY_NAME: () => DEFAULT_ENTRY_NAME2,
    _addComponent: () => _addComponent,
    _addOrOverwriteComponent: () => _addOrOverwriteComponent,
    _apps: () => _apps,
    _clearComponents: () => _clearComponents,
    _components: () => _components,
    _getProvider: () => _getProvider,
    _isFirebaseApp: () => _isFirebaseApp,
    _isFirebaseServerApp: () => _isFirebaseServerApp,
    _isFirebaseServerAppSettings: () => _isFirebaseServerAppSettings,
    _registerComponent: () => _registerComponent,
    _removeServiceInstance: () => _removeServiceInstance,
    _serverApps: () => _serverApps,
    deleteApp: () => deleteApp,
    getApp: () => getApp,
    getApps: () => getApps,
    initializeApp: () => initializeApp,
    initializeServerApp: () => initializeServerApp,
    onLog: () => onLog,
    registerVersion: () => registerVersion,
    setLogLevel: () => setLogLevel2
  });
  var name2, version4;
  var init_index_esm5 = __esm({
    "node_modules/firebase/app/dist/esm/index.esm.js"() {
      init_index_esm4();
      init_index_esm4();
      name2 = "firebase";
      version4 = "12.0.0";
      registerVersion(name2, version4, "app");
    }
  });

  // node_modules/@firebase/installations/dist/esm/index.esm.js
  function isServerError(error) {
    return error instanceof FirebaseError && error.code.includes(
      "request-failed"
      /* ErrorCode.REQUEST_FAILED */
    );
  }
  function getInstallationsEndpoint({ projectId }) {
    return `${INSTALLATIONS_API_URL}/projects/${projectId}/installations`;
  }
  function extractAuthTokenInfoFromResponse(response) {
    return {
      token: response.token,
      requestStatus: 2,
      expiresIn: getExpiresInFromResponseExpiresIn(response.expiresIn),
      creationTime: Date.now()
    };
  }
  function getErrorFromResponse(requestName, response) {
    return __async(this, null, function* () {
      const responseJson = yield response.json();
      const errorData = responseJson.error;
      return ERROR_FACTORY2.create("request-failed", {
        requestName,
        serverCode: errorData.code,
        serverMessage: errorData.message,
        serverStatus: errorData.status
      });
    });
  }
  function getHeaders({ apiKey }) {
    return new Headers({
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-goog-api-key": apiKey
    });
  }
  function getHeadersWithAuth(appConfig, { refreshToken }) {
    const headers = getHeaders(appConfig);
    headers.append("Authorization", getAuthorizationHeader(refreshToken));
    return headers;
  }
  function retryIfServerError(fn) {
    return __async(this, null, function* () {
      const result = yield fn();
      if (result.status >= 500 && result.status < 600) {
        return fn();
      }
      return result;
    });
  }
  function getExpiresInFromResponseExpiresIn(responseExpiresIn) {
    return Number(responseExpiresIn.replace("s", "000"));
  }
  function getAuthorizationHeader(refreshToken) {
    return `${INTERNAL_AUTH_VERSION} ${refreshToken}`;
  }
  function createInstallationRequest(_0, _1) {
    return __async(this, arguments, function* ({ appConfig, heartbeatServiceProvider }, { fid }) {
      const endpoint = getInstallationsEndpoint(appConfig);
      const headers = getHeaders(appConfig);
      const heartbeatService = heartbeatServiceProvider.getImmediate({
        optional: true
      });
      if (heartbeatService) {
        const heartbeatsHeader = yield heartbeatService.getHeartbeatsHeader();
        if (heartbeatsHeader) {
          headers.append("x-firebase-client", heartbeatsHeader);
        }
      }
      const body = {
        fid,
        authVersion: INTERNAL_AUTH_VERSION,
        appId: appConfig.appId,
        sdkVersion: PACKAGE_VERSION
      };
      const request = {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      };
      const response = yield retryIfServerError(() => fetch(endpoint, request));
      if (response.ok) {
        const responseValue = yield response.json();
        const registeredInstallationEntry = {
          fid: responseValue.fid || fid,
          registrationStatus: 2,
          refreshToken: responseValue.refreshToken,
          authToken: extractAuthTokenInfoFromResponse(responseValue.authToken)
        };
        return registeredInstallationEntry;
      } else {
        throw yield getErrorFromResponse("Create Installation", response);
      }
    });
  }
  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
  function bufferToBase64UrlSafe(array) {
    const b64 = btoa(String.fromCharCode(...array));
    return b64.replace(/\+/g, "-").replace(/\//g, "_");
  }
  function generateFid() {
    try {
      const fidByteArray = new Uint8Array(17);
      const crypto = self.crypto || self.msCrypto;
      crypto.getRandomValues(fidByteArray);
      fidByteArray[0] = 112 + fidByteArray[0] % 16;
      const fid = encode(fidByteArray);
      return VALID_FID_PATTERN.test(fid) ? fid : INVALID_FID;
    } catch (e) {
      return INVALID_FID;
    }
  }
  function encode(fidByteArray) {
    const b64String = bufferToBase64UrlSafe(fidByteArray);
    return b64String.substr(0, 22);
  }
  function getKey(appConfig) {
    return `${appConfig.appName}!${appConfig.appId}`;
  }
  function fidChanged(appConfig, fid) {
    const key = getKey(appConfig);
    callFidChangeCallbacks(key, fid);
    broadcastFidChange(key, fid);
  }
  function callFidChangeCallbacks(key, fid) {
    const callbacks = fidChangeCallbacks.get(key);
    if (!callbacks) {
      return;
    }
    for (const callback of callbacks) {
      callback(fid);
    }
  }
  function broadcastFidChange(key, fid) {
    const channel = getBroadcastChannel();
    if (channel) {
      channel.postMessage({ key, fid });
    }
    closeBroadcastChannel();
  }
  function getBroadcastChannel() {
    if (!broadcastChannel && "BroadcastChannel" in self) {
      broadcastChannel = new BroadcastChannel("[Firebase] FID Change");
      broadcastChannel.onmessage = (e) => {
        callFidChangeCallbacks(e.data.key, e.data.fid);
      };
    }
    return broadcastChannel;
  }
  function closeBroadcastChannel() {
    if (fidChangeCallbacks.size === 0 && broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
  }
  function getDbPromise2() {
    if (!dbPromise2) {
      dbPromise2 = openDB(DATABASE_NAME, DATABASE_VERSION, {
        upgrade: /* @__PURE__ */ __name((db, oldVersion) => {
          switch (oldVersion) {
            case 0:
              db.createObjectStore(OBJECT_STORE_NAME);
          }
        }, "upgrade")
      });
    }
    return dbPromise2;
  }
  function set2(appConfig, value) {
    return __async(this, null, function* () {
      const key = getKey(appConfig);
      const db = yield getDbPromise2();
      const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
      const objectStore = tx.objectStore(OBJECT_STORE_NAME);
      const oldValue = yield objectStore.get(key);
      yield objectStore.put(value, key);
      yield tx.done;
      if (!oldValue || oldValue.fid !== value.fid) {
        fidChanged(appConfig, value.fid);
      }
      return value;
    });
  }
  function remove(appConfig) {
    return __async(this, null, function* () {
      const key = getKey(appConfig);
      const db = yield getDbPromise2();
      const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
      yield tx.objectStore(OBJECT_STORE_NAME).delete(key);
      yield tx.done;
    });
  }
  function update(appConfig, updateFn) {
    return __async(this, null, function* () {
      const key = getKey(appConfig);
      const db = yield getDbPromise2();
      const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");
      const store = tx.objectStore(OBJECT_STORE_NAME);
      const oldValue = yield store.get(key);
      const newValue = updateFn(oldValue);
      if (newValue === void 0) {
        yield store.delete(key);
      } else {
        yield store.put(newValue, key);
      }
      yield tx.done;
      if (newValue && (!oldValue || oldValue.fid !== newValue.fid)) {
        fidChanged(appConfig, newValue.fid);
      }
      return newValue;
    });
  }
  function getInstallationEntry(installations) {
    return __async(this, null, function* () {
      let registrationPromise;
      const installationEntry = yield update(installations.appConfig, (oldEntry) => {
        const installationEntry2 = updateOrCreateInstallationEntry(oldEntry);
        const entryWithPromise = triggerRegistrationIfNecessary(installations, installationEntry2);
        registrationPromise = entryWithPromise.registrationPromise;
        return entryWithPromise.installationEntry;
      });
      if (installationEntry.fid === INVALID_FID) {
        return { installationEntry: yield registrationPromise };
      }
      return {
        installationEntry,
        registrationPromise
      };
    });
  }
  function updateOrCreateInstallationEntry(oldEntry) {
    const entry = oldEntry || {
      fid: generateFid(),
      registrationStatus: 0
      /* RequestStatus.NOT_STARTED */
    };
    return clearTimedOutRequest(entry);
  }
  function triggerRegistrationIfNecessary(installations, installationEntry) {
    if (installationEntry.registrationStatus === 0) {
      if (!navigator.onLine) {
        const registrationPromiseWithError = Promise.reject(ERROR_FACTORY2.create(
          "app-offline"
          /* ErrorCode.APP_OFFLINE */
        ));
        return {
          installationEntry,
          registrationPromise: registrationPromiseWithError
        };
      }
      const inProgressEntry = {
        fid: installationEntry.fid,
        registrationStatus: 1,
        registrationTime: Date.now()
      };
      const registrationPromise = registerInstallation(installations, inProgressEntry);
      return { installationEntry: inProgressEntry, registrationPromise };
    } else if (installationEntry.registrationStatus === 1) {
      return {
        installationEntry,
        registrationPromise: waitUntilFidRegistration(installations)
      };
    } else {
      return { installationEntry };
    }
  }
  function registerInstallation(installations, installationEntry) {
    return __async(this, null, function* () {
      try {
        const registeredInstallationEntry = yield createInstallationRequest(installations, installationEntry);
        return set2(installations.appConfig, registeredInstallationEntry);
      } catch (e) {
        if (isServerError(e) && e.customData.serverCode === 409) {
          yield remove(installations.appConfig);
        } else {
          yield set2(installations.appConfig, {
            fid: installationEntry.fid,
            registrationStatus: 0
            /* RequestStatus.NOT_STARTED */
          });
        }
        throw e;
      }
    });
  }
  function waitUntilFidRegistration(installations) {
    return __async(this, null, function* () {
      let entry = yield updateInstallationRequest(installations.appConfig);
      while (entry.registrationStatus === 1) {
        yield sleep(100);
        entry = yield updateInstallationRequest(installations.appConfig);
      }
      if (entry.registrationStatus === 0) {
        const { installationEntry, registrationPromise } = yield getInstallationEntry(installations);
        if (registrationPromise) {
          return registrationPromise;
        } else {
          return installationEntry;
        }
      }
      return entry;
    });
  }
  function updateInstallationRequest(appConfig) {
    return update(appConfig, (oldEntry) => {
      if (!oldEntry) {
        throw ERROR_FACTORY2.create(
          "installation-not-found"
          /* ErrorCode.INSTALLATION_NOT_FOUND */
        );
      }
      return clearTimedOutRequest(oldEntry);
    });
  }
  function clearTimedOutRequest(entry) {
    if (hasInstallationRequestTimedOut(entry)) {
      return {
        fid: entry.fid,
        registrationStatus: 0
        /* RequestStatus.NOT_STARTED */
      };
    }
    return entry;
  }
  function hasInstallationRequestTimedOut(installationEntry) {
    return installationEntry.registrationStatus === 1 && installationEntry.registrationTime + PENDING_TIMEOUT_MS < Date.now();
  }
  function generateAuthTokenRequest(_0, _1) {
    return __async(this, arguments, function* ({ appConfig, heartbeatServiceProvider }, installationEntry) {
      const endpoint = getGenerateAuthTokenEndpoint(appConfig, installationEntry);
      const headers = getHeadersWithAuth(appConfig, installationEntry);
      const heartbeatService = heartbeatServiceProvider.getImmediate({
        optional: true
      });
      if (heartbeatService) {
        const heartbeatsHeader = yield heartbeatService.getHeartbeatsHeader();
        if (heartbeatsHeader) {
          headers.append("x-firebase-client", heartbeatsHeader);
        }
      }
      const body = {
        installation: {
          sdkVersion: PACKAGE_VERSION,
          appId: appConfig.appId
        }
      };
      const request = {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      };
      const response = yield retryIfServerError(() => fetch(endpoint, request));
      if (response.ok) {
        const responseValue = yield response.json();
        const completedAuthToken = extractAuthTokenInfoFromResponse(responseValue);
        return completedAuthToken;
      } else {
        throw yield getErrorFromResponse("Generate Auth Token", response);
      }
    });
  }
  function getGenerateAuthTokenEndpoint(appConfig, { fid }) {
    return `${getInstallationsEndpoint(appConfig)}/${fid}/authTokens:generate`;
  }
  function refreshAuthToken(installations, forceRefresh = false) {
    return __async(this, null, function* () {
      let tokenPromise;
      const entry = yield update(installations.appConfig, (oldEntry) => {
        if (!isEntryRegistered(oldEntry)) {
          throw ERROR_FACTORY2.create(
            "not-registered"
            /* ErrorCode.NOT_REGISTERED */
          );
        }
        const oldAuthToken = oldEntry.authToken;
        if (!forceRefresh && isAuthTokenValid(oldAuthToken)) {
          return oldEntry;
        } else if (oldAuthToken.requestStatus === 1) {
          tokenPromise = waitUntilAuthTokenRequest(installations, forceRefresh);
          return oldEntry;
        } else {
          if (!navigator.onLine) {
            throw ERROR_FACTORY2.create(
              "app-offline"
              /* ErrorCode.APP_OFFLINE */
            );
          }
          const inProgressEntry = makeAuthTokenRequestInProgressEntry(oldEntry);
          tokenPromise = fetchAuthTokenFromServer(installations, inProgressEntry);
          return inProgressEntry;
        }
      });
      const authToken = tokenPromise ? yield tokenPromise : entry.authToken;
      return authToken;
    });
  }
  function waitUntilAuthTokenRequest(installations, forceRefresh) {
    return __async(this, null, function* () {
      let entry = yield updateAuthTokenRequest(installations.appConfig);
      while (entry.authToken.requestStatus === 1) {
        yield sleep(100);
        entry = yield updateAuthTokenRequest(installations.appConfig);
      }
      const authToken = entry.authToken;
      if (authToken.requestStatus === 0) {
        return refreshAuthToken(installations, forceRefresh);
      } else {
        return authToken;
      }
    });
  }
  function updateAuthTokenRequest(appConfig) {
    return update(appConfig, (oldEntry) => {
      if (!isEntryRegistered(oldEntry)) {
        throw ERROR_FACTORY2.create(
          "not-registered"
          /* ErrorCode.NOT_REGISTERED */
        );
      }
      const oldAuthToken = oldEntry.authToken;
      if (hasAuthTokenRequestTimedOut(oldAuthToken)) {
        return __spreadProps(__spreadValues({}, oldEntry), {
          authToken: {
            requestStatus: 0
            /* RequestStatus.NOT_STARTED */
          }
        });
      }
      return oldEntry;
    });
  }
  function fetchAuthTokenFromServer(installations, installationEntry) {
    return __async(this, null, function* () {
      try {
        const authToken = yield generateAuthTokenRequest(installations, installationEntry);
        const updatedInstallationEntry = __spreadProps(__spreadValues({}, installationEntry), {
          authToken
        });
        yield set2(installations.appConfig, updatedInstallationEntry);
        return authToken;
      } catch (e) {
        if (isServerError(e) && (e.customData.serverCode === 401 || e.customData.serverCode === 404)) {
          yield remove(installations.appConfig);
        } else {
          const updatedInstallationEntry = __spreadProps(__spreadValues({}, installationEntry), {
            authToken: {
              requestStatus: 0
              /* RequestStatus.NOT_STARTED */
            }
          });
          yield set2(installations.appConfig, updatedInstallationEntry);
        }
        throw e;
      }
    });
  }
  function isEntryRegistered(installationEntry) {
    return installationEntry !== void 0 && installationEntry.registrationStatus === 2;
  }
  function isAuthTokenValid(authToken) {
    return authToken.requestStatus === 2 && !isAuthTokenExpired(authToken);
  }
  function isAuthTokenExpired(authToken) {
    const now = Date.now();
    return now < authToken.creationTime || authToken.creationTime + authToken.expiresIn < now + TOKEN_EXPIRATION_BUFFER;
  }
  function makeAuthTokenRequestInProgressEntry(oldEntry) {
    const inProgressAuthToken = {
      requestStatus: 1,
      requestTime: Date.now()
    };
    return __spreadProps(__spreadValues({}, oldEntry), {
      authToken: inProgressAuthToken
    });
  }
  function hasAuthTokenRequestTimedOut(authToken) {
    return authToken.requestStatus === 1 && authToken.requestTime + PENDING_TIMEOUT_MS < Date.now();
  }
  function getId(installations) {
    return __async(this, null, function* () {
      const installationsImpl = installations;
      const { installationEntry, registrationPromise } = yield getInstallationEntry(installationsImpl);
      if (registrationPromise) {
        registrationPromise.catch(console.error);
      } else {
        refreshAuthToken(installationsImpl).catch(console.error);
      }
      return installationEntry.fid;
    });
  }
  function getToken(installations, forceRefresh = false) {
    return __async(this, null, function* () {
      const installationsImpl = installations;
      yield completeInstallationRegistration(installationsImpl);
      const authToken = yield refreshAuthToken(installationsImpl, forceRefresh);
      return authToken.token;
    });
  }
  function completeInstallationRegistration(installations) {
    return __async(this, null, function* () {
      const { registrationPromise } = yield getInstallationEntry(installations);
      if (registrationPromise) {
        yield registrationPromise;
      }
    });
  }
  function extractAppConfig(app) {
    if (!app || !app.options) {
      throw getMissingValueError("App Configuration");
    }
    if (!app.name) {
      throw getMissingValueError("App Name");
    }
    const configKeys = [
      "projectId",
      "apiKey",
      "appId"
    ];
    for (const keyName of configKeys) {
      if (!app.options[keyName]) {
        throw getMissingValueError(keyName);
      }
    }
    return {
      appName: app.name,
      projectId: app.options.projectId,
      apiKey: app.options.apiKey,
      appId: app.options.appId
    };
  }
  function getMissingValueError(valueName) {
    return ERROR_FACTORY2.create("missing-app-config-values", {
      valueName
    });
  }
  function registerInstallations() {
    _registerComponent(new Component2(
      INSTALLATIONS_NAME,
      publicFactory,
      "PUBLIC"
      /* ComponentType.PUBLIC */
    ));
    _registerComponent(new Component2(
      INSTALLATIONS_NAME_INTERNAL,
      internalFactory,
      "PRIVATE"
      /* ComponentType.PRIVATE */
    ));
  }
  var name3, version5, PENDING_TIMEOUT_MS, PACKAGE_VERSION, INTERNAL_AUTH_VERSION, INSTALLATIONS_API_URL, TOKEN_EXPIRATION_BUFFER, SERVICE, SERVICE_NAME, ERROR_DESCRIPTION_MAP, ERROR_FACTORY2, VALID_FID_PATTERN, INVALID_FID, fidChangeCallbacks, broadcastChannel, DATABASE_NAME, DATABASE_VERSION, OBJECT_STORE_NAME, dbPromise2, INSTALLATIONS_NAME, INSTALLATIONS_NAME_INTERNAL, publicFactory, internalFactory;
  var init_index_esm6 = __esm({
    "node_modules/@firebase/installations/dist/esm/index.esm.js"() {
      init_index_esm4();
      init_index_esm2();
      init_index_esm();
      init_build();
      name3 = "@firebase/installations";
      version5 = "0.6.19";
      PENDING_TIMEOUT_MS = 1e4;
      PACKAGE_VERSION = `w:${version5}`;
      INTERNAL_AUTH_VERSION = "FIS_v2";
      INSTALLATIONS_API_URL = "https://firebaseinstallations.googleapis.com/v1";
      TOKEN_EXPIRATION_BUFFER = 60 * 60 * 1e3;
      SERVICE = "installations";
      SERVICE_NAME = "Installations";
      ERROR_DESCRIPTION_MAP = {
        [
          "missing-app-config-values"
          /* ErrorCode.MISSING_APP_CONFIG_VALUES */
        ]: 'Missing App configuration value: "{$valueName}"',
        [
          "not-registered"
          /* ErrorCode.NOT_REGISTERED */
        ]: "Firebase Installation is not registered.",
        [
          "installation-not-found"
          /* ErrorCode.INSTALLATION_NOT_FOUND */
        ]: "Firebase Installation not found.",
        [
          "request-failed"
          /* ErrorCode.REQUEST_FAILED */
        ]: '{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',
        [
          "app-offline"
          /* ErrorCode.APP_OFFLINE */
        ]: "Could not process request. Application offline.",
        [
          "delete-pending-registration"
          /* ErrorCode.DELETE_PENDING_REGISTRATION */
        ]: "Can't delete installation while there is a pending registration request."
      };
      ERROR_FACTORY2 = new ErrorFactory(SERVICE, SERVICE_NAME, ERROR_DESCRIPTION_MAP);
      __name(isServerError, "isServerError");
      __name(getInstallationsEndpoint, "getInstallationsEndpoint");
      __name(extractAuthTokenInfoFromResponse, "extractAuthTokenInfoFromResponse");
      __name(getErrorFromResponse, "getErrorFromResponse");
      __name(getHeaders, "getHeaders");
      __name(getHeadersWithAuth, "getHeadersWithAuth");
      __name(retryIfServerError, "retryIfServerError");
      __name(getExpiresInFromResponseExpiresIn, "getExpiresInFromResponseExpiresIn");
      __name(getAuthorizationHeader, "getAuthorizationHeader");
      __name(createInstallationRequest, "createInstallationRequest");
      __name(sleep, "sleep");
      __name(bufferToBase64UrlSafe, "bufferToBase64UrlSafe");
      VALID_FID_PATTERN = /^[cdef][\w-]{21}$/;
      INVALID_FID = "";
      __name(generateFid, "generateFid");
      __name(encode, "encode");
      __name(getKey, "getKey");
      fidChangeCallbacks = /* @__PURE__ */ new Map();
      __name(fidChanged, "fidChanged");
      __name(callFidChangeCallbacks, "callFidChangeCallbacks");
      __name(broadcastFidChange, "broadcastFidChange");
      broadcastChannel = null;
      __name(getBroadcastChannel, "getBroadcastChannel");
      __name(closeBroadcastChannel, "closeBroadcastChannel");
      DATABASE_NAME = "firebase-installations-database";
      DATABASE_VERSION = 1;
      OBJECT_STORE_NAME = "firebase-installations-store";
      dbPromise2 = null;
      __name(getDbPromise2, "getDbPromise");
      __name(set2, "set");
      __name(remove, "remove");
      __name(update, "update");
      __name(getInstallationEntry, "getInstallationEntry");
      __name(updateOrCreateInstallationEntry, "updateOrCreateInstallationEntry");
      __name(triggerRegistrationIfNecessary, "triggerRegistrationIfNecessary");
      __name(registerInstallation, "registerInstallation");
      __name(waitUntilFidRegistration, "waitUntilFidRegistration");
      __name(updateInstallationRequest, "updateInstallationRequest");
      __name(clearTimedOutRequest, "clearTimedOutRequest");
      __name(hasInstallationRequestTimedOut, "hasInstallationRequestTimedOut");
      __name(generateAuthTokenRequest, "generateAuthTokenRequest");
      __name(getGenerateAuthTokenEndpoint, "getGenerateAuthTokenEndpoint");
      __name(refreshAuthToken, "refreshAuthToken");
      __name(waitUntilAuthTokenRequest, "waitUntilAuthTokenRequest");
      __name(updateAuthTokenRequest, "updateAuthTokenRequest");
      __name(fetchAuthTokenFromServer, "fetchAuthTokenFromServer");
      __name(isEntryRegistered, "isEntryRegistered");
      __name(isAuthTokenValid, "isAuthTokenValid");
      __name(isAuthTokenExpired, "isAuthTokenExpired");
      __name(makeAuthTokenRequestInProgressEntry, "makeAuthTokenRequestInProgressEntry");
      __name(hasAuthTokenRequestTimedOut, "hasAuthTokenRequestTimedOut");
      __name(getId, "getId");
      __name(getToken, "getToken");
      __name(completeInstallationRegistration, "completeInstallationRegistration");
      __name(extractAppConfig, "extractAppConfig");
      __name(getMissingValueError, "getMissingValueError");
      INSTALLATIONS_NAME = "installations";
      INSTALLATIONS_NAME_INTERNAL = "installations-internal";
      publicFactory = /* @__PURE__ */ __name((container) => {
        const app = container.getProvider("app").getImmediate();
        const appConfig = extractAppConfig(app);
        const heartbeatServiceProvider = _getProvider(app, "heartbeat");
        const installationsImpl = {
          app,
          appConfig,
          heartbeatServiceProvider,
          _delete: /* @__PURE__ */ __name(() => Promise.resolve(), "_delete")
        };
        return installationsImpl;
      }, "publicFactory");
      internalFactory = /* @__PURE__ */ __name((container) => {
        const app = container.getProvider("app").getImmediate();
        const installations = _getProvider(app, INSTALLATIONS_NAME).getImmediate();
        const installationsInternal = {
          getId: /* @__PURE__ */ __name(() => getId(installations), "getId"),
          getToken: /* @__PURE__ */ __name((forceRefresh) => getToken(installations, forceRefresh), "getToken")
        };
        return installationsInternal;
      }, "internalFactory");
      __name(registerInstallations, "registerInstallations");
      registerInstallations();
      registerVersion(name3, version5);
      registerVersion(name3, version5, "esm2020");
    }
  });

  // node_modules/@firebase/messaging/dist/esm/index.esm.js
  function arrayToBase64(array) {
    const uint8Array = new Uint8Array(array);
    const base64String = btoa(String.fromCharCode(...uint8Array));
    return base64String.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  function base64ToArray(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base642 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = atob(base642);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  function migrateOldDatabase(senderId) {
    return __async(this, null, function* () {
      if ("databases" in indexedDB) {
        const databases = yield indexedDB.databases();
        const dbNames = databases.map((db2) => db2.name);
        if (!dbNames.includes(OLD_DB_NAME)) {
          return null;
        }
      }
      let tokenDetails = null;
      const db = yield openDB(OLD_DB_NAME, OLD_DB_VERSION, {
        upgrade: /* @__PURE__ */ __name((db2, oldVersion, newVersion, upgradeTransaction) => __async(null, null, function* () {
          var _a2;
          if (oldVersion < 2) {
            return;
          }
          if (!db2.objectStoreNames.contains(OLD_OBJECT_STORE_NAME)) {
            return;
          }
          const objectStore = upgradeTransaction.objectStore(OLD_OBJECT_STORE_NAME);
          const value = yield objectStore.index("fcmSenderId").get(senderId);
          yield objectStore.clear();
          if (!value) {
            return;
          }
          if (oldVersion === 2) {
            const oldDetails = value;
            if (!oldDetails.auth || !oldDetails.p256dh || !oldDetails.endpoint) {
              return;
            }
            tokenDetails = {
              token: oldDetails.fcmToken,
              createTime: (_a2 = oldDetails.createTime) != null ? _a2 : Date.now(),
              subscriptionOptions: {
                auth: oldDetails.auth,
                p256dh: oldDetails.p256dh,
                endpoint: oldDetails.endpoint,
                swScope: oldDetails.swScope,
                vapidKey: typeof oldDetails.vapidKey === "string" ? oldDetails.vapidKey : arrayToBase64(oldDetails.vapidKey)
              }
            };
          } else if (oldVersion === 3) {
            const oldDetails = value;
            tokenDetails = {
              token: oldDetails.fcmToken,
              createTime: oldDetails.createTime,
              subscriptionOptions: {
                auth: arrayToBase64(oldDetails.auth),
                p256dh: arrayToBase64(oldDetails.p256dh),
                endpoint: oldDetails.endpoint,
                swScope: oldDetails.swScope,
                vapidKey: arrayToBase64(oldDetails.vapidKey)
              }
            };
          } else if (oldVersion === 4) {
            const oldDetails = value;
            tokenDetails = {
              token: oldDetails.fcmToken,
              createTime: oldDetails.createTime,
              subscriptionOptions: {
                auth: arrayToBase64(oldDetails.auth),
                p256dh: arrayToBase64(oldDetails.p256dh),
                endpoint: oldDetails.endpoint,
                swScope: oldDetails.swScope,
                vapidKey: arrayToBase64(oldDetails.vapidKey)
              }
            };
          }
        }), "upgrade")
      });
      db.close();
      yield deleteDB(OLD_DB_NAME);
      yield deleteDB("fcm_vapid_details_db");
      yield deleteDB("undefined");
      return checkTokenDetails(tokenDetails) ? tokenDetails : null;
    });
  }
  function checkTokenDetails(tokenDetails) {
    if (!tokenDetails || !tokenDetails.subscriptionOptions) {
      return false;
    }
    const { subscriptionOptions } = tokenDetails;
    return typeof tokenDetails.createTime === "number" && tokenDetails.createTime > 0 && typeof tokenDetails.token === "string" && tokenDetails.token.length > 0 && typeof subscriptionOptions.auth === "string" && subscriptionOptions.auth.length > 0 && typeof subscriptionOptions.p256dh === "string" && subscriptionOptions.p256dh.length > 0 && typeof subscriptionOptions.endpoint === "string" && subscriptionOptions.endpoint.length > 0 && typeof subscriptionOptions.swScope === "string" && subscriptionOptions.swScope.length > 0 && typeof subscriptionOptions.vapidKey === "string" && subscriptionOptions.vapidKey.length > 0;
  }
  function getDbPromise3() {
    if (!dbPromise3) {
      dbPromise3 = openDB(DATABASE_NAME2, DATABASE_VERSION2, {
        upgrade: /* @__PURE__ */ __name((upgradeDb, oldVersion) => {
          switch (oldVersion) {
            case 0:
              upgradeDb.createObjectStore(OBJECT_STORE_NAME2);
          }
        }, "upgrade")
      });
    }
    return dbPromise3;
  }
  function dbGet(firebaseDependencies) {
    return __async(this, null, function* () {
      const key = getKey2(firebaseDependencies);
      const db = yield getDbPromise3();
      const tokenDetails = yield db.transaction(OBJECT_STORE_NAME2).objectStore(OBJECT_STORE_NAME2).get(key);
      if (tokenDetails) {
        return tokenDetails;
      } else {
        const oldTokenDetails = yield migrateOldDatabase(firebaseDependencies.appConfig.senderId);
        if (oldTokenDetails) {
          yield dbSet(firebaseDependencies, oldTokenDetails);
          return oldTokenDetails;
        }
      }
    });
  }
  function dbSet(firebaseDependencies, tokenDetails) {
    return __async(this, null, function* () {
      const key = getKey2(firebaseDependencies);
      const db = yield getDbPromise3();
      const tx = db.transaction(OBJECT_STORE_NAME2, "readwrite");
      yield tx.objectStore(OBJECT_STORE_NAME2).put(tokenDetails, key);
      yield tx.done;
      return tokenDetails;
    });
  }
  function dbRemove(firebaseDependencies) {
    return __async(this, null, function* () {
      const key = getKey2(firebaseDependencies);
      const db = yield getDbPromise3();
      const tx = db.transaction(OBJECT_STORE_NAME2, "readwrite");
      yield tx.objectStore(OBJECT_STORE_NAME2).delete(key);
      yield tx.done;
    });
  }
  function getKey2({ appConfig }) {
    return appConfig.appId;
  }
  function requestGetToken(firebaseDependencies, subscriptionOptions) {
    return __async(this, null, function* () {
      const headers = yield getHeaders2(firebaseDependencies);
      const body = getBody(subscriptionOptions);
      const subscribeOptions = {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      };
      let responseData;
      try {
        const response = yield fetch(getEndpoint(firebaseDependencies.appConfig), subscribeOptions);
        responseData = yield response.json();
      } catch (err2) {
        throw ERROR_FACTORY3.create("token-subscribe-failed", {
          errorInfo: err2 == null ? void 0 : err2.toString()
        });
      }
      if (responseData.error) {
        const message = responseData.error.message;
        throw ERROR_FACTORY3.create("token-subscribe-failed", {
          errorInfo: message
        });
      }
      if (!responseData.token) {
        throw ERROR_FACTORY3.create(
          "token-subscribe-no-token"
          /* ErrorCode.TOKEN_SUBSCRIBE_NO_TOKEN */
        );
      }
      return responseData.token;
    });
  }
  function requestUpdateToken(firebaseDependencies, tokenDetails) {
    return __async(this, null, function* () {
      const headers = yield getHeaders2(firebaseDependencies);
      const body = getBody(tokenDetails.subscriptionOptions);
      const updateOptions = {
        method: "PATCH",
        headers,
        body: JSON.stringify(body)
      };
      let responseData;
      try {
        const response = yield fetch(`${getEndpoint(firebaseDependencies.appConfig)}/${tokenDetails.token}`, updateOptions);
        responseData = yield response.json();
      } catch (err2) {
        throw ERROR_FACTORY3.create("token-update-failed", {
          errorInfo: err2 == null ? void 0 : err2.toString()
        });
      }
      if (responseData.error) {
        const message = responseData.error.message;
        throw ERROR_FACTORY3.create("token-update-failed", {
          errorInfo: message
        });
      }
      if (!responseData.token) {
        throw ERROR_FACTORY3.create(
          "token-update-no-token"
          /* ErrorCode.TOKEN_UPDATE_NO_TOKEN */
        );
      }
      return responseData.token;
    });
  }
  function requestDeleteToken(firebaseDependencies, token) {
    return __async(this, null, function* () {
      const headers = yield getHeaders2(firebaseDependencies);
      const unsubscribeOptions = {
        method: "DELETE",
        headers
      };
      try {
        const response = yield fetch(`${getEndpoint(firebaseDependencies.appConfig)}/${token}`, unsubscribeOptions);
        const responseData = yield response.json();
        if (responseData.error) {
          const message = responseData.error.message;
          throw ERROR_FACTORY3.create("token-unsubscribe-failed", {
            errorInfo: message
          });
        }
      } catch (err2) {
        throw ERROR_FACTORY3.create("token-unsubscribe-failed", {
          errorInfo: err2 == null ? void 0 : err2.toString()
        });
      }
    });
  }
  function getEndpoint({ projectId }) {
    return `${ENDPOINT}/projects/${projectId}/registrations`;
  }
  function getHeaders2(_0) {
    return __async(this, arguments, function* ({ appConfig, installations }) {
      const authToken = yield installations.getToken();
      return new Headers({
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-goog-api-key": appConfig.apiKey,
        "x-goog-firebase-installations-auth": `FIS ${authToken}`
      });
    });
  }
  function getBody({ p256dh, auth, endpoint, vapidKey }) {
    const body = {
      web: {
        endpoint,
        auth,
        p256dh
      }
    };
    if (vapidKey !== DEFAULT_VAPID_KEY) {
      body.web.applicationPubKey = vapidKey;
    }
    return body;
  }
  function getTokenInternal(messaging) {
    return __async(this, null, function* () {
      const pushSubscription = yield getPushSubscription(messaging.swRegistration, messaging.vapidKey);
      const subscriptionOptions = {
        vapidKey: messaging.vapidKey,
        swScope: messaging.swRegistration.scope,
        endpoint: pushSubscription.endpoint,
        auth: arrayToBase64(pushSubscription.getKey("auth")),
        p256dh: arrayToBase64(pushSubscription.getKey("p256dh"))
      };
      const tokenDetails = yield dbGet(messaging.firebaseDependencies);
      if (!tokenDetails) {
        return getNewToken(messaging.firebaseDependencies, subscriptionOptions);
      } else if (!isTokenValid(tokenDetails.subscriptionOptions, subscriptionOptions)) {
        try {
          yield requestDeleteToken(messaging.firebaseDependencies, tokenDetails.token);
        } catch (e) {
          console.warn(e);
        }
        return getNewToken(messaging.firebaseDependencies, subscriptionOptions);
      } else if (Date.now() >= tokenDetails.createTime + TOKEN_EXPIRATION_MS) {
        return updateToken(messaging, {
          token: tokenDetails.token,
          createTime: Date.now(),
          subscriptionOptions
        });
      } else {
        return tokenDetails.token;
      }
    });
  }
  function deleteTokenInternal(messaging) {
    return __async(this, null, function* () {
      const tokenDetails = yield dbGet(messaging.firebaseDependencies);
      if (tokenDetails) {
        yield requestDeleteToken(messaging.firebaseDependencies, tokenDetails.token);
        yield dbRemove(messaging.firebaseDependencies);
      }
      const pushSubscription = yield messaging.swRegistration.pushManager.getSubscription();
      if (pushSubscription) {
        return pushSubscription.unsubscribe();
      }
      return true;
    });
  }
  function updateToken(messaging, tokenDetails) {
    return __async(this, null, function* () {
      try {
        const updatedToken = yield requestUpdateToken(messaging.firebaseDependencies, tokenDetails);
        const updatedTokenDetails = __spreadProps(__spreadValues({}, tokenDetails), {
          token: updatedToken,
          createTime: Date.now()
        });
        yield dbSet(messaging.firebaseDependencies, updatedTokenDetails);
        return updatedToken;
      } catch (e) {
        throw e;
      }
    });
  }
  function getNewToken(firebaseDependencies, subscriptionOptions) {
    return __async(this, null, function* () {
      const token = yield requestGetToken(firebaseDependencies, subscriptionOptions);
      const tokenDetails = {
        token,
        createTime: Date.now(),
        subscriptionOptions
      };
      yield dbSet(firebaseDependencies, tokenDetails);
      return tokenDetails.token;
    });
  }
  function getPushSubscription(swRegistration, vapidKey) {
    return __async(this, null, function* () {
      const subscription = yield swRegistration.pushManager.getSubscription();
      if (subscription) {
        return subscription;
      }
      return swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        // Chrome <= 75 doesn't support base64-encoded VAPID key. For backward compatibility, VAPID key
        // submitted to pushManager#subscribe must be of type Uint8Array.
        applicationServerKey: base64ToArray(vapidKey)
      });
    });
  }
  function isTokenValid(dbOptions, currentOptions) {
    const isVapidKeyEqual = currentOptions.vapidKey === dbOptions.vapidKey;
    const isEndpointEqual = currentOptions.endpoint === dbOptions.endpoint;
    const isAuthEqual = currentOptions.auth === dbOptions.auth;
    const isP256dhEqual = currentOptions.p256dh === dbOptions.p256dh;
    return isVapidKeyEqual && isEndpointEqual && isAuthEqual && isP256dhEqual;
  }
  function externalizePayload(internalPayload) {
    const payload = {
      from: internalPayload.from,
      // eslint-disable-next-line camelcase
      collapseKey: internalPayload.collapse_key,
      // eslint-disable-next-line camelcase
      messageId: internalPayload.fcmMessageId
    };
    propagateNotificationPayload(payload, internalPayload);
    propagateDataPayload(payload, internalPayload);
    propagateFcmOptions(payload, internalPayload);
    return payload;
  }
  function propagateNotificationPayload(payload, messagePayloadInternal) {
    if (!messagePayloadInternal.notification) {
      return;
    }
    payload.notification = {};
    const title = messagePayloadInternal.notification.title;
    if (!!title) {
      payload.notification.title = title;
    }
    const body = messagePayloadInternal.notification.body;
    if (!!body) {
      payload.notification.body = body;
    }
    const image = messagePayloadInternal.notification.image;
    if (!!image) {
      payload.notification.image = image;
    }
    const icon = messagePayloadInternal.notification.icon;
    if (!!icon) {
      payload.notification.icon = icon;
    }
  }
  function propagateDataPayload(payload, messagePayloadInternal) {
    if (!messagePayloadInternal.data) {
      return;
    }
    payload.data = messagePayloadInternal.data;
  }
  function propagateFcmOptions(payload, messagePayloadInternal) {
    var _a2, _b2, _c2, _d2, _e;
    if (!messagePayloadInternal.fcmOptions && !((_a2 = messagePayloadInternal.notification) == null ? void 0 : _a2.click_action)) {
      return;
    }
    payload.fcmOptions = {};
    const link = (_d2 = (_b2 = messagePayloadInternal.fcmOptions) == null ? void 0 : _b2.link) != null ? _d2 : (_c2 = messagePayloadInternal.notification) == null ? void 0 : _c2.click_action;
    if (!!link) {
      payload.fcmOptions.link = link;
    }
    const analyticsLabel = (_e = messagePayloadInternal.fcmOptions) == null ? void 0 : _e.analytics_label;
    if (!!analyticsLabel) {
      payload.fcmOptions.analyticsLabel = analyticsLabel;
    }
  }
  function isConsoleMessage(data) {
    return typeof data === "object" && !!data && CONSOLE_CAMPAIGN_ID in data;
  }
  function _mergeStrings(s1, s2) {
    const resultArray = [];
    for (let i = 0; i < s1.length; i++) {
      resultArray.push(s1.charAt(i));
      if (i < s2.length) {
        resultArray.push(s2.charAt(i));
      }
    }
    return resultArray.join("");
  }
  function extractAppConfig2(app) {
    if (!app || !app.options) {
      throw getMissingValueError2("App Configuration Object");
    }
    if (!app.name) {
      throw getMissingValueError2("App Name");
    }
    const configKeys = [
      "projectId",
      "apiKey",
      "appId",
      "messagingSenderId"
    ];
    const { options } = app;
    for (const keyName of configKeys) {
      if (!options[keyName]) {
        throw getMissingValueError2(keyName);
      }
    }
    return {
      appName: app.name,
      projectId: options.projectId,
      apiKey: options.apiKey,
      appId: options.appId,
      senderId: options.messagingSenderId
    };
  }
  function getMissingValueError2(valueName) {
    return ERROR_FACTORY3.create("missing-app-config-values", {
      valueName
    });
  }
  function registerDefaultSw(messaging) {
    return __async(this, null, function* () {
      try {
        messaging.swRegistration = yield navigator.serviceWorker.register(DEFAULT_SW_PATH, {
          scope: DEFAULT_SW_SCOPE
        });
        messaging.swRegistration.update().catch(() => {
        });
        yield waitForRegistrationActive(messaging.swRegistration);
      } catch (e) {
        throw ERROR_FACTORY3.create("failed-service-worker-registration", {
          browserErrorMessage: e == null ? void 0 : e.message
        });
      }
    });
  }
  function waitForRegistrationActive(registration) {
    return __async(this, null, function* () {
      return new Promise((resolve, reject) => {
        const rejectTimeout = setTimeout(() => reject(new Error(`Service worker not registered after ${DEFAULT_REGISTRATION_TIMEOUT} ms`)), DEFAULT_REGISTRATION_TIMEOUT);
        const incomingSw = registration.installing || registration.waiting;
        if (registration.active) {
          clearTimeout(rejectTimeout);
          resolve();
        } else if (incomingSw) {
          incomingSw.onstatechange = (ev) => {
            var _a2;
            if (((_a2 = ev.target) == null ? void 0 : _a2.state) === "activated") {
              incomingSw.onstatechange = null;
              clearTimeout(rejectTimeout);
              resolve();
            }
          };
        } else {
          clearTimeout(rejectTimeout);
          reject(new Error("No incoming service worker found."));
        }
      });
    });
  }
  function updateSwReg(messaging, swRegistration) {
    return __async(this, null, function* () {
      if (!swRegistration && !messaging.swRegistration) {
        yield registerDefaultSw(messaging);
      }
      if (!swRegistration && !!messaging.swRegistration) {
        return;
      }
      if (!(swRegistration instanceof ServiceWorkerRegistration)) {
        throw ERROR_FACTORY3.create(
          "invalid-sw-registration"
          /* ErrorCode.INVALID_SW_REGISTRATION */
        );
      }
      messaging.swRegistration = swRegistration;
    });
  }
  function updateVapidKey(messaging, vapidKey) {
    return __async(this, null, function* () {
      if (!!vapidKey) {
        messaging.vapidKey = vapidKey;
      } else if (!messaging.vapidKey) {
        messaging.vapidKey = DEFAULT_VAPID_KEY;
      }
    });
  }
  function getToken$1(messaging, options) {
    return __async(this, null, function* () {
      if (!navigator) {
        throw ERROR_FACTORY3.create(
          "only-available-in-window"
          /* ErrorCode.AVAILABLE_IN_WINDOW */
        );
      }
      if (Notification.permission === "default") {
        yield Notification.requestPermission();
      }
      if (Notification.permission !== "granted") {
        throw ERROR_FACTORY3.create(
          "permission-blocked"
          /* ErrorCode.PERMISSION_BLOCKED */
        );
      }
      yield updateVapidKey(messaging, options == null ? void 0 : options.vapidKey);
      yield updateSwReg(messaging, options == null ? void 0 : options.serviceWorkerRegistration);
      return getTokenInternal(messaging);
    });
  }
  function logToScion(messaging, messageType, data) {
    return __async(this, null, function* () {
      const eventType = getEventType(messageType);
      const analytics = yield messaging.firebaseDependencies.analyticsProvider.get();
      analytics.logEvent(eventType, {
        /* eslint-disable camelcase */
        message_id: data[CONSOLE_CAMPAIGN_ID],
        message_name: data[CONSOLE_CAMPAIGN_NAME],
        message_time: data[CONSOLE_CAMPAIGN_TIME],
        message_device_time: Math.floor(Date.now() / 1e3)
        /* eslint-enable camelcase */
      });
    });
  }
  function getEventType(messageType) {
    switch (messageType) {
      case MessageType.NOTIFICATION_CLICKED:
        return "notification_open";
      case MessageType.PUSH_RECEIVED:
        return "notification_foreground";
      default:
        throw new Error();
    }
  }
  function messageEventListener(messaging, event) {
    return __async(this, null, function* () {
      const internalPayload = event.data;
      if (!internalPayload.isFirebaseMessaging) {
        return;
      }
      if (messaging.onMessageHandler && internalPayload.messageType === MessageType.PUSH_RECEIVED) {
        if (typeof messaging.onMessageHandler === "function") {
          messaging.onMessageHandler(externalizePayload(internalPayload));
        } else {
          messaging.onMessageHandler.next(externalizePayload(internalPayload));
        }
      }
      const dataPayload = internalPayload.data;
      if (isConsoleMessage(dataPayload) && dataPayload[CONSOLE_CAMPAIGN_ANALYTICS_ENABLED] === "1") {
        yield logToScion(messaging, internalPayload.messageType, dataPayload);
      }
    });
  }
  function registerMessagingInWindow() {
    _registerComponent(new Component2(
      "messaging",
      WindowMessagingFactory,
      "PUBLIC"
      /* ComponentType.PUBLIC */
    ));
    _registerComponent(new Component2(
      "messaging-internal",
      WindowMessagingInternalFactory,
      "PRIVATE"
      /* ComponentType.PRIVATE */
    ));
    registerVersion(name4, version6);
    registerVersion(name4, version6, "esm2020");
  }
  function isWindowSupported() {
    return __async(this, null, function* () {
      try {
        yield validateIndexedDBOpenable();
      } catch (e) {
        return false;
      }
      return typeof window !== "undefined" && isIndexedDBAvailable() && areCookiesEnabled() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && "fetch" in window && ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification") && PushSubscription.prototype.hasOwnProperty("getKey");
    });
  }
  function deleteToken$1(messaging) {
    return __async(this, null, function* () {
      if (!navigator) {
        throw ERROR_FACTORY3.create(
          "only-available-in-window"
          /* ErrorCode.AVAILABLE_IN_WINDOW */
        );
      }
      if (!messaging.swRegistration) {
        yield registerDefaultSw(messaging);
      }
      return deleteTokenInternal(messaging);
    });
  }
  function onMessage$1(messaging, nextOrObserver) {
    if (!navigator) {
      throw ERROR_FACTORY3.create(
        "only-available-in-window"
        /* ErrorCode.AVAILABLE_IN_WINDOW */
      );
    }
    messaging.onMessageHandler = nextOrObserver;
    return () => {
      messaging.onMessageHandler = null;
    };
  }
  function getMessagingInWindow(app = getApp()) {
    isWindowSupported().then((isSupported) => {
      if (!isSupported) {
        throw ERROR_FACTORY3.create(
          "unsupported-browser"
          /* ErrorCode.UNSUPPORTED_BROWSER */
        );
      }
    }, (_) => {
      throw ERROR_FACTORY3.create(
        "indexed-db-unsupported"
        /* ErrorCode.INDEXED_DB_UNSUPPORTED */
      );
    });
    return _getProvider(getModularInstance(app), "messaging").getImmediate();
  }
  function getToken2(messaging, options) {
    return __async(this, null, function* () {
      messaging = getModularInstance(messaging);
      return getToken$1(messaging, options);
    });
  }
  function deleteToken(messaging) {
    messaging = getModularInstance(messaging);
    return deleteToken$1(messaging);
  }
  function onMessage(messaging, nextOrObserver) {
    messaging = getModularInstance(messaging);
    return onMessage$1(messaging, nextOrObserver);
  }
  var DEFAULT_SW_PATH, DEFAULT_SW_SCOPE, DEFAULT_VAPID_KEY, ENDPOINT, CONSOLE_CAMPAIGN_ID, CONSOLE_CAMPAIGN_NAME, CONSOLE_CAMPAIGN_TIME, CONSOLE_CAMPAIGN_ANALYTICS_ENABLED, DEFAULT_REGISTRATION_TIMEOUT, MessageType$1, MessageType, OLD_DB_NAME, OLD_DB_VERSION, OLD_OBJECT_STORE_NAME, DATABASE_NAME2, DATABASE_VERSION2, OBJECT_STORE_NAME2, dbPromise3, ERROR_MAP, ERROR_FACTORY3, TOKEN_EXPIRATION_MS, _MessagingService, MessagingService, name4, version6, WindowMessagingFactory, WindowMessagingInternalFactory;
  var init_index_esm7 = __esm({
    "node_modules/@firebase/messaging/dist/esm/index.esm.js"() {
      init_index_esm6();
      init_index_esm2();
      init_build();
      init_index_esm();
      init_index_esm4();
      DEFAULT_SW_PATH = "/firebase-messaging-sw.js";
      DEFAULT_SW_SCOPE = "/firebase-cloud-messaging-push-scope";
      DEFAULT_VAPID_KEY = "BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4";
      ENDPOINT = "https://fcmregistrations.googleapis.com/v1";
      CONSOLE_CAMPAIGN_ID = "google.c.a.c_id";
      CONSOLE_CAMPAIGN_NAME = "google.c.a.c_l";
      CONSOLE_CAMPAIGN_TIME = "google.c.a.ts";
      CONSOLE_CAMPAIGN_ANALYTICS_ENABLED = "google.c.a.e";
      DEFAULT_REGISTRATION_TIMEOUT = 1e4;
      (function(MessageType2) {
        MessageType2[MessageType2["DATA_MESSAGE"] = 1] = "DATA_MESSAGE";
        MessageType2[MessageType2["DISPLAY_NOTIFICATION"] = 3] = "DISPLAY_NOTIFICATION";
      })(MessageType$1 || (MessageType$1 = {}));
      (function(MessageType2) {
        MessageType2["PUSH_RECEIVED"] = "push-received";
        MessageType2["NOTIFICATION_CLICKED"] = "notification-clicked";
      })(MessageType || (MessageType = {}));
      __name(arrayToBase64, "arrayToBase64");
      __name(base64ToArray, "base64ToArray");
      OLD_DB_NAME = "fcm_token_details_db";
      OLD_DB_VERSION = 5;
      OLD_OBJECT_STORE_NAME = "fcm_token_object_Store";
      __name(migrateOldDatabase, "migrateOldDatabase");
      __name(checkTokenDetails, "checkTokenDetails");
      DATABASE_NAME2 = "firebase-messaging-database";
      DATABASE_VERSION2 = 1;
      OBJECT_STORE_NAME2 = "firebase-messaging-store";
      dbPromise3 = null;
      __name(getDbPromise3, "getDbPromise");
      __name(dbGet, "dbGet");
      __name(dbSet, "dbSet");
      __name(dbRemove, "dbRemove");
      __name(getKey2, "getKey");
      ERROR_MAP = {
        [
          "missing-app-config-values"
          /* ErrorCode.MISSING_APP_CONFIG_VALUES */
        ]: 'Missing App configuration value: "{$valueName}"',
        [
          "only-available-in-window"
          /* ErrorCode.AVAILABLE_IN_WINDOW */
        ]: "This method is available in a Window context.",
        [
          "only-available-in-sw"
          /* ErrorCode.AVAILABLE_IN_SW */
        ]: "This method is available in a service worker context.",
        [
          "permission-default"
          /* ErrorCode.PERMISSION_DEFAULT */
        ]: "The notification permission was not granted and dismissed instead.",
        [
          "permission-blocked"
          /* ErrorCode.PERMISSION_BLOCKED */
        ]: "The notification permission was not granted and blocked instead.",
        [
          "unsupported-browser"
          /* ErrorCode.UNSUPPORTED_BROWSER */
        ]: "This browser doesn't support the API's required to use the Firebase SDK.",
        [
          "indexed-db-unsupported"
          /* ErrorCode.INDEXED_DB_UNSUPPORTED */
        ]: "This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)",
        [
          "failed-service-worker-registration"
          /* ErrorCode.FAILED_DEFAULT_REGISTRATION */
        ]: "We are unable to register the default service worker. {$browserErrorMessage}",
        [
          "token-subscribe-failed"
          /* ErrorCode.TOKEN_SUBSCRIBE_FAILED */
        ]: "A problem occurred while subscribing the user to FCM: {$errorInfo}",
        [
          "token-subscribe-no-token"
          /* ErrorCode.TOKEN_SUBSCRIBE_NO_TOKEN */
        ]: "FCM returned no token when subscribing the user to push.",
        [
          "token-unsubscribe-failed"
          /* ErrorCode.TOKEN_UNSUBSCRIBE_FAILED */
        ]: "A problem occurred while unsubscribing the user from FCM: {$errorInfo}",
        [
          "token-update-failed"
          /* ErrorCode.TOKEN_UPDATE_FAILED */
        ]: "A problem occurred while updating the user from FCM: {$errorInfo}",
        [
          "token-update-no-token"
          /* ErrorCode.TOKEN_UPDATE_NO_TOKEN */
        ]: "FCM returned no token when updating the user to push.",
        [
          "use-sw-after-get-token"
          /* ErrorCode.USE_SW_AFTER_GET_TOKEN */
        ]: "The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.",
        [
          "invalid-sw-registration"
          /* ErrorCode.INVALID_SW_REGISTRATION */
        ]: "The input to useServiceWorker() must be a ServiceWorkerRegistration.",
        [
          "invalid-bg-handler"
          /* ErrorCode.INVALID_BG_HANDLER */
        ]: "The input to setBackgroundMessageHandler() must be a function.",
        [
          "invalid-vapid-key"
          /* ErrorCode.INVALID_VAPID_KEY */
        ]: "The public VAPID key must be a string.",
        [
          "use-vapid-key-after-get-token"
          /* ErrorCode.USE_VAPID_KEY_AFTER_GET_TOKEN */
        ]: "The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."
      };
      ERROR_FACTORY3 = new ErrorFactory("messaging", "Messaging", ERROR_MAP);
      __name(requestGetToken, "requestGetToken");
      __name(requestUpdateToken, "requestUpdateToken");
      __name(requestDeleteToken, "requestDeleteToken");
      __name(getEndpoint, "getEndpoint");
      __name(getHeaders2, "getHeaders");
      __name(getBody, "getBody");
      TOKEN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1e3;
      __name(getTokenInternal, "getTokenInternal");
      __name(deleteTokenInternal, "deleteTokenInternal");
      __name(updateToken, "updateToken");
      __name(getNewToken, "getNewToken");
      __name(getPushSubscription, "getPushSubscription");
      __name(isTokenValid, "isTokenValid");
      __name(externalizePayload, "externalizePayload");
      __name(propagateNotificationPayload, "propagateNotificationPayload");
      __name(propagateDataPayload, "propagateDataPayload");
      __name(propagateFcmOptions, "propagateFcmOptions");
      __name(isConsoleMessage, "isConsoleMessage");
      _mergeStrings("AzSCbw63g1R0nCw85jG8", "Iaya3yLKwmgvh7cF0q4");
      __name(_mergeStrings, "_mergeStrings");
      __name(extractAppConfig2, "extractAppConfig");
      __name(getMissingValueError2, "getMissingValueError");
      _MessagingService = class _MessagingService {
        constructor(app, installations, analyticsProvider) {
          this.deliveryMetricsExportedToBigQueryEnabled = false;
          this.onBackgroundMessageHandler = null;
          this.onMessageHandler = null;
          this.logEvents = [];
          this.isLogServiceStarted = false;
          const appConfig = extractAppConfig2(app);
          this.firebaseDependencies = {
            app,
            appConfig,
            installations,
            analyticsProvider
          };
        }
        _delete() {
          return Promise.resolve();
        }
      };
      __name(_MessagingService, "MessagingService");
      MessagingService = _MessagingService;
      __name(registerDefaultSw, "registerDefaultSw");
      __name(waitForRegistrationActive, "waitForRegistrationActive");
      __name(updateSwReg, "updateSwReg");
      __name(updateVapidKey, "updateVapidKey");
      __name(getToken$1, "getToken$1");
      __name(logToScion, "logToScion");
      __name(getEventType, "getEventType");
      __name(messageEventListener, "messageEventListener");
      name4 = "@firebase/messaging";
      version6 = "0.12.23";
      WindowMessagingFactory = /* @__PURE__ */ __name((container) => {
        const messaging = new MessagingService(container.getProvider("app").getImmediate(), container.getProvider("installations-internal").getImmediate(), container.getProvider("analytics-internal"));
        navigator.serviceWorker.addEventListener("message", (e) => messageEventListener(messaging, e));
        return messaging;
      }, "WindowMessagingFactory");
      WindowMessagingInternalFactory = /* @__PURE__ */ __name((container) => {
        const messaging = container.getProvider("messaging").getImmediate();
        const messagingInternal = {
          getToken: /* @__PURE__ */ __name((options) => getToken$1(messaging, options), "getToken")
        };
        return messagingInternal;
      }, "WindowMessagingInternalFactory");
      __name(registerMessagingInWindow, "registerMessagingInWindow");
      __name(isWindowSupported, "isWindowSupported");
      __name(deleteToken$1, "deleteToken$1");
      __name(onMessage$1, "onMessage$1");
      __name(getMessagingInWindow, "getMessagingInWindow");
      __name(getToken2, "getToken");
      __name(deleteToken, "deleteToken");
      __name(onMessage, "onMessage");
      registerMessagingInWindow();
    }
  });

  // node_modules/firebase/messaging/dist/esm/index.esm.js
  var index_esm_exports2 = {};
  __export(index_esm_exports2, {
    deleteToken: () => deleteToken,
    getMessaging: () => getMessagingInWindow,
    getToken: () => getToken2,
    isSupported: () => isWindowSupported,
    onMessage: () => onMessage
  });
  var init_index_esm8 = __esm({
    "node_modules/firebase/messaging/dist/esm/index.esm.js"() {
      init_index_esm7();
    }
  });

  // src/mls.ts
  var mls_exports = {};
  __export(mls_exports, {
    actual: () => actual,
    actualLevel: () => actualLevel,
    actualModule: () => actualModule,
    actualNav3: () => actualNav3,
    actualPosition: () => actualPosition,
    actualProject: () => actualProject,
    actualService: () => actualService,
    api: () => api_exports,
    bots: () => bots_exports,
    cbe: () => global_cbe_types_exports,
    common: () => common_exports,
    contributions: () => contributions,
    defs: () => defs_exports,
    editor: () => editor_exports,
    events: () => events_exports,
    getActualUser: () => getActualUser,
    l0: () => l0_exports,
    l1: () => l1_exports,
    l2: () => l2_exports,
    l3: () => l3_exports,
    l4: () => l4_exports,
    l5: () => l5_exports,
    l5_common: () => l5_common_exports,
    l6: () => l6_exports,
    l7: () => l7_exports,
    main: () => main_exports,
    mindmap: () => mindmap_exports,
    plugin: () => plugin_exports,
    services: () => services,
    setActualLevel: () => setActualLevel,
    setActualModule: () => setActualModule,
    setActualNav3: () => setActualNav3,
    setActualPosition: () => setActualPosition,
    setActualProject: () => setActualProject,
    setActualService: () => setActualService,
    setContributions: () => setContributions,
    setServices: () => setServices,
    showLibVersions: () => showLibVersions,
    stor: () => stor_exports,
    version: () => version7
  });

  // src/l0/l0.ts
  var l0_exports = {};
  __export(l0_exports, {
    addProviderConnected: () => addProviderConnected,
    init: () => init,
    providersConnected: () => providersConnected
  });
  var init = /* @__PURE__ */ __name((mode) => __async(null, null, function* () {
  }), "init");
  var providersConnected = [];
  var addProviderConnected = /* @__PURE__ */ __name((provider) => {
    if (providersConnected.includes(provider)) return;
    const widgetPath = mls_exports.cbe.providerWidgets[provider];
    if (widgetPath === void 0) throw new Error(`invalid provider: '${provider}'`);
    providersConnected.push(provider);
  }, "addProviderConnected");

  // src/l1/l1.ts
  var l1_exports = {};
  __export(l1_exports, {
    init: () => init2
  });
  var init2 = /* @__PURE__ */ __name((mode) => __async(null, null, function* () {
  }), "init");

  // src/l2/l2.ts
  var l2_exports = {};
  __export(l2_exports, {
    codeLens: () => l2_codeLens_exports,
    enhancement: () => l2_enhancement_exports,
    html: () => l2_html_exports,
    init: () => init3,
    less: () => l2_less_exports,
    typescript: () => l2_typescript_exports
  });

  // src/l2/l2.enhancement.ts
  var l2_enhancement_exports = {};
  __export(l2_enhancement_exports, {
    addPathsToTypescriptConfigIfNeed: () => addPathsToTypescriptConfigIfNeed,
    getEnhancementModule: () => getEnhancementModule
  });
  var getEnhancementModule = /* @__PURE__ */ __name((file) => __async(null, null, function* () {
    return yield getEnhancementInstance2(file);
  }), "getEnhancementModule");
  var getEnhancementInstance2 = /* @__PURE__ */ __name((file) => __async(null, null, function* () {
    return new Promise((resolve, reject) => {
      if (file.project < 1) throw new Error("error, project < 1, invalid enhancement reference");
      const url = `/local/_${file.folder ? file.folder + "/" : ""}${file.project}_${file.shortName}`;
      import(url).then((a) => {
        if (!Array.isArray(a.requires)) return reject(new Error("not found requires array in enhancement"));
        if (typeof a.onAfterChange !== "function") return reject(new Error("not found onAfterChange function in enhancement"));
        if (typeof a.getDesignDetails !== "function") return reject(new Error("not found getDesignDetails function in enhancement"));
        if (typeof a.onAfterCompile !== "function") return reject(new Error("not found onAfterCompile function in enhancement"));
        return resolve(a);
      }).catch((e) => {
        console.log(`getEnhancementInstance2, project:${file.project}, shortName:${file.shortName} error: ${e.message || e}`);
        return reject(new Error(e.message || e));
      });
    });
  }), "getEnhancementInstance2");
  var addPathsToTypescriptConfigIfNeed = /* @__PURE__ */ __name((file) => __async(null, null, function* () {
    const enhInstance = yield getEnhancementModule(file).catch((e) => {
      console.error(`error on fireBeforeCompile: ${e.message}`);
    });
    if (mls_exports.istrace) console.log(`fireBeforeCompile: _${file.project}_/l/${file.level}/${file.folder ? file.folder + "/" : ""}${file.shortName} enhancement instance: ${Boolean(enhInstance)}`);
    const requires = enhInstance == null ? void 0 : enhInstance.requires;
    if (mls_exports.istrace) console.log(`addPathsToTypescriptConfigIfNeed: ${requires ? JSON.stringify(requires) : "no requires"}`);
    if (!requires) return;
    const op = monaco.languages.typescript.typescriptDefaults.getCompilerOptions();
    if (!op.paths) op.paths = {};
    let changed = false;
    for (const require2 of requires) {
      if (mls_exports.istrace) console.log(`addPathsToTypescriptConfigIfNeed: require: ${JSON.stringify(require2)}`);
      if (require2.type !== "tspath") continue;
      if (op.paths[require2.name] && op.paths[require2.name].length === 1 && op.paths[require2.name][0] === require2.ref) continue;
      op.paths[require2.name] = [require2.ref];
      changed = true;
    }
    if (!changed) return;
    if (mls_exports.istrace) console.log(`paths typescript config changed: ${JSON.stringify(op.paths)}`);
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(op);
    const modelTS = mls_exports.l2.typescript.getModelTS(file.project, file.shortName, file.folder);
    if (modelTS == null ? void 0 : modelTS.compilerResults) modelTS.compilerResults.modelNeedCompile = true;
  }), "addPathsToTypescriptConfigIfNeed");

  // src/l2/l2.codeLens.ts
  var l2_codeLens_exports = {};
  __export(l2_codeLens_exports, {
    addCodeLen: () => addCodeLen,
    commands: () => commands,
    initCodeLens: () => initCodeLens,
    removeCodeLen: () => removeCodeLen
  });
  var _CustomCodeLensProvider = class _CustomCodeLensProvider {
    constructor() {
      /**
       * An event that is emitted when the CodeLens provider has updated information.
       */
      __publicField(this, "onDidChange");
    }
    /**
     * Provide CodeLens items for the given document.
     * @param model The document for which CodeLens items should be provided.
     * @param token A cancellation token.
     * @returns An array of CodeLens items.
     */
    provideCodeLenses(model, token) {
      const lenses = this.getLenses(mls_exports.editor.getModelById(model.id));
      return {
        lenses,
        dispose: /* @__PURE__ */ __name(() => {
        }, "dispose")
      };
    }
    getLenses(modelBase) {
      const lenses = [];
      if (!modelBase || !modelBase.codeLens) return lenses;
      const { level, position } = mls_exports.editor.getInfoFromActiveInstance();
      for (const slineNr in modelBase.codeLens) {
        const len = modelBase.codeLens[slineNr];
        const lineNr = Number(slineNr);
        for (let i = 0; i < len.length; i++) {
          const comm = len[i];
          const id = getCommandID(modelBase.model, comm.id, level, position) || "";
          lenses.push({
            range: {
              startLineNumber: lineNr,
              startColumn: 1,
              endLineNumber: lineNr + 1,
              endColumn: 1
            },
            id: `mlsCodelens${lineNr}`,
            command: {
              id,
              title: comm.title,
              arguments: [modelBase.model, modelBase.storFile, lineNr]
            }
          });
        }
      }
      return lenses;
    }
    /**
     * Resolve a CodeLens item.
     * @param model The document for which the CodeLens item was provided.
     * @param codeLens The CodeLens item to resolve.
     * @param token A cancellation token.
     * @returns The resolved CodeLens item.
     */
    resolveCodeLens(model, codeLens, token) {
      console.info(`resolveCodeLens ${model.uri.toString()}`, codeLens);
      return codeLens;
    }
  };
  __name(_CustomCodeLensProvider, "CustomCodeLensProvider");
  var CustomCodeLensProvider = _CustomCodeLensProvider;
  var statusInitCodeLens = "notloaded";
  var initCodeLens = /* @__PURE__ */ __name(() => {
    if (statusInitCodeLens !== "notloaded") return;
    monaco.languages.registerCodeLensProvider("typescript", new CustomCodeLensProvider());
    statusInitCodeLens = "loaded";
  }, "initCodeLens");
  var commands = {};
  var getCommandID = /* @__PURE__ */ __name((model, id, level, position) => {
    const editor = mls_exports.editor.instances[mls_exports.editor.activeInstance];
    if (!editor) return "";
    const key = editor.getId() + ":" + id;
    if (commands[key]) return commands[key];
    function cmdFileReference() {
      const commandId2 = editor.addCommand(
        0,
        function(ctx, model2, storFile2, lineNr) {
          mls_exports.events.fireFileAction("fileReference", storFile2, position);
        },
        ""
      );
      return commandId2;
    }
    __name(cmdFileReference, "cmdFileReference");
    function cmdhelpAssistant() {
      const commandId2 = editor.addCommand(
        0,
        function(ctx, model2, storFile2, lineNr) {
          console.info("helpAssistant in monado on line " + lineNr);
          mls_exports.events.fireMonacoAction("helpAssistant", storFile2, getCodLenCommand(model2, lineNr, id), position, lineNr);
        },
        ""
      );
      return commandId2;
    }
    __name(cmdhelpAssistant, "cmdhelpAssistant");
    let commandId;
    switch (id) {
      case "fileReferences":
        commandId = cmdFileReference();
        break;
      case "helpAssistant":
        commandId = cmdhelpAssistant();
        break;
      default:
        throw new Error(`Unknown command id ${id}`);
    }
    commands[key] = commandId;
    return commandId;
  }, "getCommandID");
  var getCodLenCommand = /* @__PURE__ */ __name((model, lineNr, id) => {
    if (!model) return;
    const mm = mls_exports.editor.getModelById(model.id);
    if (!mm) return;
    const lens = mm.codeLens[lineNr];
    if (lens) {
      for (const len of lens) {
        if (len.id === id) return len;
      }
    }
  }, "getCodLenCommand");
  var addCodeLen = /* @__PURE__ */ __name((model, lineNr, args) => {
    if (!model) return;
    const mfile = mls_exports.editor.getModelById(model.id);
    if (!mfile) return;
    if (!mfile.codeLens) mfile.codeLens = {};
    let lens = mfile.codeLens[lineNr];
    if (lens) {
      for (let i = 0; i < lens.length; i++) {
        if (lens[i].id === args.id) {
          lens.splice(i, 1);
          break;
        }
      }
    } else lens = [];
    lens.push(args);
    mfile.codeLens[lineNr] = lens;
    updateCodeLens(model);
  }, "addCodeLen");
  var removeCodeLen = /* @__PURE__ */ __name((model, lineNr) => {
    if (!model) return;
    const mfile = mls_exports.editor.getModelById(model.id);
    if (!mfile) return;
    if (!mfile.codeLens) mfile.codeLens = {};
    if (mfile.codeLens[lineNr]) {
      delete mfile.codeLens[lineNr];
      updateCodeLens(model);
    }
  }, "removeCodeLen");
  var updateCodeLens = /* @__PURE__ */ __name((model) => {
    const list = mls_exports.editor.findEditorsByModel(model);
    for (const ed of list) {
      ed.updateOptions({ codeLens: false });
      ed.updateOptions({ codeLens: true });
    }
  }, "updateCodeLens");

  // src/l2/l2.typescript.ts
  var l2_typescript_exports = {};
  __export(l2_typescript_exports, {
    addError: () => addError,
    compile: () => compile,
    compileAll: () => compileAll,
    compileAndGetImports: () => compileAndGetImports,
    compileAndPostProcess: () => compileAndPostProcess,
    enableMlsTSWorkerIfNeeded: () => enableMlsTSWorkerIfNeeded,
    getDiagnostics: () => getDiagnostics,
    getModelTS: () => getModelTS,
    getRef: () => getRef,
    getTypeScriptWorker: () => getTypeScriptWorker,
    initCompilerResults: () => initCompilerResults,
    initCompilerResultsIfNeed: () => initCompilerResultsIfNeed,
    parseTripleSlash: () => parseTripleSlash,
    translateImportPaths: () => translateImportPaths
  });
  var MLSTSWORKERVERSION = "1.0.898";
  var getModelTS = /* @__PURE__ */ __name((project, shortName, folder) => {
    var _a2;
    return (_a2 = mls_exports.editor.models[mls_exports.editor.getKeyModel(project, shortName, folder, 2)]) == null ? void 0 : _a2.ts;
  }, "getModelTS");
  var compileAndGetImports = /* @__PURE__ */ __name((modelTS, deep) => __async(null, null, function* () {
    throw new Error("Not implemented");
  }), "compileAndGetImports");
  var compileAndPostProcess = /* @__PURE__ */ __name((modelTS, runAfterCompile, saveCache) => __async(null, null, function* () {
    if (!(yield compile(modelTS))) return false;
    if (runAfterCompile) yield runEnhancementAfterCompile(modelTS);
    if (!modelTS.compilerResults || modelTS.compilerResults.errors.length > 0) return false;
    if (saveCache) return saveCacheAfterCompile(modelTS);
    return true;
  }), "compileAndPostProcess");
  var compile = /* @__PURE__ */ __name((modelTS) => __async(null, null, function* () {
    var _a2, _b2;
    const start = Date.now();
    enableMlsTSWorkerIfNeeded();
    if (modelTS.compilerResults && modelTS.compilerResults.modelVersion === modelTS.model.getVersionId() && !modelTS.compilerResults.modelNeedCompile) return true;
    initCompilerResults(modelTS);
    if (!modelTS.compilerResults) throw new Error("modelTS.compilerResults is not initialized");
    try {
      modelTS.compilerResults.trace.push(`compiling ${modelTS.model.uri}`);
      parseTripleSlash(modelTS);
      if (modelTS.compilerResults.errors.length > 0) return false;
      addEnhancementToImports(modelTS, true);
      if (modelTS.compilerResults.errors.length > 0) return false;
      const widget = (_b2 = (_a2 = modelTS.compilerResults) == null ? void 0 : _a2.tripleSlashMLS) == null ? void 0 : _b2.variables.enhancement;
      if (widget && widget !== "_blank") {
        const storFile = mls_exports.actual[0].setFullName(widget).getStorFile();
        if (storFile) yield mls_exports.l2.enhancement.addPathsToTypescriptConfigIfNeed(storFile);
      }
      const fileName = modelTS.model.uri.toString();
      const tsWorker = yield getTypeScriptWorker(modelTS.model).catch((reason) => {
        addError(modelTS, `Error on getTypeScriptWorker${reason.message}` || reason, 0, 9999);
        return false;
      });
      if (!tsWorker) throw new Error("typescript not initialized");
      modelTS.compilerResults.errors = [...modelTS.compilerResults.errors, ...yield getDiagnostics(fileName, tsWorker)];
      modelTS.compilerResults.imports = [...modelTS.compilerResults.imports, ...yield tsWorker.getImports(fileName)];
      translateImportPaths(modelTS.compilerResults);
      modelTS.compilerResults.trace.push("getting emit files");
      const emit = yield tsWorker.getEmitOutput(fileName);
      if (emit.emitSkipped) return modelTS.compilerResults.errors.length === 0;
      modelTS.compilerResults.trace.push(`emit files:${emit.outputFiles.length}`);
      emit.outputFiles.forEach((outputFile) => {
        if (!modelTS.compilerResults) throw new Error(`compilerResults not found: _${modelTS.storFile.project}_${modelTS.storFile.shortName}`);
        modelTS.compilerResults.trace.push(`outputFile, ${outputFile.name}, len=${outputFile.text.length}`);
        if (outputFile.name.endsWith(".js")) {
          modelTS.compilerResults.prodJS = outputFile.text;
        } else if (outputFile.name.endsWith(".d.ts")) {
          modelTS.compilerResults.prodDTS = outputFile.text;
        } else if (outputFile.name.endsWith(".js.map")) {
          modelTS.compilerResults.prodMap = outputFile.text;
        }
      });
      modelTS.compilerResults.trace.push("getting decorators and json doc");
      modelTS.compilerResults.decorators = yield tsWorker.getDecoratorsInfo(fileName);
      modelTS.compilerResults.devDoc = yield tsWorker.getJsonDoc(fileName);
      modelTS.compilerResults.trace.push(`compile time: ${Date.now() - start}ms`);
      return modelTS.compilerResults.errors.length === 0;
    } catch (e) {
      addError(modelTS, e.message || e, 0, 9999);
      return false;
    }
  }), "compile");
  var compileAll = /* @__PURE__ */ __name((project, onProgress) => __async(null, null, function* () {
    var _a2;
    if (mls_exports.istrace) console.time("compileAll");
    enableMlsTSWorkerIfNeeded();
    const files2 = Object.keys(mls_exports.stor.files).filter((key) => {
      const fi = mls_exports.stor.files[key];
      return fi.project === project && fi.extension === ".ts";
    }).map((key) => mls_exports.stor.files[key]);
    const result = [];
    try {
      for (var iter = __forAwait(files2), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
        const file2 = temp.value;
        const keyModel = mls_exports.editor.getKeyModel(file2.project, file2.shortName, file2.folder, file2.level);
        let modelTS = (_a2 = mls_exports.editor.models[keyModel]) == null ? void 0 : _a2.ts;
        let alreadyLoaded = modelTS !== void 0;
        if (!alreadyLoaded) {
          modelTS = yield loadModelTS(file2);
        }
        if (!modelTS) continue;
        initCompilerResultsIfNeed(modelTS);
        if (!modelTS.compilerResults) throw new Error(`modelTS.compilerResults is not initialized in compileAll _${file2.project}_${file2.shortName}`);
        modelTS.compilerResults.modelNeedCompile = true;
        const success = yield compile(modelTS);
        if (!success) {
          const storFile = modelTS.storFile;
          result.push(`--- Error compiling "_${storFile.project}_/l${storFile.level}/${storFile.folder ? storFile.folder + "/" : ""}${storFile.shortName}${storFile.extension}", errors: (${modelTS.compilerResults.errors.length})`);
          storFile.hasError = true;
        }
        if (!alreadyLoaded) {
          yield removeModel(file2);
        }
        if (onProgress && !onProgress(files2.indexOf(file2), files2.length, result)) break;
      }
    } catch (temp) {
      error = [temp];
    } finally {
      try {
        more && (temp = iter.return) && (yield temp.call(iter));
      } finally {
        if (error)
          throw error[0];
      }
    }
    if (mls_exports.istrace) console.timeEnd("compileAll");
    return result;
  }), "compileAll");
  var addEnhancementToImports = /* @__PURE__ */ __name((modelTS, verifyIfExists) => __async(null, null, function* () {
    var _a2;
    try {
      if (!(modelTS == null ? void 0 : modelTS.compilerResults)) return;
      const tripleSlashEnhancement = ((_a2 = modelTS.compilerResults.tripleSlashMLS) == null ? void 0 : _a2.variables.enhancement) || "";
      if (tripleSlashEnhancement === "_blank") return;
      modelTS.compilerResults.imports.push(`${tripleSlashEnhancement}`);
      if (!verifyIfExists) return;
      const { project, shortName, folder, level } = mls_exports.actual[0].setFullName(tripleSlashEnhancement).getStorFile() || { project: 0, shortName: "", folder: "", level: 2 };
      const key = mls_exports.stor.getKeyToFile({ project, level, shortName, folder, extension: ".ts" });
      if (!mls_exports.stor.files[key]) {
        modelTS.compilerResults.errorEnhancementNotFound = true;
        addError(modelTS, `Enhancement not found: _${project}_${shortName}`, 0, 9999);
      }
    } catch (e) {
      addError(modelTS, e.message || e, 0, 9999);
    }
  }), "addEnhancementToImports");
  var loadModelTS = /* @__PURE__ */ __name((file2) => __async(null, null, function* () {
    const keyModel = mls_exports.editor.getKeyModel(file2.project, file2.shortName, file2.folder, file2.level);
    let models2 = mls_exports.editor.models[keyModel];
    if (models2 == null ? void 0 : models2.ts) return void 0;
    models2 = models2 || {};
    const source = yield file2.getContent();
    if (typeof source === "string" && source) {
      const ts = yield mls_exports.editor.createModelTS(file2, source);
      models2 = mls_exports.editor.models[keyModel] || {};
      models2.ts = ts;
      mls_exports.editor.models[keyModel] = models2;
      return models2.ts;
    } else {
      console.error(`Error loading file _${file2.project}_${file2.folder ? "/" + file2.folder + "/" : ""}${file2.shortName}, source is not a string.`);
      return void 0;
    }
  }), "loadModelTS");
  var removeModel = /* @__PURE__ */ __name((file2) => __async(null, null, function* () {
    mls_exports.editor.deleteModels(file2.project, file2.shortName, file2.folder, true, file2.level);
  }), "removeModel");
  var runEnhancementAfterCompile = /* @__PURE__ */ __name((modelTS) => __async(null, null, function* () {
    var _a2, _b2, _c2;
    try {
      if (!modelTS.compilerResults) throw new Error("modelTS.compilerResults is not initialized");
      const widget = (_b2 = (_a2 = modelTS.compilerResults) == null ? void 0 : _a2.tripleSlashMLS) == null ? void 0 : _b2.variables.enhancement;
      if (!widget) throw new Error("not found enhancement tag");
      if (widget === "_blank") return;
      modelTS.compilerResults.trace.push(`running enhancement after compile: ${widget}`);
      const enFile = mls_exports.actual[0].setFullName(widget).getStorFile();
      if (!enFile) throw new Error(`enhancement file not found: ${widget}`);
      const en1 = yield mls_exports.l2.enhancement.getEnhancementModule(enFile);
      const start = Date.now();
      yield en1 == null ? void 0 : en1.onAfterCompile(modelTS);
      modelTS.compilerResults.trace.push(`enhancement after compile time: ${Date.now() - start}ms`);
    } catch (e) {
      (_c2 = modelTS.compilerResults) == null ? void 0 : _c2.trace.push(`error on addEnhancementInstance: ${e.message}` || e);
      addError(modelTS, `error on addEnhancementInstance: ${e.message}` || e, 0, 9999);
    }
  }), "runEnhancementAfterCompile");
  var saveCacheAfterCompile = /* @__PURE__ */ __name((modelTS) => __async(null, null, function* () {
    var _a2;
    if (!modelTS || !modelTS.compilerResults) return false;
    try {
      const hasError = (modelTS.compilerResults.errors || []).length > 0;
      if (hasError) return false;
      const prodJS = ((_a2 = modelTS.compilerResults) == null ? void 0 : _a2.prodJS) || "";
      if (!prodJS) return false;
      let { project, shortName, folder, extension } = modelTS.storFile;
      const version8 = modelTS.compilerResults.cacheVersion;
      if (!version8) return false;
      extension = extension.replace(".ts", ".js");
      const url = yield mls_exports.stor.cache.addIfNeed({ project, folder, shortName, version: version8, content: prodJS, extension });
      modelTS.compilerResults.trace.push(`cache saved: ${url}`);
      return true;
    } catch (e) {
      addError(modelTS, `error on saveCacheAfterCompile: ${e.message}` || e, 0, 9999);
      return false;
    }
  }), "saveCacheAfterCompile");
  var parseTripleSlash = /* @__PURE__ */ __name((modelTS) => {
    try {
      if (!modelTS || !modelTS.model || modelTS.model.isDisposed()) throw new Error("modelTS or model is not initialized or disposed");
      const firstLine = modelTS.model.getLinesContent()[0];
      initCompilerResultsIfNeed(modelTS);
      if (!modelTS.compilerResults) throw new Error("modelTS.compilerResults is not initialized");
      modelTS.compilerResults.tripleSlashMLS = mls_exports.common.tripleslash.parseXMLTripleSlash(firstLine);
    } catch (e) {
      addError(modelTS, e.message || e, 0, 9999);
    }
  }, "parseTripleSlash");
  var addError = /* @__PURE__ */ __name((modelTS, message, start, length) => {
    initCompilerResultsIfNeed(modelTS);
    if (!modelTS.compilerResults) throw new Error(`modelTS.compilerResults is not initialized in add error${message}`);
    const error = {
      category: 1,
      code: 1,
      messageText: message,
      start,
      length,
      file: {
        fileName: ""
      }
    };
    modelTS.compilerResults.errors.push(error);
  }, "addError");
  var initCompilerResultsIfNeed = /* @__PURE__ */ __name((modelTS) => {
    if (!modelTS.compilerResults) initCompilerResults(modelTS);
  }, "initCompilerResultsIfNeed");
  var initCompilerResults = /* @__PURE__ */ __name((modelTS) => {
    modelTS.compilerResults = {
      errors: [],
      prodJS: "",
      prodDTS: "",
      prodMap: "",
      devDoc: "",
      trace: [],
      modelVersion: modelTS.model.getVersionId(),
      cacheVersion: (/* @__PURE__ */ new Date()).toISOString().replace(/[:.-]/g, "").replace("T", "").replace("Z", ""),
      modelNeedCompile: false,
      errorEnhancementNotFound: false,
      imports: [],
      decorators: "",
      tripleSlashMLS: void 0
    };
  }, "initCompilerResults");
  var statusLoadMlsTSWorker = "notloaded";
  var enableMlsTSWorkerIfNeeded = /* @__PURE__ */ __name(() => {
    if (statusLoadMlsTSWorker !== "notloaded") return;
    let url;
    if (window.location.host === "multilevelstudio.com") url = `../../../../../../mlsTSWorker.js?v=${MLSTSWORKERVERSION}`;
    else {
      const site = new URL(document.head.baseURI).origin;
      const latest = window.latest || {};
      url = `${site}/libs/${latest.libs}/mlsTSWorker.js`;
    }
    monaco.languages.typescript.typescriptDefaults.setWorkerOptions({ customWorkerPath: url });
    statusLoadMlsTSWorker = "loaded";
  }, "enableMlsTSWorkerIfNeeded");
  var getTypeScriptWorker = /* @__PURE__ */ __name((model, step = 1) => __async(null, null, function* () {
    if (!model.isDisposed || model.isDisposed() || model.getValueLength() < 1) {
      throw new Error("getTypeScriptWorker, invalid model");
    }
    return new Promise((resolve, reject) => {
      monaco.languages.typescript.getTypeScriptWorker().then((worker) => {
        worker(model.uri).then((client) => {
          return resolve(client);
        }).catch((reason) => {
          throw new Error("getTypeScriptWorker, client error: " + reason.message || reason);
        });
      }).catch((reason) => {
        const msg = reason.message || reason;
        if (msg.indexOf("not registered")) {
          if (step > 10) throw new Error(msg);
          step += 1;
          if (mls_exports.istrace) console.log(`Trying get typescript worker: ${step}/10`);
          return getTypeScriptWorker(model, step);
        } else throw new Error(msg);
      });
    });
  }), "getTypeScriptWorker");
  var translateImportPaths = /* @__PURE__ */ __name((compilerResults) => {
    if (!compilerResults) return;
    const op = monaco.languages.typescript.typescriptDefaults.getCompilerOptions();
    if (!op.paths) return;
    const prefix = "file://server/";
    const suffix = ".ts";
    for (let i = 0; i < compilerResults.imports.length; i++) {
      let imp = compilerResults.imports[i];
      if (imp.indexOf("->") > 0) continue;
      for (const key in op.paths) {
        if (key === imp) {
          let str = op.paths[key][0] || "";
          if (str.startsWith(prefix)) str = str.slice(prefix.length);
          if (str.endsWith(suffix)) str = str.slice(0, -suffix.length);
          imp = `${imp}->${str}`;
          compilerResults.imports[i] = imp;
          break;
        }
      }
    }
  }, "translateImportPaths");
  var getDiagnostics = /* @__PURE__ */ __name((fileName, tsworker) => __async(null, null, function* () {
    let rc = yield tsworker.getSyntacticDiagnostics(fileName);
    if (rc.length > 0) return rc;
    rc = yield tsworker.getSemanticDiagnostics(fileName);
    return rc;
  }), "getDiagnostics");
  var getRef = /* @__PURE__ */ __name((model, word) => __async(null, null, function* () {
    if (model.isDisposed()) return void 0;
    const tsworker = yield getTypeScriptWorker(model);
    const fileName = model.uri.toString();
    const str = (yield tsworker == null ? void 0 : tsworker.getRef(fileName, word)) || void 0;
    if (str) return JSON.parse(str);
    return void 0;
  }), "getRef");

  // src/l2/l2.less.ts
  var l2_less_exports = {};
  __export(l2_less_exports, {
    addError: () => addError2,
    compile: () => compile2,
    compileStyle: () => compileStyle,
    initCompilerResults: () => initCompilerResults2,
    initStyleResultsIfNeed: () => initStyleResultsIfNeed,
    parseTripleSlash: () => parseTripleSlash2
  });
  var compile2 = /* @__PURE__ */ __name((doc, compress = false) => {
    return new Promise((resolve, reject) => {
      if (!doc || doc.trim().length < 1) return resolve("");
      less.render(doc, { compress }).then(
        (output) => {
          resolve(output.css);
        },
        (error) => {
          reject(new Error(`Error LESS: ${error}`));
        }
      );
    });
  }, "compile");
  var compileStyle = /* @__PURE__ */ __name((modelStyle) => __async(null, null, function* () {
    try {
      if (!modelStyle || !modelStyle.model || modelStyle.model.isDisposed()) throw new Error("modelStyle or model is not initialized or disposed");
      initStyleResultsIfNeed(modelStyle);
      if (!modelStyle.styleResults) throw new Error("modelStyle.styleResults is not initialized");
      if (modelStyle.styleResults.compiledVersion === modelStyle.model.getVersionId()) return true;
      modelStyle.styleResults.modelVersion = modelStyle.model.getVersionId();
      modelStyle.styleResults.compiledVersion = modelStyle.styleResults.modelVersion;
      modelStyle.styleResults.errors = [];
      modelStyle.styleResults.css = "";
      modelStyle.styleResults.trace = [];
      parseTripleSlash2(modelStyle);
      const doc = modelStyle.model.getValue();
      modelStyle.styleResults.trace.push(`compileStyle, less: ${doc.length} chars`);
      const start = Date.now();
      const versionBeforeCompile = modelStyle.model.getVersionId();
      const css = yield compile2(doc);
      if (modelStyle.model.getVersionId() === versionBeforeCompile) {
        modelStyle.styleResults.css = css;
        modelStyle.styleResults.trace.push(`compileStyle css: ${modelStyle.styleResults.css.length} chars`);
        modelStyle.styleResults.trace.push(`compileStyle: ${Date.now() - start} ms`);
        return true;
      } else {
        modelStyle.styleResults.trace.push("compileStyle: model version changed during compile, skipping css assignment");
        return false;
      }
    } catch (e) {
      addError2(modelStyle, e.message || e, 0, 9999);
      return false;
    }
  }), "compileStyle");
  var parseTripleSlash2 = /* @__PURE__ */ __name((modelStyle) => {
    try {
      if (!modelStyle || !modelStyle.model || modelStyle.model.isDisposed()) throw new Error("modelStyle or model is not initialized or disposed");
      const firstLine = modelStyle.model.getLinesContent()[0];
      initStyleResultsIfNeed(modelStyle);
      if (!modelStyle.styleResults) throw new Error("modelStyle.styleResults is not initialized");
      modelStyle.styleResults.tripleSlashMLS = mls_exports.common.tripleslash.parseXMLTripleSlash(firstLine);
    } catch (e) {
      addError2(modelStyle, e.message || e, 0, 9999);
    }
  }, "parseTripleSlash");
  var addError2 = /* @__PURE__ */ __name((modelStyle, message, start, length) => {
    initStyleResultsIfNeed(modelStyle);
    if (!modelStyle.styleResults) throw new Error(`modelStyle.styleResults is not initialized in add error${message}`);
    const error = {
      category: 1,
      code: 1,
      messageText: message,
      start,
      length,
      file: {
        fileName: ""
      }
    };
    modelStyle.styleResults.errors.push(error);
  }, "addError");
  var initStyleResultsIfNeed = /* @__PURE__ */ __name((modelStyle) => {
    if (!modelStyle.styleResults) initCompilerResults2(modelStyle);
  }, "initStyleResultsIfNeed");
  var initCompilerResults2 = /* @__PURE__ */ __name((modelStyle) => {
    modelStyle.styleResults = {
      errors: [],
      css: "",
      trace: [],
      modelVersion: modelStyle.model.getVersionId(),
      compiledVersion: 0,
      tripleSlashMLS: void 0
    };
  }, "initCompilerResults");

  // src/l2/l2.html.ts
  var l2_html_exports = {};

  // src/l2/l2.ts
  var init3 = /* @__PURE__ */ __name((mode) => __async(null, null, function* () {
  }), "init");

  // src/l3/l3.ts
  var l3_exports = {};
  __export(l3_exports, {
    Asset: () => Asset,
    Component: () => Component,
    Css: () => Css,
    DesignSystemIO: () => DesignSystemIO,
    Doc: () => Doc,
    Example: () => Example,
    Style: () => Style,
    Token: () => Token,
    getOrCreateDSInstanceIO: () => getOrCreateDSInstanceIO,
    init: () => init4,
    nodeScriptReplace: () => nodeScriptReplace
  });
  var init4 = /* @__PURE__ */ __name((mode) => __async(null, null, function* () {
  }), "init");
  var nodeNeedReplace = /* @__PURE__ */ __name((node) => {
    if (node.classList && node.classList.contains("noScriptReplace")) return false;
    return node.tagName === "SCRIPT";
  }, "nodeNeedReplace");
  var nodeReplaceClone = /* @__PURE__ */ __name((node) => {
    if (node.tagName === "SCRIPT") {
      let script = document.createElement("script");
      script.text = node.innerHTML;
      for (let i = node.attributes.length - 1; i >= 0; i--) {
        script.setAttribute(node.attributes[i].name, node.attributes[i].value);
      }
      return script;
    }
    if (node.tagName === "LINK") {
      let link = document.createElement("link");
      for (let i = node.attributes.length - 1; i >= 0; i--) {
        link.setAttribute(node.attributes[i].name, node.attributes[i].value);
      }
      return link;
    }
    return node;
  }, "nodeReplaceClone");
  var nodeScriptReplace = /* @__PURE__ */ __name((node) => {
    if (node.parentNode && nodeNeedReplace(node) === true) {
      node.parentNode.replaceChild(nodeReplaceClone(node), node);
    } else {
      let i = 0;
      let children = node.childNodes;
      while (i < children.length) {
        nodeScriptReplace(children[i++]);
      }
    }
    return node;
  }, "nodeScriptReplace");
  var _Doc = class _Doc {
    constructor(ds) {
      __publicField(this, "_ds");
      this._ds = ds;
    }
  };
  __name(_Doc, "Doc");
  var Doc = _Doc;
  var _Token = class _Token {
    constructor(ds) {
      __publicField(this, "_ds");
      this._ds = ds;
    }
  };
  __name(_Token, "Token");
  var Token = _Token;
  var _Asset = class _Asset {
    constructor(ds) {
      __publicField(this, "_ds");
      this._ds = ds;
    }
  };
  __name(_Asset, "Asset");
  var Asset = _Asset;
  var _Css = class _Css {
    constructor(ds) {
      __publicField(this, "_ds");
      this._ds = ds;
    }
  };
  __name(_Css, "Css");
  var Css = _Css;
  var _Component = class _Component {
    constructor(ds) {
      __publicField(this, "_ds");
      this._ds = ds;
    }
  };
  __name(_Component, "Component");
  var Component = _Component;
  var _Example = class _Example {
    constructor(ds) {
      __publicField(this, "_ds");
      __publicField(this, "list", {});
      this._ds = ds;
    }
  };
  __name(_Example, "Example");
  var Example = _Example;
  var _Style = class _Style {
    constructor(ds) {
      __publicField(this, "_ds");
      this._ds = ds;
    }
  };
  __name(_Style, "Style");
  var Style = _Style;
  var _DesignSystemIO = class _DesignSystemIO {
    constructor(project, dsindex) {
      __publicField(this, "project");
      __publicField(this, "dsindex");
      this.project = project;
      this.dsindex = dsindex;
    }
  };
  __name(_DesignSystemIO, "DesignSystemIO");
  var DesignSystemIO = _DesignSystemIO;
  var instanceCache = {};
  var getKeyDs = /* @__PURE__ */ __name((project, dsindex) => {
    const key = `_${project}_${dsindex}`;
    return key;
  }, "getKeyDs");
  var getOrCreateDSInstanceIO = /* @__PURE__ */ __name((project, dsindex, widgetIOName) => {
    const dskey = getKeyDs(project, dsindex);
    if (!instanceCache[dskey]) {
      const instance = new window.l2_html[widgetIOName](project, dsindex);
      instanceCache[dskey] = instance;
    }
    return instanceCache[dskey];
  }, "getOrCreateDSInstanceIO");

  // src/l4/l4.ts
  var l4_exports = {};
  __export(l4_exports, {
    convertPathToClassName: () => convertPathToClassName,
    htmls: () => htmls,
    init: () => init5,
    scripts: () => scripts,
    styles: () => styles,
    stylesRootSelectors: () => stylesRootSelectors
  });
  var init5 = /* @__PURE__ */ __name((mode) => __async(null, null, function* () {
  }), "init");
  var htmls = { 1: [1] };
  var scripts = {
    BaseRoot: ""
  };
  var styles = {};
  var stylesRootSelectors = {};
  var convertPathToClassName = /* @__PURE__ */ __name((key) => {
    const i1 = key.indexOf("/");
    if (i1 < 1) {
      return key;
    } else {
      return `_${key.replace("/", "_")}`;
    }
  }, "convertPathToClassName");

  // src/l5/l5.ts
  var l5_exports = {};
  __export(l5_exports, {
    actualOrg: () => actualOrg,
    getBaseProject: () => getBaseProject,
    getOrgsName: () => getOrgsName,
    getProjectConf: () => getProjectConf,
    getProjectDependencies: () => getProjectDependencies,
    getProjectDetails: () => getProjectDetails,
    getProjectOrgIndex: () => getProjectOrgIndex,
    getProjectSettings: () => getProjectSettings,
    getProjectsInOrg: () => getProjectsInOrg,
    init: () => init6,
    setActualOrg: () => setActualOrg,
    setProjectSettings: () => setProjectSettings,
    updateProjectConf: () => updateProjectConf
  });
  var init6 = /* @__PURE__ */ __name((mode) => __async(null, null, function* () {
  }), "init");
  var actualOrg;
  var setActualOrg = /* @__PURE__ */ __name((org) => {
    actualOrg = org;
  }, "setActualOrg");
  var getProjectOrgIndex = /* @__PURE__ */ __name((prjID) => {
    return mls_exports.l5_common.getProjectOrganizationIndex(mls_exports.stor.orgs, prjID);
  }, "getProjectOrgIndex");
  var getProjectDetails = /* @__PURE__ */ __name((prjID) => {
    return mls_exports.l5_common.getProjectDetails(mls_exports.stor.orgs, prjID);
  }, "getProjectDetails");
  var getProjectSettings = /* @__PURE__ */ __name((prjID) => {
    return mls_exports.l5_common.getProjectSettings(mls_exports.stor.orgs, prjID);
  }, "getProjectSettings");
  var setProjectSettings = /* @__PURE__ */ __name((prjID, settings) => {
    mls_exports.l5_common.setProjectSettings(mls_exports.stor.orgs, prjID, settings);
  }, "setProjectSettings");
  var getBaseProject = /* @__PURE__ */ __name((prjID) => {
    var _a2;
    const deps = (_a2 = mls_exports.l5.getProjectDetails(prjID)) == null ? void 0 : _a2.prj_dependencies;
    if (deps && deps[0]) return deps[0];
    return 0;
  }, "getBaseProject");
  var getProjectDependencies = /* @__PURE__ */ __name((prjID, addParentPrj) => {
    const detPrj = mls_exports.l5.getProjectDetails(prjID);
    let dep = (detPrj == null ? void 0 : detPrj.prj_dependencies) ? [...detPrj.prj_dependencies] : [];
    if (!dep) dep = [];
    if (addParentPrj) dep.push(prjID);
    return dep;
  }, "getProjectDependencies");
  var getOrgsName = /* @__PURE__ */ __name(() => {
    return mls_exports.l5_common.getOrgsName(mls_exports.stor.orgs);
  }, "getOrgsName");
  var getProjectsInOrg = /* @__PURE__ */ __name((orgIndex) => {
    return mls_exports.l5_common.getProjectsInOrg(mls_exports.stor.orgs, orgIndex);
  }, "getProjectsInOrg");
  function getProjectConf(projectID) {
    return __async(this, null, function* () {
      if (!projectID) throw new Error("Invalid project");
      const keyToFile = mls_exports.stor.getKeyToFile({ project: projectID, level: 5, shortName: mls_exports.l5_common.FILENAMEPROJECTCONFIG, folder: "", extension: ".json" });
      const file = mls_exports.stor.files[keyToFile];
      if (!file) throw new Error("No file project config");
      const src = yield file.getContent();
      if (src === null || src === void 0) throw new Error("Invalid value of config");
      if (typeof src !== "string") throw new Error("Config file must be string");
      try {
        const config = JSON.parse(src);
        return config;
      } catch (error) {
        throw new Error(`Error parsing config JSON: ${error.message}`);
      }
    });
  }
  __name(getProjectConf, "getProjectConf");
  function updateProjectConf(projectID, config) {
    return __async(this, null, function* () {
      if (!projectID) throw new Error("Invalid project");
      const keyToFile = mls_exports.stor.getKeyToFile({ project: projectID, level: 5, shortName: mls_exports.l5_common.FILENAMEPROJECTCONFIG, folder: "", extension: ".json" });
      const file = mls_exports.stor.files[keyToFile];
      if (!file) throw new Error("No file project config");
      yield mls_exports.stor.localStor.setContent(file, {
        contentType: "string",
        content: JSON.stringify(config, null, 2)
      });
    });
  }
  __name(updateProjectConf, "updateProjectConf");

  // src/l6/l6.ts
  var l6_exports = {};
  __export(l6_exports, {
    init: () => init7
  });
  var init7 = /* @__PURE__ */ __name((mode) => __async(null, null, function* () {
  }), "init");

  // src/l7/l7.ts
  var l7_exports = {};
  __export(l7_exports, {
    init: () => init8
  });
  var init8 = /* @__PURE__ */ __name((mode) => __async(null, null, function* () {
  }), "init");

  // src/defs/defs.ts
  var defs_exports = {};

  // src/stor/stor.ts
  var stor_exports = {};
  __export(stor_exports, {
    LOCALPROJECTNUMBER: () => LOCALPROJECTNUMBER,
    addOrUpdateFile: () => addOrUpdateFile,
    cache: () => stor_cache_exports,
    convertFileReferenceToFile: () => convertFileReferenceToFile,
    convertFileToFileReference: () => convertFileToFileReference,
    files: () => files,
    findFilesNeedingDefsUpdate: () => findFilesNeedingDefsUpdate,
    getFileStorFromJson: () => getFileStorFromJson,
    getFiles: () => getFiles,
    getFilesContent: () => getFilesContent,
    getKeyToFile: () => getKeyToFile2,
    getKeyToFiles: () => getKeyToFiles,
    getPathToFile: () => getPathToFile,
    getProjectDependencies: () => getProjectDependencies2,
    getShortPath: () => getShortPath,
    html: () => stor_html_exports,
    isProjectLoaded: () => isProjectLoaded,
    loadProjectdependenciesInfoIfNeed: () => loadProjectdependenciesInfoIfNeed,
    localDB: () => stor_localDB_exports,
    localStor: () => stor_localStor_exports,
    orgs: () => orgs,
    others: () => stor_others_exports,
    projects: () => projects,
    removeProjectInfo: () => removeProjectInfo2,
    renameFile: () => renameFile,
    server: () => stor_server_exports,
    setContents: () => setContents4,
    updateOrgs: () => updateOrgs
  });

  // src/stor/stor.localStor.ts
  var stor_localStor_exports = {};
  __export(stor_localStor_exports, {
    getContent: () => getContent,
    getContentFile: () => getContentFile,
    getProjectDetails: () => getProjectDetails2,
    listFilesInDevelopment: () => listFilesInDevelopment,
    listFilesProjectLocal: () => listFilesProjectLocal,
    setContent: () => setContent,
    setContents: () => setContents,
    setProjectDetails: () => setProjectDetails
  });
  var getContent = /* @__PURE__ */ __name((fileInfo) => __async(null, null, function* () {
    if (!fileInfo.inLocalStorage) return null;
    const { project, level, shortName, folder, extension } = fileInfo;
    return getContentFile(project, level, shortName, folder, extension);
  }), "getContent");
  var getContentFile = /* @__PURE__ */ __name((project, level, shortName, folder, extension) => __async(null, null, function* () {
    const fileDB = yield mls_exports.stor.localDB.readFile({ project, level, shortName, folder, extension }).catch(() => null);
    if (fileDB && fileDB.info) return fileDB.info.content;
    else return null;
  }), "getContentFile");
  var setContent = /* @__PURE__ */ __name((fileInfo, info) => __async(null, null, function* () {
    fileInfo.inLocalStorage = Boolean(info.content);
    if (info.content) yield mls_exports.stor.localDB.saveFile(fileInfo, info);
    else yield mls_exports.stor.localDB.removeItem(fileInfo);
    return true;
  }), "setContent");
  var setContents = /* @__PURE__ */ __name((project, fileInfos) => __async(null, null, function* () {
    if (!fileInfos || fileInfos.length < 1) return false;
    let rc = true;
    try {
      for (var iter = __forAwait(fileInfos), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
        const fileInfo = temp.value;
        const info = fileInfo.getValueInfo ? yield fileInfo.getValueInfo() : { content: null };
        if ((yield setContent(fileInfo, info)) === false) rc = false;
      }
    } catch (temp) {
      error = [temp];
    } finally {
      try {
        more && (temp = iter.return) && (yield temp.call(iter));
      } finally {
        if (error)
          throw error[0];
      }
    }
    return rc;
  }), "setContents");
  var listFilesProjectLocal = /* @__PURE__ */ __name((projectSearch) => __async(null, null, function* () {
    if (projectSearch !== 0 && projectSearch !== mls_exports.stor.LOCALPROJECTNUMBER) throw new Error("projectSearch must be local Project");
    const rc = [];
    const keys = yield mls_exports.stor.localDB.getKeysWithPrefix(mls_exports.stor.localDB.getPrefixToLocalStorage());
    try {
      for (var iter = __forAwait(keys), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
        const [i, key] = temp.value;
        const parseKey = yield mls_exports.stor.localDB.getInfoFromLocalStorage(key);
        if (!parseKey) continue;
        const { project, level, shortName, folder, extension } = parseKey.fileInfo;
        if (project !== projectSearch) continue;
        const dbContent = yield getContentFile(project, level, shortName, folder, extension);
        rc.push({
          shortPath: mls_exports.stor.getShortPath({ level, shortName, extension, folder }),
          versionRef: (/* @__PURE__ */ new Date()).toUTCString(),
          Length: dbContent ? dbContent.length : 0
        });
      }
    } catch (temp) {
      error = [temp];
    } finally {
      try {
        more && (temp = iter.return) && (yield temp.call(iter));
      } finally {
        if (error)
          throw error[0];
      }
    }
    return rc;
  }), "listFilesProjectLocal");
  var listFilesInDevelopment = /* @__PURE__ */ __name((projectSearch, onlyExtension = "") => __async(null, null, function* () {
    const rc = [];
    const keys = yield mls_exports.stor.localDB.getKeysWithPrefix(mls_exports.stor.localDB.getPrefixToLocalStorage()).catch(() => []);
    for (const key of keys) {
      const { level, project, shortName, folder, extension } = mls_exports.stor.localDB.parseKeyToFile(key);
      if (project !== projectSearch) continue;
      if (onlyExtension && extension !== onlyExtension) continue;
      if (folder) {
        rc.push(`l${level}/${folder}/${shortName}`);
      } else {
        rc.push(`l${level}/${shortName}`);
      }
    }
    return rc;
  }), "listFilesInDevelopment");
  var getProjectDetails2 = /* @__PURE__ */ __name(() => {
    const str = localStorage.getItem("projectDetails");
    if (str) {
      try {
        return JSON.parse(str);
      } catch (err2) {
        return { project: 0 };
      }
    }
    return { project: 0 };
  }, "getProjectDetails");
  var setProjectDetails = /* @__PURE__ */ __name((projectDetails) => {
    localStorage.setItem("projectDetails", JSON.stringify(projectDetails));
  }, "setProjectDetails");

  // src/stor/stor.localDB.ts
  var stor_localDB_exports = {};
  __export(stor_localDB_exports, {
    clearAllItems: () => clearAllItems,
    existFile: () => existFile,
    exists: () => exists,
    getAllKeys: () => getAllKeys,
    getAllProjects: () => getAllProjects,
    getContentInfoOrNull: () => getContentInfoOrNull,
    getInfoFromLocalStorage: () => getInfoFromLocalStorage,
    getKeyToPrj: () => getKeyToPrj,
    getKeyToTask: () => getKeyToTask,
    getKeysWithPrefix: () => getKeysWithPrefix,
    getPrefixTasks: () => getPrefixTasks,
    getPrefixToLocalStorage: () => getPrefixToLocalStorage,
    getPrefixToLocalStorageWithProject: () => getPrefixToLocalStorageWithProject,
    getProjectsLastModified: () => getProjectsLastModified,
    parseKeyToFile: () => parseKeyToFile,
    parseKeyToProject: () => parseKeyToProject,
    readFile: () => readFile,
    readPrjInfo: () => readPrjInfo,
    removeItem: () => removeItem,
    removeKey: () => removeKey,
    removePrjInfo: () => removePrjInfo,
    saveFile: () => saveFile,
    savePrjInfo: () => savePrjInfo
  });
  var filePrefix = "File_";
  var PrjPrefix = "Prj_";
  var TaskPrefix = "Task_";
  var getKeyToFile = /* @__PURE__ */ __name((project, level, shortName, folder, extension) => {
    if (folder) return `${filePrefix}${project}_${level}_${folder.replace(/\//g, "_")}_${shortName}_${extension}`;
    return `${filePrefix}${project}_${level}_${shortName}_${extension}`;
  }, "getKeyToFile");
  var parseKeyToFile = /* @__PURE__ */ __name((key) => {
    if (!key.startsWith(filePrefix)) return { project: 0, level: 0, shortName: "", folder: "", extension: "" };
    key = key.substring(filePrefix.length);
    const ar = key.split("_");
    const folder = ar.length > 4 ? ar.slice(2, -2).join("/") : "";
    const shortName = ar[ar.length - 2];
    const extension = ar[ar.length - 1];
    const [project, level] = ar;
    return { project: Number(project), level: Number(level), shortName, folder, extension };
  }, "parseKeyToFile");
  var parseKeyToProject = /* @__PURE__ */ __name((key) => {
    if (!key.startsWith(PrjPrefix)) return 0;
    key = key.substring(PrjPrefix.length);
    const project = Number(key);
    return project < 1 ? 0 : project;
  }, "parseKeyToProject");
  var getKeyToPrj = /* @__PURE__ */ __name((project) => {
    return `${PrjPrefix}${project}`;
  }, "getKeyToPrj");
  var getKeyToTask = /* @__PURE__ */ __name((project, task) => {
    return `${TaskPrefix}${project}_${task}`;
  }, "getKeyToTask");
  var getPrefixTasks = /* @__PURE__ */ __name((project) => {
    return `${TaskPrefix}${project}_`;
  }, "getPrefixTasks");
  var getPrefixToLocalStorageWithProject = /* @__PURE__ */ __name((project) => {
    return `${filePrefix}${project}_`;
  }, "getPrefixToLocalStorageWithProject");
  var getPrefixToLocalStorage = /* @__PURE__ */ __name(() => {
    return filePrefix;
  }, "getPrefixToLocalStorage");
  var getInfoFromLocalStorage = /* @__PURE__ */ __name((key) => __async(null, null, function* () {
    if (!key.startsWith(filePrefix)) return null;
    key = key.substring(filePrefix.length);
    const ar = key.split("_");
    const folder = ar.length > 4 ? ar.slice(2, -2).join("/") : "";
    const shortName = ar[ar.length - 2];
    const extension = ar[ar.length - 1];
    const [project, level] = ar;
    const result = yield readFile({ project: Number(project), level: Number(level), shortName, folder, extension }).catch(() => null);
    return result;
  }), "getInfoFromLocalStorage");
  var dbName = "mlsDB";
  var tbName = "tempObjects";
  var version = 1;
  var openDatabase = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore(tbName, { keyPath: "key" });
      };
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }), "openDatabase");
  var saveObject = /* @__PURE__ */ __name((object) => __async(null, null, function* () {
    const db = yield openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName, "readwrite");
      const objectStore = transaction.objectStore(tbName);
      const request = objectStore.put(object);
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = (event) => {
        reject(event.target.error);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }), "saveObject");
  var saveFile = /* @__PURE__ */ __name((fileInfo, info) => __async(null, null, function* () {
    const { project, level, shortName, folder, extension, versionRef, isLocalVersionOutdated, status, inLocalStorage, hasError, updatedAt } = fileInfo;
    if (!info.content) throw new Error("No content to save in IndexedDB");
    const key = getKeyToFile(project, level, shortName, folder, extension);
    const obj = {
      key,
      fileInfo: { project, level, shortName, folder, extension, versionRef, isLocalVersionOutdated, status, inLocalStorage, hasError, updatedAt, projectDependencies: null },
      info
    };
    return saveObject(obj);
  }), "saveFile");
  var savePrjInfo = /* @__PURE__ */ __name((project, info, baseProject_lastModified) => __async(null, null, function* () {
    var _a2;
    if (project < 1) throw new Error("Invalid project information to save in IndexedDB, invalid project number");
    if (isNaN(new Date(baseProject_lastModified).getTime())) {
      throw new Error(`Invalid project information to save in IndexedDB, invalid last modified date:${baseProject_lastModified}`);
    }
    if (!info || !info.filesInfo || info.filesInfo.length < 1) {
      throw new Error(`Invalid project information to save in IndexedDB, file length:${(_a2 = info == null ? void 0 : info.filesInfo) == null ? void 0 : _a2.length}`);
    }
    const key = getKeyToPrj(project);
    const obj = {
      key,
      project,
      fileInfo: info.filesInfo,
      importsMap: info.importsMap,
      indexModules: info.indexModules,
      repository_lastModified: baseProject_lastModified
    };
    return saveObject(obj);
  }), "savePrjInfo");
  var removePrjInfo = /* @__PURE__ */ __name((project) => __async(null, null, function* () {
    return removeKey(getKeyToPrj(project));
  }), "removePrjInfo");
  var readObject = /* @__PURE__ */ __name((key) => __async(null, null, function* () {
    const db = yield openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName, "readonly");
      const objectStore = transaction.objectStore(tbName);
      const request = objectStore.get(key);
      request.onsuccess = (event) => {
        const file = event.target.result;
        if (!file) return reject(new Error(`Object not found in IndexedDB, key: ${key} event:${JSON.stringify(event)}`));
        if (!file.info) file.info = { content: null };
        resolve(file);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }), "readObject");
  var readFile = /* @__PURE__ */ __name((_0) => __async(null, [_0], function* ({ project, level, shortName, extension, folder }) {
    return readObject(getKeyToFile(project, level, shortName, folder, extension));
  }), "readFile");
  var readPrjInfo = /* @__PURE__ */ __name((project) => __async(null, null, function* () {
    const rc = yield readObject(getKeyToPrj(project));
    if (rc.fileInfo) return rc;
    throw new Error("Project info not found in IndexedDB");
  }), "readPrjInfo");
  function getContentInfoOrNull() {
    return __async(this, null, function* () {
      if (!this.inLocalStorage) return { content: null };
      const file = yield readFile({
        project: this.project,
        level: this.level,
        shortName: this.shortName,
        extension: this.extension,
        folder: this.folder
      });
      return file.info;
    });
  }
  __name(getContentInfoOrNull, "getContentInfoOrNull");
  var removeItem = /* @__PURE__ */ __name((fileInfo) => __async(null, null, function* () {
    const { project, level, shortName, folder, extension } = fileInfo;
    const key = getKeyToFile(project, level, shortName, folder, extension);
    return removeKey(key);
  }), "removeItem");
  var removeKey = /* @__PURE__ */ __name((key) => __async(null, null, function* () {
    const db = yield openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName, "readwrite");
      const objectStore = transaction.objectStore(tbName);
      const request = objectStore.delete(key);
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = (event) => {
        reject(event.target.error);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }), "removeKey");
  var clearAllItems = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const db = yield openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName, "readwrite");
      const objectStore = transaction.objectStore(tbName);
      const request = objectStore.clear();
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = (event) => {
        reject(event.target.error);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }), "clearAllItems");
  var getKeysWithPrefix = /* @__PURE__ */ __name((prefix) => __async(null, null, function* () {
    const db = yield openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName, "readonly");
      const objectStore = transaction.objectStore(tbName);
      const request = objectStore.openCursor();
      const keys = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.key.toString().startsWith(prefix)) {
            keys.push(cursor.key.toString());
          }
          cursor.continue();
        } else {
          resolve(keys);
        }
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }), "getKeysWithPrefix");
  var getAllKeys = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const db = yield openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName, "readonly");
      const objectStore = transaction.objectStore(tbName);
      const request = objectStore.getAllKeys();
      const keys = [];
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }), "getAllKeys");
  var getAllProjects = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const keys = yield getKeysWithPrefix(filePrefix);
    const projects2 = [];
    keys.forEach((key) => {
      const { project } = parseKeyToFile(key);
      if (!projects2.includes(project)) projects2.push(project);
    });
    return projects2;
  }), "getAllProjects");
  var getProjectsLastModified = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const db = yield openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName, "readonly");
      const objectStore = transaction.objectStore(tbName);
      const request = objectStore.openCursor();
      const projects2 = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const key = cursor.key.toString();
          if (key.startsWith(PrjPrefix)) {
            const project = parseKeyToProject(key);
            const repository_lastModified = cursor.value.repository_lastModified || "";
            if (project && repository_lastModified) {
              projects2.push({ project, lastModified: repository_lastModified });
            }
          }
          cursor.continue();
        } else {
          resolve(projects2);
        }
      };
      request.onerror = (event) => {
        console.error("Error retrieving projects last modified:", event.target.error);
        resolve([]);
      };
    });
  }), "getProjectsLastModified");
  var exists = /* @__PURE__ */ __name((key) => __async(null, null, function* () {
    const db = yield openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName, "readonly");
      const objectStore = transaction.objectStore(tbName);
      const request = objectStore.getKey(key);
      request.onsuccess = (event) => {
        resolve(event.target.result !== void 0);
      };
      request.onerror = (event) => {
        resolve(false);
      };
    });
  }), "exists");
  var existFile = /* @__PURE__ */ __name((_0) => __async(null, [_0], function* ({ project, level, shortName, extension, folder }) {
    return exists(getKeyToFile(project, level, shortName, folder, extension));
  }), "existFile");

  // src/stor/stor.server.ts
  var stor_server_exports = {};
  __export(stor_server_exports, {
    findDriverAndGetContent: () => findDriverAndGetContent,
    findDriverAndGetHistory: () => findDriverAndGetHistory,
    findDriverAndGetHistoryContent: () => findDriverAndGetHistoryContent,
    findDriverAndSetContents: () => findDriverAndSetContents,
    getAllRenomedFiles: () => getAllRenomedFiles,
    getContent: () => getContent2,
    loadProjectInfoIfNeeded: () => loadProjectInfoIfNeeded,
    rename: () => rename,
    unzipSourcesIfNeeded: () => unzipSourcesIfNeeded,
    updateProjectFilesInfo: () => updateProjectFilesInfo
  });
  var getContent2 = /* @__PURE__ */ __name((fileInfo) => __async(null, null, function* () {
    return new Promise((resolve, reject) => {
      var _a2;
      const { project, level, shortName } = fileInfo;
      if (!fileInfo || !projects[project] || ((_a2 = projects[project]) == null ? void 0 : _a2.projectDriver) !== "mls") return {};
      throw new Error(`Level ${level} not supported`);
    });
  }), "getContent");
  var setContent2 = /* @__PURE__ */ __name((fileInfo, info) => {
    return new Promise((resolve, reject) => {
      var _a2;
      const { project, level, shortName, folder, extension } = fileInfo;
      const keyF = getKeyToFile2({ project, level, shortName, folder, extension });
      if (!files[keyF]) return resolve(false);
      if (!projects[project] || ((_a2 = projects[project]) == null ? void 0 : _a2.projectDriver) !== "mls") return resolve(false);
      if (files[keyF].inLocalStorage) {
        stor_localStor_exports.setContent(fileInfo, info);
        files[keyF].inLocalStorage = false;
      }
      return resolve(true);
    });
  }, "setContent");
  var rename = /* @__PURE__ */ __name((fileInfo, newName) => __async(null, null, function* () {
    return new Promise((resolve, reject) => {
      resolve(false);
    });
  }), "rename");
  var loadProjectInfoIfNeeded = /* @__PURE__ */ __name((project, forceUpdate = false) => __async(null, null, function* () {
    var _a2;
    if (project < 1e5) console.error(`Error on loadProjectInfoIfNeeded, project invalid:${project}`);
    if (!forceUpdate && projects[project]) return false;
    projects[project] = null;
    yield loadLocalProject0IfNeed(0);
    yield loadLocalProject0IfNeed(mls_exports.stor.LOCALPROJECTNUMBER);
    if (!Number.isInteger(project) || project < 1) throw new Error("loadProjectInfoIfNeeded, project must be a positive integer");
    const driverName = (_a2 = mls_exports.l5.getProjectSettings(project)) == null ? void 0 : _a2.projectDriver;
    if (driverName && driverName === "local") throw new Error("loadProjectInfoIfNeeded, driver local not supported");
    if (driverName && driverName !== "mls") {
      yield loadOtherProjectInfoIfNeeded(project, driverName);
      return true;
    } else throw new Error(`loadProjectInfoIfNeeded, driver not supported: ${driverName}`);
  }), "loadProjectInfoIfNeeded");
  var loadOtherProjectInfoIfNeeded = /* @__PURE__ */ __name((project, driverName) => __async(null, null, function* () {
    var _a2, _b2;
    if (mls_exports.istrace) console.time("loadOtherProjectInfoIfNeeded");
    let filesInfo;
    {
      const prjInfo = yield mls_exports.stor.localDB.readPrjInfo(project).catch((err2) => {
        return void 0;
      });
      if (prjInfo) {
        filesInfo = prjInfo.fileInfo;
      } else {
        filesInfo = yield loadOtherProjectInfoFromDriver(project, driverName);
        const lastModified = ((_a2 = mls_exports.l5.getProjectDetails(project)) == null ? void 0 : _a2.repository_lastModified) || "";
        yield mls_exports.stor.localDB.savePrjInfo(project, { filesInfo, importsMap: "", indexModules: "" }, lastModified);
      }
    }
    yield mergeLocalFilesOnly(project, filesInfo);
    yield addOrUpdateStorFiles(project, filesInfo);
    const projectURL = ((_b2 = mls_exports.l5.getProjectSettings(project)) == null ? void 0 : _b2.projectURL) || "";
    projects[project] = {
      project,
      projectDriver: driverName,
      projectURL,
      projectDependencies: null
    };
    if (mls_exports.istrace) console.timeEnd("loadOtherProjectInfoIfNeeded");
  }), "loadOtherProjectInfoIfNeeded");
  var loadOtherProjectInfoFromDriver = /* @__PURE__ */ __name((project, driverName) => __async(null, null, function* () {
    const driver = mls_exports.stor.others.getDefaultDriver(project);
    return driver.loadFilesInfo(project).catch((err2) => {
      throw err2;
    });
  }), "loadOtherProjectInfoFromDriver");
  var loadLocalProject0IfNeed = /* @__PURE__ */ __name((project) => __async(null, null, function* () {
    if (projects[project]) return;
    yield addOrUpdateStorFiles(project, yield mls_exports.stor.localStor.listFilesProjectLocal(project));
    if (projects[project]) return;
    const projectDriver = "local";
    const projectURL = "";
    projects[project] = {
      project,
      projectDriver,
      projectURL,
      projectDependencies: null
    };
  }), "loadLocalProject0IfNeed");
  var addOrUpdateStorFiles = /* @__PURE__ */ __name((project, data) => __async(null, null, function* () {
    if (!Array.isArray(data)) throw new Error("loadFiles, data must be an array");
    yield mergeLocalFilesOnly(project, data);
    if (data.length === 0) return;
    const renamedFiles = yield getAllRenomedFiles(project);
    try {
      for (var iter = __forAwait(data.entries()), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
        const [i, item] = temp.value;
        if (renamedFiles.includes(item.shortPath)) continue;
        const ar = item.shortPath.split("/");
        if (ar.length < 2) throw new Error(`loadProjectInfoIfNeeded, invalid path: ${item.shortPath}`);
        const level = Number(ar[0].substring(1));
        const folder = ar.length > 2 ? ar.slice(1, -1).join("/") : "";
        const fn = ar[ar.length - 1];
        const dotIndex = fn.indexOf(".");
        if (dotIndex < 0) throw new Error(`loadProjectInfoIfNeeded, invalid path: ${item.shortPath}`);
        const shortName = fn.slice(0, dotIndex);
        const extension = fn.slice(dotIndex);
        const versionRef = item.versionRef;
        const updatedAt = item.update_at;
        yield mls_exports.stor.addOrUpdateFile({ project, level, shortName, extension, versionRef, folder, updatedAt });
      }
    } catch (temp) {
      error = [temp];
    } finally {
      try {
        more && (temp = iter.return) && (yield temp.call(iter));
      } finally {
        if (error)
          throw error[0];
      }
    }
  }), "addOrUpdateStorFiles");
  var getAllRenomedFiles = /* @__PURE__ */ __name((project) => __async(null, null, function* () {
    const rc = [];
    const keys = Object.keys(mls_exports.stor.files);
    try {
      for (var iter = __forAwait(keys), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
        const key = temp.value;
        const file = mls_exports.stor.files[key];
        if (!file.inLocalStorage || file.status !== "renamed" || file.project !== project) continue;
        const info = file.getValueInfo ? yield file.getValueInfo() : null;
        if (!info || info.originalProject !== project) continue;
        const shortPath = mls_exports.stor.getShortPath({ level: file.level, shortName: info.originalShortName || "", extension: file.extension, folder: file.folder });
        rc.push(shortPath);
      }
    } catch (temp) {
      error = [temp];
    } finally {
      try {
        more && (temp = iter.return) && (yield temp.call(iter));
      } finally {
        if (error)
          throw error[0];
      }
    }
    return rc;
  }), "getAllRenomedFiles");
  var mergeLocalFilesOnly = /* @__PURE__ */ __name((projectSearch, data) => __async(null, null, function* () {
    const prefix = mls_exports.stor.localDB.getPrefixToLocalStorageWithProject(projectSearch);
    const data2 = yield mls_exports.stor.localDB.getKeysWithPrefix(prefix);
    if (!data2 || data2.length < 1) return;
    try {
      for (var iter = __forAwait(data2), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
        const keyDB = temp.value;
        const info = yield mls_exports.stor.localDB.getInfoFromLocalStorage(keyDB);
        if (!info || !info.fileInfo.level) continue;
        let { project, level, shortName, folder, extension, versionRef, updatedAt } = info.fileInfo;
        let exists2 = false;
        for (const item of data) {
          const ar = item.shortPath.split("/");
          if (ar.length < 2) throw new Error(`loadProjectInfoIfNeeded, invalid path: ${item.shortPath}`);
          const level2 = Number(ar[0].substring(1));
          const folder2 = ar.length > 2 ? ar.slice(1, -1).join("/") : "";
          const fn = ar[ar.length - 1];
          const dotIndex = fn.indexOf(".");
          if (dotIndex < 0) throw new Error(`loadProjectInfoIfNeeded, invalid path: ${item.shortPath}`);
          const shortName2 = fn.slice(0, dotIndex);
          const extension2 = fn.slice(dotIndex);
          exists2 = project === projectSearch && level === level2 && shortName === shortName2 && extension === extension2 && folder === folder2;
          if (exists2) {
            versionRef = item.versionRef;
            item.update_at = updatedAt;
            break;
          }
        }
        if (exists2) continue;
        const shortPath = folder ? `l${level}/${folder}/${shortName}${extension}` : `l${level}/${shortName}${extension}`;
        data.push({ shortPath, versionRef, update_at: updatedAt, Length: 0 });
      }
    } catch (temp) {
      error = [temp];
    } finally {
      try {
        more && (temp = iter.return) && (yield temp.call(iter));
      } finally {
        if (error)
          throw error[0];
      }
    }
  }), "mergeLocalFilesOnly");
  var adjustVersionRefAfterPostCompile = /* @__PURE__ */ __name((dataServer) => {
    const mapLess = {};
    dataServer.filesInfo.forEach((item) => {
      if (!item.shortPath.endsWith(".less")) return;
      const shortPathWithoutExt = item.shortPath.replace(".less", "");
      mapLess[shortPathWithoutExt] = item.update_at || "";
    });
    dataServer.filesInfo.forEach((item) => {
      if (!item.shortPath.endsWith(".ts") || item.shortPath.endsWith(".d.ts") || item.shortPath.endsWith(".test.ts") || item.shortPath.endsWith(".defs.ts")) return;
      const shortPathWithoutExt = item.shortPath.replace(".ts", "");
      if (mapLess[shortPathWithoutExt] && mapLess[shortPathWithoutExt] > (item.update_at || "")) {
        item.versionRef = mapLess[shortPathWithoutExt];
      }
    });
    return dataServer;
  }, "adjustVersionRefAfterPostCompile");
  var updateProjectFilesInfo = /* @__PURE__ */ __name((projectSearch, dataServer, lastModified) => __async(null, null, function* () {
    var _a2;
    let dataLocal = [];
    yield mls_exports.stor.localDB.readPrjInfo(projectSearch).catch((err2) => {
      return void 0;
    }).then((prj) => {
      dataLocal = prj ? prj.fileInfo : [];
    });
    const inDevelopment = yield mls_exports.stor.localStor.listFilesInDevelopment(projectSearch, ".ts");
    dataServer = adjustVersionRefAfterPostCompile(dataServer);
    let updatedFiles = 0;
    const adds = { project: projectSearch, folder: [], shortName: [], version: [], content: [], extension: [], contentType: [] };
    for (const item of dataServer.filesInfo) {
      const index = dataLocal.findIndex((f) => f.shortPath === item.shortPath);
      if (index >= 0) {
        if (dataLocal[index].versionRef !== item.versionRef) updatedFiles++;
      }
      if (!item.jsContent) continue;
      if (!item.shortPath) console.error(`updateProjectFilesInfo, item.shortPath is empty`, item);
      const ar = item.shortPath.split("/");
      if (ar.length < 2) throw new Error(`updateProjectFilesInfo, invalid path: ${item.shortPath}`);
      const level = Number(ar[0].substring(1));
      const folder = ar.length > 2 ? ar.slice(1, -1).join("/") : "";
      const shortName = ((_a2 = item.shortPath.split("/").pop()) == null ? void 0 : _a2.split(".")[0]) || "";
      const shortPath = folder ? `l${level}/${folder}/${shortName}` : `l${level}/${shortName}`;
      const inLocalStorage = inDevelopment.includes(shortPath);
      if (!inLocalStorage) {
        adds.folder.push(folder);
        adds.shortName.push(shortName);
        adds.version.push(item.versionRef || item.update_at || "?");
        adds.content.push(item.jsContent);
        const fullExtension = item.shortPath.substring(item.shortPath.indexOf("."));
        let extension = ".js";
        if (fullExtension === ".test.ts") {
          extension = ".test.js";
        } else if (fullExtension === ".defs.ts") {
          extension = ".defs.js";
        }
        adds.extension.push(extension);
        adds.contentType.push("application/javascript");
      }
    }
    if (mls_exports.istrace) console.log(`updateProjectFilesInfo, updatedFiles:${updatedFiles}, js updated in cache: ${adds.shortName.length}`);
    if (adds.shortName.length > 0) {
      const rc = yield mls_exports.stor.cache.addsIfNeed(adds);
      if (rc.toLowerCase().startsWith("error")) {
        return;
      }
    }
    dataServer.filesInfo.forEach((item) => {
      if (item.jsContent) delete item.jsContent;
    });
    if (updatedFiles > 0) console.info(`project ${projectSearch} with ${updatedFiles} files updated, lastModified:${lastModified}`);
    yield mls_exports.stor.localDB.savePrjInfo(projectSearch, dataServer, lastModified).catch((err2) => {
      console.error(`updateProjectFilesInfo, savePrjInfo error:${err2}`);
      console.error(`project ${projectSearch} with ${updatedFiles} files updated, lastModified:${lastModified}`, dataServer);
    });
  }), "updateProjectFilesInfo");
  function findDriverAndGetContent(defaultValue) {
    return __async(this, null, function* () {
      try {
        const projectInfo = projects[this.project];
        if (!projectInfo) throw new Error(`project ${this.project} not found in mls.stor.projects`);
        if (projectInfo.project === 0 || projectInfo.project === mls_exports.stor.LOCALPROJECTNUMBER || this.inLocalStorage || projectInfo.projectDriver === "local") return stor_localStor_exports.getContent(this);
        let cacheContent = yield mls_exports.stor.cache.getContent(this);
        if (cacheContent) return cacheContent;
        if (projectInfo.projectDriver === "mls") {
          cacheContent = yield mls_exports.stor.server.getContent(this);
          mls_exports.stor.cache.setContent(this, cacheContent);
          return cacheContent;
        }
        const ret = yield mls_exports.stor.others.getContents(this.project, [this]);
        if (ret.length !== 1) throw new Error("findDriverAndGetContent, ret.length !== 1");
        cacheContent = ret[0].content;
        mls_exports.stor.cache.setContent(this, cacheContent);
        return cacheContent;
      } catch (err2) {
        if (defaultValue !== void 0) return defaultValue;
        throw err2;
      }
    });
  }
  __name(findDriverAndGetContent, "findDriverAndGetContent");
  function findDriverAndGetHistory() {
    return __async(this, null, function* () {
      const projectInfo = projects[this.project];
      if (!projectInfo) throw new Error(`project ${this.project} not found in mls.stor.projects`);
      if (projectInfo.project === 0 || projectInfo.project === mls_exports.stor.LOCALPROJECTNUMBER || this.status === "new") return null;
      if (projectInfo.projectDriver === "local") {
        return null;
      }
      if (projectInfo.projectDriver === "mls") {
        return null;
      }
      return mls_exports.stor.others.getHistory(this.project, this);
    });
  }
  __name(findDriverAndGetHistory, "findDriverAndGetHistory");
  function findDriverAndGetHistoryContent(ref) {
    return __async(this, null, function* () {
      const projectInfo = projects[this.project];
      if (!projectInfo) throw new Error(`project ${this.project} not found in mls.stor.projects`);
      if (projectInfo.project === 0 || projectInfo.project === mls_exports.stor.LOCALPROJECTNUMBER || this.status === "new") return null;
      if (projectInfo.projectDriver === "local") {
        return null;
      }
      if (projectInfo.projectDriver === "mls") {
        return null;
      }
      return mls_exports.stor.others.getHistoryContent(this.project, this, ref);
    });
  }
  __name(findDriverAndGetHistoryContent, "findDriverAndGetHistoryContent");
  function findDriverAndSetContents(project, fileInfos, comments) {
    return __async(this, null, function* () {
      const projectInfo = projects[project];
      if (!projectInfo) throw new Error(`project ${project} not found`);
      if (project === 0 || project === mls_exports.stor.LOCALPROJECTNUMBER) return mls_exports.stor.localStor.setContents(project, fileInfos);
      if (projectInfo.projectDriver === "mls") return setContents2(project, fileInfos);
      return mls_exports.stor.others.setContents(project, fileInfos, comments);
    });
  }
  __name(findDriverAndSetContents, "findDriverAndSetContents");
  var setContents2 = /* @__PURE__ */ __name((project, fileInfos) => __async(null, null, function* () {
    if (!fileInfos || fileInfos.length < 1) return false;
    return new Promise((resolve, reject) => {
      let rc = true;
      fileInfos.forEach((fileInfo) => __async(null, null, function* () {
        const info = fileInfo.getValueInfo ? yield fileInfo.getValueInfo() : { content: null };
        if ((yield setContent2(fileInfo, info)) === false) rc = false;
        if (rc && fileInfo.versionRef) {
          mls_exports.stor.cache.setContent(fileInfo, info.content);
        }
      }));
      return resolve(rc);
    });
  }), "setContents");
  function unzipSourcesIfNeeded(prj) {
    return __async(this, null, function* () {
      const caches2 = yield mls_exports.stor.cache.getStatesOfCache(prj);
      if (caches2.length === 0) return `Don't need update sources, no cache in project ${prj}`;
      const filesWithOutCache = caches2.filter((c) => c.localCacheState === "MISS" && !c.fileKey.includes("_0_"));
      if (filesWithOutCache.length === 0) return `Don't need update sources, all files is ok with cache in project ${prj}`;
      const key = `${prj}_0_obj_source.zip`;
      const fStor = mls_exports.stor.files[key];
      if (!fStor) {
        console.info("Not found source.zip in this project");
        return "Not found source.zip in this project";
      }
      const b64 = yield fStor.getContent();
      if (!b64 || typeof b64 !== "string") return "Error on getContent source.zip";
      const filesFromSource = yield mls_exports.common.zip.unzipBase64(b64);
      if (filesFromSource.length < 1) return "Error on unzip source.zip, filesFromSource.length < 1";
      try {
        for (var iter = __forAwait(filesWithOutCache), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
          const info = temp.value;
          const stor = mls_exports.stor.files[info.fileKey];
          if (!stor || stor.project !== prj) continue;
          const auxL = stor.level === 0 ? "" : `l${stor.level}/`;
          const name5 = `${auxL}${stor.folder.endsWith("/") ? stor.folder : `${stor.folder}/`}${stor.shortName}${stor.extension}`;
          const file = filesFromSource.filter((i) => i.key === name5);
          if (mls_exports.istrace && file.length !== 1) console.log(`unzipSourcesIfNeeded, shortName:${stor.shortName}, search name=${name5}, found:${file.length}`);
          if (file.length < 1) continue;
          if (file.length > 1) return `Error on unzip source.zip, found ${file.length} files with name ${name5}`;
          yield mls_exports.stor.cache.addIfNeed(
            {
              project: prj,
              folder: stor.folder,
              shortName: stor.shortName,
              version: stor.versionRef,
              content: file[0].value,
              extension: stor.extension,
              contentType: stor.extension.endsWith(".js") ? "application/javascript" : "text/plain"
            }
          );
        }
      } catch (temp) {
        error = [temp];
      } finally {
        try {
          more && (temp = iter.return) && (yield temp.call(iter));
        } finally {
          if (error)
            throw error[0];
        }
      }
      return "";
    });
  }
  __name(unzipSourcesIfNeeded, "unzipSourcesIfNeeded");

  // src/stor/stor.others.ts
  var stor_others_exports = {};
  __export(stor_others_exports, {
    DriverIOBase: () => DriverIOBase,
    addDriver: () => addDriver,
    getContents: () => getContents,
    getDefaultDriver: () => getDefaultDriver,
    getDriver: () => getDriver,
    getDriversInfo: () => getDriversInfo,
    getHistory: () => getHistory,
    getHistoryContent: () => getHistoryContent,
    removeDriver: () => removeDriver,
    setContents: () => setContents3
  });
  var _DriverIOBase = class _DriverIOBase {
  };
  __name(_DriverIOBase, "DriverIOBase");
  var DriverIOBase = _DriverIOBase;
  var drivers = {};
  var getDriver = /* @__PURE__ */ __name((provider) => {
    return drivers[provider];
  }, "getDriver");
  var getDefaultDriver = /* @__PURE__ */ __name((project) => {
    var _a2;
    const driverName = ((_a2 = mls_exports.l5.getProjectSettings(project)) == null ? void 0 : _a2.projectDriver) || "mls";
    let provider;
    if (driverName === "GitHub") provider = "github";
    else if (driverName === "GitLab") provider = "gitlab";
    else throw new Error(`Driver _${project}_${driverName} not found`);
    let driver = getDriver(provider);
    if (!driver) {
      project = mls_exports.l5.getBaseProject(project);
      driver = getDriver(provider);
    }
    if (!driver) throw new Error(`Driver _${project}_${driverName} not found`);
    return driver;
  }, "getDefaultDriver");
  var getDriversInfo = /* @__PURE__ */ __name(() => {
    const list = [];
    const keys = Object.keys(drivers);
    for (const key of keys) {
      const driver = drivers[key];
      list.push({
        project: driver.project,
        shortName: driver.shortName,
        driverVersion: driver.driverVersion
      });
    }
    return list;
  }, "getDriversInfo");
  var addDriver = /* @__PURE__ */ __name((driver, provider) => {
    if (!driver || !driver.shortName || driver.project < 0 || !driver.driverVersion) throw new Error("Invalid driver");
    drivers[provider] = driver;
  }, "addDriver");
  var removeDriver = /* @__PURE__ */ __name((driverName) => {
    delete drivers[driverName];
  }, "removeDriver");
  var getContents = /* @__PURE__ */ __name((project, fileInfos) => __async(null, null, function* () {
    const driver = getDefaultDriver(project);
    return driver.getContents(project, fileInfos);
  }), "getContents");
  var setContents3 = /* @__PURE__ */ __name((project, fileInfos, comments) => __async(null, null, function* () {
    const driver = getDefaultDriver(project);
    const isOk = yield driver.setContents(project, fileInfos, comments);
    if (isOk) {
      fileInfos.forEach((fileInfo) => {
        if (!fileInfo.inLocalStorage) return;
        mls_exports.stor.localStor.setContent(fileInfo, { content: null });
        fileInfo.inLocalStorage = false;
      });
    }
    return isOk;
  }), "setContents");
  var getHistory = /* @__PURE__ */ __name((project, fileInfo) => __async(null, null, function* () {
    const driver = getDefaultDriver(project);
    return driver.getHistory(fileInfo);
  }), "getHistory");
  var getHistoryContent = /* @__PURE__ */ __name((project, fileInfo, ref) => __async(null, null, function* () {
    const driver = getDefaultDriver(project);
    return driver.getHistoryContent(fileInfo, ref);
  }), "getHistoryContent");

  // src/stor/stor.cache.ts
  var stor_cache_exports = {};
  __export(stor_cache_exports, {
    AddMfileIfNeed: () => AddMfileIfNeed,
    addIfNeed: () => addIfNeed,
    addsIfNeed: () => addsIfNeed,
    clearAll: () => clearAll,
    clearObsoleteCache: () => clearObsoleteCache,
    clearProjectsCache: () => clearProjectsCache,
    getContent: () => getContent3,
    getFileFromCache: () => getFileFromCache,
    getStatesOfCache: () => getStatesOfCache,
    getStatistics: () => getStatistics,
    getURL: () => getURL,
    installIfNeeded: () => installIfNeeded,
    sendACK: () => sendACK,
    sendRequestMissed: () => sendRequestMissed,
    serviceWorkerNeedUpdate: () => serviceWorkerNeedUpdate,
    setContent: () => setContent3,
    setTraceServiceWorker: () => setTraceServiceWorker
  });

  // src/stor/stor.serviceWorkerIndex.js
  var dbOrNull = null;
  var dbName2 = "mlsSW";
  var version2 = 4;
  var initDB = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    return new Promise((resolve, reject) => {
      if (dbOrNull) {
        resolve(dbOrNull);
        return;
      }
      const request = indexedDB.open(dbName2, version2);
      request.onblocked = () => console.warn("[IDB] Upgrade blocked");
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch (e) {
            console.log("[IDB] Error closing DB");
          }
        };
        dbOrNull = db;
        if (!db.objectStoreNames.contains("serviceWorker")) {
          db.createObjectStore("serviceWorker", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("tsWorker")) {
          db.createObjectStore("tsWorker", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("notifications")) {
          db.createObjectStore("notifications", { keyPath: "key" });
        }
      };
      request.onsuccess = (event) => {
        const db = event.target.result;
        dbOrNull = db;
        resolve(db);
      };
    });
  }), "initDB");
  var set = /* @__PURE__ */ __name((tbName2, key, value) => __async(null, null, function* () {
    const db = yield initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName2, "readwrite");
      const objectStore = transaction.objectStore(tbName2);
      const request = !value ? objectStore.delete(key) : objectStore.put({ key, value });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      request.onerror = () => reject(request.error);
    });
  }), "set");
  var get = /* @__PURE__ */ __name((tbName2, key) => __async(null, null, function* () {
    const db = yield initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(tbName2, "readonly");
      const objectStore = transaction.objectStore(tbName2);
      const request = objectStore.get(key);
      request.onsuccess = () => {
        var _a2;
        return resolve((_a2 = request.result) == null ? void 0 : _a2.value);
      };
      request.onerror = () => resolve(void 0);
    });
  }), "get");
  var getAll = /* @__PURE__ */ __name((tbName2) => __async(null, null, function* () {
    const db = yield initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(tbName2, "readonly");
      const objectStore = transaction.objectStore(tbName2);
      const request = objectStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  }), "getAll");
  var getLocalCacheKey = /* @__PURE__ */ __name((project, folder, shortName, extension) => {
    return `/local/_${project}_${folder ? `${folder}/` : ""}${shortName}${extension}`;
  }, "getLocalCacheKey");
  var getAllFilesRefInCache = /* @__PURE__ */ __name((project) => __async(null, null, function* () {
    const tbName2 = "serviceWorker";
    const db = yield initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName2, "readonly");
      const objectStore = transaction.objectStore(tbName2);
      const prefix = project ? `/local/_${project}_` : `/local/_`;
      const range = IDBKeyRange.bound(prefix, prefix + "\uFFFF");
      const request = objectStore.getAll(range);
      request.onsuccess = (event) => {
        var _a2;
        resolve((_a2 = event.target.result) != null ? _a2 : []);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }), "getAllFilesRefInCache");
  var _notificationStore = class _notificationStore {
    static save(notification) {
      return __async(this, null, function* () {
        return set(this.tbName, notification.id, JSON.stringify(notification));
      });
    }
    static getAll() {
      return __async(this, null, function* () {
        const results = yield getAll(this.tbName);
        return results.map(({ key, value }) => {
          const notification = JSON.parse(value);
          return notification;
        });
      });
    }
    static delete(id) {
      return __async(this, null, function* () {
        yield set(this.tbName, id, null);
      });
    }
    static markSending(id) {
      return __async(this, null, function* () {
        const raw = yield get(this.tbName, id);
        if (!raw)
          return;
        const rec = JSON.parse(raw);
        if (rec) {
          rec.attempts++;
          if (rec.attempts > 3) {
            yield set(this.tbName, id, null);
          } else {
            yield set(this.tbName, id, JSON.stringify(rec));
          }
        }
      });
    }
  };
  __name(_notificationStore, "notificationStore");
  var notificationStore = _notificationStore;
  notificationStore.tbName = "notifications";

  // src/stor/stor.cache.ts
  var MLSSERVICEWORKERVERSION = "1.4.36";
  var installIfNeeded = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    if (!("serviceWorker" in navigator)) return null;
    const need = yield serviceWorkerNeedUpdate();
    let url = location.host === "multilevelstudio.com" ? "https://multilevelstudio.com/mlsServiceWorker.js" : "https://on.collab.codes/mlsServiceWorker.js";
    if (location.host === "collab.codes") url = "https://collab.codes/mlsServiceWorker.js";
    if (location.host === "test.collab.codes") url = "https://test.collab.codes/mlsServiceWorker.js";
    if (location.host !== "multilevelstudio.com" && location.host !== "collab.codes" && !location.host.endsWith(".collab.codes")) {
      url = `${location.origin}/mlsServiceWorker.js`;
    }
    let reg = yield navigator.serviceWorker.getRegistration();
    if (!reg || need) {
      reg = yield navigator.serviceWorker.register(url, { updateViaCache: "none" });
      yield reg.update();
      reg = yield navigator.serviceWorker.register(url, { updateViaCache: "all" });
    }
    yield navigator.serviceWorker.ready;
    return reg;
  }), "installIfNeeded");
  var serviceWorkerNeedUpdate = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    var _a2;
    if (!("serviceWorker" in navigator)) return false;
    const registrations = yield navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      return true;
    }
    return ((_a2 = yield getStatistics()) == null ? void 0 : _a2.versionSW) !== MLSSERVICEWORKERVERSION;
  }), "serviceWorkerNeedUpdate");
  var addIfNeed = /* @__PURE__ */ __name((args) => __async(null, null, function* () {
    const path = getPathSuffix(args.project, args.folder, args.shortName, args.extension);
    const contentType = args.content instanceof Blob ? args.content.type || "application/octet-stream" : args.contentType || "application/javascript";
    if (mls_exports.istrace) console.log(`addIfNeed: ${path}, version: ${args.version}`);
    return sendToServiceWorkerAndGetReturn({
      action: "add",
      path,
      version: args.version,
      content: args.content,
      contentType
    });
  }), "addIfNeed");
  var addsIfNeed = /* @__PURE__ */ __name((args) => __async(null, null, function* () {
    if (args.folder.length !== args.shortName.length || args.folder.length !== args.version.length || args.folder.length !== args.content.length || args.folder.length !== args.extension.length || args.folder.length !== args.contentType.length) throw new Error("addsIfNeed: invalid parameters");
    const path = args.folder.map((folder, index) => getPathSuffix(args.project, folder, args.shortName[index], args.extension[index]));
    if (mls_exports.istrace) console.log(`addIfNeed: ${path}, version: ${args.version}, content-length: ${args.content.length}`);
    return sendToServiceWorkerAndGetReturn({
      action: "adds",
      path,
      version: args.version,
      content: args.content,
      contentType: args.contentType
    });
  }), "addsIfNeed");
  var AddMfileIfNeed = /* @__PURE__ */ __name((modelTS) => __async(null, null, function* () {
    var _a2, _b2;
    const { project, shortName, folder } = modelTS.storFile;
    const version8 = (_a2 = modelTS.compilerResults) == null ? void 0 : _a2.cacheVersion;
    const js = ((_b2 = modelTS.compilerResults) == null ? void 0 : _b2.prodJS) || "";
    const extension = ".js";
    if (!version8) return "";
    const url = yield getURL(project, folder, shortName, extension, version8);
    if (url) return url;
    return addIfNeed({ project, folder, shortName, version: version8, content: js, extension });
  }), "AddMfileIfNeed");
  var getFileFromCache = /* @__PURE__ */ __name((project, folder, shortName, extension, version8) => __async(null, null, function* () {
    const url = getUrlLocalWithVersion(project, folder, shortName, extension, version8);
    const cachedResponse = yield caches.match(url);
    if (!cachedResponse) return null;
    return (yield cachedResponse.text()) || null;
  }), "getFileFromCache");
  var getURL = /* @__PURE__ */ __name((project, folder, shortName, extension, version8) => __async(null, null, function* () {
    const path = getPathSuffix(project, folder, shortName, extension);
    const message = {
      action: "getURL",
      path,
      version: version8
    };
    return sendToServiceWorkerAndGetReturn(message);
  }), "getURL");
  var getStatistics = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    try {
      const result = yield sendToServiceWorkerAndGetReturn({ action: "sts" });
      const sts = JSON.parse(result);
      return sts;
    } catch (error) {
      console.error(`Error parsing service worker statistics: ${error}`);
      return null;
    }
  }), "getStatistics");
  var getContent3 = /* @__PURE__ */ __name((fileInfo) => __async(null, null, function* () {
    const path = yield getURL(fileInfo.project, fileInfo.folder, fileInfo.shortName, fileInfo.extension, fileInfo.versionRef);
    if (!path) return null;
    return getFetch(path);
  }), "getContent");
  var setContent3 = /* @__PURE__ */ __name((fileInfo, content) => __async(null, null, function* () {
    const path = getPathSuffix(fileInfo.project, fileInfo.folder, fileInfo.shortName, fileInfo.extension);
    const contentType = content instanceof Blob ? content.type || "application/octet-stream" : "text/plain";
    return sendToServiceWorkerAndGetReturn({
      action: "add",
      path,
      version: fileInfo.versionRef,
      content,
      contentType
    });
  }), "setContent");
  var getFetch = /* @__PURE__ */ __name((url) => __async(null, null, function* () {
    try {
      const response = yield fetch(url);
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type");
      if (contentType && (contentType.startsWith("text/") || contentType.includes("application/json") || contentType.includes("application/javascript") || contentType.includes("application/typescript") || contentType.includes("application/xml"))) {
        return yield response.text();
      } else {
        return yield response.blob();
      }
    } catch (error) {
      console.error(`There was an error with the fetch operation: ${error}`);
    }
    return null;
  }), "getFetch");
  var sendToServiceWorker = /* @__PURE__ */ __name((message) => __async(null, null, function* () {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported in this browser.");
    }
    try {
      const registration = yield navigator.serviceWorker.ready;
      if (!registration.active) {
        console.warn("No active service worker to receive the message.");
        return;
      }
      registration.active.postMessage(message);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to send message to service worker: ${error.message}`);
      }
      throw new Error(`Failed to send message to service worker: ${error}`);
    }
  }), "sendToServiceWorker");
  var sendToServiceWorkerAndGetReturn = /* @__PURE__ */ __name((message) => __async(null, null, function* () {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported in this browser.");
    }
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (!event.data) return resolve(null);
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data);
        }
      };
      navigator.serviceWorker.ready.then((registration) => {
        var _a2;
        (_a2 = registration.active) == null ? void 0 : _a2.postMessage(message, [messageChannel.port2]);
      }).catch((error) => {
        if (error instanceof Error) reject(new Error(`Failed to send message to service worker: ${error.message}`));
        else reject(new Error(`Failed to send message to service worker: ${error}`));
      });
    });
  }), "sendToServiceWorkerAndGetReturn");
  var getPathSuffix = /* @__PURE__ */ __name((project, folder, shortName, extension) => {
    return `_${project}_${folder ? `${folder}/` : ""}${shortName}${extension}`;
  }, "getPathSuffix");
  var getUrlLocalWithVersion = /* @__PURE__ */ __name((project, folder, shortName, extension, version8) => {
    return `/local/_${project}_${folder ? `${folder}/` : ""}${shortName}${extension}?v=${version8}`;
  }, "getUrlLocalWithVersion");
  var MLSWORKERTRACE = "mlsServiceWorkerTrace";
  var setTraceServiceWorker = /* @__PURE__ */ __name((enable) => {
    set("serviceWorker", MLSWORKERTRACE, enable ? "true" : "false").catch((reason) => console.error(reason)).then(() => __async(null, null, function* () {
      console.info(yield getStatistics());
    }));
  }, "setTraceServiceWorker");
  var getStatesOfCache = /* @__PURE__ */ __name((project) => __async(null, null, function* () {
    var _a2;
    const cache = yield getAllFilesRefInCache(project).catch(() => []);
    const rc = [];
    const keys = Object.keys(mls_exports.stor.files);
    for (const key of keys) {
      const item = mls_exports.stor.files[key];
      if (item.project !== project) continue;
      const localShortPath = getLocalCacheKey(project, item.folder, item.shortName, item.extension);
      const value = ((_a2 = cache.find((item2) => item2.key === localShortPath)) == null ? void 0 : _a2.value) || "";
      const localCacheState = value && value === item.versionRef ? "HIT" : "MISS";
      rc.push({
        fileKey: key,
        localCacheState: item.inLocalStorage ? "INDEVELOPMENT" : localCacheState
      });
    }
    return rc;
  }), "getStatesOfCache");
  var clearObsoleteCache = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    return sendToServiceWorker({
      action: "clearObsolete"
    });
  }), "clearObsoleteCache");
  var sendACK = /* @__PURE__ */ __name((id) => {
    return sendToServiceWorker({
      action: "ACK",
      id
    });
  }, "sendACK");
  var sendRequestMissed = /* @__PURE__ */ __name(() => {
    return sendToServiceWorker({
      action: "REQUEST_MISSED"
    });
  }, "sendRequestMissed");
  var clearAll = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    return sendToServiceWorker({
      action: "clearAll"
    });
  }), "clearAll");
  var clearProjectsCache = /* @__PURE__ */ __name((project) => __async(null, null, function* () {
    return sendToServiceWorker({
      action: "clearProjects",
      path: project.map((p) => `${p}`)
    });
  }), "clearProjectsCache");

  // src/stor/stor.html.ts
  var stor_html_exports = {};
  __export(stor_html_exports, {
    updateImportMap: () => updateImportMap
  });
  var updateImportMap = /* @__PURE__ */ __name((key, url) => {
    const scriptTag = document.querySelector('script[type="importmap"]');
    if (!scriptTag) {
      const newScriptTag = document.createElement("script");
      newScriptTag.type = "importmap";
      newScriptTag.textContent = JSON.stringify({ imports: { [key]: url } });
      document.head.appendChild(newScriptTag);
      return;
    }
    const importMap = JSON.parse(scriptTag.textContent || "{}");
    importMap.imports = importMap.imports || {};
    if (importMap.imports[key] === url) return;
    importMap.imports[key] = url;
    scriptTag.textContent = JSON.stringify(importMap, null, 2);
  }, "updateImportMap");

  // src/stor/stor.ts
  var files = {};
  var projects = {};
  var orgs = {};
  var LOCALPROJECTNUMBER = 1e5;
  var getShortPath = /* @__PURE__ */ __name(({ level, shortName, extension, folder }) => {
    return `l${level}/` + (folder === "" ? "" : `${folder}/`) + shortName + extension;
  }, "getShortPath");
  var updateOrgs = /* @__PURE__ */ __name((json) => {
    const orgs2 = JSON.parse(json);
    if (!Array.isArray(orgs2)) console.error("Error in updateOrgs, orgs is not a array");
    for (const org of Object.keys(orgs2)) {
      const orgInfo = orgs2[org];
      if (!orgInfo.key || !orgInfo.sett || orgInfo.key.startsWith("org/") === false) continue;
      orgs[orgInfo.key] = orgInfo;
    }
  }, "updateOrgs");
  var getFileStorFromJson = /* @__PURE__ */ __name((json, defaults) => {
    var _a2, _b2, _c2, _d2;
    let parsedJson;
    try {
      parsedJson = mls_exports.common.safeParseArgs(json.trim());
    } catch (e) {
      return void 0;
    }
    if (!parsedJson || !parsedJson.shortName) return void 0;
    parsedJson.project = (_a2 = parsedJson.project) != null ? _a2 : defaults.project;
    if (!parsedJson.level) parsedJson.level = (_b2 = defaults.level) != null ? _b2 : 2;
    if (!parsedJson.folder) parsedJson.folder = (_c2 = defaults.folder) != null ? _c2 : "";
    if (!parsedJson.extension) parsedJson.extension = (_d2 = defaults.extension) != null ? _d2 : ".ts";
    return mls_exports.stor.files[getKeyToFile2(parsedJson)];
  }, "getFileStorFromJson");
  var getKeyToFile2 = /* @__PURE__ */ __name(({ project, level, shortName, folder, extension }) => {
    if (folder) return `${project}_${level}_${folder}/${shortName}${extension}`;
    return `${project}_${level}_${shortName}${extension}`;
  }, "getKeyToFile");
  var getKeyToFiles = /* @__PURE__ */ __name((project, level, shortName, folder, extension) => {
    if (folder) return `${project}_${level}_${folder}/${shortName}${extension}`;
    return `${project}_${level}_${shortName}${extension}`;
  }, "getKeyToFiles");
  var convertFileToFileReference = /* @__PURE__ */ __name((fileInfo) => {
    if (fileInfo.folder && fileInfo.folder !== "") {
      return `_${fileInfo.project}_/l${fileInfo.level}/${fileInfo.folder}/${fileInfo.shortName}${fileInfo.extension}`;
    } else {
      return `_${fileInfo.project}_/l${fileInfo.level}/${fileInfo.shortName}${fileInfo.extension}`;
    }
  }, "convertFileToFileReference");
  var convertFileReferenceToFile = /* @__PURE__ */ __name((fileReference) => {
    const rc = { project: 0, level: 2, shortName: "", folder: "", extension: "" };
    const parts = fileReference.split("/");
    if (parts.length < 3 || parts[1].substring(0, 1) !== "l") return rc;
    let project = Number(parts[0].substring(1, parts[0].length - 1));
    let level = Number(parts[1].substring(1));
    if (isNaN(level) || isNaN(project)) return rc;
    let folder = "";
    if (parts.length > 2) {
      folder = parts.slice(2, parts.length - 1).join("/");
    }
    const filePart = parts[parts.length - 1];
    const firstDot = filePart.indexOf(".");
    if (firstDot === -1) return rc;
    let shortName = filePart.slice(0, firstDot);
    let extension = filePart.slice(firstDot);
    return { project, level, shortName, folder, extension };
  }, "convertFileReferenceToFile");
  var getPathToFile = /* @__PURE__ */ __name((path) => {
    const firstSlash = path.indexOf("/");
    let project = parseInt(path.slice(1, firstSlash - 1), 10);
    if (isNaN(project)) project = 0;
    const rest = path.slice(firstSlash + 1);
    const parts = rest.split("/");
    let level = 2;
    let folder = "";
    let extension = ".ts";
    if (parts.length > 1) {
      const levelStr = parts[0];
      if (levelStr.startsWith("l")) {
        const levelNum = parseInt(levelStr.slice(1), 10);
        if (!isNaN(levelNum)) level = levelNum;
      } else throw new Error(`Error in getPathToFile, level not valid: ${levelStr}`);
      if (parts.length > 2) {
        folder = parts.slice(1, parts.length - 1).join("/");
      }
    }
    const filePart = parts[parts.length - 1];
    const lastDot = filePart.indexOf(".");
    let shortName;
    if (lastDot === -1) {
      shortName = filePart;
    } else {
      shortName = filePart.slice(0, lastDot);
      extension = filePart.slice(lastDot);
    }
    return { project, level, shortName, folder, extension };
  }, "getPathToFile");
  var removeProjectInfo2 = /* @__PURE__ */ __name((project) => {
    const keys = Object.keys(files);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (files[key].project === project) {
        delete files[key];
      }
    }
    delete projects[project];
  }, "removeProjectInfo");
  var setContents4 = /* @__PURE__ */ __name((fileInfos, comments) => __async(null, null, function* () {
    let rc = [];
    let refProjects = [...new Set(fileInfos.map((f) => f.project))];
    const fileInfosLocalStorage = [];
    try {
      for (var iter = __forAwait(refProjects), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
        const project = temp.value;
        let rcProject = [];
        const fileInfos2 = [];
        for (const fileInfo of fileInfos) {
          if (fileInfo.project !== project) continue;
          const projectInfo = projects[project];
          if (!projectInfo) throw new Error(`project ${project} not found`);
          if (fileInfo.project === 0 || fileInfo.project === mls_exports.stor.LOCALPROJECTNUMBER || fileInfo.inLocalStorage || projectInfo.projectDriver === "local") fileInfosLocalStorage.push(fileInfo);
          else fileInfos2.push(fileInfo);
        }
        if (fileInfos2.length > 0) {
          rc.push({ project, result: yield mls_exports.stor.server.findDriverAndSetContents(project, fileInfos2, comments) });
        }
      }
    } catch (temp) {
      error = [temp];
    } finally {
      try {
        more && (temp = iter.return) && (yield temp.call(iter));
      } finally {
        if (error)
          throw error[0];
      }
    }
    if (fileInfosLocalStorage.length > 0) {
      rc.push({ project: 0, result: yield mls_exports.stor.server.findDriverAndSetContents(0, fileInfosLocalStorage, comments) });
    }
    return rc;
  }), "setContents");
  var addOrUpdateFile = /* @__PURE__ */ __name((_0) => __async(null, [_0], function* ({ project, level, shortName, extension, versionRef, folder, updatedAt = void 0 }) {
    if (!extension.startsWith(".")) throw new Error("loadInfoOneFile, extension must start with dot");
    const inLocalStorage = project === 0 || project === mls_exports.stor.LOCALPROJECTNUMBER || (yield mls_exports.stor.localDB.existFile({ project, level, shortName, folder, extension }));
    const key = getKeyToFile2({ project, level, shortName, folder, extension });
    if (files[key]) {
      if (files[key].versionRef !== versionRef && (files[key].hasError || files[key].status !== "nochange" || files[key].inLocalStorage === false)) {
        if (files[key].inLocalStorage === false) {
          files[key].versionRef = versionRef;
        } else {
          files[key].newVersionRefIfOutdated = versionRef;
        }
        files[key].isLocalVersionOutdated = true;
        return files[key];
      } else {
        files[key].isLocalVersionOutdated = false;
        files[key].newVersionRefIfOutdated = void 0;
      }
      files[key].versionRef = versionRef;
      files[key].updatedAt = updatedAt;
    } else {
      let _a2;
      const hasError = false;
      const isLocalVersionOutdated = false;
      const status = "nochange";
      files[key] = {
        project,
        level,
        shortName,
        folder,
        extension,
        status,
        hasError,
        versionRef,
        isLocalVersionOutdated,
        inLocalStorage,
        updatedAt,
        projectDependencies: null,
        getContent: mls_exports.stor.server.findDriverAndGetContent,
        getValueInfo: mls_exports.stor.localDB.getContentInfoOrNull,
        getHistory: mls_exports.stor.server.findDriverAndGetHistory,
        getHistoryContent: /* @__PURE__ */ __name(function(ref) {
          return mls_exports.stor.server.findDriverAndGetHistoryContent.call(this, ref);
        }, "getHistoryContent"),
        saveContentInCacheIfNeed() {
          return saveContentInCacheIfNeed.call(this);
        },
        getOrCreateModel() {
          return __async(this, null, function* () {
            return yield getOrCreateModelForFile.call(this);
          });
        }
      };
      if (inLocalStorage) {
        const fileDB = yield mls_exports.stor.localDB.readFile({ project, level, shortName, folder, extension }).catch(() => null);
        if (fileDB && fileDB.fileInfo) {
          const fi = files[key];
          fi.status = fileDB.fileInfo.status;
          fi.hasError = fileDB.fileInfo.hasError;
        }
      }
    }
    return files[key];
  }), "addOrUpdateFile");
  function saveContentInCacheIfNeed() {
    return __async(this, null, function* () {
      const url = yield mls_exports.stor.cache.getURL(this.project, this.folder, this.shortName, this.extension, this.versionRef);
      if (url) return url;
      return mls_exports.stor.cache.addIfNeed({
        project: this.project,
        folder: this.folder,
        shortName: this.shortName,
        version: this.versionRef,
        content: yield this.getContent(),
        extension: this.extension
      });
    });
  }
  __name(saveContentInCacheIfNeed, "saveContentInCacheIfNeed");
  var pendingModels = /* @__PURE__ */ new Map();
  function getOrCreateModelForFile() {
    return __async(this, null, function* () {
      const models2 = mls_exports.editor.getModel(this);
      if (models2) return models2;
      const key = convertFileToFileReference(this);
      const pendingModel = pendingModels.get(key);
      if (pendingModel) return pendingModel;
      const promise = Promise.resolve().then(() => __async(this, null, function* () {
        const content = yield this.getContent();
        if (typeof content !== "string") throw new Error(`Error, content of ${key} must be a string to create model`);
        const result = yield mls_exports.editor.addModel(this, content);
        if (!result) throw new Error(`Error creating model for file ${key}, use getOrCreateModel only on source files`);
        return result;
      })).finally(() => {
        pendingModels.delete(key);
      });
      pendingModels.set(key, promise);
      return promise;
    });
  }
  __name(getOrCreateModelForFile, "getOrCreateModelForFile");
  var renameFile = /* @__PURE__ */ __name((storFile, newName) => {
    const oldKey = mls_exports.stor.getKeyToFile({ project: storFile.project, level: storFile.level, shortName: storFile.shortName, folder: storFile.folder, extension: storFile.extension });
    const newKey = mls_exports.stor.getKeyToFile({ project: newName.project, level: storFile.level, shortName: newName.shortName, folder: storFile.folder, extension: storFile.extension });
    if (oldKey === newKey || mls_exports.stor.files[newKey]) return false;
    storFile.shortName = newName.shortName;
    storFile.project = newName.project;
    mls_exports.stor.files[newKey] = mls_exports.stor.files[oldKey];
    delete mls_exports.stor.files[oldKey];
    return true;
  }, "renameFile");
  var getProjectDependencies2 = /* @__PURE__ */ __name((project) => {
    const rc = /* @__PURE__ */ new Set();
    const fileKeys = Object.keys(files);
    for (const file of fileKeys) {
      for (const dep of files[file].projectDependencies || []) {
        if (dep !== project && dep > 1) rc.add(dep);
      }
    }
    return Array.from(rc);
  }, "getProjectDependencies");
  var isProjectLoaded = /* @__PURE__ */ __name((project) => {
    return Boolean(projects[project]);
  }, "isProjectLoaded");
  var loadProjectdependenciesInfoIfNeed = /* @__PURE__ */ __name((project, forceUpdate = false) => __async(null, null, function* () {
    if (mls_exports.istrace) console.time("loadProjectdependenciesInfoIfNeed");
    const currentProject = projects[project];
    if (forceUpdate && currentProject) {
      currentProject.projectDependencies = null;
    }
    const rc = yield loadProjectDependenciesInfoIfNeed2(project, forceUpdate, 1);
    if (mls_exports.istrace) console.timeEnd("loadProjectDependenciesInfoIfNeed");
    return rc;
  }), "loadProjectdependenciesInfoIfNeed");
  var loadProjectDependenciesInfoIfNeed2 = /* @__PURE__ */ __name((project, forceUpdate, step) => __async(null, null, function* () {
    const currentProject = projects[project];
    if (currentProject === null) {
      if (step > 100) throw new Error(`Error, project ${project} in loading for a long time`);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(loadProjectDependenciesInfoIfNeed2(project, forceUpdate, step + 1));
        }, 100);
      });
    } else {
      if (!currentProject) return [];
      currentProject.projectDependencies = mls_exports.stor.getProjectDependencies(project);
      const newProjectsDeps = currentProject.projectDependencies.filter((dd) => !mls_exports.stor.isProjectLoaded(dd));
      yield Promise.all(newProjectsDeps.map((dep) => mls_exports.stor.server.loadProjectInfoIfNeeded(dep)));
      return newProjectsDeps;
    }
  }), "loadProjectDependenciesInfoIfNeed2");
  function getFiles(args) {
    return __async(this, null, function* () {
      var _a2;
      const ret = {
        ts: void 0,
        html: void 0,
        less: void 0,
        defs: void 0
      };
      const level = (_a2 = args.level) != null ? _a2 : 2;
      [".ts", ".html", ".less", ".defs.ts", ".test.ts"].forEach((ext) => {
        const key = getKeyToFile2({ project: args.project, level, shortName: args.shortName, folder: args.folder, extension: ext });
        if (!files[key]) return;
        if (ext === ".ts") ret.ts = mls_exports.stor.files[key];
        if (ext === ".html") ret.html = mls_exports.stor.files[key];
        if (ext === ".less") ret.less = mls_exports.stor.files[key];
        if (ext === ".defs.ts") ret.defs = mls_exports.stor.files[key];
        if (ext === ".test.ts") ret.test = mls_exports.stor.files[key];
      });
      if (!args.loadContent) return ret;
      return getFilesContent(ret);
    });
  }
  __name(getFiles, "getFiles");
  function findFilesNeedingDefsUpdate(args, forceBeforeAt) {
    var _a2, _b2;
    const ret = [];
    const level = (_a2 = args.level) != null ? _a2 : 2;
    const shortNameFilter = (_b2 = args.shortName) == null ? void 0 : _b2.toLowerCase();
    const folderFilter = args.folder ? args.folder.toLowerCase() + "/" : void 0;
    const fileKeys = Object.keys(mls_exports.stor.files);
    for (const key of fileKeys) {
      const file = mls_exports.stor.files[key];
      if (file.project !== args.project || file.level !== level || file.extension !== ".ts" || shortNameFilter && !file.shortName.toLowerCase().includes(shortNameFilter) || folderFilter && !file.folder.toLowerCase().startsWith(folderFilter)) continue;
      const fileDefs = mls_exports.stor.files[getKeyToFile2(__spreadProps(__spreadValues({}, file), { extension: ".defs.ts" }))];
      if (fileDefs) {
        const updatedAt = fileDefs.updatedAt || new Date(2e3, 0, 1).toISOString();
        const isDefsBeforeBase = forceBeforeAt ? new Date(updatedAt) < forceBeforeAt : false;
        const isDefsBeforeTS = file.updatedAt ? new Date(updatedAt) < new Date(file.updatedAt) : false;
        if (!isDefsBeforeBase && !isDefsBeforeTS) continue;
      }
      ret.push(file);
    }
    return ret;
  }
  __name(findFilesNeedingDefsUpdate, "findFilesNeedingDefsUpdate");
  function getFilesContent(info) {
    return __async(this, null, function* () {
      function getFile(file) {
        return __async(this, null, function* () {
          if (!file) return void 0;
          const content = yield file.getContent();
          if (typeof content !== "string") throw new Error(`Error, content of ${file.shortName} must be a string`);
          return content;
        });
      }
      __name(getFile, "getFile");
      const [ts, html, less2, def, test] = yield Promise.all([
        getFile(info.ts),
        getFile(info.html),
        getFile(info.less),
        getFile(info.defs),
        getFile(info.test)
      ]);
      return {
        ts: info.ts,
        tsContent: ts,
        html: info.html,
        htmlContent: html,
        less: info.less,
        lessContent: less2,
        defs: info.defs,
        defsContent: def,
        test: info.test,
        testContent: test
      };
    });
  }
  __name(getFilesContent, "getFilesContent");

  // src/api/api.ts
  var api_exports = {};
  __export(api_exports, {
    base: () => api_base_exports,
    cbeAddOrUpdateOrgValue: () => cbeAddOrUpdateOrgValue,
    cbeChangeUserPreferences: () => cbeChangeUserPreferences,
    cbeLogin: () => cbeLogin,
    cbeSaveNewPrj: () => cbeSaveNewPrj,
    cbeSavePrjSettings: () => cbeSavePrjSettings,
    cbeUpdateIndexHtml: () => cbeUpdateIndexHtml,
    common: () => api_common_exports
  });

  // src/api/api.common.ts
  var api_common_exports = {};
  __export(api_common_exports, {
    clearQueryString: () => clearQueryString,
    getCookie: () => getCookie,
    processInits: () => processInits,
    processOrgs: () => processOrgs,
    processProviders: () => processProviders
  });
  function processOrgs(orgs2) {
    return __async(this, null, function* () {
      if (!orgs2 || typeof orgs2 !== "object") return;
      const keys = Object.keys(orgs2);
      try {
        for (var iter2 = __forAwait(keys), more2, temp2, error2; more2 = !(temp2 = yield iter2.next()).done; more2 = false) {
          const key = temp2.value;
          mls_exports.stor.orgs[key] = orgs2[key];
          try {
            for (var iter = __forAwait(orgs2[key].sett.projects), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
              const prj = temp.value;
              yield processProjects(prj);
            }
          } catch (temp) {
            error = [temp];
          } finally {
            try {
              more && (temp = iter.return) && (yield temp.call(iter));
            } finally {
              if (error)
                throw error[0];
            }
          }
        }
      } catch (temp2) {
        error2 = [temp2];
      } finally {
        try {
          more2 && (temp2 = iter2.return) && (yield temp2.call(iter2));
        } finally {
          if (error2)
            throw error2[0];
        }
      }
    });
  }
  __name(processOrgs, "processOrgs");
  function processProviders(providers) {
    return __async(this, null, function* () {
      if (!providers || !Array.isArray(providers)) return;
      try {
        for (var iter = __forAwait(providers), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
          const provider = temp.value;
          mls_exports.l0.addProviderConnected(provider);
        }
      } catch (temp) {
        error = [temp];
      } finally {
        try {
          more && (temp = iter.return) && (yield temp.call(iter));
        } finally {
          if (error)
            throw error[0];
        }
      }
    });
  }
  __name(processProviders, "processProviders");
  function processInits(inits) {
    return __async(this, null, function* () {
      if (!inits || typeof inits !== "object") return;
      const keys = Object.keys(inits);
      try {
        for (var iter = __forAwait(keys), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
          const key = temp.value;
          yield processInit(key, inits[key]);
        }
      } catch (temp) {
        error = [temp];
      } finally {
        try {
          more && (temp = iter.return) && (yield temp.call(iter));
        } finally {
          if (error)
            throw error[0];
        }
      }
    });
  }
  __name(processInits, "processInits");
  function processInit(widget, value) {
    return __async(this, null, function* () {
      if (!value) return;
      import(widget).then((a) => __async(null, null, function* () {
        if (typeof a.init !== "function") throw new Error(`not found init function in widget: ${widget}`);
        yield a.init(value);
      })).catch((e) => {
        console.log(`init widget: ${widget}, error: ${e.message || e}`);
      });
    });
  }
  __name(processInit, "processInit");
  function processProjects(prj) {
    return __async(this, null, function* () {
      if (!prj.files || typeof prj.files !== "string") return;
      if (!prj.repository_lastModified) throw new Error(`repository_lastModified is missing for project ${prj.id}`);
      const prjInfo = mls_exports.common.zip.decodeAndDecompressBase64(prj.files);
      if (typeof prjInfo === "string") throw new Error(`Error decoding files for project ${prj.id}, files is a string`);
      if (Array.isArray(prjInfo.filesInfo) === false) {
        console.error(`Error decoding files for project ${prj.id}, files not an array`);
        return;
      }
      try {
        for (var iter = __forAwait(prjInfo.filesInfo), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
          const file = temp.value;
          yield processFile(file);
        }
      } catch (temp) {
        error = [temp];
      } finally {
        try {
          more && (temp = iter.return) && (yield temp.call(iter));
        } finally {
          if (error)
            throw error[0];
        }
      }
      yield mls_exports.stor.server.updateProjectFilesInfo(prj.id, prjInfo, prj.repository_lastModified);
      delete prj.files;
    });
  }
  __name(processProjects, "processProjects");
  function processFile(file) {
    return __async(this, null, function* () {
      if (!file.jsContent) return;
      const js = mls_exports.common.zip.decodeAndDecompressBase64(file.jsContent);
      if (typeof js !== "string") {
        console.error(`Error decoding jsContent for file ${file.shortPath}`);
        return;
      }
      file.jsContent = js;
    });
  }
  __name(processFile, "processFile");
  var clearQueryString = /* @__PURE__ */ __name(() => {
    const url = window.location.origin + window.location.pathname;
    window.history.replaceState(null, "", url);
  }, "clearQueryString");
  function getCookie(name5) {
    var _a2;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name5}=`);
    if (parts.length === 2) {
      return ((_a2 = parts.pop()) == null ? void 0 : _a2.split(";").shift()) || null;
    }
    return null;
  }
  __name(getCookie, "getCookie");

  // src/api/api.base.ts
  var api_base_exports = {};
  __export(api_base_exports, {
    cbePost: () => cbePost,
    get: () => get2,
    getAsync: () => getAsync,
    prepareUrl: () => prepareUrl
  });
  var prepareUrl = /* @__PURE__ */ __name((base, args) => {
    let sArgs = "";
    for (let prop in args) {
      if (sArgs === "") {
        sArgs = prop + "=" + encodeURIComponent(args[prop]);
      } else {
        sArgs += "&" + prop + "=" + encodeURIComponent(args[prop]);
      }
    }
    return base + "?" + sArgs;
  }, "prepareUrl");
  var rum = {};
  var addRUMLoad = /* @__PURE__ */ __name((repeat) => {
    if (repeat > 100) return;
    setTimeout(() => {
      try {
        const perfData = window.performance.timing;
        let pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        if (pageLoadTime < 0) return addRUMLoad(repeat + 1);
        rum.connectTime = perfData.responseEnd - perfData.requestStart;
        rum.pageLoadTime = pageLoadTime;
        rum.renderTime = perfData.domComplete - perfData.domLoading;
      } catch (e) {
      }
    }, 500);
  }, "addRUMLoad");
  var addRUMapi = /* @__PURE__ */ __name((str, end, command) => {
    if (command === "api/loginAgain") addRUMLoad(1);
  }, "addRUMapi");
  var get2 = /* @__PURE__ */ __name((command, args = {}, onMessage2) => {
    if (Object.keys(rum).length > 0) {
      args.rum = JSON.stringify(rum);
      rum = {};
    }
    const str = performance.now();
    fetch(prepareUrl(command, args)).then((response) => {
      if (response.status === 200) {
        response.text().then((data) => {
          addRUMapi(str, performance.now(), command);
          return onMessage2(data, false);
        });
      } else {
        const msg = "internet or server error: " + response.status + ", " + response.statusText;
        mls_exports.main.usermsg(msg);
        return onMessage2(msg, true);
      }
    }).catch((error) => {
      const msg = typeof error === "string" ? error : "error " + error;
      mls_exports.main.usermsg(msg);
      onMessage2(msg, true);
    });
  }, "get");
  var getAsync = /* @__PURE__ */ __name((command, args = {}) => {
    return new Promise((resolve, reject) => {
      get2(
        command,
        args,
        (msg, error) => {
          if (error) return reject(msg);
          return resolve(msg);
        }
        // tryLoginAgain,
      );
    });
  }, "getAsync");
  var cbePost = /* @__PURE__ */ __name((args) => __async(null, null, function* () {
    let urlHttp = "https://on.collab.codes/exec";
    if (location.host === "collab.codes") urlHttp = "https://collab.codes/exec";
    else if (location.host !== "on.collab.codes" && !location.host.endsWith(".collab.codes")) {
      urlHttp = `${location.origin}/exec`;
    }
    let showMsg = true;
    try {
      const response = yield fetch(urlHttp, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(args),
        credentials: "include"
      });
      if (response.status !== global_cbe_types_exports.HttpStatus.OK) {
        showMsg = false;
        throw yield getPostError(response, args);
      }
      const data = yield response.json();
      if (!data) {
        throw new Error("No data on cbePost");
      }
      return data;
    } catch (error) {
      if (showMsg) console.error("Network or initiation error on cbePost: ", error);
      throw error;
    }
  }), "cbePost");
  var getPostError = /* @__PURE__ */ __name((response, args) => __async(null, null, function* () {
    const data = yield response.json().catch((err2) => {
      console.error("Error on getPostError: ", err2);
      return new Error(`No data on cbePost error: ${err2}`);
    });
    const errorMsg = typeof data.msg === "string" ? data.msg : data.error || "Unknown error";
    if (response.status === global_cbe_types_exports.HttpStatus.BAD_REQUEST) {
      console.error(`Error on cbePost, status: ${response.status}, msg: ${errorMsg}, invalid args: `, JSON.stringify(args));
      return new Error(`Invalid args, msg: ${errorMsg}`);
    }
    if (response.status === global_cbe_types_exports.HttpStatus.CONFLICT) {
      return new Error(`DomainError: ${errorMsg}`);
    }
    const msg = `Error on cbePost, status: ${response.status} - ${response.statusText}, error: ${errorMsg}`;
    console.error(msg);
    return new Error(msg);
  }), "getPostError");

  // src/common/common.ts
  var common_exports = {};
  __export(common_exports, {
    argsValidator: () => argsValidator,
    crc: () => common_crc_exports,
    deps: () => common_deps_exports,
    safeParseArgs: () => safeParseArgs,
    tripleslash: () => common_tripleslash_exports,
    tryParseNumber: () => tryParseNumber,
    zip: () => common_zip_exports
  });

  // src/common/common.tripleslash.ts
  var common_tripleslash_exports = {};
  __export(common_tripleslash_exports, {
    changeVariable: () => changeVariable,
    parseXMLTripleSlash: () => parseXMLTripleSlash
  });
  var tagName = "mls";
  var requiredVars = ["enhancement", "fileReference"];
  var optionalVars = ["author"];
  var parseXMLTripleSlash = /* @__PURE__ */ __name((line) => {
    if (!line.startsWith("/// <")) throw new Error('line must start with "/// <" (triple slash and xml');
    const res = parseXML(line.substring(3).trim());
    if (typeof res === "string") throw new Error(`invalid triple slash: ${res}`);
    if (res.tagName !== tagName) throw new Error(`invalid tag name: '${res.tagName}', use '${tagName}'`);
    requiredVars.forEach((varName) => {
      if (!res.variables[varName]) throw new Error(`missing required variable: "${varName}"`);
    });
    for (const varName in res.variables) {
      if (!requiredVars.includes(varName) && !optionalVars.includes(varName)) throw new Error(`invalid variable name: "${varName}"`);
    }
    return res;
  }, "parseXMLTripleSlash");
  var parseXML = /* @__PURE__ */ __name((str) => {
    const regex = /<(\w+)((?:\s+\w+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*\/?>/;
    const match = str.match(regex);
    if (!match) return "XML invalid: use ex: <mls variable='text' />";
    const tagName2 = match[1];
    const variables = {};
    const attributes = match[2].match(/\w+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?/g) || [];
    for (let i = 0; i < attributes.length; i++) {
      const [name5, value] = attributes[i].split("=");
      variables[name5 || "?"] = value ? value.replace(/(^['"]|['"]$)/g, "") : "";
    }
    const text = str.replace(match[0], "").trim();
    if (text) return `XML text invalid: '${text}' use ex: <mls variable='text' />`;
    return { tagName: tagName2, variables };
  }, "parseXML");
  var changeVariable = /* @__PURE__ */ __name((model, variableName, newValue) => {
    if (!(model == null ? void 0 : model.model)) return false;
    const lines = (model.model.getValue() || "").split("\n");
    const line = lines[0];
    if (!line.startsWith("/// <")) throw new Error('line must start with "/// <" (triple slash and xml');
    const regex = new RegExp(`(${variableName}\\s*=\\s*["'])([^"']*)`, "i");
    const match = line.match(regex);
    if (!match) return false;
    lines[0] = line.replace(regex, `$1${newValue}`);
    model.model.setValue(lines.join("\n"));
    return true;
  }, "changeVariable");

  // src/common/common.crc.ts
  var common_crc_exports = {};
  __export(common_crc_exports, {
    crc32: () => crc32
  });
  var createLookupTable = /* @__PURE__ */ __name(() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; ++i) {
      let value = i;
      for (let j = 0; j < 8; ++j) {
        value = value & 1 ? 3988292384 ^ value >>> 1 : value >>> 1;
      }
      table[i] = value;
    }
    return table;
  }, "createLookupTable");
  var crc32LookupTable = createLookupTable();
  var crc32 = /* @__PURE__ */ __name((text) => {
    let crc = -1;
    for (let i = 0; i < text.length; ++i) {
      crc = crc >>> 8 ^ crc32LookupTable[(crc ^ text.charCodeAt(i)) & 255];
    }
    crc ^= -1;
    return crc >>> 0;
  }, "crc32");

  // src/common/common.deps.ts
  var common_deps_exports = {};
  __export(common_deps_exports, {
    loadScriptOnDOM: () => loadScriptOnDOM
  });
  var lastScriptID = 10;
  var loadScriptOnDOM = /* @__PURE__ */ __name((ref, context, parentElement, scriptID) => {
    return new Promise((resolve) => {
      if (!context) resolve(true);
      const script = document.createElement("script");
      if (!scriptID) {
        script.id = "js_" + lastScriptID;
        lastScriptID++;
      } else {
        script.id = scriptID;
      }
      if (context.trim().startsWith("export")) script.type = "module";
      script.dataset.prjDeps = ref;
      const eventOnLoad = "\n" + script.id + '.dispatchEvent(new CustomEvent("mlsload"));';
      script.text = context + eventOnLoad + "\n//# sourceURL=_" + ref + "_.js";
      const msg = "Error on load javascript of " + ref;
      function removeEvents() {
        window.removeEventListener("error", windowErrorHandler);
        script.removeEventListener("error", rejectHandler);
        script.removeEventListener("abort", rejectHandler);
        script.removeEventListener("mlsload", loadedHandler);
      }
      __name(removeEvents, "removeEvents");
      const windowErrorHandler = /* @__PURE__ */ __name((event) => {
        event.preventDefault();
        console.error(msg, event.message, event);
        removeEvents();
        resolve(false);
      }, "windowErrorHandler");
      window.addEventListener("error", windowErrorHandler);
      const rejectHandler = /* @__PURE__ */ __name((event) => {
        console.error(msg, "Please check the import statements:\n" + context);
        removeEvents();
        resolve(false);
      }, "rejectHandler");
      script.addEventListener("error", rejectHandler);
      script.addEventListener("abort", rejectHandler);
      const loadedHandler = /* @__PURE__ */ __name((ev) => {
        removeEvents();
        resolve(true);
      }, "loadedHandler");
      try {
        script.addEventListener("mlsload", loadedHandler);
        parentElement.appendChild(script);
      } catch (e) {
        console.error(msg + ": ", e, `refs: ${ref}`, `context: ${context}`);
        removeEvents();
        resolve(false);
      }
    });
  }, "loadScriptOnDOM");

  // src/common/common.zip.ts
  var common_zip_exports = {};
  __export(common_zip_exports, {
    base64ToArrayBuffer: () => base64ToArrayBuffer,
    compressAndEncodeBase64: () => compressAndEncodeBase64,
    decodeAndDecompressBase64: () => decodeAndDecompressBase64,
    unzipBase64: () => unzipBase64
  });

  // node_modules/pako/dist/pako.esm.mjs
  var Z_FIXED$1 = 4;
  var Z_BINARY = 0;
  var Z_TEXT = 1;
  var Z_UNKNOWN$1 = 2;
  function zero$1(buf) {
    let len = buf.length;
    while (--len >= 0) {
      buf[len] = 0;
    }
  }
  __name(zero$1, "zero$1");
  var STORED_BLOCK = 0;
  var STATIC_TREES = 1;
  var DYN_TREES = 2;
  var MIN_MATCH$1 = 3;
  var MAX_MATCH$1 = 258;
  var LENGTH_CODES$1 = 29;
  var LITERALS$1 = 256;
  var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
  var D_CODES$1 = 30;
  var BL_CODES$1 = 19;
  var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
  var MAX_BITS$1 = 15;
  var Buf_size = 16;
  var MAX_BL_BITS = 7;
  var END_BLOCK = 256;
  var REP_3_6 = 16;
  var REPZ_3_10 = 17;
  var REPZ_11_138 = 18;
  var extra_lbits = (
    /* extra bits for each length code */
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0])
  );
  var extra_dbits = (
    /* extra bits for each distance code */
    new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13])
  );
  var extra_blbits = (
    /* extra bits for each bit length code */
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7])
  );
  var bl_order = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var DIST_CODE_LEN = 512;
  var static_ltree = new Array((L_CODES$1 + 2) * 2);
  zero$1(static_ltree);
  var static_dtree = new Array(D_CODES$1 * 2);
  zero$1(static_dtree);
  var _dist_code = new Array(DIST_CODE_LEN);
  zero$1(_dist_code);
  var _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
  zero$1(_length_code);
  var base_length = new Array(LENGTH_CODES$1);
  zero$1(base_length);
  var base_dist = new Array(D_CODES$1);
  zero$1(base_dist);
  function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
    this.static_tree = static_tree;
    this.extra_bits = extra_bits;
    this.extra_base = extra_base;
    this.elems = elems;
    this.max_length = max_length;
    this.has_stree = static_tree && static_tree.length;
  }
  __name(StaticTreeDesc, "StaticTreeDesc");
  var static_l_desc;
  var static_d_desc;
  var static_bl_desc;
  function TreeDesc(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree;
    this.max_code = 0;
    this.stat_desc = stat_desc;
  }
  __name(TreeDesc, "TreeDesc");
  var d_code = /* @__PURE__ */ __name((dist) => {
    return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
  }, "d_code");
  var put_short = /* @__PURE__ */ __name((s, w) => {
    s.pending_buf[s.pending++] = w & 255;
    s.pending_buf[s.pending++] = w >>> 8 & 255;
  }, "put_short");
  var send_bits = /* @__PURE__ */ __name((s, value, length) => {
    if (s.bi_valid > Buf_size - length) {
      s.bi_buf |= value << s.bi_valid & 65535;
      put_short(s, s.bi_buf);
      s.bi_buf = value >> Buf_size - s.bi_valid;
      s.bi_valid += length - Buf_size;
    } else {
      s.bi_buf |= value << s.bi_valid & 65535;
      s.bi_valid += length;
    }
  }, "send_bits");
  var send_code = /* @__PURE__ */ __name((s, c, tree) => {
    send_bits(
      s,
      tree[c * 2],
      tree[c * 2 + 1]
      /*.Len*/
    );
  }, "send_code");
  var bi_reverse = /* @__PURE__ */ __name((code, len) => {
    let res = 0;
    do {
      res |= code & 1;
      code >>>= 1;
      res <<= 1;
    } while (--len > 0);
    return res >>> 1;
  }, "bi_reverse");
  var bi_flush = /* @__PURE__ */ __name((s) => {
    if (s.bi_valid === 16) {
      put_short(s, s.bi_buf);
      s.bi_buf = 0;
      s.bi_valid = 0;
    } else if (s.bi_valid >= 8) {
      s.pending_buf[s.pending++] = s.bi_buf & 255;
      s.bi_buf >>= 8;
      s.bi_valid -= 8;
    }
  }, "bi_flush");
  var gen_bitlen = /* @__PURE__ */ __name((s, desc) => {
    const tree = desc.dyn_tree;
    const max_code = desc.max_code;
    const stree = desc.stat_desc.static_tree;
    const has_stree = desc.stat_desc.has_stree;
    const extra = desc.stat_desc.extra_bits;
    const base = desc.stat_desc.extra_base;
    const max_length = desc.stat_desc.max_length;
    let h;
    let n, m;
    let bits;
    let xbits;
    let f;
    let overflow = 0;
    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      s.bl_count[bits] = 0;
    }
    tree[s.heap[s.heap_max] * 2 + 1] = 0;
    for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
      n = s.heap[h];
      bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
      if (bits > max_length) {
        bits = max_length;
        overflow++;
      }
      tree[n * 2 + 1] = bits;
      if (n > max_code) {
        continue;
      }
      s.bl_count[bits]++;
      xbits = 0;
      if (n >= base) {
        xbits = extra[n - base];
      }
      f = tree[n * 2];
      s.opt_len += f * (bits + xbits);
      if (has_stree) {
        s.static_len += f * (stree[n * 2 + 1] + xbits);
      }
    }
    if (overflow === 0) {
      return;
    }
    do {
      bits = max_length - 1;
      while (s.bl_count[bits] === 0) {
        bits--;
      }
      s.bl_count[bits]--;
      s.bl_count[bits + 1] += 2;
      s.bl_count[max_length]--;
      overflow -= 2;
    } while (overflow > 0);
    for (bits = max_length; bits !== 0; bits--) {
      n = s.bl_count[bits];
      while (n !== 0) {
        m = s.heap[--h];
        if (m > max_code) {
          continue;
        }
        if (tree[m * 2 + 1] !== bits) {
          s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
          tree[m * 2 + 1] = bits;
        }
        n--;
      }
    }
  }, "gen_bitlen");
  var gen_codes = /* @__PURE__ */ __name((tree, max_code, bl_count) => {
    const next_code = new Array(MAX_BITS$1 + 1);
    let code = 0;
    let bits;
    let n;
    for (bits = 1; bits <= MAX_BITS$1; bits++) {
      code = code + bl_count[bits - 1] << 1;
      next_code[bits] = code;
    }
    for (n = 0; n <= max_code; n++) {
      let len = tree[n * 2 + 1];
      if (len === 0) {
        continue;
      }
      tree[n * 2] = bi_reverse(next_code[len]++, len);
    }
  }, "gen_codes");
  var tr_static_init = /* @__PURE__ */ __name(() => {
    let n;
    let bits;
    let length;
    let code;
    let dist;
    const bl_count = new Array(MAX_BITS$1 + 1);
    length = 0;
    for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
      base_length[code] = length;
      for (n = 0; n < 1 << extra_lbits[code]; n++) {
        _length_code[length++] = code;
      }
    }
    _length_code[length - 1] = code;
    dist = 0;
    for (code = 0; code < 16; code++) {
      base_dist[code] = dist;
      for (n = 0; n < 1 << extra_dbits[code]; n++) {
        _dist_code[dist++] = code;
      }
    }
    dist >>= 7;
    for (; code < D_CODES$1; code++) {
      base_dist[code] = dist << 7;
      for (n = 0; n < 1 << extra_dbits[code] - 7; n++) {
        _dist_code[256 + dist++] = code;
      }
    }
    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      bl_count[bits] = 0;
    }
    n = 0;
    while (n <= 143) {
      static_ltree[n * 2 + 1] = 8;
      n++;
      bl_count[8]++;
    }
    while (n <= 255) {
      static_ltree[n * 2 + 1] = 9;
      n++;
      bl_count[9]++;
    }
    while (n <= 279) {
      static_ltree[n * 2 + 1] = 7;
      n++;
      bl_count[7]++;
    }
    while (n <= 287) {
      static_ltree[n * 2 + 1] = 8;
      n++;
      bl_count[8]++;
    }
    gen_codes(static_ltree, L_CODES$1 + 1, bl_count);
    for (n = 0; n < D_CODES$1; n++) {
      static_dtree[n * 2 + 1] = 5;
      static_dtree[n * 2] = bi_reverse(n, 5);
    }
    static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
    static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
    static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);
  }, "tr_static_init");
  var init_block = /* @__PURE__ */ __name((s) => {
    let n;
    for (n = 0; n < L_CODES$1; n++) {
      s.dyn_ltree[n * 2] = 0;
    }
    for (n = 0; n < D_CODES$1; n++) {
      s.dyn_dtree[n * 2] = 0;
    }
    for (n = 0; n < BL_CODES$1; n++) {
      s.bl_tree[n * 2] = 0;
    }
    s.dyn_ltree[END_BLOCK * 2] = 1;
    s.opt_len = s.static_len = 0;
    s.sym_next = s.matches = 0;
  }, "init_block");
  var bi_windup = /* @__PURE__ */ __name((s) => {
    if (s.bi_valid > 8) {
      put_short(s, s.bi_buf);
    } else if (s.bi_valid > 0) {
      s.pending_buf[s.pending++] = s.bi_buf;
    }
    s.bi_buf = 0;
    s.bi_valid = 0;
  }, "bi_windup");
  var smaller = /* @__PURE__ */ __name((tree, n, m, depth) => {
    const _n2 = n * 2;
    const _m2 = m * 2;
    return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
  }, "smaller");
  var pqdownheap = /* @__PURE__ */ __name((s, tree, k) => {
    const v = s.heap[k];
    let j = k << 1;
    while (j <= s.heap_len) {
      if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
        j++;
      }
      if (smaller(tree, v, s.heap[j], s.depth)) {
        break;
      }
      s.heap[k] = s.heap[j];
      k = j;
      j <<= 1;
    }
    s.heap[k] = v;
  }, "pqdownheap");
  var compress_block = /* @__PURE__ */ __name((s, ltree, dtree) => {
    let dist;
    let lc;
    let sx = 0;
    let code;
    let extra;
    if (s.sym_next !== 0) {
      do {
        dist = s.pending_buf[s.sym_buf + sx++] & 255;
        dist += (s.pending_buf[s.sym_buf + sx++] & 255) << 8;
        lc = s.pending_buf[s.sym_buf + sx++];
        if (dist === 0) {
          send_code(s, lc, ltree);
        } else {
          code = _length_code[lc];
          send_code(s, code + LITERALS$1 + 1, ltree);
          extra = extra_lbits[code];
          if (extra !== 0) {
            lc -= base_length[code];
            send_bits(s, lc, extra);
          }
          dist--;
          code = d_code(dist);
          send_code(s, code, dtree);
          extra = extra_dbits[code];
          if (extra !== 0) {
            dist -= base_dist[code];
            send_bits(s, dist, extra);
          }
        }
      } while (sx < s.sym_next);
    }
    send_code(s, END_BLOCK, ltree);
  }, "compress_block");
  var build_tree = /* @__PURE__ */ __name((s, desc) => {
    const tree = desc.dyn_tree;
    const stree = desc.stat_desc.static_tree;
    const has_stree = desc.stat_desc.has_stree;
    const elems = desc.stat_desc.elems;
    let n, m;
    let max_code = -1;
    let node;
    s.heap_len = 0;
    s.heap_max = HEAP_SIZE$1;
    for (n = 0; n < elems; n++) {
      if (tree[n * 2] !== 0) {
        s.heap[++s.heap_len] = max_code = n;
        s.depth[n] = 0;
      } else {
        tree[n * 2 + 1] = 0;
      }
    }
    while (s.heap_len < 2) {
      node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
      tree[node * 2] = 1;
      s.depth[node] = 0;
      s.opt_len--;
      if (has_stree) {
        s.static_len -= stree[node * 2 + 1];
      }
    }
    desc.max_code = max_code;
    for (n = s.heap_len >> 1; n >= 1; n--) {
      pqdownheap(s, tree, n);
    }
    node = elems;
    do {
      n = s.heap[
        1
        /*SMALLEST*/
      ];
      s.heap[
        1
        /*SMALLEST*/
      ] = s.heap[s.heap_len--];
      pqdownheap(
        s,
        tree,
        1
        /*SMALLEST*/
      );
      m = s.heap[
        1
        /*SMALLEST*/
      ];
      s.heap[--s.heap_max] = n;
      s.heap[--s.heap_max] = m;
      tree[node * 2] = tree[n * 2] + tree[m * 2];
      s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
      tree[n * 2 + 1] = tree[m * 2 + 1] = node;
      s.heap[
        1
        /*SMALLEST*/
      ] = node++;
      pqdownheap(
        s,
        tree,
        1
        /*SMALLEST*/
      );
    } while (s.heap_len >= 2);
    s.heap[--s.heap_max] = s.heap[
      1
      /*SMALLEST*/
    ];
    gen_bitlen(s, desc);
    gen_codes(tree, max_code, s.bl_count);
  }, "build_tree");
  var scan_tree = /* @__PURE__ */ __name((s, tree, max_code) => {
    let n;
    let prevlen = -1;
    let curlen;
    let nextlen = tree[0 * 2 + 1];
    let count = 0;
    let max_count = 7;
    let min_count = 4;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    tree[(max_code + 1) * 2 + 1] = 65535;
    for (n = 0; n <= max_code; n++) {
      curlen = nextlen;
      nextlen = tree[(n + 1) * 2 + 1];
      if (++count < max_count && curlen === nextlen) {
        continue;
      } else if (count < min_count) {
        s.bl_tree[curlen * 2] += count;
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          s.bl_tree[curlen * 2]++;
        }
        s.bl_tree[REP_3_6 * 2]++;
      } else if (count <= 10) {
        s.bl_tree[REPZ_3_10 * 2]++;
      } else {
        s.bl_tree[REPZ_11_138 * 2]++;
      }
      count = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;
      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  }, "scan_tree");
  var send_tree = /* @__PURE__ */ __name((s, tree, max_code) => {
    let n;
    let prevlen = -1;
    let curlen;
    let nextlen = tree[0 * 2 + 1];
    let count = 0;
    let max_count = 7;
    let min_count = 4;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    for (n = 0; n <= max_code; n++) {
      curlen = nextlen;
      nextlen = tree[(n + 1) * 2 + 1];
      if (++count < max_count && curlen === nextlen) {
        continue;
      } else if (count < min_count) {
        do {
          send_code(s, curlen, s.bl_tree);
        } while (--count !== 0);
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          send_code(s, curlen, s.bl_tree);
          count--;
        }
        send_code(s, REP_3_6, s.bl_tree);
        send_bits(s, count - 3, 2);
      } else if (count <= 10) {
        send_code(s, REPZ_3_10, s.bl_tree);
        send_bits(s, count - 3, 3);
      } else {
        send_code(s, REPZ_11_138, s.bl_tree);
        send_bits(s, count - 11, 7);
      }
      count = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;
      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  }, "send_tree");
  var build_bl_tree = /* @__PURE__ */ __name((s) => {
    let max_blindex;
    scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
    scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
    build_tree(s, s.bl_desc);
    for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
      if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
        break;
      }
    }
    s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
    return max_blindex;
  }, "build_bl_tree");
  var send_all_trees = /* @__PURE__ */ __name((s, lcodes, dcodes, blcodes) => {
    let rank2;
    send_bits(s, lcodes - 257, 5);
    send_bits(s, dcodes - 1, 5);
    send_bits(s, blcodes - 4, 4);
    for (rank2 = 0; rank2 < blcodes; rank2++) {
      send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
    }
    send_tree(s, s.dyn_ltree, lcodes - 1);
    send_tree(s, s.dyn_dtree, dcodes - 1);
  }, "send_all_trees");
  var detect_data_type = /* @__PURE__ */ __name((s) => {
    let block_mask = 4093624447;
    let n;
    for (n = 0; n <= 31; n++, block_mask >>>= 1) {
      if (block_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
        return Z_BINARY;
      }
    }
    if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
      return Z_TEXT;
    }
    for (n = 32; n < LITERALS$1; n++) {
      if (s.dyn_ltree[n * 2] !== 0) {
        return Z_TEXT;
      }
    }
    return Z_BINARY;
  }, "detect_data_type");
  var static_init_done = false;
  var _tr_init$1 = /* @__PURE__ */ __name((s) => {
    if (!static_init_done) {
      tr_static_init();
      static_init_done = true;
    }
    s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
    s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
    s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
    s.bi_buf = 0;
    s.bi_valid = 0;
    init_block(s);
  }, "_tr_init$1");
  var _tr_stored_block$1 = /* @__PURE__ */ __name((s, buf, stored_len, last) => {
    send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
    bi_windup(s);
    put_short(s, stored_len);
    put_short(s, ~stored_len);
    if (stored_len) {
      s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
    }
    s.pending += stored_len;
  }, "_tr_stored_block$1");
  var _tr_align$1 = /* @__PURE__ */ __name((s) => {
    send_bits(s, STATIC_TREES << 1, 3);
    send_code(s, END_BLOCK, static_ltree);
    bi_flush(s);
  }, "_tr_align$1");
  var _tr_flush_block$1 = /* @__PURE__ */ __name((s, buf, stored_len, last) => {
    let opt_lenb, static_lenb;
    let max_blindex = 0;
    if (s.level > 0) {
      if (s.strm.data_type === Z_UNKNOWN$1) {
        s.strm.data_type = detect_data_type(s);
      }
      build_tree(s, s.l_desc);
      build_tree(s, s.d_desc);
      max_blindex = build_bl_tree(s);
      opt_lenb = s.opt_len + 3 + 7 >>> 3;
      static_lenb = s.static_len + 3 + 7 >>> 3;
      if (static_lenb <= opt_lenb) {
        opt_lenb = static_lenb;
      }
    } else {
      opt_lenb = static_lenb = stored_len + 5;
    }
    if (stored_len + 4 <= opt_lenb && buf !== -1) {
      _tr_stored_block$1(s, buf, stored_len, last);
    } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
      send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
      compress_block(s, static_ltree, static_dtree);
    } else {
      send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
      send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
      compress_block(s, s.dyn_ltree, s.dyn_dtree);
    }
    init_block(s);
    if (last) {
      bi_windup(s);
    }
  }, "_tr_flush_block$1");
  var _tr_tally$1 = /* @__PURE__ */ __name((s, dist, lc) => {
    s.pending_buf[s.sym_buf + s.sym_next++] = dist;
    s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
    s.pending_buf[s.sym_buf + s.sym_next++] = lc;
    if (dist === 0) {
      s.dyn_ltree[lc * 2]++;
    } else {
      s.matches++;
      dist--;
      s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]++;
      s.dyn_dtree[d_code(dist) * 2]++;
    }
    return s.sym_next === s.sym_end;
  }, "_tr_tally$1");
  var _tr_init_1 = _tr_init$1;
  var _tr_stored_block_1 = _tr_stored_block$1;
  var _tr_flush_block_1 = _tr_flush_block$1;
  var _tr_tally_1 = _tr_tally$1;
  var _tr_align_1 = _tr_align$1;
  var trees = {
    _tr_init: _tr_init_1,
    _tr_stored_block: _tr_stored_block_1,
    _tr_flush_block: _tr_flush_block_1,
    _tr_tally: _tr_tally_1,
    _tr_align: _tr_align_1
  };
  var adler32 = /* @__PURE__ */ __name((adler, buf, len, pos) => {
    let s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
    while (len !== 0) {
      n = len > 2e3 ? 2e3 : len;
      len -= n;
      do {
        s1 = s1 + buf[pos++] | 0;
        s2 = s2 + s1 | 0;
      } while (--n);
      s1 %= 65521;
      s2 %= 65521;
    }
    return s1 | s2 << 16 | 0;
  }, "adler32");
  var adler32_1 = adler32;
  var makeTable = /* @__PURE__ */ __name(() => {
    let c, table = [];
    for (var n = 0; n < 256; n++) {
      c = n;
      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      }
      table[n] = c;
    }
    return table;
  }, "makeTable");
  var crcTable = new Uint32Array(makeTable());
  var crc322 = /* @__PURE__ */ __name((crc, buf, len, pos) => {
    const t = crcTable;
    const end = pos + len;
    crc ^= -1;
    for (let i = pos; i < end; i++) {
      crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
    }
    return crc ^ -1;
  }, "crc32");
  var crc32_1 = crc322;
  var messages = {
    2: "need dictionary",
    /* Z_NEED_DICT       2  */
    1: "stream end",
    /* Z_STREAM_END      1  */
    0: "",
    /* Z_OK              0  */
    "-1": "file error",
    /* Z_ERRNO         (-1) */
    "-2": "stream error",
    /* Z_STREAM_ERROR  (-2) */
    "-3": "data error",
    /* Z_DATA_ERROR    (-3) */
    "-4": "insufficient memory",
    /* Z_MEM_ERROR     (-4) */
    "-5": "buffer error",
    /* Z_BUF_ERROR     (-5) */
    "-6": "incompatible version"
    /* Z_VERSION_ERROR (-6) */
  };
  var constants$2 = {
    /* Allowed flush values; see deflate() and inflate() below for details */
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,
    /* Return codes for the compression/decompression functions. Negative values
    * are errors, positive values are used for special but normal events.
    */
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_ERRNO: -1,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    //Z_VERSION_ERROR: -6,
    /* compression levels */
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,
    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,
    /* Possible values of the data_type field (though see inflate()) */
    Z_BINARY: 0,
    Z_TEXT: 1,
    //Z_ASCII:                1, // = Z_TEXT (deprecated)
    Z_UNKNOWN: 2,
    /* The deflate compression method */
    Z_DEFLATED: 8
    //Z_NULL:                 null // Use -1 or null inline, depending on var type
  };
  var { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } = trees;
  var {
    Z_NO_FLUSH: Z_NO_FLUSH$2,
    Z_PARTIAL_FLUSH,
    Z_FULL_FLUSH: Z_FULL_FLUSH$1,
    Z_FINISH: Z_FINISH$3,
    Z_BLOCK: Z_BLOCK$1,
    Z_OK: Z_OK$3,
    Z_STREAM_END: Z_STREAM_END$3,
    Z_STREAM_ERROR: Z_STREAM_ERROR$2,
    Z_DATA_ERROR: Z_DATA_ERROR$2,
    Z_BUF_ERROR: Z_BUF_ERROR$1,
    Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
    Z_FILTERED,
    Z_HUFFMAN_ONLY,
    Z_RLE,
    Z_FIXED,
    Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
    Z_UNKNOWN,
    Z_DEFLATED: Z_DEFLATED$2
  } = constants$2;
  var MAX_MEM_LEVEL = 9;
  var MAX_WBITS$1 = 15;
  var DEF_MEM_LEVEL = 8;
  var LENGTH_CODES = 29;
  var LITERALS = 256;
  var L_CODES = LITERALS + 1 + LENGTH_CODES;
  var D_CODES = 30;
  var BL_CODES = 19;
  var HEAP_SIZE = 2 * L_CODES + 1;
  var MAX_BITS = 15;
  var MIN_MATCH = 3;
  var MAX_MATCH = 258;
  var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
  var PRESET_DICT = 32;
  var INIT_STATE = 42;
  var GZIP_STATE = 57;
  var EXTRA_STATE = 69;
  var NAME_STATE = 73;
  var COMMENT_STATE = 91;
  var HCRC_STATE = 103;
  var BUSY_STATE = 113;
  var FINISH_STATE = 666;
  var BS_NEED_MORE = 1;
  var BS_BLOCK_DONE = 2;
  var BS_FINISH_STARTED = 3;
  var BS_FINISH_DONE = 4;
  var OS_CODE = 3;
  var err = /* @__PURE__ */ __name((strm, errorCode) => {
    strm.msg = messages[errorCode];
    return errorCode;
  }, "err");
  var rank = /* @__PURE__ */ __name((f) => {
    return f * 2 - (f > 4 ? 9 : 0);
  }, "rank");
  var zero = /* @__PURE__ */ __name((buf) => {
    let len = buf.length;
    while (--len >= 0) {
      buf[len] = 0;
    }
  }, "zero");
  var slide_hash = /* @__PURE__ */ __name((s) => {
    let n, m;
    let p;
    let wsize = s.w_size;
    n = s.hash_size;
    p = n;
    do {
      m = s.head[--p];
      s.head[p] = m >= wsize ? m - wsize : 0;
    } while (--n);
    n = wsize;
    p = n;
    do {
      m = s.prev[--p];
      s.prev[p] = m >= wsize ? m - wsize : 0;
    } while (--n);
  }, "slide_hash");
  var HASH_ZLIB = /* @__PURE__ */ __name((s, prev, data) => (prev << s.hash_shift ^ data) & s.hash_mask, "HASH_ZLIB");
  var HASH = HASH_ZLIB;
  var flush_pending = /* @__PURE__ */ __name((strm) => {
    const s = strm.state;
    let len = s.pending;
    if (len > strm.avail_out) {
      len = strm.avail_out;
    }
    if (len === 0) {
      return;
    }
    strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
    strm.next_out += len;
    s.pending_out += len;
    strm.total_out += len;
    strm.avail_out -= len;
    s.pending -= len;
    if (s.pending === 0) {
      s.pending_out = 0;
    }
  }, "flush_pending");
  var flush_block_only = /* @__PURE__ */ __name((s, last) => {
    _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
    s.block_start = s.strstart;
    flush_pending(s.strm);
  }, "flush_block_only");
  var put_byte = /* @__PURE__ */ __name((s, b) => {
    s.pending_buf[s.pending++] = b;
  }, "put_byte");
  var putShortMSB = /* @__PURE__ */ __name((s, b) => {
    s.pending_buf[s.pending++] = b >>> 8 & 255;
    s.pending_buf[s.pending++] = b & 255;
  }, "putShortMSB");
  var read_buf = /* @__PURE__ */ __name((strm, buf, start, size) => {
    let len = strm.avail_in;
    if (len > size) {
      len = size;
    }
    if (len === 0) {
      return 0;
    }
    strm.avail_in -= len;
    buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
    if (strm.state.wrap === 1) {
      strm.adler = adler32_1(strm.adler, buf, len, start);
    } else if (strm.state.wrap === 2) {
      strm.adler = crc32_1(strm.adler, buf, len, start);
    }
    strm.next_in += len;
    strm.total_in += len;
    return len;
  }, "read_buf");
  var longest_match = /* @__PURE__ */ __name((s, cur_match) => {
    let chain_length = s.max_chain_length;
    let scan = s.strstart;
    let match;
    let len;
    let best_len = s.prev_length;
    let nice_match = s.nice_match;
    const limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
    const _win = s.window;
    const wmask = s.w_mask;
    const prev = s.prev;
    const strend = s.strstart + MAX_MATCH;
    let scan_end1 = _win[scan + best_len - 1];
    let scan_end = _win[scan + best_len];
    if (s.prev_length >= s.good_match) {
      chain_length >>= 2;
    }
    if (nice_match > s.lookahead) {
      nice_match = s.lookahead;
    }
    do {
      match = cur_match;
      if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
        continue;
      }
      scan += 2;
      match++;
      do {
      } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
      len = MAX_MATCH - (strend - scan);
      scan = strend - MAX_MATCH;
      if (len > best_len) {
        s.match_start = cur_match;
        best_len = len;
        if (len >= nice_match) {
          break;
        }
        scan_end1 = _win[scan + best_len - 1];
        scan_end = _win[scan + best_len];
      }
    } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
    if (best_len <= s.lookahead) {
      return best_len;
    }
    return s.lookahead;
  }, "longest_match");
  var fill_window = /* @__PURE__ */ __name((s) => {
    const _w_size = s.w_size;
    let n, more, str;
    do {
      more = s.window_size - s.lookahead - s.strstart;
      if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
        s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
        s.match_start -= _w_size;
        s.strstart -= _w_size;
        s.block_start -= _w_size;
        if (s.insert > s.strstart) {
          s.insert = s.strstart;
        }
        slide_hash(s);
        more += _w_size;
      }
      if (s.strm.avail_in === 0) {
        break;
      }
      n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
      s.lookahead += n;
      if (s.lookahead + s.insert >= MIN_MATCH) {
        str = s.strstart - s.insert;
        s.ins_h = s.window[str];
        s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
        while (s.insert) {
          s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
          s.prev[str & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = str;
          str++;
          s.insert--;
          if (s.lookahead + s.insert < MIN_MATCH) {
            break;
          }
        }
      }
    } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
  }, "fill_window");
  var deflate_stored = /* @__PURE__ */ __name((s, flush) => {
    let min_block = s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5;
    let len, left, have, last = 0;
    let used = s.strm.avail_in;
    do {
      len = 65535;
      have = s.bi_valid + 42 >> 3;
      if (s.strm.avail_out < have) {
        break;
      }
      have = s.strm.avail_out - have;
      left = s.strstart - s.block_start;
      if (len > left + s.strm.avail_in) {
        len = left + s.strm.avail_in;
      }
      if (len > have) {
        len = have;
      }
      if (len < min_block && (len === 0 && flush !== Z_FINISH$3 || flush === Z_NO_FLUSH$2 || len !== left + s.strm.avail_in)) {
        break;
      }
      last = flush === Z_FINISH$3 && len === left + s.strm.avail_in ? 1 : 0;
      _tr_stored_block(s, 0, 0, last);
      s.pending_buf[s.pending - 4] = len;
      s.pending_buf[s.pending - 3] = len >> 8;
      s.pending_buf[s.pending - 2] = ~len;
      s.pending_buf[s.pending - 1] = ~len >> 8;
      flush_pending(s.strm);
      if (left) {
        if (left > len) {
          left = len;
        }
        s.strm.output.set(s.window.subarray(s.block_start, s.block_start + left), s.strm.next_out);
        s.strm.next_out += left;
        s.strm.avail_out -= left;
        s.strm.total_out += left;
        s.block_start += left;
        len -= left;
      }
      if (len) {
        read_buf(s.strm, s.strm.output, s.strm.next_out, len);
        s.strm.next_out += len;
        s.strm.avail_out -= len;
        s.strm.total_out += len;
      }
    } while (last === 0);
    used -= s.strm.avail_in;
    if (used) {
      if (used >= s.w_size) {
        s.matches = 2;
        s.window.set(s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in), 0);
        s.strstart = s.w_size;
        s.insert = s.strstart;
      } else {
        if (s.window_size - s.strstart <= used) {
          s.strstart -= s.w_size;
          s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
          if (s.matches < 2) {
            s.matches++;
          }
          if (s.insert > s.strstart) {
            s.insert = s.strstart;
          }
        }
        s.window.set(s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in), s.strstart);
        s.strstart += used;
        s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used;
      }
      s.block_start = s.strstart;
    }
    if (s.high_water < s.strstart) {
      s.high_water = s.strstart;
    }
    if (last) {
      return BS_FINISH_DONE;
    }
    if (flush !== Z_NO_FLUSH$2 && flush !== Z_FINISH$3 && s.strm.avail_in === 0 && s.strstart === s.block_start) {
      return BS_BLOCK_DONE;
    }
    have = s.window_size - s.strstart;
    if (s.strm.avail_in > have && s.block_start >= s.w_size) {
      s.block_start -= s.w_size;
      s.strstart -= s.w_size;
      s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
      if (s.matches < 2) {
        s.matches++;
      }
      have += s.w_size;
      if (s.insert > s.strstart) {
        s.insert = s.strstart;
      }
    }
    if (have > s.strm.avail_in) {
      have = s.strm.avail_in;
    }
    if (have) {
      read_buf(s.strm, s.window, s.strstart, have);
      s.strstart += have;
      s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have;
    }
    if (s.high_water < s.strstart) {
      s.high_water = s.strstart;
    }
    have = s.bi_valid + 42 >> 3;
    have = s.pending_buf_size - have > 65535 ? 65535 : s.pending_buf_size - have;
    min_block = have > s.w_size ? s.w_size : have;
    left = s.strstart - s.block_start;
    if (left >= min_block || (left || flush === Z_FINISH$3) && flush !== Z_NO_FLUSH$2 && s.strm.avail_in === 0 && left <= have) {
      len = left > have ? have : left;
      last = flush === Z_FINISH$3 && s.strm.avail_in === 0 && len === left ? 1 : 0;
      _tr_stored_block(s, s.block_start, len, last);
      s.block_start += len;
      flush_pending(s.strm);
    }
    return last ? BS_FINISH_STARTED : BS_NEED_MORE;
  }, "deflate_stored");
  var deflate_fast = /* @__PURE__ */ __name((s, flush) => {
    let hash_head;
    let bflush;
    for (; ; ) {
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      hash_head = 0;
      if (s.lookahead >= MIN_MATCH) {
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
      }
      if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
        s.match_length = longest_match(s, hash_head);
      }
      if (s.match_length >= MIN_MATCH) {
        bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
        s.lookahead -= s.match_length;
        if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
          s.match_length--;
          do {
            s.strstart++;
            s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          } while (--s.match_length !== 0);
          s.strstart++;
        } else {
          s.strstart += s.match_length;
          s.match_length = 0;
          s.ins_h = s.window[s.strstart];
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);
        }
      } else {
        bflush = _tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.sym_next) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }, "deflate_fast");
  var deflate_slow = /* @__PURE__ */ __name((s, flush) => {
    let hash_head;
    let bflush;
    let max_insert;
    for (; ; ) {
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      hash_head = 0;
      if (s.lookahead >= MIN_MATCH) {
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
      }
      s.prev_length = s.match_length;
      s.prev_match = s.match_start;
      s.match_length = MIN_MATCH - 1;
      if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
        s.match_length = longest_match(s, hash_head);
        if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
          s.match_length = MIN_MATCH - 1;
        }
      }
      if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
        max_insert = s.strstart + s.lookahead - MIN_MATCH;
        bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
        s.lookahead -= s.prev_length - 1;
        s.prev_length -= 2;
        do {
          if (++s.strstart <= max_insert) {
            s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          }
        } while (--s.prev_length !== 0);
        s.match_available = 0;
        s.match_length = MIN_MATCH - 1;
        s.strstart++;
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      } else if (s.match_available) {
        bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
        if (bflush) {
          flush_block_only(s, false);
        }
        s.strstart++;
        s.lookahead--;
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      } else {
        s.match_available = 1;
        s.strstart++;
        s.lookahead--;
      }
    }
    if (s.match_available) {
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
      s.match_available = 0;
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.sym_next) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }, "deflate_slow");
  var deflate_rle = /* @__PURE__ */ __name((s, flush) => {
    let bflush;
    let prev;
    let scan, strend;
    const _win = s.window;
    for (; ; ) {
      if (s.lookahead <= MAX_MATCH) {
        fill_window(s);
        if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      s.match_length = 0;
      if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
        scan = s.strstart - 1;
        prev = _win[scan];
        if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
          strend = s.strstart + MAX_MATCH;
          do {
          } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
          s.match_length = MAX_MATCH - (strend - scan);
          if (s.match_length > s.lookahead) {
            s.match_length = s.lookahead;
          }
        }
      }
      if (s.match_length >= MIN_MATCH) {
        bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);
        s.lookahead -= s.match_length;
        s.strstart += s.match_length;
        s.match_length = 0;
      } else {
        bflush = _tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.sym_next) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }, "deflate_rle");
  var deflate_huff = /* @__PURE__ */ __name((s, flush) => {
    let bflush;
    for (; ; ) {
      if (s.lookahead === 0) {
        fill_window(s);
        if (s.lookahead === 0) {
          if (flush === Z_NO_FLUSH$2) {
            return BS_NEED_MORE;
          }
          break;
        }
      }
      s.match_length = 0;
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.sym_next) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }, "deflate_huff");
  function Config(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }
  __name(Config, "Config");
  var configuration_table = [
    /*      good lazy nice chain */
    new Config(0, 0, 0, 0, deflate_stored),
    /* 0 store only */
    new Config(4, 4, 8, 4, deflate_fast),
    /* 1 max speed, no lazy matches */
    new Config(4, 5, 16, 8, deflate_fast),
    /* 2 */
    new Config(4, 6, 32, 32, deflate_fast),
    /* 3 */
    new Config(4, 4, 16, 16, deflate_slow),
    /* 4 lazy matches */
    new Config(8, 16, 32, 32, deflate_slow),
    /* 5 */
    new Config(8, 16, 128, 128, deflate_slow),
    /* 6 */
    new Config(8, 32, 128, 256, deflate_slow),
    /* 7 */
    new Config(32, 128, 258, 1024, deflate_slow),
    /* 8 */
    new Config(32, 258, 258, 4096, deflate_slow)
    /* 9 max compression */
  ];
  var lm_init = /* @__PURE__ */ __name((s) => {
    s.window_size = 2 * s.w_size;
    zero(s.head);
    s.max_lazy_match = configuration_table[s.level].max_lazy;
    s.good_match = configuration_table[s.level].good_length;
    s.nice_match = configuration_table[s.level].nice_length;
    s.max_chain_length = configuration_table[s.level].max_chain;
    s.strstart = 0;
    s.block_start = 0;
    s.lookahead = 0;
    s.insert = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    s.ins_h = 0;
  }, "lm_init");
  function DeflateState() {
    this.strm = null;
    this.status = 0;
    this.pending_buf = null;
    this.pending_buf_size = 0;
    this.pending_out = 0;
    this.pending = 0;
    this.wrap = 0;
    this.gzhead = null;
    this.gzindex = 0;
    this.method = Z_DEFLATED$2;
    this.last_flush = -1;
    this.w_size = 0;
    this.w_bits = 0;
    this.w_mask = 0;
    this.window = null;
    this.window_size = 0;
    this.prev = null;
    this.head = null;
    this.ins_h = 0;
    this.hash_size = 0;
    this.hash_bits = 0;
    this.hash_mask = 0;
    this.hash_shift = 0;
    this.block_start = 0;
    this.match_length = 0;
    this.prev_match = 0;
    this.match_available = 0;
    this.strstart = 0;
    this.match_start = 0;
    this.lookahead = 0;
    this.prev_length = 0;
    this.max_chain_length = 0;
    this.max_lazy_match = 0;
    this.level = 0;
    this.strategy = 0;
    this.good_match = 0;
    this.nice_match = 0;
    this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2);
    this.dyn_dtree = new Uint16Array((2 * D_CODES + 1) * 2);
    this.bl_tree = new Uint16Array((2 * BL_CODES + 1) * 2);
    zero(this.dyn_ltree);
    zero(this.dyn_dtree);
    zero(this.bl_tree);
    this.l_desc = null;
    this.d_desc = null;
    this.bl_desc = null;
    this.bl_count = new Uint16Array(MAX_BITS + 1);
    this.heap = new Uint16Array(2 * L_CODES + 1);
    zero(this.heap);
    this.heap_len = 0;
    this.heap_max = 0;
    this.depth = new Uint16Array(2 * L_CODES + 1);
    zero(this.depth);
    this.sym_buf = 0;
    this.lit_bufsize = 0;
    this.sym_next = 0;
    this.sym_end = 0;
    this.opt_len = 0;
    this.static_len = 0;
    this.matches = 0;
    this.insert = 0;
    this.bi_buf = 0;
    this.bi_valid = 0;
  }
  __name(DeflateState, "DeflateState");
  var deflateStateCheck = /* @__PURE__ */ __name((strm) => {
    if (!strm) {
      return 1;
    }
    const s = strm.state;
    if (!s || s.strm !== strm || s.status !== INIT_STATE && //#ifdef GZIP
    s.status !== GZIP_STATE && //#endif
    s.status !== EXTRA_STATE && s.status !== NAME_STATE && s.status !== COMMENT_STATE && s.status !== HCRC_STATE && s.status !== BUSY_STATE && s.status !== FINISH_STATE) {
      return 1;
    }
    return 0;
  }, "deflateStateCheck");
  var deflateResetKeep = /* @__PURE__ */ __name((strm) => {
    if (deflateStateCheck(strm)) {
      return err(strm, Z_STREAM_ERROR$2);
    }
    strm.total_in = strm.total_out = 0;
    strm.data_type = Z_UNKNOWN;
    const s = strm.state;
    s.pending = 0;
    s.pending_out = 0;
    if (s.wrap < 0) {
      s.wrap = -s.wrap;
    }
    s.status = //#ifdef GZIP
    s.wrap === 2 ? GZIP_STATE : (
      //#endif
      s.wrap ? INIT_STATE : BUSY_STATE
    );
    strm.adler = s.wrap === 2 ? 0 : 1;
    s.last_flush = -2;
    _tr_init(s);
    return Z_OK$3;
  }, "deflateResetKeep");
  var deflateReset = /* @__PURE__ */ __name((strm) => {
    const ret = deflateResetKeep(strm);
    if (ret === Z_OK$3) {
      lm_init(strm.state);
    }
    return ret;
  }, "deflateReset");
  var deflateSetHeader = /* @__PURE__ */ __name((strm, head) => {
    if (deflateStateCheck(strm) || strm.state.wrap !== 2) {
      return Z_STREAM_ERROR$2;
    }
    strm.state.gzhead = head;
    return Z_OK$3;
  }, "deflateSetHeader");
  var deflateInit2 = /* @__PURE__ */ __name((strm, level, method, windowBits, memLevel, strategy) => {
    if (!strm) {
      return Z_STREAM_ERROR$2;
    }
    let wrap2 = 1;
    if (level === Z_DEFAULT_COMPRESSION$1) {
      level = 6;
    }
    if (windowBits < 0) {
      wrap2 = 0;
      windowBits = -windowBits;
    } else if (windowBits > 15) {
      wrap2 = 2;
      windowBits -= 16;
    }
    if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED || windowBits === 8 && wrap2 !== 1) {
      return err(strm, Z_STREAM_ERROR$2);
    }
    if (windowBits === 8) {
      windowBits = 9;
    }
    const s = new DeflateState();
    strm.state = s;
    s.strm = strm;
    s.status = INIT_STATE;
    s.wrap = wrap2;
    s.gzhead = null;
    s.w_bits = windowBits;
    s.w_size = 1 << s.w_bits;
    s.w_mask = s.w_size - 1;
    s.hash_bits = memLevel + 7;
    s.hash_size = 1 << s.hash_bits;
    s.hash_mask = s.hash_size - 1;
    s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
    s.window = new Uint8Array(s.w_size * 2);
    s.head = new Uint16Array(s.hash_size);
    s.prev = new Uint16Array(s.w_size);
    s.lit_bufsize = 1 << memLevel + 6;
    s.pending_buf_size = s.lit_bufsize * 4;
    s.pending_buf = new Uint8Array(s.pending_buf_size);
    s.sym_buf = s.lit_bufsize;
    s.sym_end = (s.lit_bufsize - 1) * 3;
    s.level = level;
    s.strategy = strategy;
    s.method = method;
    return deflateReset(strm);
  }, "deflateInit2");
  var deflateInit = /* @__PURE__ */ __name((strm, level) => {
    return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
  }, "deflateInit");
  var deflate$2 = /* @__PURE__ */ __name((strm, flush) => {
    if (deflateStateCheck(strm) || flush > Z_BLOCK$1 || flush < 0) {
      return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
    }
    const s = strm.state;
    if (!strm.output || strm.avail_in !== 0 && !strm.input || s.status === FINISH_STATE && flush !== Z_FINISH$3) {
      return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$2);
    }
    const old_flush = s.last_flush;
    s.last_flush = flush;
    if (s.pending !== 0) {
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH$3) {
      return err(strm, Z_BUF_ERROR$1);
    }
    if (s.status === FINISH_STATE && strm.avail_in !== 0) {
      return err(strm, Z_BUF_ERROR$1);
    }
    if (s.status === INIT_STATE && s.wrap === 0) {
      s.status = BUSY_STATE;
    }
    if (s.status === INIT_STATE) {
      let header = Z_DEFLATED$2 + (s.w_bits - 8 << 4) << 8;
      let level_flags = -1;
      if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
        level_flags = 0;
      } else if (s.level < 6) {
        level_flags = 1;
      } else if (s.level === 6) {
        level_flags = 2;
      } else {
        level_flags = 3;
      }
      header |= level_flags << 6;
      if (s.strstart !== 0) {
        header |= PRESET_DICT;
      }
      header += 31 - header % 31;
      putShortMSB(s, header);
      if (s.strstart !== 0) {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 65535);
      }
      strm.adler = 1;
      s.status = BUSY_STATE;
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    }
    if (s.status === GZIP_STATE) {
      strm.adler = 0;
      put_byte(s, 31);
      put_byte(s, 139);
      put_byte(s, 8);
      if (!s.gzhead) {
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
        put_byte(s, OS_CODE);
        s.status = BUSY_STATE;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
      } else {
        put_byte(
          s,
          (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16)
        );
        put_byte(s, s.gzhead.time & 255);
        put_byte(s, s.gzhead.time >> 8 & 255);
        put_byte(s, s.gzhead.time >> 16 & 255);
        put_byte(s, s.gzhead.time >> 24 & 255);
        put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
        put_byte(s, s.gzhead.os & 255);
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 255);
          put_byte(s, s.gzhead.extra.length >> 8 & 255);
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0);
        }
        s.gzindex = 0;
        s.status = EXTRA_STATE;
      }
    }
    if (s.status === EXTRA_STATE) {
      if (s.gzhead.extra) {
        let beg = s.pending;
        let left = (s.gzhead.extra.length & 65535) - s.gzindex;
        while (s.pending + left > s.pending_buf_size) {
          let copy = s.pending_buf_size - s.pending;
          s.pending_buf.set(s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy), s.pending);
          s.pending = s.pending_buf_size;
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          s.gzindex += copy;
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
          left -= copy;
        }
        let gzhead_extra = new Uint8Array(s.gzhead.extra);
        s.pending_buf.set(gzhead_extra.subarray(s.gzindex, s.gzindex + left), s.pending);
        s.pending += left;
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        s.gzindex = 0;
      }
      s.status = NAME_STATE;
    }
    if (s.status === NAME_STATE) {
      if (s.gzhead.name) {
        let beg = s.pending;
        let val;
        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            if (s.pending !== 0) {
              s.last_flush = -1;
              return Z_OK$3;
            }
            beg = 0;
          }
          if (s.gzindex < s.gzhead.name.length) {
            val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        s.gzindex = 0;
      }
      s.status = COMMENT_STATE;
    }
    if (s.status === COMMENT_STATE) {
      if (s.gzhead.comment) {
        let beg = s.pending;
        let val;
        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            if (s.pending !== 0) {
              s.last_flush = -1;
              return Z_OK$3;
            }
            beg = 0;
          }
          if (s.gzindex < s.gzhead.comment.length) {
            val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
      }
      s.status = HCRC_STATE;
    }
    if (s.status === HCRC_STATE) {
      if (s.gzhead.hcrc) {
        if (s.pending + 2 > s.pending_buf_size) {
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
        }
        put_byte(s, strm.adler & 255);
        put_byte(s, strm.adler >> 8 & 255);
        strm.adler = 0;
      }
      s.status = BUSY_STATE;
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    }
    if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE) {
      let bstate = s.level === 0 ? deflate_stored(s, flush) : s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
      if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
        s.status = FINISH_STATE;
      }
      if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
        if (strm.avail_out === 0) {
          s.last_flush = -1;
        }
        return Z_OK$3;
      }
      if (bstate === BS_BLOCK_DONE) {
        if (flush === Z_PARTIAL_FLUSH) {
          _tr_align(s);
        } else if (flush !== Z_BLOCK$1) {
          _tr_stored_block(s, 0, 0, false);
          if (flush === Z_FULL_FLUSH$1) {
            zero(s.head);
            if (s.lookahead === 0) {
              s.strstart = 0;
              s.block_start = 0;
              s.insert = 0;
            }
          }
        }
        flush_pending(strm);
        if (strm.avail_out === 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
      }
    }
    if (flush !== Z_FINISH$3) {
      return Z_OK$3;
    }
    if (s.wrap <= 0) {
      return Z_STREAM_END$3;
    }
    if (s.wrap === 2) {
      put_byte(s, strm.adler & 255);
      put_byte(s, strm.adler >> 8 & 255);
      put_byte(s, strm.adler >> 16 & 255);
      put_byte(s, strm.adler >> 24 & 255);
      put_byte(s, strm.total_in & 255);
      put_byte(s, strm.total_in >> 8 & 255);
      put_byte(s, strm.total_in >> 16 & 255);
      put_byte(s, strm.total_in >> 24 & 255);
    } else {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 65535);
    }
    flush_pending(strm);
    if (s.wrap > 0) {
      s.wrap = -s.wrap;
    }
    return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3;
  }, "deflate$2");
  var deflateEnd = /* @__PURE__ */ __name((strm) => {
    if (deflateStateCheck(strm)) {
      return Z_STREAM_ERROR$2;
    }
    const status = strm.state.status;
    strm.state = null;
    return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3;
  }, "deflateEnd");
  var deflateSetDictionary = /* @__PURE__ */ __name((strm, dictionary) => {
    let dictLength = dictionary.length;
    if (deflateStateCheck(strm)) {
      return Z_STREAM_ERROR$2;
    }
    const s = strm.state;
    const wrap2 = s.wrap;
    if (wrap2 === 2 || wrap2 === 1 && s.status !== INIT_STATE || s.lookahead) {
      return Z_STREAM_ERROR$2;
    }
    if (wrap2 === 1) {
      strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0);
    }
    s.wrap = 0;
    if (dictLength >= s.w_size) {
      if (wrap2 === 0) {
        zero(s.head);
        s.strstart = 0;
        s.block_start = 0;
        s.insert = 0;
      }
      let tmpDict = new Uint8Array(s.w_size);
      tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
      dictionary = tmpDict;
      dictLength = s.w_size;
    }
    const avail = strm.avail_in;
    const next = strm.next_in;
    const input = strm.input;
    strm.avail_in = dictLength;
    strm.next_in = 0;
    strm.input = dictionary;
    fill_window(s);
    while (s.lookahead >= MIN_MATCH) {
      let str = s.strstart;
      let n = s.lookahead - (MIN_MATCH - 1);
      do {
        s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
      } while (--n);
      s.strstart = str;
      s.lookahead = MIN_MATCH - 1;
      fill_window(s);
    }
    s.strstart += s.lookahead;
    s.block_start = s.strstart;
    s.insert = s.lookahead;
    s.lookahead = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    strm.next_in = next;
    strm.input = input;
    strm.avail_in = avail;
    s.wrap = wrap2;
    return Z_OK$3;
  }, "deflateSetDictionary");
  var deflateInit_1 = deflateInit;
  var deflateInit2_1 = deflateInit2;
  var deflateReset_1 = deflateReset;
  var deflateResetKeep_1 = deflateResetKeep;
  var deflateSetHeader_1 = deflateSetHeader;
  var deflate_2$1 = deflate$2;
  var deflateEnd_1 = deflateEnd;
  var deflateSetDictionary_1 = deflateSetDictionary;
  var deflateInfo = "pako deflate (from Nodeca project)";
  var deflate_1$2 = {
    deflateInit: deflateInit_1,
    deflateInit2: deflateInit2_1,
    deflateReset: deflateReset_1,
    deflateResetKeep: deflateResetKeep_1,
    deflateSetHeader: deflateSetHeader_1,
    deflate: deflate_2$1,
    deflateEnd: deflateEnd_1,
    deflateSetDictionary: deflateSetDictionary_1,
    deflateInfo
  };
  var _has = /* @__PURE__ */ __name((obj, key) => {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }, "_has");
  var assign = /* @__PURE__ */ __name(function(obj) {
    const sources = Array.prototype.slice.call(arguments, 1);
    while (sources.length) {
      const source = sources.shift();
      if (!source) {
        continue;
      }
      if (typeof source !== "object") {
        throw new TypeError(source + "must be non-object");
      }
      for (const p in source) {
        if (_has(source, p)) {
          obj[p] = source[p];
        }
      }
    }
    return obj;
  }, "assign");
  var flattenChunks = /* @__PURE__ */ __name((chunks) => {
    let len = 0;
    for (let i = 0, l = chunks.length; i < l; i++) {
      len += chunks[i].length;
    }
    const result = new Uint8Array(len);
    for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
      let chunk = chunks[i];
      result.set(chunk, pos);
      pos += chunk.length;
    }
    return result;
  }, "flattenChunks");
  var common = {
    assign,
    flattenChunks
  };
  var STR_APPLY_UIA_OK = true;
  try {
    String.fromCharCode.apply(null, new Uint8Array(1));
  } catch (__) {
    STR_APPLY_UIA_OK = false;
  }
  var _utf8len = new Uint8Array(256);
  for (let q = 0; q < 256; q++) {
    _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
  }
  _utf8len[254] = _utf8len[254] = 1;
  var string2buf = /* @__PURE__ */ __name((str) => {
    if (typeof TextEncoder === "function" && TextEncoder.prototype.encode) {
      return new TextEncoder().encode(str);
    }
    let buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
    for (m_pos = 0; m_pos < str_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 64512) === 56320) {
          c = 65536 + (c - 55296 << 10) + (c2 - 56320);
          m_pos++;
        }
      }
      buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
    }
    buf = new Uint8Array(buf_len);
    for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 64512) === 56320) {
          c = 65536 + (c - 55296 << 10) + (c2 - 56320);
          m_pos++;
        }
      }
      if (c < 128) {
        buf[i++] = c;
      } else if (c < 2048) {
        buf[i++] = 192 | c >>> 6;
        buf[i++] = 128 | c & 63;
      } else if (c < 65536) {
        buf[i++] = 224 | c >>> 12;
        buf[i++] = 128 | c >>> 6 & 63;
        buf[i++] = 128 | c & 63;
      } else {
        buf[i++] = 240 | c >>> 18;
        buf[i++] = 128 | c >>> 12 & 63;
        buf[i++] = 128 | c >>> 6 & 63;
        buf[i++] = 128 | c & 63;
      }
    }
    return buf;
  }, "string2buf");
  var buf2binstring = /* @__PURE__ */ __name((buf, len) => {
    if (len < 65534) {
      if (buf.subarray && STR_APPLY_UIA_OK) {
        return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len));
      }
    }
    let result = "";
    for (let i = 0; i < len; i++) {
      result += String.fromCharCode(buf[i]);
    }
    return result;
  }, "buf2binstring");
  var buf2string = /* @__PURE__ */ __name((buf, max) => {
    const len = max || buf.length;
    if (typeof TextDecoder === "function" && TextDecoder.prototype.decode) {
      return new TextDecoder().decode(buf.subarray(0, max));
    }
    let i, out;
    const utf16buf = new Array(len * 2);
    for (out = 0, i = 0; i < len; ) {
      let c = buf[i++];
      if (c < 128) {
        utf16buf[out++] = c;
        continue;
      }
      let c_len = _utf8len[c];
      if (c_len > 4) {
        utf16buf[out++] = 65533;
        i += c_len - 1;
        continue;
      }
      c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
      while (c_len > 1 && i < len) {
        c = c << 6 | buf[i++] & 63;
        c_len--;
      }
      if (c_len > 1) {
        utf16buf[out++] = 65533;
        continue;
      }
      if (c < 65536) {
        utf16buf[out++] = c;
      } else {
        c -= 65536;
        utf16buf[out++] = 55296 | c >> 10 & 1023;
        utf16buf[out++] = 56320 | c & 1023;
      }
    }
    return buf2binstring(utf16buf, out);
  }, "buf2string");
  var utf8border = /* @__PURE__ */ __name((buf, max) => {
    max = max || buf.length;
    if (max > buf.length) {
      max = buf.length;
    }
    let pos = max - 1;
    while (pos >= 0 && (buf[pos] & 192) === 128) {
      pos--;
    }
    if (pos < 0) {
      return max;
    }
    if (pos === 0) {
      return max;
    }
    return pos + _utf8len[buf[pos]] > max ? pos : max;
  }, "utf8border");
  var strings = {
    string2buf,
    buf2string,
    utf8border
  };
  function ZStream() {
    this.input = null;
    this.next_in = 0;
    this.avail_in = 0;
    this.total_in = 0;
    this.output = null;
    this.next_out = 0;
    this.avail_out = 0;
    this.total_out = 0;
    this.msg = "";
    this.state = null;
    this.data_type = 2;
    this.adler = 0;
  }
  __name(ZStream, "ZStream");
  var zstream = ZStream;
  var toString$1 = Object.prototype.toString;
  var {
    Z_NO_FLUSH: Z_NO_FLUSH$1,
    Z_SYNC_FLUSH,
    Z_FULL_FLUSH,
    Z_FINISH: Z_FINISH$2,
    Z_OK: Z_OK$2,
    Z_STREAM_END: Z_STREAM_END$2,
    Z_DEFAULT_COMPRESSION,
    Z_DEFAULT_STRATEGY,
    Z_DEFLATED: Z_DEFLATED$1
  } = constants$2;
  function Deflate$1(options) {
    this.options = common.assign({
      level: Z_DEFAULT_COMPRESSION,
      method: Z_DEFLATED$1,
      chunkSize: 16384,
      windowBits: 15,
      memLevel: 8,
      strategy: Z_DEFAULT_STRATEGY
    }, options || {});
    let opt = this.options;
    if (opt.raw && opt.windowBits > 0) {
      opt.windowBits = -opt.windowBits;
    } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
      opt.windowBits += 16;
    }
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.chunks = [];
    this.strm = new zstream();
    this.strm.avail_out = 0;
    let status = deflate_1$2.deflateInit2(
      this.strm,
      opt.level,
      opt.method,
      opt.windowBits,
      opt.memLevel,
      opt.strategy
    );
    if (status !== Z_OK$2) {
      throw new Error(messages[status]);
    }
    if (opt.header) {
      deflate_1$2.deflateSetHeader(this.strm, opt.header);
    }
    if (opt.dictionary) {
      let dict;
      if (typeof opt.dictionary === "string") {
        dict = strings.string2buf(opt.dictionary);
      } else if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") {
        dict = new Uint8Array(opt.dictionary);
      } else {
        dict = opt.dictionary;
      }
      status = deflate_1$2.deflateSetDictionary(this.strm, dict);
      if (status !== Z_OK$2) {
        throw new Error(messages[status]);
      }
      this._dict_set = true;
    }
  }
  __name(Deflate$1, "Deflate$1");
  Deflate$1.prototype.push = function(data, flush_mode) {
    const strm = this.strm;
    const chunkSize = this.options.chunkSize;
    let status, _flush_mode;
    if (this.ended) {
      return false;
    }
    if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
    else _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1;
    if (typeof data === "string") {
      strm.input = strings.string2buf(data);
    } else if (toString$1.call(data) === "[object ArrayBuffer]") {
      strm.input = new Uint8Array(data);
    } else {
      strm.input = data;
    }
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    for (; ; ) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      if ((_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) && strm.avail_out <= 6) {
        this.onData(strm.output.subarray(0, strm.next_out));
        strm.avail_out = 0;
        continue;
      }
      status = deflate_1$2.deflate(strm, _flush_mode);
      if (status === Z_STREAM_END$2) {
        if (strm.next_out > 0) {
          this.onData(strm.output.subarray(0, strm.next_out));
        }
        status = deflate_1$2.deflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return status === Z_OK$2;
      }
      if (strm.avail_out === 0) {
        this.onData(strm.output);
        continue;
      }
      if (_flush_mode > 0 && strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
        strm.avail_out = 0;
        continue;
      }
      if (strm.avail_in === 0) break;
    }
    return true;
  };
  Deflate$1.prototype.onData = function(chunk) {
    this.chunks.push(chunk);
  };
  Deflate$1.prototype.onEnd = function(status) {
    if (status === Z_OK$2) {
      this.result = common.flattenChunks(this.chunks);
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
  };
  function deflate$1(input, options) {
    const deflator = new Deflate$1(options);
    deflator.push(input, true);
    if (deflator.err) {
      throw deflator.msg || messages[deflator.err];
    }
    return deflator.result;
  }
  __name(deflate$1, "deflate$1");
  function deflateRaw$1(input, options) {
    options = options || {};
    options.raw = true;
    return deflate$1(input, options);
  }
  __name(deflateRaw$1, "deflateRaw$1");
  function gzip$1(input, options) {
    options = options || {};
    options.gzip = true;
    return deflate$1(input, options);
  }
  __name(gzip$1, "gzip$1");
  var Deflate_1$1 = Deflate$1;
  var deflate_2 = deflate$1;
  var deflateRaw_1$1 = deflateRaw$1;
  var gzip_1$1 = gzip$1;
  var constants$1 = constants$2;
  var deflate_1$1 = {
    Deflate: Deflate_1$1,
    deflate: deflate_2,
    deflateRaw: deflateRaw_1$1,
    gzip: gzip_1$1,
    constants: constants$1
  };
  var BAD$1 = 16209;
  var TYPE$1 = 16191;
  var inffast = /* @__PURE__ */ __name(function inflate_fast(strm, start) {
    let _in;
    let last;
    let _out;
    let beg;
    let end;
    let dmax;
    let wsize;
    let whave;
    let wnext;
    let s_window;
    let hold;
    let bits;
    let lcode;
    let dcode;
    let lmask;
    let dmask;
    let here;
    let op;
    let len;
    let dist;
    let from;
    let from_source;
    let input, output;
    const state = strm.state;
    _in = strm.next_in;
    input = strm.input;
    last = _in + (strm.avail_in - 5);
    _out = strm.next_out;
    output = strm.output;
    beg = _out - (start - strm.avail_out);
    end = _out + (strm.avail_out - 257);
    dmax = state.dmax;
    wsize = state.wsize;
    whave = state.whave;
    wnext = state.wnext;
    s_window = state.window;
    hold = state.hold;
    bits = state.bits;
    lcode = state.lencode;
    dcode = state.distcode;
    lmask = (1 << state.lenbits) - 1;
    dmask = (1 << state.distbits) - 1;
    top:
      do {
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = lcode[hold & lmask];
        dolen:
          for (; ; ) {
            op = here >>> 24;
            hold >>>= op;
            bits -= op;
            op = here >>> 16 & 255;
            if (op === 0) {
              output[_out++] = here & 65535;
            } else if (op & 16) {
              len = here & 65535;
              op &= 15;
              if (op) {
                if (bits < op) {
                  hold += input[_in++] << bits;
                  bits += 8;
                }
                len += hold & (1 << op) - 1;
                hold >>>= op;
                bits -= op;
              }
              if (bits < 15) {
                hold += input[_in++] << bits;
                bits += 8;
                hold += input[_in++] << bits;
                bits += 8;
              }
              here = dcode[hold & dmask];
              dodist:
                for (; ; ) {
                  op = here >>> 24;
                  hold >>>= op;
                  bits -= op;
                  op = here >>> 16 & 255;
                  if (op & 16) {
                    dist = here & 65535;
                    op &= 15;
                    if (bits < op) {
                      hold += input[_in++] << bits;
                      bits += 8;
                      if (bits < op) {
                        hold += input[_in++] << bits;
                        bits += 8;
                      }
                    }
                    dist += hold & (1 << op) - 1;
                    if (dist > dmax) {
                      strm.msg = "invalid distance too far back";
                      state.mode = BAD$1;
                      break top;
                    }
                    hold >>>= op;
                    bits -= op;
                    op = _out - beg;
                    if (dist > op) {
                      op = dist - op;
                      if (op > whave) {
                        if (state.sane) {
                          strm.msg = "invalid distance too far back";
                          state.mode = BAD$1;
                          break top;
                        }
                      }
                      from = 0;
                      from_source = s_window;
                      if (wnext === 0) {
                        from += wsize - op;
                        if (op < len) {
                          len -= op;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op);
                          from = _out - dist;
                          from_source = output;
                        }
                      } else if (wnext < op) {
                        from += wsize + wnext - op;
                        op -= wnext;
                        if (op < len) {
                          len -= op;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op);
                          from = 0;
                          if (wnext < len) {
                            op = wnext;
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = _out - dist;
                            from_source = output;
                          }
                        }
                      } else {
                        from += wnext - op;
                        if (op < len) {
                          len -= op;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op);
                          from = _out - dist;
                          from_source = output;
                        }
                      }
                      while (len > 2) {
                        output[_out++] = from_source[from++];
                        output[_out++] = from_source[from++];
                        output[_out++] = from_source[from++];
                        len -= 3;
                      }
                      if (len) {
                        output[_out++] = from_source[from++];
                        if (len > 1) {
                          output[_out++] = from_source[from++];
                        }
                      }
                    } else {
                      from = _out - dist;
                      do {
                        output[_out++] = output[from++];
                        output[_out++] = output[from++];
                        output[_out++] = output[from++];
                        len -= 3;
                      } while (len > 2);
                      if (len) {
                        output[_out++] = output[from++];
                        if (len > 1) {
                          output[_out++] = output[from++];
                        }
                      }
                    }
                  } else if ((op & 64) === 0) {
                    here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                    continue dodist;
                  } else {
                    strm.msg = "invalid distance code";
                    state.mode = BAD$1;
                    break top;
                  }
                  break;
                }
            } else if ((op & 64) === 0) {
              here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
              continue dolen;
            } else if (op & 32) {
              state.mode = TYPE$1;
              break top;
            } else {
              strm.msg = "invalid literal/length code";
              state.mode = BAD$1;
              break top;
            }
            break;
          }
      } while (_in < last && _out < end);
    len = bits >> 3;
    _in -= len;
    bits -= len << 3;
    hold &= (1 << bits) - 1;
    strm.next_in = _in;
    strm.next_out = _out;
    strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
    strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
    state.hold = hold;
    state.bits = bits;
    return;
  }, "inflate_fast");
  var MAXBITS = 15;
  var ENOUGH_LENS$1 = 852;
  var ENOUGH_DISTS$1 = 592;
  var CODES$1 = 0;
  var LENS$1 = 1;
  var DISTS$1 = 2;
  var lbase = new Uint16Array([
    /* Length codes 257..285 base */
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    13,
    15,
    17,
    19,
    23,
    27,
    31,
    35,
    43,
    51,
    59,
    67,
    83,
    99,
    115,
    131,
    163,
    195,
    227,
    258,
    0,
    0
  ]);
  var lext = new Uint8Array([
    /* Length codes 257..285 extra */
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    17,
    17,
    17,
    17,
    18,
    18,
    18,
    18,
    19,
    19,
    19,
    19,
    20,
    20,
    20,
    20,
    21,
    21,
    21,
    21,
    16,
    72,
    78
  ]);
  var dbase = new Uint16Array([
    /* Distance codes 0..29 base */
    1,
    2,
    3,
    4,
    5,
    7,
    9,
    13,
    17,
    25,
    33,
    49,
    65,
    97,
    129,
    193,
    257,
    385,
    513,
    769,
    1025,
    1537,
    2049,
    3073,
    4097,
    6145,
    8193,
    12289,
    16385,
    24577,
    0,
    0
  ]);
  var dext = new Uint8Array([
    /* Distance codes 0..29 extra */
    16,
    16,
    16,
    16,
    17,
    17,
    18,
    18,
    19,
    19,
    20,
    20,
    21,
    21,
    22,
    22,
    23,
    23,
    24,
    24,
    25,
    25,
    26,
    26,
    27,
    27,
    28,
    28,
    29,
    29,
    64,
    64
  ]);
  var inflate_table = /* @__PURE__ */ __name((type, lens, lens_index, codes, table, table_index, work, opts) => {
    const bits = opts.bits;
    let len = 0;
    let sym = 0;
    let min = 0, max = 0;
    let root = 0;
    let curr = 0;
    let drop = 0;
    let left = 0;
    let used = 0;
    let huff = 0;
    let incr;
    let fill;
    let low;
    let mask;
    let next;
    let base = null;
    let match;
    const count = new Uint16Array(MAXBITS + 1);
    const offs = new Uint16Array(MAXBITS + 1);
    let extra = null;
    let here_bits, here_op, here_val;
    for (len = 0; len <= MAXBITS; len++) {
      count[len] = 0;
    }
    for (sym = 0; sym < codes; sym++) {
      count[lens[lens_index + sym]]++;
    }
    root = bits;
    for (max = MAXBITS; max >= 1; max--) {
      if (count[max] !== 0) {
        break;
      }
    }
    if (root > max) {
      root = max;
    }
    if (max === 0) {
      table[table_index++] = 1 << 24 | 64 << 16 | 0;
      table[table_index++] = 1 << 24 | 64 << 16 | 0;
      opts.bits = 1;
      return 0;
    }
    for (min = 1; min < max; min++) {
      if (count[min] !== 0) {
        break;
      }
    }
    if (root < min) {
      root = min;
    }
    left = 1;
    for (len = 1; len <= MAXBITS; len++) {
      left <<= 1;
      left -= count[len];
      if (left < 0) {
        return -1;
      }
    }
    if (left > 0 && (type === CODES$1 || max !== 1)) {
      return -1;
    }
    offs[1] = 0;
    for (len = 1; len < MAXBITS; len++) {
      offs[len + 1] = offs[len] + count[len];
    }
    for (sym = 0; sym < codes; sym++) {
      if (lens[lens_index + sym] !== 0) {
        work[offs[lens[lens_index + sym]]++] = sym;
      }
    }
    if (type === CODES$1) {
      base = extra = work;
      match = 20;
    } else if (type === LENS$1) {
      base = lbase;
      extra = lext;
      match = 257;
    } else {
      base = dbase;
      extra = dext;
      match = 0;
    }
    huff = 0;
    sym = 0;
    len = min;
    next = table_index;
    curr = root;
    drop = 0;
    low = -1;
    used = 1 << root;
    mask = used - 1;
    if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
      return 1;
    }
    for (; ; ) {
      here_bits = len - drop;
      if (work[sym] + 1 < match) {
        here_op = 0;
        here_val = work[sym];
      } else if (work[sym] >= match) {
        here_op = extra[work[sym] - match];
        here_val = base[work[sym] - match];
      } else {
        here_op = 32 + 64;
        here_val = 0;
      }
      incr = 1 << len - drop;
      fill = 1 << curr;
      min = fill;
      do {
        fill -= incr;
        table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
      } while (fill !== 0);
      incr = 1 << len - 1;
      while (huff & incr) {
        incr >>= 1;
      }
      if (incr !== 0) {
        huff &= incr - 1;
        huff += incr;
      } else {
        huff = 0;
      }
      sym++;
      if (--count[len] === 0) {
        if (len === max) {
          break;
        }
        len = lens[lens_index + work[sym]];
      }
      if (len > root && (huff & mask) !== low) {
        if (drop === 0) {
          drop = root;
        }
        next += min;
        curr = len - drop;
        left = 1 << curr;
        while (curr + drop < max) {
          left -= count[curr + drop];
          if (left <= 0) {
            break;
          }
          curr++;
          left <<= 1;
        }
        used += 1 << curr;
        if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
          return 1;
        }
        low = huff & mask;
        table[low] = root << 24 | curr << 16 | next - table_index | 0;
      }
    }
    if (huff !== 0) {
      table[next + huff] = len - drop << 24 | 64 << 16 | 0;
    }
    opts.bits = root;
    return 0;
  }, "inflate_table");
  var inftrees = inflate_table;
  var CODES = 0;
  var LENS = 1;
  var DISTS = 2;
  var {
    Z_FINISH: Z_FINISH$1,
    Z_BLOCK,
    Z_TREES,
    Z_OK: Z_OK$1,
    Z_STREAM_END: Z_STREAM_END$1,
    Z_NEED_DICT: Z_NEED_DICT$1,
    Z_STREAM_ERROR: Z_STREAM_ERROR$1,
    Z_DATA_ERROR: Z_DATA_ERROR$1,
    Z_MEM_ERROR: Z_MEM_ERROR$1,
    Z_BUF_ERROR,
    Z_DEFLATED
  } = constants$2;
  var HEAD = 16180;
  var FLAGS = 16181;
  var TIME = 16182;
  var OS = 16183;
  var EXLEN = 16184;
  var EXTRA = 16185;
  var NAME = 16186;
  var COMMENT = 16187;
  var HCRC = 16188;
  var DICTID = 16189;
  var DICT = 16190;
  var TYPE = 16191;
  var TYPEDO = 16192;
  var STORED = 16193;
  var COPY_ = 16194;
  var COPY = 16195;
  var TABLE = 16196;
  var LENLENS = 16197;
  var CODELENS = 16198;
  var LEN_ = 16199;
  var LEN = 16200;
  var LENEXT = 16201;
  var DIST = 16202;
  var DISTEXT = 16203;
  var MATCH = 16204;
  var LIT = 16205;
  var CHECK = 16206;
  var LENGTH = 16207;
  var DONE = 16208;
  var BAD = 16209;
  var MEM = 16210;
  var SYNC = 16211;
  var ENOUGH_LENS = 852;
  var ENOUGH_DISTS = 592;
  var MAX_WBITS = 15;
  var DEF_WBITS = MAX_WBITS;
  var zswap32 = /* @__PURE__ */ __name((q) => {
    return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
  }, "zswap32");
  function InflateState() {
    this.strm = null;
    this.mode = 0;
    this.last = false;
    this.wrap = 0;
    this.havedict = false;
    this.flags = 0;
    this.dmax = 0;
    this.check = 0;
    this.total = 0;
    this.head = null;
    this.wbits = 0;
    this.wsize = 0;
    this.whave = 0;
    this.wnext = 0;
    this.window = null;
    this.hold = 0;
    this.bits = 0;
    this.length = 0;
    this.offset = 0;
    this.extra = 0;
    this.lencode = null;
    this.distcode = null;
    this.lenbits = 0;
    this.distbits = 0;
    this.ncode = 0;
    this.nlen = 0;
    this.ndist = 0;
    this.have = 0;
    this.next = null;
    this.lens = new Uint16Array(320);
    this.work = new Uint16Array(288);
    this.lendyn = null;
    this.distdyn = null;
    this.sane = 0;
    this.back = 0;
    this.was = 0;
  }
  __name(InflateState, "InflateState");
  var inflateStateCheck = /* @__PURE__ */ __name((strm) => {
    if (!strm) {
      return 1;
    }
    const state = strm.state;
    if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) {
      return 1;
    }
    return 0;
  }, "inflateStateCheck");
  var inflateResetKeep = /* @__PURE__ */ __name((strm) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    strm.total_in = strm.total_out = state.total = 0;
    strm.msg = "";
    if (state.wrap) {
      strm.adler = state.wrap & 1;
    }
    state.mode = HEAD;
    state.last = 0;
    state.havedict = 0;
    state.flags = -1;
    state.dmax = 32768;
    state.head = null;
    state.hold = 0;
    state.bits = 0;
    state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
    state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);
    state.sane = 1;
    state.back = -1;
    return Z_OK$1;
  }, "inflateResetKeep");
  var inflateReset = /* @__PURE__ */ __name((strm) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    state.wsize = 0;
    state.whave = 0;
    state.wnext = 0;
    return inflateResetKeep(strm);
  }, "inflateReset");
  var inflateReset2 = /* @__PURE__ */ __name((strm, windowBits) => {
    let wrap2;
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    if (windowBits < 0) {
      wrap2 = 0;
      windowBits = -windowBits;
    } else {
      wrap2 = (windowBits >> 4) + 5;
      if (windowBits < 48) {
        windowBits &= 15;
      }
    }
    if (windowBits && (windowBits < 8 || windowBits > 15)) {
      return Z_STREAM_ERROR$1;
    }
    if (state.window !== null && state.wbits !== windowBits) {
      state.window = null;
    }
    state.wrap = wrap2;
    state.wbits = windowBits;
    return inflateReset(strm);
  }, "inflateReset2");
  var inflateInit2 = /* @__PURE__ */ __name((strm, windowBits) => {
    if (!strm) {
      return Z_STREAM_ERROR$1;
    }
    const state = new InflateState();
    strm.state = state;
    state.strm = strm;
    state.window = null;
    state.mode = HEAD;
    const ret = inflateReset2(strm, windowBits);
    if (ret !== Z_OK$1) {
      strm.state = null;
    }
    return ret;
  }, "inflateInit2");
  var inflateInit = /* @__PURE__ */ __name((strm) => {
    return inflateInit2(strm, DEF_WBITS);
  }, "inflateInit");
  var virgin = true;
  var lenfix;
  var distfix;
  var fixedtables = /* @__PURE__ */ __name((state) => {
    if (virgin) {
      lenfix = new Int32Array(512);
      distfix = new Int32Array(32);
      let sym = 0;
      while (sym < 144) {
        state.lens[sym++] = 8;
      }
      while (sym < 256) {
        state.lens[sym++] = 9;
      }
      while (sym < 280) {
        state.lens[sym++] = 7;
      }
      while (sym < 288) {
        state.lens[sym++] = 8;
      }
      inftrees(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
      sym = 0;
      while (sym < 32) {
        state.lens[sym++] = 5;
      }
      inftrees(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
      virgin = false;
    }
    state.lencode = lenfix;
    state.lenbits = 9;
    state.distcode = distfix;
    state.distbits = 5;
  }, "fixedtables");
  var updatewindow = /* @__PURE__ */ __name((strm, src, end, copy) => {
    let dist;
    const state = strm.state;
    if (state.window === null) {
      state.wsize = 1 << state.wbits;
      state.wnext = 0;
      state.whave = 0;
      state.window = new Uint8Array(state.wsize);
    }
    if (copy >= state.wsize) {
      state.window.set(src.subarray(end - state.wsize, end), 0);
      state.wnext = 0;
      state.whave = state.wsize;
    } else {
      dist = state.wsize - state.wnext;
      if (dist > copy) {
        dist = copy;
      }
      state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
      copy -= dist;
      if (copy) {
        state.window.set(src.subarray(end - copy, end), 0);
        state.wnext = copy;
        state.whave = state.wsize;
      } else {
        state.wnext += dist;
        if (state.wnext === state.wsize) {
          state.wnext = 0;
        }
        if (state.whave < state.wsize) {
          state.whave += dist;
        }
      }
    }
    return 0;
  }, "updatewindow");
  var inflate$2 = /* @__PURE__ */ __name((strm, flush) => {
    let state;
    let input, output;
    let next;
    let put;
    let have, left;
    let hold;
    let bits;
    let _in, _out;
    let copy;
    let from;
    let from_source;
    let here = 0;
    let here_bits, here_op, here_val;
    let last_bits, last_op, last_val;
    let len;
    let ret;
    const hbuf = new Uint8Array(4);
    let opts;
    let n;
    const order = (
      /* permutation of code lengths */
      new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
    );
    if (inflateStateCheck(strm) || !strm.output || !strm.input && strm.avail_in !== 0) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;
    if (state.mode === TYPE) {
      state.mode = TYPEDO;
    }
    put = strm.next_out;
    output = strm.output;
    left = strm.avail_out;
    next = strm.next_in;
    input = strm.input;
    have = strm.avail_in;
    hold = state.hold;
    bits = state.bits;
    _in = have;
    _out = left;
    ret = Z_OK$1;
    inf_leave:
      for (; ; ) {
        switch (state.mode) {
          case HEAD:
            if (state.wrap === 0) {
              state.mode = TYPEDO;
              break;
            }
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 2 && hold === 35615) {
              if (state.wbits === 0) {
                state.wbits = 15;
              }
              state.check = 0;
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
              hold = 0;
              bits = 0;
              state.mode = FLAGS;
              break;
            }
            if (state.head) {
              state.head.done = false;
            }
            if (!(state.wrap & 1) || /* check if zlib header allowed */
            (((hold & 255) << 8) + (hold >> 8)) % 31) {
              strm.msg = "incorrect header check";
              state.mode = BAD;
              break;
            }
            if ((hold & 15) !== Z_DEFLATED) {
              strm.msg = "unknown compression method";
              state.mode = BAD;
              break;
            }
            hold >>>= 4;
            bits -= 4;
            len = (hold & 15) + 8;
            if (state.wbits === 0) {
              state.wbits = len;
            }
            if (len > 15 || len > state.wbits) {
              strm.msg = "invalid window size";
              state.mode = BAD;
              break;
            }
            state.dmax = 1 << state.wbits;
            state.flags = 0;
            strm.adler = state.check = 1;
            state.mode = hold & 512 ? DICTID : TYPE;
            hold = 0;
            bits = 0;
            break;
          case FLAGS:
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.flags = hold;
            if ((state.flags & 255) !== Z_DEFLATED) {
              strm.msg = "unknown compression method";
              state.mode = BAD;
              break;
            }
            if (state.flags & 57344) {
              strm.msg = "unknown header flags set";
              state.mode = BAD;
              break;
            }
            if (state.head) {
              state.head.text = hold >> 8 & 1;
            }
            if (state.flags & 512 && state.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = TIME;
          /* falls through */
          case TIME:
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.head) {
              state.head.time = hold;
            }
            if (state.flags & 512 && state.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              hbuf[2] = hold >>> 16 & 255;
              hbuf[3] = hold >>> 24 & 255;
              state.check = crc32_1(state.check, hbuf, 4, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = OS;
          /* falls through */
          case OS:
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.head) {
              state.head.xflags = hold & 255;
              state.head.os = hold >> 8;
            }
            if (state.flags & 512 && state.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = EXLEN;
          /* falls through */
          case EXLEN:
            if (state.flags & 1024) {
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.length = hold;
              if (state.head) {
                state.head.extra_len = hold;
              }
              if (state.flags & 512 && state.wrap & 4) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc32_1(state.check, hbuf, 2, 0);
              }
              hold = 0;
              bits = 0;
            } else if (state.head) {
              state.head.extra = null;
            }
            state.mode = EXTRA;
          /* falls through */
          case EXTRA:
            if (state.flags & 1024) {
              copy = state.length;
              if (copy > have) {
                copy = have;
              }
              if (copy) {
                if (state.head) {
                  len = state.head.extra_len - state.length;
                  if (!state.head.extra) {
                    state.head.extra = new Uint8Array(state.head.extra_len);
                  }
                  state.head.extra.set(
                    input.subarray(
                      next,
                      // extra field is limited to 65536 bytes
                      // - no need for additional size check
                      next + copy
                    ),
                    /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                    len
                  );
                }
                if (state.flags & 512 && state.wrap & 4) {
                  state.check = crc32_1(state.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                state.length -= copy;
              }
              if (state.length) {
                break inf_leave;
              }
            }
            state.length = 0;
            state.mode = NAME;
          /* falls through */
          case NAME:
            if (state.flags & 2048) {
              if (have === 0) {
                break inf_leave;
              }
              copy = 0;
              do {
                len = input[next + copy++];
                if (state.head && len && state.length < 65536) {
                  state.head.name += String.fromCharCode(len);
                }
              } while (len && copy < have);
              if (state.flags & 512 && state.wrap & 4) {
                state.check = crc32_1(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              if (len) {
                break inf_leave;
              }
            } else if (state.head) {
              state.head.name = null;
            }
            state.length = 0;
            state.mode = COMMENT;
          /* falls through */
          case COMMENT:
            if (state.flags & 4096) {
              if (have === 0) {
                break inf_leave;
              }
              copy = 0;
              do {
                len = input[next + copy++];
                if (state.head && len && state.length < 65536) {
                  state.head.comment += String.fromCharCode(len);
                }
              } while (len && copy < have);
              if (state.flags & 512 && state.wrap & 4) {
                state.check = crc32_1(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              if (len) {
                break inf_leave;
              }
            } else if (state.head) {
              state.head.comment = null;
            }
            state.mode = HCRC;
          /* falls through */
          case HCRC:
            if (state.flags & 512) {
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (state.wrap & 4 && hold !== (state.check & 65535)) {
                strm.msg = "header crc mismatch";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            if (state.head) {
              state.head.hcrc = state.flags >> 9 & 1;
              state.head.done = true;
            }
            strm.adler = state.check = 0;
            state.mode = TYPE;
            break;
          case DICTID:
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            strm.adler = state.check = zswap32(hold);
            hold = 0;
            bits = 0;
            state.mode = DICT;
          /* falls through */
          case DICT:
            if (state.havedict === 0) {
              strm.next_out = put;
              strm.avail_out = left;
              strm.next_in = next;
              strm.avail_in = have;
              state.hold = hold;
              state.bits = bits;
              return Z_NEED_DICT$1;
            }
            strm.adler = state.check = 1;
            state.mode = TYPE;
          /* falls through */
          case TYPE:
            if (flush === Z_BLOCK || flush === Z_TREES) {
              break inf_leave;
            }
          /* falls through */
          case TYPEDO:
            if (state.last) {
              hold >>>= bits & 7;
              bits -= bits & 7;
              state.mode = CHECK;
              break;
            }
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.last = hold & 1;
            hold >>>= 1;
            bits -= 1;
            switch (hold & 3) {
              case 0:
                state.mode = STORED;
                break;
              case 1:
                fixedtables(state);
                state.mode = LEN_;
                if (flush === Z_TREES) {
                  hold >>>= 2;
                  bits -= 2;
                  break inf_leave;
                }
                break;
              case 2:
                state.mode = TABLE;
                break;
              case 3:
                strm.msg = "invalid block type";
                state.mode = BAD;
            }
            hold >>>= 2;
            bits -= 2;
            break;
          case STORED:
            hold >>>= bits & 7;
            bits -= bits & 7;
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
              strm.msg = "invalid stored block lengths";
              state.mode = BAD;
              break;
            }
            state.length = hold & 65535;
            hold = 0;
            bits = 0;
            state.mode = COPY_;
            if (flush === Z_TREES) {
              break inf_leave;
            }
          /* falls through */
          case COPY_:
            state.mode = COPY;
          /* falls through */
          case COPY:
            copy = state.length;
            if (copy) {
              if (copy > have) {
                copy = have;
              }
              if (copy > left) {
                copy = left;
              }
              if (copy === 0) {
                break inf_leave;
              }
              output.set(input.subarray(next, next + copy), put);
              have -= copy;
              next += copy;
              left -= copy;
              put += copy;
              state.length -= copy;
              break;
            }
            state.mode = TYPE;
            break;
          case TABLE:
            while (bits < 14) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.nlen = (hold & 31) + 257;
            hold >>>= 5;
            bits -= 5;
            state.ndist = (hold & 31) + 1;
            hold >>>= 5;
            bits -= 5;
            state.ncode = (hold & 15) + 4;
            hold >>>= 4;
            bits -= 4;
            if (state.nlen > 286 || state.ndist > 30) {
              strm.msg = "too many length or distance symbols";
              state.mode = BAD;
              break;
            }
            state.have = 0;
            state.mode = LENLENS;
          /* falls through */
          case LENLENS:
            while (state.have < state.ncode) {
              while (bits < 3) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.lens[order[state.have++]] = hold & 7;
              hold >>>= 3;
              bits -= 3;
            }
            while (state.have < 19) {
              state.lens[order[state.have++]] = 0;
            }
            state.lencode = state.lendyn;
            state.lenbits = 7;
            opts = { bits: state.lenbits };
            ret = inftrees(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
            state.lenbits = opts.bits;
            if (ret) {
              strm.msg = "invalid code lengths set";
              state.mode = BAD;
              break;
            }
            state.have = 0;
            state.mode = CODELENS;
          /* falls through */
          case CODELENS:
            while (state.have < state.nlen + state.ndist) {
              for (; ; ) {
                here = state.lencode[hold & (1 << state.lenbits) - 1];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (here_val < 16) {
                hold >>>= here_bits;
                bits -= here_bits;
                state.lens[state.have++] = here_val;
              } else {
                if (here_val === 16) {
                  n = here_bits + 2;
                  while (bits < n) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  if (state.have === 0) {
                    strm.msg = "invalid bit length repeat";
                    state.mode = BAD;
                    break;
                  }
                  len = state.lens[state.have - 1];
                  copy = 3 + (hold & 3);
                  hold >>>= 2;
                  bits -= 2;
                } else if (here_val === 17) {
                  n = here_bits + 3;
                  while (bits < n) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  len = 0;
                  copy = 3 + (hold & 7);
                  hold >>>= 3;
                  bits -= 3;
                } else {
                  n = here_bits + 7;
                  while (bits < n) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  len = 0;
                  copy = 11 + (hold & 127);
                  hold >>>= 7;
                  bits -= 7;
                }
                if (state.have + copy > state.nlen + state.ndist) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD;
                  break;
                }
                while (copy--) {
                  state.lens[state.have++] = len;
                }
              }
            }
            if (state.mode === BAD) {
              break;
            }
            if (state.lens[256] === 0) {
              strm.msg = "invalid code -- missing end-of-block";
              state.mode = BAD;
              break;
            }
            state.lenbits = 9;
            opts = { bits: state.lenbits };
            ret = inftrees(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
            state.lenbits = opts.bits;
            if (ret) {
              strm.msg = "invalid literal/lengths set";
              state.mode = BAD;
              break;
            }
            state.distbits = 6;
            state.distcode = state.distdyn;
            opts = { bits: state.distbits };
            ret = inftrees(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
            state.distbits = opts.bits;
            if (ret) {
              strm.msg = "invalid distances set";
              state.mode = BAD;
              break;
            }
            state.mode = LEN_;
            if (flush === Z_TREES) {
              break inf_leave;
            }
          /* falls through */
          case LEN_:
            state.mode = LEN;
          /* falls through */
          case LEN:
            if (have >= 6 && left >= 258) {
              strm.next_out = put;
              strm.avail_out = left;
              strm.next_in = next;
              strm.avail_in = have;
              state.hold = hold;
              state.bits = bits;
              inffast(strm, _out);
              put = strm.next_out;
              output = strm.output;
              left = strm.avail_out;
              next = strm.next_in;
              input = strm.input;
              have = strm.avail_in;
              hold = state.hold;
              bits = state.bits;
              if (state.mode === TYPE) {
                state.back = -1;
              }
              break;
            }
            state.back = 0;
            for (; ; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_op && (here_op & 240) === 0) {
              last_bits = here_bits;
              last_op = here_op;
              last_val = here_val;
              for (; ; ) {
                here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (last_bits + here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              hold >>>= last_bits;
              bits -= last_bits;
              state.back += last_bits;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            state.back += here_bits;
            state.length = here_val;
            if (here_op === 0) {
              state.mode = LIT;
              break;
            }
            if (here_op & 32) {
              state.back = -1;
              state.mode = TYPE;
              break;
            }
            if (here_op & 64) {
              strm.msg = "invalid literal/length code";
              state.mode = BAD;
              break;
            }
            state.extra = here_op & 15;
            state.mode = LENEXT;
          /* falls through */
          case LENEXT:
            if (state.extra) {
              n = state.extra;
              while (bits < n) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.length += hold & (1 << state.extra) - 1;
              hold >>>= state.extra;
              bits -= state.extra;
              state.back += state.extra;
            }
            state.was = state.length;
            state.mode = DIST;
          /* falls through */
          case DIST:
            for (; ; ) {
              here = state.distcode[hold & (1 << state.distbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if ((here_op & 240) === 0) {
              last_bits = here_bits;
              last_op = here_op;
              last_val = here_val;
              for (; ; ) {
                here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (last_bits + here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              hold >>>= last_bits;
              bits -= last_bits;
              state.back += last_bits;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            state.back += here_bits;
            if (here_op & 64) {
              strm.msg = "invalid distance code";
              state.mode = BAD;
              break;
            }
            state.offset = here_val;
            state.extra = here_op & 15;
            state.mode = DISTEXT;
          /* falls through */
          case DISTEXT:
            if (state.extra) {
              n = state.extra;
              while (bits < n) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.offset += hold & (1 << state.extra) - 1;
              hold >>>= state.extra;
              bits -= state.extra;
              state.back += state.extra;
            }
            if (state.offset > state.dmax) {
              strm.msg = "invalid distance too far back";
              state.mode = BAD;
              break;
            }
            state.mode = MATCH;
          /* falls through */
          case MATCH:
            if (left === 0) {
              break inf_leave;
            }
            copy = _out - left;
            if (state.offset > copy) {
              copy = state.offset - copy;
              if (copy > state.whave) {
                if (state.sane) {
                  strm.msg = "invalid distance too far back";
                  state.mode = BAD;
                  break;
                }
              }
              if (copy > state.wnext) {
                copy -= state.wnext;
                from = state.wsize - copy;
              } else {
                from = state.wnext - copy;
              }
              if (copy > state.length) {
                copy = state.length;
              }
              from_source = state.window;
            } else {
              from_source = output;
              from = put - state.offset;
              copy = state.length;
            }
            if (copy > left) {
              copy = left;
            }
            left -= copy;
            state.length -= copy;
            do {
              output[put++] = from_source[from++];
            } while (--copy);
            if (state.length === 0) {
              state.mode = LEN;
            }
            break;
          case LIT:
            if (left === 0) {
              break inf_leave;
            }
            output[put++] = state.length;
            left--;
            state.mode = LEN;
            break;
          case CHECK:
            if (state.wrap) {
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold |= input[next++] << bits;
                bits += 8;
              }
              _out -= left;
              strm.total_out += _out;
              state.total += _out;
              if (state.wrap & 4 && _out) {
                strm.adler = state.check = /*UPDATE_CHECK(state.check, put - _out, _out);*/
                state.flags ? crc32_1(state.check, output, _out, put - _out) : adler32_1(state.check, output, _out, put - _out);
              }
              _out = left;
              if (state.wrap & 4 && (state.flags ? hold : zswap32(hold)) !== state.check) {
                strm.msg = "incorrect data check";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            state.mode = LENGTH;
          /* falls through */
          case LENGTH:
            if (state.wrap && state.flags) {
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (state.wrap & 4 && hold !== (state.total & 4294967295)) {
                strm.msg = "incorrect length check";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            state.mode = DONE;
          /* falls through */
          case DONE:
            ret = Z_STREAM_END$1;
            break inf_leave;
          case BAD:
            ret = Z_DATA_ERROR$1;
            break inf_leave;
          case MEM:
            return Z_MEM_ERROR$1;
          case SYNC:
          /* falls through */
          default:
            return Z_STREAM_ERROR$1;
        }
      }
    strm.next_out = put;
    strm.avail_out = left;
    strm.next_in = next;
    strm.avail_in = have;
    state.hold = hold;
    state.bits = bits;
    if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH$1)) {
      if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
    }
    _in -= strm.avail_in;
    _out -= strm.avail_out;
    strm.total_in += _in;
    strm.total_out += _out;
    state.total += _out;
    if (state.wrap & 4 && _out) {
      strm.adler = state.check = /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
      state.flags ? crc32_1(state.check, output, _out, strm.next_out - _out) : adler32_1(state.check, output, _out, strm.next_out - _out);
    }
    strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
    if ((_in === 0 && _out === 0 || flush === Z_FINISH$1) && ret === Z_OK$1) {
      ret = Z_BUF_ERROR;
    }
    return ret;
  }, "inflate$2");
  var inflateEnd = /* @__PURE__ */ __name((strm) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    let state = strm.state;
    if (state.window) {
      state.window = null;
    }
    strm.state = null;
    return Z_OK$1;
  }, "inflateEnd");
  var inflateGetHeader = /* @__PURE__ */ __name((strm, head) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    if ((state.wrap & 2) === 0) {
      return Z_STREAM_ERROR$1;
    }
    state.head = head;
    head.done = false;
    return Z_OK$1;
  }, "inflateGetHeader");
  var inflateSetDictionary = /* @__PURE__ */ __name((strm, dictionary) => {
    const dictLength = dictionary.length;
    let state;
    let dictid;
    let ret;
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;
    if (state.wrap !== 0 && state.mode !== DICT) {
      return Z_STREAM_ERROR$1;
    }
    if (state.mode === DICT) {
      dictid = 1;
      dictid = adler32_1(dictid, dictionary, dictLength, 0);
      if (dictid !== state.check) {
        return Z_DATA_ERROR$1;
      }
    }
    ret = updatewindow(strm, dictionary, dictLength, dictLength);
    if (ret) {
      state.mode = MEM;
      return Z_MEM_ERROR$1;
    }
    state.havedict = 1;
    return Z_OK$1;
  }, "inflateSetDictionary");
  var inflateReset_1 = inflateReset;
  var inflateReset2_1 = inflateReset2;
  var inflateResetKeep_1 = inflateResetKeep;
  var inflateInit_1 = inflateInit;
  var inflateInit2_1 = inflateInit2;
  var inflate_2$1 = inflate$2;
  var inflateEnd_1 = inflateEnd;
  var inflateGetHeader_1 = inflateGetHeader;
  var inflateSetDictionary_1 = inflateSetDictionary;
  var inflateInfo = "pako inflate (from Nodeca project)";
  var inflate_1$2 = {
    inflateReset: inflateReset_1,
    inflateReset2: inflateReset2_1,
    inflateResetKeep: inflateResetKeep_1,
    inflateInit: inflateInit_1,
    inflateInit2: inflateInit2_1,
    inflate: inflate_2$1,
    inflateEnd: inflateEnd_1,
    inflateGetHeader: inflateGetHeader_1,
    inflateSetDictionary: inflateSetDictionary_1,
    inflateInfo
  };
  function GZheader() {
    this.text = 0;
    this.time = 0;
    this.xflags = 0;
    this.os = 0;
    this.extra = null;
    this.extra_len = 0;
    this.name = "";
    this.comment = "";
    this.hcrc = 0;
    this.done = false;
  }
  __name(GZheader, "GZheader");
  var gzheader = GZheader;
  var toString = Object.prototype.toString;
  var {
    Z_NO_FLUSH,
    Z_FINISH,
    Z_OK,
    Z_STREAM_END,
    Z_NEED_DICT,
    Z_STREAM_ERROR,
    Z_DATA_ERROR,
    Z_MEM_ERROR
  } = constants$2;
  function Inflate$1(options) {
    this.options = common.assign({
      chunkSize: 1024 * 64,
      windowBits: 15,
      to: ""
    }, options || {});
    const opt = this.options;
    if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
      opt.windowBits = -opt.windowBits;
      if (opt.windowBits === 0) {
        opt.windowBits = -15;
      }
    }
    if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
      opt.windowBits += 32;
    }
    if (opt.windowBits > 15 && opt.windowBits < 48) {
      if ((opt.windowBits & 15) === 0) {
        opt.windowBits |= 15;
      }
    }
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.chunks = [];
    this.strm = new zstream();
    this.strm.avail_out = 0;
    let status = inflate_1$2.inflateInit2(
      this.strm,
      opt.windowBits
    );
    if (status !== Z_OK) {
      throw new Error(messages[status]);
    }
    this.header = new gzheader();
    inflate_1$2.inflateGetHeader(this.strm, this.header);
    if (opt.dictionary) {
      if (typeof opt.dictionary === "string") {
        opt.dictionary = strings.string2buf(opt.dictionary);
      } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
        opt.dictionary = new Uint8Array(opt.dictionary);
      }
      if (opt.raw) {
        status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary);
        if (status !== Z_OK) {
          throw new Error(messages[status]);
        }
      }
    }
  }
  __name(Inflate$1, "Inflate$1");
  Inflate$1.prototype.push = function(data, flush_mode) {
    const strm = this.strm;
    const chunkSize = this.options.chunkSize;
    const dictionary = this.options.dictionary;
    let status, _flush_mode, last_avail_out;
    if (this.ended) return false;
    if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
    else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH;
    if (toString.call(data) === "[object ArrayBuffer]") {
      strm.input = new Uint8Array(data);
    } else {
      strm.input = data;
    }
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    for (; ; ) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      status = inflate_1$2.inflate(strm, _flush_mode);
      if (status === Z_NEED_DICT && dictionary) {
        status = inflate_1$2.inflateSetDictionary(strm, dictionary);
        if (status === Z_OK) {
          status = inflate_1$2.inflate(strm, _flush_mode);
        } else if (status === Z_DATA_ERROR) {
          status = Z_NEED_DICT;
        }
      }
      while (strm.avail_in > 0 && status === Z_STREAM_END && strm.state.wrap > 0 && data[strm.next_in] !== 0) {
        inflate_1$2.inflateReset(strm);
        status = inflate_1$2.inflate(strm, _flush_mode);
      }
      switch (status) {
        case Z_STREAM_ERROR:
        case Z_DATA_ERROR:
        case Z_NEED_DICT:
        case Z_MEM_ERROR:
          this.onEnd(status);
          this.ended = true;
          return false;
      }
      last_avail_out = strm.avail_out;
      if (strm.next_out) {
        if (strm.avail_out === 0 || status === Z_STREAM_END) {
          if (this.options.to === "string") {
            let next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
            let tail = strm.next_out - next_out_utf8;
            let utf8str = strings.buf2string(strm.output, next_out_utf8);
            strm.next_out = tail;
            strm.avail_out = chunkSize - tail;
            if (tail) strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0);
            this.onData(utf8str);
          } else {
            this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
          }
        }
      }
      if (status === Z_OK && last_avail_out === 0) continue;
      if (status === Z_STREAM_END) {
        status = inflate_1$2.inflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return true;
      }
      if (strm.avail_in === 0) break;
    }
    return true;
  };
  Inflate$1.prototype.onData = function(chunk) {
    this.chunks.push(chunk);
  };
  Inflate$1.prototype.onEnd = function(status) {
    if (status === Z_OK) {
      if (this.options.to === "string") {
        this.result = this.chunks.join("");
      } else {
        this.result = common.flattenChunks(this.chunks);
      }
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
  };
  function inflate$1(input, options) {
    const inflator = new Inflate$1(options);
    inflator.push(input);
    if (inflator.err) throw inflator.msg || messages[inflator.err];
    return inflator.result;
  }
  __name(inflate$1, "inflate$1");
  function inflateRaw$1(input, options) {
    options = options || {};
    options.raw = true;
    return inflate$1(input, options);
  }
  __name(inflateRaw$1, "inflateRaw$1");
  var Inflate_1$1 = Inflate$1;
  var inflate_2 = inflate$1;
  var inflateRaw_1$1 = inflateRaw$1;
  var ungzip$1 = inflate$1;
  var constants = constants$2;
  var inflate_1$1 = {
    Inflate: Inflate_1$1,
    inflate: inflate_2,
    inflateRaw: inflateRaw_1$1,
    ungzip: ungzip$1,
    constants
  };
  var { Deflate, deflate, deflateRaw, gzip } = deflate_1$1;
  var { Inflate, inflate, inflateRaw, ungzip } = inflate_1$1;
  var Deflate_1 = Deflate;
  var deflate_1 = deflate;
  var deflateRaw_1 = deflateRaw;
  var gzip_1 = gzip;
  var Inflate_1 = Inflate;
  var inflate_1 = inflate;
  var inflateRaw_1 = inflateRaw;
  var ungzip_1 = ungzip;
  var constants_1 = constants$2;
  var pako = {
    Deflate: Deflate_1,
    deflate: deflate_1,
    deflateRaw: deflateRaw_1,
    gzip: gzip_1,
    Inflate: Inflate_1,
    inflate: inflate_1,
    inflateRaw: inflateRaw_1,
    ungzip: ungzip_1,
    constants: constants_1
  };

  // src/common/common.zip.ts
  var import_jszip = __toESM(require_jszip_min(), 1);
  var compressAndEncodeBase64 = /* @__PURE__ */ __name((data) => {
    let inputData;
    if (data instanceof Uint8Array) {
      inputData = data;
    } else if (typeof data === "string") {
      inputData = new TextEncoder().encode(data);
    } else {
      inputData = new TextEncoder().encode(JSON.stringify(data));
    }
    const compressed = pako.gzip(inputData);
    return btoa(String.fromCharCode(...compressed));
  }, "compressAndEncodeBase64");
  var decodeAndDecompressBase64 = /* @__PURE__ */ __name((base64Data) => {
    const compressedData = new Uint8Array(atob(base64Data).split("").map((c) => c.charCodeAt(0)));
    const decompressedData = pako.ungzip(compressedData);
    const resultString = new TextDecoder("utf-8").decode(decompressedData);
    try {
      return JSON.parse(resultString);
    } catch (e) {
      return resultString;
    }
  }, "decodeAndDecompressBase64");
  var base64ToArrayBuffer = /* @__PURE__ */ __name((base642) => {
    const binaryString = atob(base642);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, "base64ToArrayBuffer");
  var unzipBase64 = /* @__PURE__ */ __name((base642) => __async(null, null, function* () {
    const arrayBuffer = base64ToArrayBuffer(base642);
    const ret = [];
    const content = yield import_jszip.default.loadAsync(arrayBuffer);
    try {
      for (var iter = __forAwait(Object.entries(content.files)), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
        const [fileName, fileContent] = temp.value;
        if (fileContent.dir) continue;
        const fileData = yield fileContent.async("string");
        ret.push({ key: fileName, value: fileData });
      }
    } catch (temp) {
      error = [temp];
    } finally {
      try {
        more && (temp = iter.return) && (yield temp.call(iter));
      } finally {
        if (error)
          throw error[0];
      }
    }
    return ret;
  }), "unzipBase64");

  // src/common/common.ts
  var tryParseNumber = /* @__PURE__ */ __name((value, defaultValue) => {
    if (!value) return defaultValue;
    const number = Number(value);
    return isNaN(number) ? defaultValue : number;
  }, "tryParseNumber");
  function safeParseArgs(args) {
    if (!args) throw new Error("No args provided");
    let input = args.trim();
    if (input.startsWith("{")) {
      try {
        return JSON.parse(input);
      } catch (e) {
      }
    }
    if (input.includes("=") && !input.includes(":")) {
      input = input.replace(/([a-zA-Z0-9_]+)\s*=/g, "$1:");
    }
    if (!input.startsWith("{")) input = `{${input}}`;
    input = input.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    input = input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, s) => `"${s.replace(/"/g, '\\"')}"`);
    input = input.replace(
      /:\s*([A-Za-z_][A-Za-z0-9_./-]*)(\s*)(?=[,}])/g,
      (full, value, ws) => {
        const lower = value.toLowerCase();
        const isKeyword = lower === "true" || lower === "false" || lower === "null";
        return isKeyword ? `:${value}${ws}` : `:"${value}"${ws}`;
      }
    );
    try {
      return JSON.parse(input);
    } catch (e) {
      throw new Error("Invalid args format, cannot parse.");
    }
  }
  __name(safeParseArgs, "safeParseArgs");
  function argsValidator(args, schema) {
    for (const key in schema) {
      if (Object.prototype.hasOwnProperty.call(schema, key)) {
        const isOptional = schema[key].optional === true;
        if (!(key in args)) {
          if (!isOptional) {
            throw new Error(`Missing argument: ${key}`);
          }
          continue;
        }
        const expectedType = schema[key].type;
        const actualType = typeof args[key];
        if (expectedType !== actualType) {
          throw new Error(`Invalid type for argument '${key}': expected '${expectedType}', got '${actualType}'`);
        }
      }
    }
  }
  __name(argsValidator, "argsValidator");

  // src/api/api.ts
  var handleCollabAuthCallback = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    if (!location.hash || location.hash.indexOf("access_token=") === -1) return;
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const access_token = params.get("access_token") || "";
    const refresh_token = params.get("refresh_token") || "";
    try {
      history.replaceState(null, "", location.pathname);
    } catch (e) {
    }
    if (!access_token) return;
    try {
      yield mls_exports.api.base.cbePost({ action: "authSession", access_token, refresh_token });
    } catch (e) {
      console.error("Error establishing collab-auth session", e);
    }
  }), "handleCollabAuthCallback");
  var cbeLogin = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    var _a2;
    yield handleCollabAuthCallback();
    const baseProject = tryParseNumber((_a2 = document.getElementById("collabNav1")) == null ? void 0 : _a2.getAttribute("initialproject"), 0);
    const actualProject2 = mls_exports.actualProject || 0;
    const projectsLastModified = yield mls_exports.stor.localDB.getProjectsLastModified();
    let queryString = "";
    if (location.search.includes("source=")) {
      const lastState = localStorage.getItem("pluginCollabLogin") || "";
      queryString = encodeURIComponent(`${location.search}&lastState=${lastState}`);
    }
    const args = {
      action: "login",
      queryString,
      baseProject,
      actualProject: actualProject2,
      projectsLastModified
    };
    try {
      const rc = yield mls_exports.api.base.cbePost(args);
      yield processOrgs(rc.orgs);
      yield processInits(rc.inits);
      yield processProviders(rc.providers);
      rc.inits = {};
      if (location.search.includes("source=")) {
        localStorage.removeItem("pluginCollabLogin");
        clearQueryString();
      }
      if (rc.alertMessage) window.collabMessages.add(rc.alertMessage, "alert", { timeToClose: 5e3 });
      if (rc.errorMessage) window.collabMessages.add(rc.errorMessage, "error", { autoClose: false });
      return rc;
    } catch (e) {
      console.error(`Error on cbeLogin`, e);
      if (location.search.includes("source=")) {
        localStorage.removeItem("pluginCollabLogin");
        console.error(`queryString: '${queryString}'`);
        clearQueryString();
      }
      return void 0;
    }
  }), "cbeLogin");
  var cbeChangeUserPreferences = /* @__PURE__ */ __name((services2) => __async(null, null, function* () {
    const args = {
      action: "changeUserPreferences",
      services: services2
    };
    return mls_exports.api.base.cbePost(args);
  }), "cbeChangeUserPreferences");
  var cbeUpdateIndexHtml = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const args = {
      action: "updateIndexHtml"
    };
    return mls_exports.api.base.cbePost(args);
  }), "cbeUpdateIndexHtml");
  var cbeSavePrjSettings = /* @__PURE__ */ __name((project) => __async(null, null, function* () {
    const projectDetails = mls_exports.l5.getProjectDetails(project);
    if (!projectDetails) throw new Error(`Project ${project} not found`);
    if ("created_at" in projectDetails) {
      delete projectDetails.created_at;
    }
    if ("archived_at" in projectDetails) {
      delete projectDetails.archived_at;
    }
    if ("repository_lastModified" in projectDetails) {
      delete projectDetails.repository_lastModified;
    }
    if ("files" in projectDetails) {
      delete projectDetails.files;
    }
    const orgIndex = mls_exports.l5.getProjectOrgIndex(project);
    if (!orgIndex) throw new Error("Project not found in organizations");
    const orgName = Object.keys(mls_exports.stor.orgs)[orgIndex];
    const args = {
      action: "savePrjSettings",
      project,
      orgIndex,
      orgName,
      projectDetails
    };
    return mls_exports.api.base.cbePost(args);
  }), "cbeSavePrjSettings");
  var cbeAddOrUpdateOrgValue = /* @__PURE__ */ __name((orgName, value) => __async(null, null, function* () {
    const args = {
      action: "addOrUpdateOrgValue",
      orgName,
      value
    };
    try {
      const rc = yield mls_exports.api.base.cbePost(args);
      processOrgs(rc.orgs);
      return rc;
    } catch (e) {
      console.error(`Error on cbeAddOrUpdateOrgValue, ${e}`);
      throw new Error(`Error on cbeAddOrUpdateOrgValue, ${e}`);
    }
  }), "cbeAddOrUpdateOrgValue");
  var cbeSaveNewPrj = /* @__PURE__ */ __name((_0) => __async(null, [_0], function* ({ orgName, info, settings }) {
    if ("created_at" in settings) {
      delete settings.created_at;
    }
    if ("archived_at" in settings) {
      delete settings.archived_at;
    }
    if ("repository_lastModified" in settings) {
      delete settings.repository_lastModified;
    }
    if ("files" in settings) {
      delete settings.files;
    }
    const args = {
      action: "saveNewPrj",
      orgName,
      info,
      settings
    };
    try {
      const rc = yield mls_exports.api.base.cbePost(args);
      if (!rc.projectID) return rc.msg || "Invalid response from server";
      processOrgs(rc.orgs);
      return rc.projectID;
    } catch (e) {
      console.error(`Error on cbeSaveNewPrj, ${e}`);
      return `Error on cbeSaveNewPrj, ${e}`;
    }
  }), "cbeSaveNewPrj");

  // src/main/main.ts
  var main_exports = {};
  __export(main_exports, {
    usermsg: () => usermsg
  });
  var usermsg = /* @__PURE__ */ __name((msg) => {
    console.log(msg);
  }, "usermsg");
  console.usermsg = usermsg;

  // src/plugin/plugin.ts
  var plugin_exports = {};
  __export(plugin_exports, {
    getAllHooks: () => getAllHooks,
    getAllMenuActions: () => getAllMenuActions,
    getAllServices: () => getAllServices,
    getHooks: () => getHooks,
    loadAll: () => loadAll,
    loadConfig: () => loadConfig,
    loadModules: () => loadModules,
    plugins: () => plugins,
    saveConfig: () => saveConfig
  });
  function getHooks() {
    return [
      {
        title: "On User Created",
        eventName: "userCreated",
        widget: "userNotificationWidget"
      },
      {
        title: "On Data Sync",
        eventName: "dataSync",
        widget: "dataSyncWidget"
      }
    ];
  }
  __name(getHooks, "getHooks");
  var plugins = /* @__PURE__ */ new Map();
  var loadAll = /* @__PURE__ */ __name((projectID, clearOlds) => __async(null, null, function* () {
    if (mls_exports.istrace) console.time("loadAllPlugins");
    if (clearOlds) plugins.clear();
    const prefix = "plugin";
    const suffix = "Index";
    const extension = ".ts";
    const keys = Object.keys(mls_exports.stor.files);
    let total = 0;
    let notLoaded = 0;
    try {
      for (var iter = __forAwait(keys), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
        const key = temp.value;
        const item = mls_exports.stor.files[key];
        if (!(item.project === projectID && item.shortName.startsWith(prefix) && item.shortName.endsWith(suffix) && item.extension === extension)) continue;
        if (mls_exports.istrace) console.log(`loading plugin: ${key}`);
        yield loadPluginIndex(item).then((plugin) => {
          if (plugin) {
            plugins.set(key, plugin);
            total++;
          } else notLoaded++;
        }).catch((e) => {
          console.log(`error on load plugin _${item.project}_${item.shortName}: ${e.message || e}`);
        });
      }
    } catch (temp) {
      error = [temp];
    } finally {
      try {
        more && (temp = iter.return) && (yield temp.call(iter));
      } finally {
        if (error)
          throw error[0];
      }
    }
    if (mls_exports.istrace) console.timeEnd("loadAllPlugins");
    if (mls_exports.istrace) console.log(`total plugins loaded: ${total}, not loaded: ${notLoaded}`);
  }), "loadAll");
  var getAllMenuActions = /* @__PURE__ */ __name((projectID, filter) => {
    const result = [];
    if (!filter.scope) filter.scope = "*";
    if (!filter.auth) filter.auth = "*";
    if (!filter.groupByCategoryAndPriority) filter.groupByCategoryAndPriority = false;
    const keys = plugins.keys();
    for (const key of keys) {
      const item = plugins.get(key);
      if (!item) continue;
      const file = mls_exports.stor.files[key];
      if (file.project !== projectID) continue;
      try {
        const menu1 = item.getMenus();
        if (!Array.isArray(menu1)) throw new Error("getMenu must return an array");
        for (const action of menu1) {
          if (mls_exports.istrace && filter.scope === "*") console.log(`menu action: scope: ${action.scope}, auth: ${action.auth}`);
          if (filter.scope !== "*" && !action.scope.includes(filter.scope)) continue;
          if (filter.auth !== "*" && !action.auth.includes(filter.auth) && !action.auth.includes("*")) continue;
          action.widgetConfig = key;
          result.push(action);
        }
      } catch (e) {
        console.log(`error on load plugin menu _${file.project}_${file.shortName}: ${e.message || e}`);
      }
    }
    if (filter.groupByCategoryAndPriority) {
      result.sort((a, b) => {
        var _a2, _b2;
        if (a.category === b.category) {
          if (a.priority === b.priority) return 0;
          return ((_a2 = a.priority) != null ? _a2 : 0) > ((_b2 = b.priority) != null ? _b2 : 0) ? 1 : -1;
        }
        if (a.category === null) return -1;
        if (b.category === null) return 1;
        return a.category > b.category ? 1 : -1;
      });
    }
    return result;
  }, "getAllMenuActions");
  var getAllHooks = /* @__PURE__ */ __name((projectID) => {
    const result = [];
    const keys = plugins.keys();
    for (const key of keys) {
      const item = plugins.get(key);
      if (!item) continue;
      const file = mls_exports.stor.files[key];
      if (file.project !== projectID) continue;
      try {
        const hooks = item.getHooks();
        if (!Array.isArray(hooks)) throw new Error("hooks is not an array");
        for (const action of hooks) {
          result.push(action);
        }
      } catch (e) {
        console.log(`error on load plugin hook _${file.project}_${file.shortName}: ${e.message || e}`);
      }
    }
    return result;
  }, "getAllHooks");
  var getAllServices = /* @__PURE__ */ __name((projectID) => {
    const result = [];
    const keys = plugins.keys();
    for (const key of keys) {
      const item = plugins.get(key);
      if (!item) continue;
      const file = mls_exports.stor.files[key];
      if (file.project !== projectID) continue;
      try {
        const services2 = item.getServices();
        if (!Array.isArray(services2)) throw new Error("getServices must return an array");
        for (const action of services2) {
          result.push(action);
        }
      } catch (e) {
        console.log(`error on load plugin service _${file.project}_${file.shortName}: ${e.message || e}`);
      }
    }
    return result;
  }, "getAllServices");
  var loadPluginIndex = /* @__PURE__ */ __name((file) => __async(null, null, function* () {
    return new Promise((resolve, reject) => {
      const url = `/local/_${file.folder ? file.folder + "/" : ""}${file.project}_${file.shortName}?cacheBust=${Date.now()}`;
      import(url).then((module) => {
        const a = module.default;
        if (!a) return reject(new Error("not found default export in plugin index"));
        if (typeof a === "string" && a === "disabled") return resolve(null);
        if (typeof a !== "object" || a === null) return reject(new Error("Default export is not an object or is null"));
        if (typeof a.getMenus !== "function") return reject(new Error("not found getMenus function in plugin index"));
        if (typeof a.getHooks !== "function") return reject(new Error("not found getHooks function in plugin index"));
        if (typeof a.getServices !== "function") return reject(new Error("not found getServices function in plugin index"));
        return resolve(a);
      }).catch((e) => {
        console.log(`loadPluginIndex error: ${e.message || e}`);
        return reject(new Error(e.message || e));
      });
    });
  }), "loadPluginIndex");
  var loadModules = /* @__PURE__ */ __name((widgets) => __async(null, null, function* () {
    const promises = widgets.map((widget) => __async(null, null, function* () {
      const file = mls_exports.actual[0].setFullName(widget).getStorFile();
      if (!file || isNaN(file.project) || file.project < 1 || !file.shortName) throw new Error(`invalid widget name: ${widget}`);
      const url = `/local/_${file.folder ? file.folder + "/" : ""}${file.project}_${file.shortName}`;
      return import(url).then((a) => {
        if (typeof a !== "object" || !a.pluginData) throw new Error("Plugin module must have export const pluginData: IPluginData = { ... }");
        const pluginData = a.pluginData;
        if (typeof pluginData.getSvg !== "function") throw new Error("not found getSvg function in pluginData");
        if (typeof pluginData.title !== "string") throw new Error("not found title string in pluginData");
      }).catch((e) => {
        console.log(`loadModule error: ${e.message || e}`);
        throw new Error(e.message || e);
      });
    }));
    yield Promise.all(promises);
  }), "loadModules");
  var loadConfig = /* @__PURE__ */ __name((widget) => __async(null, null, function* () {
    throw new Error("not implemented");
  }), "loadConfig");
  var saveConfig = /* @__PURE__ */ __name((widget, config) => __async(null, null, function* () {
    throw new Error("not implemented");
  }), "saveConfig");

  // src/editor/editor.ts
  var editor_exports = {};
  __export(editor_exports, {
    InitEditor: () => InitEditor,
    InitMonaco: () => InitMonaco,
    activeInstance: () => activeInstance,
    addError: () => addError3,
    addHint: () => addHint,
    addInfo: () => addInfo,
    addModel: () => addModel,
    addModels: () => addModels,
    addWarning: () => addWarning,
    conf: () => conf,
    convertTypescriptPosToMonacoRange: () => convertTypescriptPosToMonacoRange,
    createModelDefs: () => createModelDefs,
    createModelHTML: () => createModelHTML,
    createModelProjectDefinition: () => createModelProjectDefinition,
    createModelStyle: () => createModelStyle,
    createModelTS: () => createModelTS,
    createModelTest: () => createModelTest,
    deleteModels: () => deleteModels,
    diff: () => editor_diff_exports,
    diffPatience: () => editor_diffPatience_exports,
    editors: () => editors,
    findEditorsByModel: () => findEditorsByModel,
    findPositionOfEditor: () => findPositionOfEditor,
    forceModelUpdate: () => forceModelUpdate,
    getInfoFromActiveInstance: () => getInfoFromActiveInstance,
    getKeyModel: () => getKeyModel,
    getModel: () => getModel,
    getModelById: () => getModelById,
    getModels: () => getModels,
    instances: () => instances,
    loadConf: () => loadConf,
    loadConfFromJSON: () => loadConfFromJSON,
    localHistory: () => editor_localHistory_exports,
    models: () => models,
    setActiveInstance: () => setActiveInstance,
    setThemeName: () => setThemeName,
    setTypescriptConfig: () => setTypescriptConfig,
    showActualTypeScriptConfig: () => showActualTypeScriptConfig,
    showModelDecorations: () => showModelDecorations,
    themeName: () => themeName
  });

  // src/editor/editor.gotoDefinition.ts
  var init9 = /* @__PURE__ */ __name((editor) => {
    const myDefinitionProvider = {
      provideDefinition: /* @__PURE__ */ __name(function(model, position) {
        return __async(this, null, function* () {
          const word = model.getWordAtPosition(position);
          if (word) {
            const ret = yield mls_exports.l2.typescript.getRef(model, word.word);
            if (ret) {
              const pos = model.getPositionAt(ret.pos);
              return [{
                uri: monaco.Uri.parse(ret.uri),
                range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column + ret.len),
                pos: ret.pos
              }];
            }
          }
          return null;
        });
      }, "provideDefinition")
    };
    let alreadyRegistered = false;
    if (!alreadyRegistered) {
      alreadyRegistered = true;
      monaco.languages.registerDefinitionProvider("typescript", myDefinitionProvider);
    }
    editor.addAction({
      id: "mls.openfile.here",
      label: "Open file here",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.F12],
      contextMenuGroupId: "navigation",
      contextMenuOrder: 1,
      run: /* @__PURE__ */ __name(function(ed) {
        return __async(this, null, function* () {
          yield runOpenFile(ed, false);
        });
      }, "run")
    });
    editor.addAction({
      id: "mls.openfile.nextto",
      label: "Open file next to",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12],
      contextMenuGroupId: "navigation",
      contextMenuOrder: 1,
      run: /* @__PURE__ */ __name(function(ed) {
        return __async(this, null, function* () {
          yield runOpenFile(ed, true);
        });
      }, "run")
    });
    const runOpenFile = /* @__PURE__ */ __name((ed, useAnotherSide) => __async(null, null, function* () {
      const position = ed.getPosition();
      const model = ed.getModel();
      if (!model || !position) return;
      const definition = yield myDefinitionProvider.provideDefinition(model, position);
      if (definition && definition[0]) {
        gotoDefinition(ed, definition[0].uri, definition[0].pos || 0, useAnotherSide);
      }
    }), "runOpenFile");
    const gotoDefinition = /* @__PURE__ */ __name((ed, uri, filePosition, useAnotherSide) => {
      let side = mls_exports.editor.findPositionOfEditor(ed);
      if (useAnotherSide) side = side === "left" ? "right" : "left";
      mls_exports.actual[0].setFullName(uri.path.replace(/\//g, "").split(".")[0]);
      const file = mls_exports.actual[0].getStorFile();
      if (!file) return;
      const mm = mls_exports.l2.typescript.getModelTS(file.project, file.shortName, file.folder);
      if (mm) {
        mls_exports.events.fireFileAction("open", mm.storFile, side, void 0, void 0, void 0, void 0, 0);
        mls_exports.events.fireMonacoAction("gotoPosition", mm.storFile, void 0, side, filePosition, 400);
      } else console.log("not found model in l2.editors: ", file, uri);
    }, "gotoDefinition");
  }, "init");

  // src/editor/editor.diff.ts
  var editor_diff_exports = {};
  __export(editor_diff_exports, {
    addVersion: () => addVersion,
    addVersion2: () => addVersion2,
    addVersion3: () => addVersion3,
    createDiffGroups: () => createDiffGroups
  });
  function addVersion(currentContent, newContent) {
    return compactChanges(addVersion2(currentContent, newContent));
  }
  __name(addVersion, "addVersion");
  function compactChanges(changes) {
    const compacted = [];
    let i = 0;
    changes.sort((a, b) => a.startLine - b.startLine);
    while (i < changes.length) {
      const current = changes[i];
      const next = i + 1 < changes.length ? changes[i + 1] : null;
      if (current.type === "deleted" && next && next.type === "new") {
        if (current.startLine === next.startLine && current.endLine === next.endLine) {
          const changeGroup = {
            id: generateUniqueId(),
            type: "change",
            startLine: current.startLine,
            endLine: current.endLine
            // previousContent: current.previousContent,
            // currentContent: next.currentContent,
          };
          compacted.push(changeGroup);
          i += 2;
          continue;
        }
      }
      current.previousContent = void 0;
      current.currentContent = void 0;
      compacted.push(current);
      i++;
    }
    return compacted;
  }
  __name(compactChanges, "compactChanges");
  function addVersion2(currentContent, newContent) {
    return adjustLineNumbers(addVersion3(currentContent, newContent));
  }
  __name(addVersion2, "addVersion2");
  function adjustLineNumbers(changes) {
    return changes.map((change) => {
      if (change.endLine < change.startLine) {
        [change.startLine, change.endLine] = [change.endLine, change.startLine];
      }
      return change;
    });
  }
  __name(adjustLineNumbers, "adjustLineNumbers");
  function addVersion3(currentContent, newContent) {
    var _a2, _b2;
    const oldLines = currentContent.split("\n");
    const newLines = newContent.split("\n");
    const lcsMatrix = createLCSMatrix(oldLines, newLines);
    const changes = [];
    let currentGroup = null;
    let i = oldLines.length;
    let j = newLines.length;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        i--;
        j--;
      } else if (j > 0 && (i === 0 || lcsMatrix[i][j - 1] >= lcsMatrix[i - 1][j])) {
        const lineContent = newLines[j - 1];
        if (!currentGroup || currentGroup.type !== "new") {
          if (currentGroup) changes.push(currentGroup);
          currentGroup = {
            id: generateUniqueId(),
            type: "new",
            startLine: j,
            endLine: j,
            previousContent: [],
            currentContent: [lineContent]
          };
        } else {
          currentGroup.endLine = j;
          currentGroup.currentContent.push(lineContent);
        }
        j--;
      } else if (i > 0 && (j === 0 || lcsMatrix[i][j - 1] < lcsMatrix[i - 1][j])) {
        const lineContent = oldLines[i - 1];
        if (!currentGroup || currentGroup.type !== "deleted") {
          if (currentGroup) changes.push(currentGroup);
          currentGroup = {
            id: generateUniqueId(),
            type: "deleted",
            startLine: i,
            endLine: i,
            previousContent: [lineContent]
          };
        } else {
          currentGroup.endLine = i;
          (_a2 = currentGroup.previousContent) == null ? void 0 : _a2.push(lineContent);
        }
        i--;
      } else {
        const oldLine = oldLines[i - 1];
        const newLine = newLines[j - 1];
        if (!currentGroup || currentGroup.type !== "change") {
          if (currentGroup) changes.push(currentGroup);
          currentGroup = {
            id: generateUniqueId(),
            type: "change",
            startLine: i,
            endLine: i,
            previousContent: [oldLine],
            currentContent: [newLine]
          };
        } else {
          currentGroup.endLine = i;
          (_b2 = currentGroup.previousContent) == null ? void 0 : _b2.push(oldLine);
          currentGroup.currentContent.push(newLine);
        }
        i--;
        j--;
      }
    }
    if (currentGroup) changes.push(currentGroup);
    return changes.reverse();
  }
  __name(addVersion3, "addVersion3");
  function createLCSMatrix(oldLines, newLines) {
    const m = oldLines.length;
    const n = newLines.length;
    const lcsMatrix = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          lcsMatrix[i][j] = lcsMatrix[i - 1][j - 1] + 1;
        } else {
          lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]);
        }
      }
    }
    return lcsMatrix;
  }
  __name(createLCSMatrix, "createLCSMatrix");
  function generateUniqueId() {
    return Math.random().toString(36).substr(2, 9);
  }
  __name(generateUniqueId, "generateUniqueId");
  function createDiffGroups(currentContent, newContent) {
    const oldLines = currentContent.split("\n");
    const newLines = newContent.split("\n");
    const changes = [];
    let oldIndex = 0;
    let newIndex = 0;
    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (oldIndex < oldLines.length && newIndex < newLines.length) {
        if (oldLines[oldIndex] !== newLines[newIndex]) {
          changes.push({
            id: generateUniqueId(),
            type: "change",
            startLine: oldIndex + 1,
            endLine: oldIndex + 1,
            previousContent: [oldLines[oldIndex]],
            currentContent: [newLines[newIndex]]
          });
        }
        oldIndex++;
        newIndex++;
      } else if (oldIndex < oldLines.length) {
        const deletedLines = [];
        const startLine = oldIndex + 1;
        while (oldIndex < oldLines.length) {
          deletedLines.push(oldLines[oldIndex]);
          oldIndex++;
        }
        changes.push({
          id: generateUniqueId(),
          type: "deleted",
          startLine,
          endLine: startLine + deletedLines.length - 1,
          previousContent: deletedLines
        });
      } else if (newIndex < newLines.length) {
        const newLinesContent = [];
        const startLine = newIndex + 1;
        while (newIndex < newLines.length) {
          newLinesContent.push(newLines[newIndex]);
          newIndex++;
        }
        changes.push({
          id: generateUniqueId(),
          type: "new",
          startLine,
          endLine: startLine + newLinesContent.length - 1,
          currentContent: newLinesContent,
          previousContent: []
        });
      }
    }
    return splitNonContinuousGroups(changes);
  }
  __name(createDiffGroups, "createDiffGroups");
  function splitNonContinuousGroups(changes) {
    const adjustedChanges = [];
    changes.forEach((change) => {
      var _a2, _b2;
      if (change.type === "new" || change.type === "deleted") {
        let currentGroup = null;
        let lineIndex = change.startLine;
        for (let i = 0; i < (change.previousContent || "").length || i < (((_a2 = change.currentContent) == null ? void 0 : _a2.length) || 0); i++) {
          const currentLine = lineIndex + i;
          if (!currentGroup) {
            currentGroup = __spreadProps(__spreadValues({}, change), {
              startLine: currentLine,
              endLine: currentLine,
              previousContent: change.type === "deleted" ? [(change.previousContent || [])[i]] : [],
              currentContent: change.type === "new" ? [change.currentContent[i]] : []
            });
          } else {
            if (currentLine !== currentGroup.endLine + 1) {
              adjustedChanges.push(currentGroup);
              currentGroup = __spreadProps(__spreadValues({}, change), {
                startLine: currentLine,
                endLine: currentLine,
                previousContent: change.type === "deleted" ? [(change.previousContent || [])[i]] : [],
                currentContent: change.type === "new" ? [change.currentContent[i]] : []
              });
            } else {
              currentGroup.endLine = currentLine;
              if (change.type === "deleted") {
                (_b2 = currentGroup.previousContent) == null ? void 0 : _b2.push((change.previousContent || [])[i]);
              }
              if (change.type === "new") {
                currentGroup.currentContent.push(change.currentContent[i]);
              }
            }
          }
        }
        if (currentGroup) adjustedChanges.push(currentGroup);
      } else {
        adjustedChanges.push(change);
      }
    });
    return adjustedChanges;
  }
  __name(splitNonContinuousGroups, "splitNonContinuousGroups");

  // src/editor/editor.localHistory.ts
  var editor_localHistory_exports = {};

  // src/editor/editor.diffPatience.ts
  var editor_diffPatience_exports = {};
  __export(editor_diffPatience_exports, {
    addVersion: () => addVersion4
  });
  function addVersion4(currentContent, newContent) {
    var _a2, _b2;
    const oldLines = currentContent.split("\n");
    const newLines = newContent.split("\n");
    const matches = findPatienceMatches(oldLines, newLines);
    const changes = [];
    let currentGroup = null;
    let oldIndex = 0;
    let newIndex = 0;
    matches.forEach((match) => {
      var _a3, _b3;
      while (oldIndex < match.oldIndex || newIndex < match.newIndex) {
        if (oldIndex < match.oldIndex && newIndex < match.newIndex) {
          if (isSmallChange(oldLines[oldIndex], newLines[newIndex])) {
            if (!currentGroup || currentGroup.type !== "change") {
              if (currentGroup) changes.push(currentGroup);
              currentGroup = {
                id: generateUniqueId2(),
                type: "change",
                startLine: oldIndex + 1,
                endLine: oldIndex + 1,
                previousContent: [oldLines[oldIndex]],
                currentContent: [newLines[newIndex]]
              };
            } else {
              currentGroup.endLine = oldIndex + 1;
              (_a3 = currentGroup.previousContent) == null ? void 0 : _a3.push(oldLines[oldIndex]);
              currentGroup.currentContent.push(newLines[newIndex]);
            }
          } else {
            if (currentGroup) changes.push(currentGroup);
            changes.push({
              id: generateUniqueId2(),
              type: "deleted",
              startLine: oldIndex + 1,
              endLine: oldIndex + 1,
              previousContent: [oldLines[oldIndex]]
            });
            changes.push({
              id: generateUniqueId2(),
              type: "new",
              startLine: newIndex + 1,
              endLine: newIndex + 1,
              previousContent: [],
              currentContent: [newLines[newIndex]]
            });
          }
          oldIndex++;
          newIndex++;
        } else if (oldIndex < match.oldIndex) {
          if (!currentGroup || currentGroup.type !== "deleted") {
            if (currentGroup) changes.push(currentGroup);
            currentGroup = {
              id: generateUniqueId2(),
              type: "deleted",
              startLine: oldIndex + 1,
              endLine: oldIndex + 1,
              previousContent: [oldLines[oldIndex]]
            };
          } else {
            currentGroup.endLine = oldIndex + 1;
            (_b3 = currentGroup.previousContent) == null ? void 0 : _b3.push(oldLines[oldIndex]);
          }
          oldIndex++;
        } else if (newIndex < match.newIndex) {
          if (!currentGroup || currentGroup.type !== "new") {
            if (currentGroup) changes.push(currentGroup);
            currentGroup = {
              id: generateUniqueId2(),
              type: "new",
              startLine: newIndex + 1,
              endLine: newIndex + 1,
              previousContent: [],
              currentContent: [newLines[newIndex]]
            };
          } else {
            currentGroup.endLine = newIndex + 1;
            currentGroup.currentContent.push(newLines[newIndex]);
          }
          newIndex++;
        }
      }
      oldIndex++;
      newIndex++;
    });
    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (oldIndex < oldLines.length && newIndex < newLines.length) {
        if (isSmallChange(oldLines[oldIndex], newLines[newIndex])) {
          if (!currentGroup || currentGroup.type !== "change") {
            if (currentGroup) changes.push(currentGroup);
            currentGroup = {
              id: generateUniqueId2(),
              type: "change",
              startLine: oldIndex + 1,
              endLine: oldIndex + 1,
              previousContent: [oldLines[oldIndex]],
              currentContent: [newLines[newIndex]]
            };
          } else {
            currentGroup.endLine = oldIndex + 1;
            (_a2 = currentGroup.previousContent) == null ? void 0 : _a2.push(oldLines[oldIndex]);
            currentGroup.currentContent.push(newLines[newIndex]);
          }
        } else {
          if (currentGroup) changes.push(currentGroup);
          changes.push({
            id: generateUniqueId2(),
            type: "deleted",
            startLine: oldIndex + 1,
            endLine: oldIndex + 1,
            previousContent: [oldLines[oldIndex]]
          });
          changes.push({
            id: generateUniqueId2(),
            type: "new",
            startLine: newIndex + 1,
            endLine: newIndex + 1,
            previousContent: [],
            currentContent: [newLines[newIndex]]
          });
        }
        oldIndex++;
        newIndex++;
      } else if (oldIndex < oldLines.length) {
        if (!currentGroup || currentGroup.type !== "deleted") {
          if (currentGroup) changes.push(currentGroup);
          currentGroup = {
            id: generateUniqueId2(),
            type: "deleted",
            startLine: oldIndex + 1,
            endLine: oldIndex + 1,
            previousContent: [oldLines[oldIndex]]
          };
        } else {
          currentGroup.endLine = oldIndex + 1;
          (_b2 = currentGroup.previousContent) == null ? void 0 : _b2.push(oldLines[oldIndex]);
        }
        oldIndex++;
      } else if (newIndex < newLines.length) {
        if (!currentGroup || currentGroup.type !== "new") {
          if (currentGroup) changes.push(currentGroup);
          currentGroup = {
            id: generateUniqueId2(),
            type: "new",
            startLine: newIndex + 1,
            endLine: newIndex + 1,
            previousContent: [],
            currentContent: [newLines[newIndex]]
          };
        } else {
          currentGroup.endLine = newIndex + 1;
          currentGroup.currentContent.push(newLines[newIndex]);
        }
        newIndex++;
      }
    }
    if (currentGroup) changes.push(currentGroup);
    return changes;
  }
  __name(addVersion4, "addVersion");
  function isSmallChange(line1, line2) {
    return getLevenshteinDistance(line1, line2) <= Math.max(line1.length, line2.length) * 0.2;
  }
  __name(isSmallChange, "isSmallChange");
  function getLevenshteinDistance(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        matrix[i][j] = a[i - 1] === b[j - 1] ? matrix[i - 1][j - 1] : Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + 1);
      }
    }
    return matrix[a.length][b.length];
  }
  __name(getLevenshteinDistance, "getLevenshteinDistance");
  function findPatienceMatches(oldLines, newLines) {
    const oldLineMap = buildLineMap(oldLines);
    const newLineMap = buildLineMap(newLines);
    const matches = [];
    oldLineMap.forEach((oldIndexes, line) => {
      const newIndexes = newLineMap.get(line);
      if (oldIndexes.length === 1 && newIndexes && newIndexes.length === 1) {
        matches.push({ oldIndex: oldIndexes[0], newIndex: newIndexes[0] });
      }
    });
    return matches.sort((a, b) => a.oldIndex - b.oldIndex);
  }
  __name(findPatienceMatches, "findPatienceMatches");
  function buildLineMap(lines) {
    const lineMap = /* @__PURE__ */ new Map();
    lines.forEach((line, index) => {
      if (!lineMap.has(line)) lineMap.set(line, []);
      lineMap.get(line).push(index);
    });
    return lineMap;
  }
  __name(buildLineMap, "buildLineMap");
  function generateUniqueId2() {
    return Math.random().toString(36).substr(2, 9);
  }
  __name(generateUniqueId2, "generateUniqueId");

  // src/editor/editor.ts
  var models = {};
  var editors = {
    left: void 0,
    right: void 0
  };
  var getUriL1OrL2 = /* @__PURE__ */ __name((storFile) => {
    let uri;
    if (storFile.level === 1) {
      uri = monaco.Uri.parse(`file://server/_${storFile.project}_/l1/${storFile.folder ? storFile.folder + "/" : ""}${storFile.shortName}${storFile.extension}`);
    } else {
      uri = monaco.Uri.parse(`file://server/_${storFile.project}_/l2/${storFile.folder ? storFile.folder + "/" : ""}${storFile.shortName}${storFile.extension}`);
    }
    return uri;
  }, "getUriL1OrL2");
  var createModelTS = /* @__PURE__ */ __name((storFile, content) => __async(null, null, function* () {
    if (!storFile || storFile.extension !== ".ts") throw new Error("invalid storFile, use a valid ts file");
    const uri = getUriL1OrL2(storFile);
    const model = monaco.editor.getModel(uri);
    if (model) throw new Error(`model already exists, uri: ${uri.toString()}`);
    const result = {
      model: monaco.editor.createModel(content || "", "typescript", uri),
      storFile,
      codeLens: {},
      compilerResults: void 0
    };
    yield registerModelsEntry(storFile, result, void 0, void 0, void 0, void 0);
    return result;
  }), "createModelTS");
  var createModelTest = /* @__PURE__ */ __name((storFile, content) => __async(null, null, function* () {
    if (!storFile || storFile.extension !== ".test.ts") throw new Error("invalid storFile, use a valid test.ts file");
    const uri = getUriL1OrL2(storFile);
    const model = monaco.editor.getModel(uri);
    if (model) throw new Error(`model already exists, uri: ${uri.toString()}`);
    const result = {
      model: monaco.editor.createModel(content || "", "typescript", uri),
      storFile,
      codeLens: {},
      compilerResults: void 0
    };
    yield registerModelsEntry(storFile, void 0, void 0, void 0, result, void 0);
    return result;
  }), "createModelTest");
  var createModelDefs = /* @__PURE__ */ __name((storFile, content) => __async(null, null, function* () {
    if (!storFile || storFile.extension !== ".defs.ts") throw new Error("invalid storFile, use a valid defs.ts file");
    const uri = getUriL1OrL2(storFile);
    const model = monaco.editor.getModel(uri);
    if (model) throw new Error(`model already exists, uri: ${uri.toString()}`);
    const result = {
      model: monaco.editor.createModel(content || "", "typescript", uri),
      storFile,
      codeLens: {},
      compilerResults: void 0
    };
    yield registerModelsEntry(storFile, void 0, void 0, void 0, void 0, result);
    return result;
  }), "createModelDefs");
  var createModelProjectDefinition = /* @__PURE__ */ __name((project, content) => __async(null, null, function* () {
    if (!content) throw new Error("invalid content");
    if (project < 1 || !mls_exports.stor.projects[project]) throw new Error("invalid project");
    const uri = monaco.Uri.parse(`file://server/_${project}_.d.ts`);
    const model = monaco.editor.getModel(uri);
    if (model) throw new Error(`model defintion already exists, uri: ${uri.toString()}`);
    const result = {
      model: monaco.editor.createModel(content || "", "typescript", uri),
      storFile: void 0,
      // no storFile
      codeLens: {},
      compilerResults: void 0
    };
    const key = `_${project}_`;
    models[key] = { ts: result };
    return result;
  }), "createModelProjectDefinition");
  var createModelHTML = /* @__PURE__ */ __name((storFile, content) => __async(null, null, function* () {
    if (!storFile || storFile.extension !== ".html") throw new Error("invalid storFile, use a valid html file");
    const uri = monaco.Uri.parse(`file://server/_${storFile.project}_${storFile.folder ? storFile.folder + "_" : ""}${storFile.shortName}.html`);
    const model = monaco.editor.getModel(uri);
    if (model) throw new Error(`model already exists, uri: ${uri.toString()}`);
    const result = {
      model: monaco.editor.createModel(content || "", "html", uri),
      storFile,
      codeLens: {}
    };
    yield registerModelsEntry(storFile, void 0, result, void 0, void 0, void 0);
    return result;
  }), "createModelHTML");
  var createModelStyle = /* @__PURE__ */ __name((storFile, content) => __async(null, null, function* () {
    if (!storFile || storFile.extension !== ".less") throw new Error("invalid storFile, use a valid less file");
    const uri = monaco.Uri.parse(`file://server/_${storFile.project}_${storFile.folder ? storFile.folder + "_" : ""}${storFile.shortName}.less`);
    const model = monaco.editor.getModel(uri);
    if (model) throw new Error(`model already exists, uri: ${uri.toString()}`);
    const result = {
      model: monaco.editor.createModel(content || "", "less", uri),
      storFile,
      codeLens: {}
    };
    yield registerModelsEntry(storFile, void 0, void 0, result, void 0, void 0);
    return result;
  }), "createModelStyle");
  var getKeyModel = /* @__PURE__ */ __name((project, shortName, folder, level) => {
    if (folder) return `_${project}_${level === 1 ? level.toString() + "_" : ""}${folder}_${shortName}`;
    return `_${project}_${level === 1 ? level.toString() + "_" : ""}${shortName}`;
  }, "getKeyModel");
  var addModels = /* @__PURE__ */ __name((project, shortName, folder, level) => __async(null, null, function* () {
    const files2 = yield mls_exports.stor.getFiles({ project, shortName, folder, loadContent: true, level });
    if (files2.ts) yield createModelTS(files2.ts, files2.tsContent || "");
    if (files2.test) yield createModelTest(files2.test, files2.testContent || "");
    if (files2.defs) yield createModelDefs(files2.defs, files2.defsContent || "");
    if (files2.html) yield createModelHTML(files2.html, files2.htmlContent || "");
    if (files2.less) yield createModelStyle(files2.less, files2.lessContent || "");
    return getModels(project, shortName, folder, level);
  }), "addModels");
  var addModel = /* @__PURE__ */ __name((file, content) => __async(null, null, function* () {
    if (file.extension === ".ts") return yield createModelTS(file, content);
    if (file.extension === ".test.ts") return yield createModelTest(file, content);
    if (file.extension === ".defs.ts") return yield createModelDefs(file, content);
    if (file.extension === ".html") return yield createModelHTML(file, content);
    if (file.extension === ".less") return yield createModelStyle(file, content);
    return void 0;
  }), "addModel");
  var registerModelsEntry = /* @__PURE__ */ __name((storFile, tsModel, html, style, test, defs) => __async(null, null, function* () {
    const key = getKeyModel(storFile.project, storFile.shortName, storFile.folder, storFile.level);
    let modelCreated = false;
    if (models[key]) {
      if (tsModel && !models[key].ts || html && !models[key].html || style && !models[key].style || test && !models[key].test || defs && !models[key].defs) modelCreated = true;
      if (tsModel) models[key].ts = tsModel;
      if (test) models[key].test = test;
      if (defs) models[key].defs = defs;
      if (html) models[key].html = html;
      if (style) models[key].style = style;
    } else {
      models[key] = { ts: tsModel, html, style, test, defs };
      modelCreated = true;
    }
    if (modelCreated) {
      const time = 0;
      yield mls_exports.events.fire(storFile.level, "MonacoModelCreated", mls_exports.stor.convertFileToFileReference(storFile), time);
    }
  }), "registerModelsEntry");
  var deleteModels = /* @__PURE__ */ __name((project, shortName, folder, releaseMonacoModel, level) => {
    var _a2, _b2, _c2, _d2, _e;
    const keyToModel = getKeyModel(project, shortName, folder, level);
    if (!models[keyToModel]) return false;
    if (releaseMonacoModel) {
      if (models[keyToModel].ts) (_a2 = models[keyToModel].ts) == null ? void 0 : _a2.model.dispose();
      if (models[keyToModel].html) (_b2 = models[keyToModel].html) == null ? void 0 : _b2.model.dispose();
      if (models[keyToModel].style) (_c2 = models[keyToModel].style) == null ? void 0 : _c2.model.dispose();
      if (models[keyToModel].test) (_d2 = models[keyToModel].test) == null ? void 0 : _d2.model.dispose();
      if (models[keyToModel].defs) (_e = models[keyToModel].defs) == null ? void 0 : _e.model.dispose();
    }
    delete models[keyToModel];
    return true;
  }, "deleteModels");
  var getModels = /* @__PURE__ */ __name((project, shortName, folder, level = 2) => {
    return mls_exports.editor.models[getKeyModel(project, shortName, folder, level)];
  }, "getModels");
  var getModel = /* @__PURE__ */ __name((storFile) => {
    const keyToModel = getKeyModel(storFile.project, storFile.shortName, storFile.folder || "", storFile.level || 2);
    const myModels = mls_exports.editor.models[keyToModel];
    if (!myModels) return void 0;
    switch (storFile.extension) {
      case ".ts":
        return myModels.ts;
      case ".test.ts":
        return myModels.test;
      case ".defs.ts":
        return myModels.defs;
      case ".html":
        return myModels.html;
      case ".less":
        return myModels.style;
    }
    return void 0;
  }, "getModel");
  var getModelById = /* @__PURE__ */ __name((modelId) => {
    var _a2;
    for (const key of Object.keys(mls_exports.editor.models)) {
      const _models = mls_exports.editor.models[key];
      for (const modelType of Object.keys(_models)) {
        const modelEntry = _models[modelType];
        if (modelEntry && ((_a2 = modelEntry.model) == null ? void 0 : _a2.id) === modelId) {
          return modelEntry;
        }
      }
    }
    return void 0;
  }, "getModelById");
  var instances = {};
  var activeInstance = "";
  var setActiveInstance = /* @__PURE__ */ __name((level, position) => {
    if (level !== 1 && level !== 2) return;
    activeInstance = `l${level}_${position}`;
  }, "setActiveInstance");
  var getInfoFromActiveInstance = /* @__PURE__ */ __name(() => {
    const level = Number(activeInstance.substring(1, 2));
    const position = activeInstance.substring(3);
    return { level, position };
  }, "getInfoFromActiveInstance");
  var findPositionOfEditor = /* @__PURE__ */ __name((editor) => {
    var _a2;
    if (!editor || editor.getId() === ((_a2 = instances.l2_left) == null ? void 0 : _a2.getId())) return "left";
    return "right";
  }, "findPositionOfEditor");
  var findEditorsByModel = /* @__PURE__ */ __name((model) => {
    const list = [];
    if (!model || !model.isAttachedToEditor()) return list;
    monaco.editor.getEditors().forEach((editor) => {
      var _a2;
      if (((_a2 = editor.getModel()) == null ? void 0 : _a2.id) === model.id) list.push(editor);
    });
    return list;
  }, "findEditorsByModel");
  var onFirstInitMonaco = true;
  var InitMonaco = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    if (!onFirstInitMonaco) return;
    onFirstInitMonaco = false;
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
    monaco.languages.typescript.typescriptDefaults.setMaximumWorkerIdleTime(30 * 1e3);
    setTypescriptConfig();
    setTypescriptExtraLibs();
    mls_exports.l2.typescript.enableMlsTSWorkerIfNeeded();
    mls_exports.l2.codeLens.initCodeLens();
  }), "InitMonaco");
  var InitEditor = /* @__PURE__ */ __name((editor) => {
    init9(editor);
  }, "InitEditor");
  var conf = {};
  var loadConfFromJSON = /* @__PURE__ */ __name((json) => {
    if (json) {
      conf = JSON.parse(json);
    }
  }, "loadConfFromJSON");
  var loadConf = /* @__PURE__ */ __name((key, value) => {
    conf[key] = value;
  }, "loadConf");
  var themeName;
  var setThemeName = /* @__PURE__ */ __name((theme) => {
    themeName = theme || "VS";
  }, "setThemeName");
  var CONFTYPESCRIPT = "mls-ConfTypeScript2";
  var setTypescriptConfig = /* @__PURE__ */ __name(() => {
    let json = localStorage.getItem(CONFTYPESCRIPT);
    let tsconf = {};
    if (json) {
      try {
        tsconf = JSON.parse(json);
        if (!tsconf.target || !tsconf.moduleResolution || !tsconf.module) throw new Error("json invalid");
      } catch (e) {
        json = null;
        console.log("error on localstorage key: " + CONFTYPESCRIPT + ":" + e.message || e);
      }
    }
    if (!json) tsconf = defaultTsConf;
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsconf);
  }, "setTypescriptConfig");
  var showActualTypeScriptConfig = /* @__PURE__ */ __name(() => {
    const co = monaco.languages.typescript.typescriptDefaults.getCompilerOptions();
    console.log("actual definition: " + JSON.stringify(co));
  }, "showActualTypeScriptConfig");
  var setTypescriptExtraLibs = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    let urlMls;
    let urlMonaco;
    if (window.location.host === "multilevelstudio.com") {
      urlMls = "";
      urlMonaco = `/lib2/monaco2023`;
    } else {
      const site = new URL(document.head.baseURI).origin;
      const latest = window.latest || {};
      urlMls = `${site}/libs/${latest.libs}`;
      urlMonaco = `${site}/monaco/${latest.monaco}`;
    }
    const importHelper = [
      {
        name: "mls",
        url: `${urlMls}/mls.d.ts`
      },
      {
        name: "global",
        url: `${urlMls}/global.d.ts`
      },
      {
        name: "monaco",
        url: `${urlMonaco}/monaco.d.ts`
      }
    ];
    importHelper.forEach((item) => __async(null, null, function* () {
      const text = yield (yield fetch(item.url)).text();
      if (text) {
        monaco.languages.typescript.typescriptDefaults.addExtraLib(text, `file:///server/${item.name}.d.ts`);
      } else {
        console.log(`error on fetch ${item.url}`);
      }
    }));
  }), "setTypescriptExtraLibs");
  var defaultTsConf = {
    target: 7,
    // monaco.languages.typescript.ScriptTarget.ES2020,
    // allowNonTsExtensions: true, // =false -> error
    moduleResolution: 1,
    // monaco.languages.typescript.ModuleResolutionKind.Classic, // see adjustCompilerOptions
    module: 99,
    // monaco.languages.typescript.ModuleKind.ESNext,
    // module: monaco.languages.typescript.ModuleKind.AMD,
    strict: true,
    // strict flag that enables
    // alwaysStrict,
    // noImplicitAny,
    // noImplicitThis,
    // strictBindCallApply,
    // strictNullChecks,
    // strictFunctionTypes
    // and strictPropertyInitialization which are even more important.
    // noImplicitThis: true,
    // strictBindCallApply: true, error
    // strictNullChecks: true, // true -> error let kk: HTMLElement = undefined;
    // strictFunctionTypes: true,
    // strictPropertyInitialization: true, // true -> strictNullChecks must be true
    // noEmit: false, // true -> don't generate .js
    // noLib: false, // don't add lib.d.ts
    // preserveConstEnums: true,
    // suppressImplicitAnyIndexErrors: true, // https://github.com/Microsoft/TypeScript/issues/1232
    declaration: true,
    // same the server
    removeComments: false,
    // noUnusedLocals: false, // optional
    noUnusedParameters: false,
    // optional
    skipLibCheck: false,
    // don't check .d.ts files
    forceConsistentCasingInFileNames: true,
    sourceMap: false,
    // generate .js.map
    // jsx: monaco.languages.typescript.JsxEmit.React,
    // jsxFactory: 'DOMcreateElement',
    // allowJs: false,
    // inlineSourceMap: true
    // reactNamespace: "JSX",
    // jsxFragmentFactory: "Fragment"
    // lib: ['dom',
    // '/lib2/precompilers/ts/lib.es7.d.ts?v=' + mls.version,
    // '/l4/mls.d.ts?v=' + mls.version,
    // '/lib2/monaco2023/monaco.d.ts?v=' + mls.version
    // ]
    experimentalDecorators: true
    // don't use ?
    // JSX details (react and preact)
    // https://stackoverflow.com/questions/40050675/jsx-in-typescript-without-react?rq=1
  };
  var flattenDiagnosticMessageText = /* @__PURE__ */ __name((diag, newLine, indent = 0) => {
    if (typeof diag === "string") {
      return diag;
    } else if (diag === void 0) {
      return "";
    }
    let result = "";
    if (indent) {
      result += newLine;
      for (let i = 0; i < indent; i++) {
        result += "  ";
      }
    }
    result += diag.messageText;
    indent++;
    if (diag.next) {
      for (const kid of diag.next) {
        result += flattenDiagnosticMessageText(kid, newLine, indent);
      }
    }
    return result;
  }, "flattenDiagnosticMessageText");
  var convertTypescriptPosToMonacoRange = /* @__PURE__ */ __name((model, diagStart, diagLength) => {
    diagStart = diagStart || 0;
    diagLength = diagLength || 1;
    const { lineNumber: startLineNumber, column: startColumn } = model.getPositionAt(diagStart);
    const { lineNumber: endLineNumber, column: endColumn } = model.getPositionAt(diagStart + diagLength);
    return new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn);
  }, "convertTypescriptPosToMonacoRange");
  var showModelDecorations = /* @__PURE__ */ __name((model, diags, addMarkers = false) => {
    function _tsDiagnosticCategoryToMarkerSeverity(category) {
      switch (category) {
        case 1:
          return monaco.MarkerSeverity.Error;
        case 3:
          return monaco.MarkerSeverity.Info;
        case 0:
          return monaco.MarkerSeverity.Warning;
        case 2:
          return monaco.MarkerSeverity.Hint;
      }
      return monaco.MarkerSeverity.Info;
    }
    __name(_tsDiagnosticCategoryToMarkerSeverity, "_tsDiagnosticCategoryToMarkerSeverity");
    function _convertDiagnostics(diag) {
      const { startLineNumber, startColumn, endLineNumber, endColumn } = convertTypescriptPosToMonacoRange(model, diag.start, diag.length);
      const tags = [];
      if (diag.reportsUnnecessary) {
        tags.push(monaco.MarkerTag.Unnecessary);
      }
      if (diag.reportsDeprecated) {
        tags.push(monaco.MarkerTag.Deprecated);
      }
      return {
        severity: _tsDiagnosticCategoryToMarkerSeverity(diag.category),
        startLineNumber,
        startColumn,
        endLineNumber,
        endColumn,
        message: flattenDiagnosticMessageText(diag.messageText, "\n"),
        code: diag.code.toString(),
        tags
      };
    }
    __name(_convertDiagnostics, "_convertDiagnostics");
    let markers = [];
    if (addMarkers) {
      markers = monaco.editor.getModelMarkers({
        resource: model.uri,
        owner: model.id
      });
    }
    if (diags.length !== 0) markers = [...markers, ...diags.map((d) => _convertDiagnostics(d))];
    monaco.editor.setModelMarkers(model, model.id, markers);
  }, "showModelDecorations");
  var addError3 = /* @__PURE__ */ __name((model, range, msg) => {
    addMarker(model, range, msg, monaco.MarkerSeverity.Error);
  }, "addError");
  var addInfo = /* @__PURE__ */ __name((model, range, msg) => {
    addMarker(model, range, msg, monaco.MarkerSeverity.Info);
  }, "addInfo");
  var addWarning = /* @__PURE__ */ __name((model, range, msg) => {
    addMarker(model, range, msg, monaco.MarkerSeverity.Warning);
  }, "addWarning");
  var addHint = /* @__PURE__ */ __name((model, range, msg) => {
    addMarker(model, range, msg, monaco.MarkerSeverity.Hint);
  }, "addHint");
  var addMarker = /* @__PURE__ */ __name((model, range, msg, severity) => {
    let markers = [];
    markers = monaco.editor.getModelMarkers({
      resource: model.uri,
      owner: model.id
    });
    for (const marker of markers) {
      if (marker.severity === severity && marker.startLineNumber === range.startLineNumber && marker.startColumn === range.startColumn && marker.message === msg) return;
    }
    const tags = [];
    markers.push({
      severity,
      startLineNumber: range.startLineNumber,
      startColumn: range.startColumn,
      endLineNumber: range.endLineNumber,
      endColumn: range.endColumn,
      message: msg,
      code: void 0,
      tags
    });
    monaco.editor.setModelMarkers(model, model.id, markers);
  }, "addMarker");
  var forceModelUpdate = /* @__PURE__ */ __name((model) => {
    let range = new monaco.Range(1, 1, 1, 1);
    model.applyEdits([{ range, text: "a" }]);
    range = new monaco.Range(1, 1, 1, 2);
    model.applyEdits([{ range, text: "" }]);
  }, "forceModelUpdate");

  // src/events/events.ts
  var events_exports = {};
  __export(events_exports, {
    addEventListener: () => addEventListener,
    addListener: () => addListener,
    delays: () => delays,
    fire: () => fire,
    fireFileAction: () => fireFileAction,
    fireMonacoAction: () => fireMonacoAction,
    getFCMTokenForBackend: () => getFCMTokenForBackend,
    removeEventListener: () => removeEventListener,
    subscribers: () => subscribers
  });
  var delays = {};
  var subscribers = {};
  var fire = /* @__PURE__ */ __name((levels, types, desc, timeout = 200) => __async(null, null, function* () {
    if (!Array.isArray(levels)) levels = [levels];
    if (!Array.isArray(types)) types = [types];
    const ev = { levels, types, desc };
    if (timeout <= 0) return yield fireEvents([ev]);
    timeout = Math.round(timeout * 0.01) * 100;
    let delay = getNearTimeout(timeout);
    if (delay) {
      delay.events.push(ev);
      return;
    }
    delay = {
      str: Date.now() + timeout,
      timeout,
      events: [ev]
    };
    const handle = window.setTimeout(() => {
      fireEvents(delays[handle].events);
      if (delays[handle]) {
        delays[handle].events = [];
        delete delays[handle];
      }
    }, timeout);
    delays[handle] = delay;
  }), "fire");
  var addListener = /* @__PURE__ */ __name((level, type, listener) => {
    if (!listener || typeof listener !== "function") {
      console.error(
        "Error, listener must be a function, in mls.events.addListener"
      );
      return;
    }
    if (typeof level !== "number" || typeof type !== "string") {
      console.error(
        "Error, level must be a number and type a string, in mls.events.addListener"
      );
      return;
    }
    const key = level + "_" + type;
    if (mls_exports.isTraceEvents) console.log("addListener key:" + key);
    const listeners = subscribers[key];
    if (listeners) {
      subscribers[key] = removeListener(subscribers[key], listener);
      subscribers[key].push(listener);
    } else {
      subscribers[key] = [listener];
    }
  }, "addListener");
  var addEventListener = /* @__PURE__ */ __name((levels, types, listener) => {
    if (!listener || typeof listener !== "function") {
      console.error(
        "Error, listener must be a function, in mls.events.addEventListener"
      );
      return;
    }
    (levels || []).forEach((level) => {
      (types || []).forEach((type) => {
        addListener(level, type, listener);
      });
    });
  }, "addEventListener");
  var removeEventListener = /* @__PURE__ */ __name((levels, types, listener) => {
    if (!listener || typeof listener !== "function") return;
    (levels || [1, 2, 3, 4, 5, 6, 7]).forEach((level) => {
      if (!types) {
        const keys = Object.keys(subscribers);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (key.startsWith(level + "_")) {
            subscribers[key] = removeListener(subscribers[key], listener);
          }
        }
      }
      (types || []).forEach((type) => {
        const key = level + "_" + type;
        const listeners = subscribers[key];
        if (listeners) {
          subscribers[key] = removeListener(subscribers[key], listener);
        }
      });
    });
  }, "removeEventListener");
  var removeListener = /* @__PURE__ */ __name((listeners, listener) => {
    if (!listeners) return [];
    for (let i = listeners.length - 1; i >= 0; i--) {
      if (Object.is(listeners[i], listener)) {
        listeners.splice(i, 1);
      }
    }
    return listeners;
  }, "removeListener");
  var fireEvents = /* @__PURE__ */ __name((evs) => __async(null, null, function* () {
    const duplicates = [];
    try {
      for (var iter4 = __forAwait(evs || []), more4, temp4, error4; more4 = !(temp4 = yield iter4.next()).done; more4 = false) {
        const ev = temp4.value;
        try {
          for (var iter3 = __forAwait(ev.levels || []), more3, temp3, error3; more3 = !(temp3 = yield iter3.next()).done; more3 = false) {
            const level = temp3.value;
            try {
              for (var iter2 = __forAwait(ev.types || []), more2, temp2, error2; more2 = !(temp2 = yield iter2.next()).done; more2 = false) {
                const type = temp2.value;
                const key = level + "_" + type;
                const listeners = subscribers[key];
                if (!listeners || typeof level !== "number" || typeof type !== "string") return;
                const pes = key + "_" + ev.desc;
                if (duplicates.indexOf(pes) >= 0) return;
                duplicates.push(pes);
                try {
                  for (var iter = __forAwait(listeners), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
                    const listener = temp.value;
                    const rc = yield fireOneEvent({ level, type, desc: ev.desc }, listener);
                    if (!rc) removeEventListener([level], [type], listener);
                  }
                } catch (temp) {
                  error = [temp];
                } finally {
                  try {
                    more && (temp = iter.return) && (yield temp.call(iter));
                  } finally {
                    if (error)
                      throw error[0];
                  }
                }
              }
            } catch (temp2) {
              error2 = [temp2];
            } finally {
              try {
                more2 && (temp2 = iter2.return) && (yield temp2.call(iter2));
              } finally {
                if (error2)
                  throw error2[0];
              }
            }
          }
        } catch (temp3) {
          error3 = [temp3];
        } finally {
          try {
            more3 && (temp3 = iter3.return) && (yield temp3.call(iter3));
          } finally {
            if (error3)
              throw error3[0];
          }
        }
      }
    } catch (temp4) {
      error4 = [temp4];
    } finally {
      try {
        more4 && (temp4 = iter4.return) && (yield temp4.call(iter4));
      } finally {
        if (error4)
          throw error4[0];
      }
    }
  }), "fireEvents");
  var fireOneEvent = /* @__PURE__ */ __name((ev, listener) => __async(null, null, function* () {
    var _a2, _b2, _c2;
    if (!listener || typeof listener !== "function") return false;
    if (mls_exports.isTraceEvents) console.time("fireOneEvent_key_" + ev.level + "_" + ev.type + "_" + ((_a2 = ev.desc) == null ? void 0 : _a2.substring(0, 20)));
    let rc = listener(ev);
    if (typeof (rc == null ? void 0 : rc.then) === "function") {
      try {
        rc = yield rc;
      } catch (e) {
        if (mls_exports.isTraceEvents) console.timeEnd("fireOneEvent_key_" + ev.level + "_" + ev.type + "_" + ((_b2 = ev.desc) == null ? void 0 : _b2.substring(0, 20)));
        console.log("error on fire event: level:" + ev.level + ", type:" + ev.type + ", desc:" + ev.desc || Number(", function: ") + (rc.name || "?"));
        console.error("trace: ", e);
        return false;
      }
    }
    if (mls_exports.isTraceEvents) console.timeEnd("fireOneEvent_key_" + ev.level + "_" + ev.type + "_" + ((_c2 = ev.desc) == null ? void 0 : _c2.substring(0, 20)));
    return true;
  }), "fireOneEvent");
  var getNearTimeout = /* @__PURE__ */ __name((timeout) => {
    const str = Date.now() + timeout;
    const keys = Object.keys(delays);
    for (let i = 0; i < keys.length; i++) {
      const key = Number(keys[i]);
      if (Math.abs(delays[key] && delays[key].str - str) < 100) return delays[key];
    }
    return void 0;
  }, "getNearTimeout");
  var fireFileAction = /* @__PURE__ */ __name((action, storFile, position, newProject, newshortName, newfolder, newEnhancement, timeout = 200) => __async(null, null, function* () {
    const args = {
      action,
      level: storFile.level,
      position,
      project: storFile.project,
      shortName: storFile.shortName,
      folder: storFile.folder,
      extension: storFile.extension,
      newProject,
      newshortName,
      newfolder,
      newEnhancement
    };
    return mls_exports.events.fire(
      storFile.level,
      "FileAction",
      JSON.stringify(args),
      timeout
    );
  }), "fireFileAction");
  var fireMonacoAction = /* @__PURE__ */ __name((action, storFile, codeLenCommand, position, filePosition, timeout = 200) => __async(null, null, function* () {
    const args = {
      action,
      level: storFile.level,
      position,
      filePosition,
      codeLenCommand,
      project: storFile.project,
      shortName: storFile.shortName,
      folder: storFile.folder,
      extension: storFile.extension
    };
    return mls_exports.events.fire(
      storFile.level,
      "MonacoAction",
      JSON.stringify(args),
      timeout
    );
  }), "fireMonacoAction");
  var firebaseConfig = {
    firebase: {
      apiKey: "AIzaSyC91viDpl3qwQz0qs45mI2ZFvu6WVjMCRM",
      authDomain: "collab-messages.firebaseapp.com",
      projectId: "collab-messages",
      storageBucket: "collab-messages.firebasestorage.app",
      messagingSenderId: "67955642284",
      appId: "1:67955642284:web:fe0e799dea0c6f05aa7409"
    },
    firebasePush: {
      // don't need on front end
    },
    firebaseBackEnd: {
      // don't need on front end
    }
  };
  var VAPID_KEY = "BDnKnenojtcHdgOlleNbSivLR8w5jebYzdZyVU42Lkuhg0BogzuQmIU3z-G0Wia99sMMliR23qdJoxYLjrYbGUs";
  var getFCMTokenForBackend = /* @__PURE__ */ __name(() => __async(null, null, function* () {
    try {
      const reg = yield mls_exports.stor.cache.installIfNeeded();
      if (!reg) throw new Error("Service Worker not available");
      if (Notification.permission !== "granted") {
        const perm = yield Notification.requestPermission();
        if (perm !== "granted") return null;
      }
      const { initializeApp: initializeApp2 } = yield Promise.resolve().then(() => (init_index_esm5(), index_esm_exports));
      const { getMessaging, getToken: getToken3 } = yield Promise.resolve().then(() => (init_index_esm8(), index_esm_exports2));
      const app = initializeApp2(firebaseConfig.firebase);
      const messaging = getMessaging(app);
      const token = yield getToken3(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: reg
      });
      return token || null;
    } catch (err2) {
      console.error("Error getting FCM token:", err2.message);
      return null;
    }
  }), "getFCMTokenForBackend");

  // src/mindmap/mindmap.ts
  var mindmap_exports = {};
  __export(mindmap_exports, {
    MindMapNodePathInput: () => MindMapNodePathInput,
    addBase: () => addBase,
    addDynamic: () => addDynamic,
    baseResolvers: () => baseResolvers,
    dynamicResolvers: () => dynamicResolvers,
    getMindMapNodes: () => getMindMapNodes
  });
  var _MindMapNodePathInput = class _MindMapNodePathInput {
    constructor(domain, entity, relation) {
      __publicField(this, "domain");
      __publicField(this, "entity");
      __publicField(this, "relation");
      this.domain = domain;
      this.entity = entity;
      this.relation = relation;
    }
    toString() {
      let path = this.domain;
      if (this.entity) path += `/${this.entity}`;
      if (this.relation) path += `/${this.relation}`;
      return path;
    }
  };
  __name(_MindMapNodePathInput, "MindMapNodePathInput");
  var MindMapNodePathInput = _MindMapNodePathInput;
  function getMindMapNodes(path) {
    return __async(this, null, function* () {
      let result = [];
      if (!path || !path.domain) {
        throw new Error("Invalid path input. Path must have a domain.");
      }
      const type = path.domain;
      const baseNode = baseResolvers[type];
      if (!baseNode) throw new Error(`No base resolver found for mind map type: ${type}`);
      result.push({
        id: baseNode.id,
        label: baseNode.label
      });
      const keys = Object.keys(baseResolvers);
      for (const key of keys) {
        const base = baseResolvers[key];
        if (base.related && base.related.includes(type)) {
          result.push({
            id: `${base.id}/${path.domain}`,
            label: base.label,
            position: "left",
            sizeHint: "line"
          });
        }
      }
      if (!dynamicResolvers[type]) throw new Error(`No dynamica resolvers found for mind map type: ${type}`);
      const function1 = dynamicResolvers[type];
      if (!function1) throw new Error(`No dynamic resolver found for mind map type: ${type}`);
      const dynResult = yield function1(path);
      if (!Array.isArray(dynResult)) throw new Error(`Dynamic resolver for type ${type} did not return an array`);
      result = [...result, ...dynResult];
      return result;
    });
  }
  __name(getMindMapNodes, "getMindMapNodes");
  var baseResolvers = {};
  var dynamicResolvers = {};
  function addBase(type, node) {
    baseResolvers[type] = node;
  }
  __name(addBase, "addBase");
  function addDynamic(type, fn) {
    dynamicResolvers[type] = fn;
  }
  __name(addDynamic, "addDynamic");

  // src/bots/bots.ts
  var bots_exports = {};
  __export(bots_exports, {
    getBotContextVarsBeforeMessageSend: () => getBotContextVarsBeforeMessageSend,
    getBotContextVarsBeforeMessageSend2: () => getBotContextVarsBeforeMessageSend2
  });
  function getBotContextVarsBeforeMessageSend(thread, messageText) {
    const vars = /* @__PURE__ */ new Set();
    for (const bot of thread.bots || []) {
      if (bot.status === "disabled") continue;
      for (const triggerEntry of bot.triggers || []) {
        if (triggerEntry.type !== "onNewMessage") continue;
        const conditions = triggerEntry.conditions || [];
        const msg = messageText.toLowerCase();
        const conditionResults = conditions.map((cond) => {
          const value = cond.value.toLowerCase();
          switch (cond.type) {
            case "hasTag":
              return msg.includes(value.startsWith("#") ? value : `#${value}`);
            case "mention":
              return msg.includes(value.startsWith("@") ? value : `@${value}`);
            case "startsWith":
              return msg.startsWith(value);
            case "contains":
              return msg.includes(value);
            default:
              return false;
          }
        });
        const conditionsPassed = (triggerEntry.match || "any") === "all" ? conditionResults.every(Boolean) : conditionResults.some(Boolean);
        if (!conditionsPassed && conditions.length > 0) continue;
        const prompt = bot.llmPrompt || "";
        const matches = prompt.match(/{{\s*([\w\d_]+)\s*}}/g) || [];
        for (const match of matches) {
          const varName = match.replace(/{{\s*|\s*}}/g, "");
          vars.add(varName);
        }
        break;
      }
    }
    return Array.from(vars);
  }
  __name(getBotContextVarsBeforeMessageSend, "getBotContextVarsBeforeMessageSend");
  function getBotContextVarsBeforeMessageSend2(vars, myArgs) {
    const results = [];
    const ignoreList = ["botRecord"];
    for (const entry of vars) {
      if (ignoreList.includes(entry)) continue;
      const match = entry.match(/^(\w+)\(([^)]*)\)$/);
      if (match) {
        const toolName = match[1];
        const argList = match[2].split(",").map((s) => s.trim()).filter(Boolean);
        const args = {};
        for (const arg of argList) {
          args[arg] = myArgs[arg];
        }
        results.push({ toolName, args });
      } else {
        results.push({ toolName: entry, args: {} });
      }
    }
    return results;
  }
  __name(getBotContextVarsBeforeMessageSend2, "getBotContextVarsBeforeMessageSend2");

  // ../cbe-common/src/l5-common.ts
  var l5_common_exports = {};
  __export(l5_common_exports, {
    FILENAMEPROJECTCONFIG: () => FILENAMEPROJECTCONFIG,
    getOrgsName: () => getOrgsName2,
    getProjectDetails: () => getProjectDetails3,
    getProjectIndexInOrg: () => getProjectIndexInOrg,
    getProjectOrganizationIndex: () => getProjectOrganizationIndex,
    getProjectSettings: () => getProjectSettings2,
    getProjectsInOrg: () => getProjectsInOrg2,
    setProjectSettings: () => setProjectSettings2
  });
  var getProjectOrganizationIndex = /* @__PURE__ */ __name((orgs2, prjID) => {
    var _a2;
    const keys = Object.keys(orgs2);
    for (let orgIndex = 0; orgIndex < keys.length; orgIndex++) {
      const key = keys[orgIndex];
      const projects2 = (_a2 = orgs2[key].sett) == null ? void 0 : _a2.projects;
      for (const item of projects2) {
        if (item.id === prjID) return orgIndex;
      }
    }
    return void 0;
  }, "getProjectOrganizationIndex");
  var getProjectIndexInOrg = /* @__PURE__ */ __name((org, prjID) => {
    var _a2;
    const projects2 = (_a2 = org.sett) == null ? void 0 : _a2.projects;
    for (let index = 0; index < projects2.length; index++) {
      if (projects2[index].id === prjID) return index;
    }
    return -1;
  }, "getProjectIndexInOrg");
  var getProjectDetails3 = /* @__PURE__ */ __name((orgs2, prjID) => {
    var _a2;
    const keys = Object.keys(orgs2);
    for (const key of keys) {
      const projects2 = (_a2 = orgs2[key].sett) == null ? void 0 : _a2.projects;
      for (const item of projects2) {
        if (item.id === prjID) return item;
      }
    }
    return void 0;
  }, "getProjectDetails");
  var getOrgsName2 = /* @__PURE__ */ __name((orgs2) => {
    const orgsName = [];
    const keys = Object.keys(orgs2);
    for (const key of keys) {
      orgsName.push(orgs2[key].sett.name);
    }
    return orgsName;
  }, "getOrgsName");
  var getProjectsInOrg2 = /* @__PURE__ */ __name((orgs2, actualOrg2) => {
    var _a2;
    const orgKeys = Object.keys(orgs2);
    if (actualOrg2 < 0 || actualOrg2 >= orgKeys.length) return [];
    const orgKey = orgKeys[actualOrg2];
    const projects2 = (_a2 = orgs2[orgKey].sett) == null ? void 0 : _a2.projects;
    if (!projects2) return [];
    return projects2.map((prj) => prj.id);
  }, "getProjectsInOrg");
  var getProjectSettings2 = /* @__PURE__ */ __name((orgs2, prjID) => {
    const prj = getProjectDetails3(orgs2, prjID);
    if (!prj || !prj.value) return void 0;
    const jObj = JSON.parse(prj.value);
    return jObj;
  }, "getProjectSettings");
  var setProjectSettings2 = /* @__PURE__ */ __name((orgs2, prjID, settings) => {
    const prj = getProjectDetails3(orgs2, prjID);
    if (!prj || !prj.value) return;
    prj.value = JSON.stringify(settings);
  }, "setProjectSettings");
  var FILENAMEPROJECTCONFIG = "project";

  // ../cbe-common/src/global.cbe.types.ts
  var global_cbe_types_exports = {};
  __export(global_cbe_types_exports, {
    GITHUBBRAND: () => GITHUBBRAND,
    GITLABBRAND: () => GITLABBRAND,
    HttpStatus: () => HttpStatus,
    providerWidgets: () => providerWidgets,
    validDrivers: () => validDrivers
  });
  var HttpStatus = /* @__PURE__ */ ((HttpStatus2) => {
    HttpStatus2[HttpStatus2["OK"] = 200] = "OK";
    HttpStatus2[HttpStatus2["NOT_MODIFIED"] = 304] = "NOT_MODIFIED";
    HttpStatus2[HttpStatus2["BAD_REQUEST"] = 400] = "BAD_REQUEST";
    HttpStatus2[HttpStatus2["UNAUTHORIZED"] = 401] = "UNAUTHORIZED";
    HttpStatus2[HttpStatus2["NOT_FOUND"] = 404] = "NOT_FOUND";
    HttpStatus2[HttpStatus2["FORBIDDEN"] = 403] = "FORBIDDEN";
    HttpStatus2[HttpStatus2["CONFLICT"] = 409] = "CONFLICT";
    HttpStatus2[HttpStatus2["SERVER_ERROR"] = 500] = "SERVER_ERROR";
    HttpStatus2[HttpStatus2["NOT_IMPLEMENTED"] = 501] = "NOT_IMPLEMENTED";
    return HttpStatus2;
  })(HttpStatus || {});
  var GITHUBBRAND = "GitHub";
  var GITLABBRAND = "GitLab";
  var validDrivers = [GITHUBBRAND, GITLABBRAND];
  var providerWidgets = {
    "github": "/_100554_/l2/driverGithub.js",
    "gitlab": "/_100554_/l2/driverGitlab.js",
    "google": "",
    "aws": "",
    "azure": "",
    "cloudflare": "",
    "googlecloud": ""
  };

  // src/mls.ts
  var _a, _b, _c, _d;
  var version7 = `versions: mls lib: ${(_a = window.latest) == null ? void 0 : _a.libs}, www: ${(_b = window.latest) == null ? void 0 : _b.www}, monaco: ${(_c = window.latest) == null ? void 0 : _c.monaco}, indexHTML: ${(_d = window.latest) == null ? void 0 : _d.indexHTML}`;
  var contributions = {};
  var setContributions = /* @__PURE__ */ __name((key, value) => {
    contributions[key] = value;
  }, "setContributions");
  var services = {};
  var setServices = /* @__PURE__ */ __name((key, value) => {
    services[key] = value;
  }, "setServices");
  var showLibVersions = /* @__PURE__ */ __name(() => {
    var _a2;
    console.log(`less, version ${(_a2 = window.less) == null ? void 0 : _a2.version}`);
  }, "showLibVersions");
  var actualLevel = 0;
  var setActualLevel = /* @__PURE__ */ __name((level) => {
    actualLevel = level;
  }, "setActualLevel");
  var actualPosition = "left";
  var setActualPosition = /* @__PURE__ */ __name((position) => {
    actualPosition = position;
  }, "setActualPosition");
  var actualProject = stor_localStor_exports.getProjectDetails().project;
  var setActualProject = /* @__PURE__ */ __name((project) => {
    actualProject = project;
  }, "setActualProject");
  var actualModule = stor_localStor_exports.getProjectDetails().module;
  var setActualModule = /* @__PURE__ */ __name((module) => {
    actualModule = module;
  }, "setActualModule");
  var getActualUser = /* @__PURE__ */ __name(() => {
    return api_common_exports.getCookie("loginUser") || "";
  }, "getActualUser");
  var actualService;
  var setActualService = /* @__PURE__ */ __name((service) => {
    actualService = service;
  }, "setActualService");
  var actualNav3;
  var setActualNav3 = /* @__PURE__ */ __name((nav3) => {
    actualNav3 = nav3;
  }, "setActualNav3");
  var actual = [
    {
      level: 0,
      project: void 0,
      path: void 0,
      getFullName,
      getStorFileBase,
      getStorFile,
      setFullName
    },
    {
      level: 1,
      project: void 0,
      path: void 0,
      getFullName,
      getStorFileBase,
      getStorFile,
      setFullName
    },
    {
      level: 2,
      project: void 0,
      path: void 0,
      getFullName,
      getStorFileBase,
      getStorFile,
      setFullName
    },
    {
      level: 3,
      project: void 0,
      path: void 0,
      getFullName,
      getStorFileBase,
      getStorFile,
      setFullName
    },
    {
      level: 4,
      project: void 0,
      path: void 0,
      getFullName,
      getStorFileBase,
      getStorFile,
      setFullName
    },
    {
      level: 5,
      project: void 0,
      path: void 0,
      getFullName,
      getStorFileBase,
      getStorFile,
      setFullName
    },
    {
      level: 6,
      project: void 0,
      path: void 0,
      getFullName,
      getStorFileBase,
      getStorFile,
      setFullName
    },
    {
      level: 7,
      project: void 0,
      path: void 0,
      getFullName,
      getStorFileBase,
      getStorFile,
      setFullName
    }
  ];
  function getFullName() {
    if (this.project === 1) return this.path || "";
    return `_${(this.project || 1).toString()}_${this.path}`;
  }
  __name(getFullName, "getFullName");
  function getStorFileBase() {
    var _a2;
    const rc = { project: this.project || 1, level: this.level, shortName: "", folder: "", extension: "" };
    if (rc.level === 0) rc.level = 2;
    if (!this.project || this.project < 1 || !this.path) return rc;
    const sp = this.path.split("/").filter(Boolean);
    const shortNameAndExtension = sp.pop() || "";
    if (sp.length > 0 && sp[0] === "l2") {
      sp.shift();
      this.level = 2;
    } else if (sp.length > 0 && sp[0] === "l1") {
      sp.shift();
      this.level = 1;
    }
    const shortName = shortNameAndExtension.split(".")[0] || "";
    if (!shortName) return rc;
    const folder = sp.join("/") || "";
    const extension = shortNameAndExtension.includes(".") ? "." + ((_a2 = shortNameAndExtension.split(".").pop()) != null ? _a2 : "") : ".ts";
    return __spreadProps(__spreadValues({}, rc), { shortName, folder, extension });
  }
  __name(getStorFileBase, "getStorFileBase");
  function getStorFile() {
    const fileBase = getStorFileBase.call(this);
    const key = getKeyToFile2(fileBase);
    return files[key];
  }
  __name(getStorFile, "getStorFile");
  function setFullName(value) {
    if (!value) {
      value = "";
    }
    value = value.trim();
    if (value.startsWith("_")) {
      let pr = value.substring(1).split("_")[0];
      let prID = Number(pr);
      if (isNaN(prID)) prID = 0;
      this.project = prID;
      this.path = value.substring(pr.length + 2);
    } else {
      this.project = 1;
      this.path = value;
    }
    return this;
  }
  __name(setFullName, "setFullName");

  // src/index.ts
  window.mls = mls_exports;
  window.mls.istrace = false;
  window.mls.istraceui = false;
  window.mls.istraceevents = false;
})();
/*! Bundled license information:

jszip/dist/jszip.min.js:
  (*!
  
  JSZip v3.10.1 - A JavaScript class for generating and reading zip files
  <http://stuartk.com/jszip>
  
  (c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
  Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.
  
  JSZip uses the library pako released under the MIT license :
  https://github.com/nodeca/pako/blob/main/LICENSE
  *)

@firebase/util/dist/index.esm.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2022 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2025 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/component/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/logger/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/app/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2023 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

firebase/app/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/installations/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/messaging/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2018 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
   * in compliance with the License. You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software distributed under the License
   * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
   * or implied. See the License for the specific language governing permissions and limitations under
   * the License.
   *)
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

pako/dist/pako.esm.mjs:
  (*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) *)
*/
//# sourceMappingURL=mls.js.map
