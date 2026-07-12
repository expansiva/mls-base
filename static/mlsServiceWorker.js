"use strict";
(() => {
  // src/stor/stor.serviceWorkerIndex.js
  var dbOrNull = null;
  var dbName = "mlsSW";
  var version = 4;
  var initDB = async () => {
    return new Promise((resolve, reject) => {
      if (dbOrNull) {
        resolve(dbOrNull);
        return;
      }
      const request = indexedDB.open(dbName, version);
      request.onblocked = () => console.warn("[IDB] Upgrade blocked");
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {
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
  };
  var set = async (tbName2, key, value) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName2, "readwrite");
      const objectStore = transaction.objectStore(tbName2);
      const request = !value ? objectStore.delete(key) : objectStore.put({ key, value });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      request.onerror = () => reject(request.error);
    });
  };
  var setMultiple = async (tbName2, keys, values) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName2, "readwrite");
      const objectStore = transaction.objectStore(tbName2);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      keys.forEach((key, index) => {
        const value = values[index];
        const request = value === "" ? objectStore.delete(key) : objectStore.put({ key, value });
        request.onerror = () => reject(request.error);
      });
    });
  };
  var get = async (tbName2, key) => {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(tbName2, "readonly");
      const objectStore = transaction.objectStore(tbName2);
      const request = objectStore.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => resolve(void 0);
    });
  };
  var getAll = async (tbName2) => {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(tbName2, "readonly");
      const objectStore = transaction.objectStore(tbName2);
      const request = objectStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  };
  var clear = async (tbName2) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName2, "readwrite");
      transaction.onerror = () => resolve(void 0);
      const objectStore = transaction.objectStore(tbName2);
      const request = objectStore.clear();
      request.onsuccess = () => resolve(void 0);
      request.onerror = () => resolve(void 0);
    });
  };
  var getAllFilesRefInCache = async (project) => {
    const tbName2 = "serviceWorker";
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(tbName2, "readonly");
      const objectStore = transaction.objectStore(tbName2);
      const prefix = project ? `/local/_${project}_` : `/local/_`;
      const range = IDBKeyRange.bound(prefix, prefix + "\uFFFF");
      const request = objectStore.getAll(range);
      request.onsuccess = (event) => {
        resolve(event.target.result ?? []);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  };
  var notificationStore = class {
    static async save(notification) {
      return set(this.tbName, notification.id, JSON.stringify(notification));
    }
    static async getAll() {
      const results = await getAll(this.tbName);
      return results.map(({ key, value }) => {
        const notification = JSON.parse(value);
        return notification;
      });
    }
    static async delete(id) {
      await set(this.tbName, id, null);
    }
    static async markSending(id) {
      const raw = await get(this.tbName, id);
      if (!raw)
        return;
      const rec = JSON.parse(raw);
      if (rec) {
        rec.attempts++;
        if (rec.attempts > 3) {
          await set(this.tbName, id, null);
        } else {
          await set(this.tbName, id, JSON.stringify(rec));
        }
      }
    }
  };
  notificationStore.tbName = "notifications";

  // serviceWorker/mlsServiceWorker.ts
  var CACHE_NAME = "mls-v2";
  var tbName = "serviceWorker";
  var totalRequests = 0;
  var totalHits = 0;
  var totalNotFound = 0;
  var totalInserts = 0;
  var MLSSERVICEWORKERVERSION = "1.4.36";
  var mls = {
    _isTrace: false,
    // default
    get isTrace() {
      return this._isTrace;
    },
    set isTrace(value) {
      this._isTrace = value;
    }
  };
  self.mls = mls;
  self.addEventListener("install", (event) => {
    if (mls.isTrace) console.info("[ServiceWorker] Install");
    console.info("service worker install ok");
    self.skipWaiting();
  });
  self.addEventListener("activate", (event) => {
    if (mls.isTrace) console.info("[ServiceWorker] Activate");
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            if (mls.isTrace) console.info("[ServiceWorker] Removing old cache", cacheName);
            return caches.delete(cacheName);
          }
          return false;
        }));
      }).then(() => {
        return self.clients.claim();
      })
    );
  });
  self.addEventListener("fetch", (event) => {
    const url = event.request.url;
    const uri = new URL(url);
    let path = uri.pathname;
    if (event.request.method === "POST" && path === "/exec") {
      getProjectId(event);
    }
    if (event.request.method !== "GET") return;
    const isDefsOrTestJs = path.endsWith(".defs.js") || path.endsWith(".test.js");
    if (path.startsWith("/local/") || path.startsWith("/l2/") || path.startsWith("/l1/") || uri.searchParams.get("v") || // ex file1?v=123
    isDefsOrTestJs || // ex file1.defs.js or file1.test.js
    path.indexOf(".") < 0 || // ex import('./_100111_widget1')
    path.startsWith(prefixWidgetName)) {
      event.respondWith((async () => {
        if (mls.isTrace) console.info(`[ServiceWorker] fetch, url: ${url}, path: ${uri.pathname}`);
        totalRequests += 1;
        return getLocalFiles(event, url, uri);
      })());
    }
  });
  self.addEventListener("message", async (event) => {
    const message = event.data;
    if (mls.isTrace) console.info("[ServiceWorker] message: ", message);
    switch (message.action) {
      case "add": {
        const rcUrl = await add(message);
        event.ports[0].postMessage(rcUrl);
        break;
      }
      case "adds": {
        try {
          const rcUrls = await adds(message);
          event.ports[0].postMessage(rcUrls);
        } catch (error) {
          console.error("[ServiceWorker] Error in adds:", error);
          const rcUrls = "Error: " + error.message;
          event.ports[0].postMessage(rcUrls);
        }
        break;
      }
      case "clearAll":
        await clearAll(message);
        break;
      case "clearObsolete":
        clearObsolete();
        break;
      case "clearProjects":
        clearProjects(message);
        break;
      case "REQUEST_MISSED":
        sendNotificationsRequestMissed();
        break;
      case "ACK":
        receiveACK(message.id);
        break;
      case "getURL": {
        if (typeof message.path !== "string" || typeof message.version !== "string") throw new Error("Invalid path or version in getURL");
        const rc = await getURL(message.path, message.version);
        event.ports[0].postMessage(rc);
        break;
      }
      case "sts":
        event.ports[0].postMessage(await getSTS(message));
        break;
      default:
        throw new Error(`Unknown action: ${message.action}`);
    }
  });
  self.addEventListener("sync", (event) => {
    if (mls.isTrace) console.info("[ServiceWorker] Event: Sync", event.tag);
    if (!event.tag) return;
    if (event.tag === "github" || event.tag === "test-tag-from-devtools") {
      event.waitUntil(
        self.clients.matchAll().then((all) => {
          return all.map((client) => {
            return client.postMessage("online");
          });
        }).catch((error) => {
          console.error(error);
        })
      );
    }
  });
  self.addEventListener("push", (event) => {
    if (mls.isTrace) console.info("[ServiceWorker] Push event received:", event);
    event.waitUntil((async () => {
      let payload = {};
      try {
        const raw = event.data?.json?.() ?? {};
        payload = raw.data ?? raw;
      } catch (e) {
        console.warn("[ServiceWorker] Failed to parse push data", e);
        return;
      }
      if (payload?.type === "thread-update") {
        await saveNotification("thread-update", payload);
      } else {
        console.warn("[SW] Unhandled push type:", payload?.type);
      }
    })());
  });
  var saveNotification = async (type, data) => {
    const rec = {
      type,
      data,
      id: `${Date.now()}#${Math.random().toString(36).slice(2, 8)}`,
      attempts: 0
    };
    notificationStore.save(rec);
    notifyAllClients(rec);
  };
  var sendNotificationsRequestMissed = async () => {
    notificationStore.getAll().then((notifications) => {
      notifications.forEach((notification) => {
        notifyAllClients(notification);
      });
    });
  };
  var receiveACK = async (id) => {
    if (!id) {
      console.log(`[ServiceWorker] ACK received without ID`);
    } else {
      notificationStore.delete(id);
    }
  };
  var notifyAllClients = async (notification) => {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    if (!clients || clients.length === 0) {
      return;
    }
    if (mls.isTrace) console.log(`[ServiceWorker] Notifying all clients: ${notification.type}`, notification.data, clients);
    notificationStore.markSending(notification.id);
    clients.forEach((client) => {
      client.postMessage(notification);
    });
  };
  var baseProject = 0;
  var getProjectId = async (event) => {
    if (event.request.method !== "POST") return;
    const clone = event.request.clone();
    try {
      const data = await clone.json();
      if (mls.isTrace) console.log("[ServiceWorker] getProjectId, data:", data);
      if (!data || !data.baseProject) {
        if (mls.isTrace) console.warn("[ServiceWorker] getProjectId, no baseProject in data");
        return;
      }
      baseProject = Number(data.baseProject);
      if (Number.isNaN(baseProject) || baseProject < 1) baseProject = 0;
    } catch (err) {
      console.error("Failed to parse JSON:", err);
    }
  };
  var prefixWidgetName = "/_";
  var getLocalFiles = async (event, url, uri) => {
    let path = uri.pathname;
    const version2 = uri.searchParams.get("v");
    const isLocalCache = path.startsWith("/local/");
    const localCache2Prefix = path.startsWith("/l2/") ? "/l2" : path.startsWith("/l1/") ? "/l1" : "";
    const isLocalCache2 = Boolean(localCache2Prefix);
    const isExternalCache = isLocalCache2 ? false : path.includes("/l2/") || path.includes("/l1/");
    let project = 0;
    let widgetName = null;
    const isJsFile = path.endsWith(".js");
    const withNoExtension = !path.includes(".");
    if ((isJsFile || withNoExtension) && !version2) {
      if (isLocalCache) {
        path = path.substring("/local".length);
        if (mls.isTrace) console.log(`[ServiceWorker] getLocalFiles localCache, baseProject=${baseProject}, path=${path}`);
      } else if (isLocalCache2) {
        path = path.substring(localCache2Prefix.length);
        if (!path.startsWith("/_")) {
          project = baseProject;
          widgetName = `${path.substring(1)}`;
        }
        if (mls.isTrace) console.log(`[ServiceWorker] getLocalFiles localCache2, baseProject=${baseProject}, path=${path}, project=${project}, widgetName=${widgetName}`);
      } else if (isExternalCache) {
        path = path.replace("/l2/", "").replace("/l1/", "");
        if (mls.isTrace) console.log(`[ServiceWorker] getLocalFiles externalCache, path=${path}`);
      }
      if (!widgetName && path.startsWith(prefixWidgetName)) {
        let rest = path.substring(prefixWidgetName.length);
        const firstUnderscore = rest.indexOf("_");
        project = Number(rest.substring(0, firstUnderscore));
        if (project > 0 && project < 999999999999) {
          widgetName = rest.substring(firstUnderscore + 1);
          if (widgetName.startsWith("/")) {
            widgetName = widgetName.substring(1);
          }
          if (mls.isTrace && widgetName.includes("/")) console.log(`[ServiceWorker] getLocalFiles with folders, project=${project}, widgetName=${widgetName}`);
        }
      }
    }
    if (!isLocalCache && !widgetName) return fetch(event.request);
    const isStudioHost = self.location.host === "multilevelstudio.com" || self.location.host === "collab.codes" || self.location.host.endsWith(".collab.codes");
    if (!isStudioHost && !uri.searchParams.get("v")) {
      try {
        const networkResponse = await fetch(event.request.url, { cache: "no-cache" });
        if (networkResponse && networkResponse.ok) return networkResponse;
      } catch {
      }
    }
    if (widgetName) url = await findCacheJS(project, widgetName) || url;
    const cachedResponse = await caches.match(url);
    if (cachedResponse) {
      totalHits += 1;
      return cachedResponse;
    }
    totalNotFound += 1;
    try {
      return await fetch(event.request);
    } catch {
    }
    return new Response(null, {
      status: 404,
      statusText: "file in local cache Not Found, url=" + url
    });
  };
  var removeOldCache = async (cache, path) => {
    const match = await cache.match(path, { ignoreSearch: true, ignoreMethod: true, ignoreVary: true });
    if (match) {
      cache.delete(path, { ignoreSearch: true, ignoreMethod: true, ignoreVary: true });
    }
  };
  var updateCache = async (cache, pathWithVersion, request, response, onlyDelete) => {
    const match = await cache.match(pathWithVersion);
    if (match) {
      if (mls.isTrace) console.log(`[ServiceWorker]updateCache: not changed ${pathWithVersion}, onlyDelete=${onlyDelete}`, match);
      if (onlyDelete) return cache.delete(pathWithVersion, { ignoreSearch: true, ignoreMethod: true, ignoreVary: true });
      return true;
    }
    if (mls.isTrace) console.log(`[ServiceWorker] updateCache: changed ${pathWithVersion}, onlyDelete=${onlyDelete}`);
    if (!onlyDelete) return cache.put(request, response);
    return true;
  };
  var add = async (message) => {
    if (typeof message.path !== "string") throw new Error("incorrect message in add, path must be string");
    if (typeof message.version !== "string") throw new Error("incorrect message in add, version must be string");
    if (typeof message.contentType !== "string") throw new Error("incorrect message in add, contentType must be string");
    if (typeof message.content !== "string" && typeof message.content !== "object") throw new Error("incorrect message in add, content must be string or Blob");
    if (typeof message.content === "string" && !message.content.length || typeof message.content === "object" && !message.content.size || !message.path || !message.version) throw new Error("incorrect message in add");
    const content = message.content;
    if (!message.path.startsWith("_")) throw new Error("incorrect message in add, FileName must start with project");
    const cache = await caches.open(CACHE_NAME);
    await removeOldCache(cache, message.path);
    if (!message.content) return "";
    const pathWithVersion = getPath(message.path, message.version);
    const request = new Request(pathWithVersion);
    const len = typeof message.content === "string" ? message.content ? message.content.length : 0 : message.content.size;
    const response = new Response(content, {
      headers: {
        "Content-Type": message.contentType || "",
        "Content-length": len.toString()
      }
    });
    totalInserts++;
    cacheIndex.addPath(message.path, message.version);
    await cache.put(request, response);
    if (mls.isTrace) console.info(`[ServiceWorker] add  path=${pathWithVersion}, len=${len}`);
    return pathWithVersion;
  };
  var adds = async (message) => {
    if (!Array.isArray(message.path)) throw new Error("incorrect message in adds, path must be array");
    if (!Array.isArray(message.version)) throw new Error("incorrect message in adds, version must be array");
    if (!Array.isArray(message.contentType)) throw new Error("incorrect message in adds, contentType must be array");
    if (!Array.isArray(message.content)) throw new Error("incorrect message in adds, content must be array");
    if (message.path.length !== message.version.length) throw new Error("incorrect message in adds, path and version must have the same length");
    if (message.path.length !== message.contentType.length) throw new Error("incorrect message in adds, path and contentType must have the same length");
    if (message.path.length !== message.content.length) throw new Error("incorrect message in adds, path and content must have the same length");
    const filesToUpdate = [];
    const cacheVersionPromises = message.path.map((path, i) => {
      const version2 = message.version?.[i] || "";
      const isVersionDate = version2.length === 24 && version2[4] === "-" && version2[7] === "-" && version2[10] === "T";
      if (isVersionDate) {
        return cacheIndex.getVersionFromPath(path);
      }
      return void 0;
    });
    const cacheVersions = await Promise.all(cacheVersionPromises);
    for (let i = 0; i < message.path.length; i++) {
      const path = message.path[i];
      const version2 = message.version[i];
      const contentType = message.contentType[i];
      const content = message.content[i];
      if (typeof content === "string" && !content.length || typeof content === "object" && !content.size || !path || !version2) throw new Error(`incorrect message in add, index ${i}`);
      if (!path.startsWith("_")) throw new Error("incorrect message in add, FileName must start with project");
      const isVersionDate = version2.length === 24 && version2[4] === "-" && version2[7] === "-" && version2[10] === "T";
      if (isVersionDate) {
        const cacheVersion = cacheVersions[i];
        const isVersionInCacheDate = cacheVersion && cacheVersion.length === 24 && cacheVersion[4] === "-" && cacheVersion[7] === "-" && cacheVersion[10] === "T";
        if (isVersionInCacheDate && cacheVersion >= version2) {
          if (mls.isTrace) console.info(`[ServiceWorker] Skipping: JS cache is more recent. Path=${path}, version=${version2}, cacheVersion=${cacheVersion}`);
          continue;
        }
      }
      const pathWithVersion = getPath(path, version2);
      const request = new Request(pathWithVersion);
      const len = typeof content === "string" ? content ? content.length : 0 : content.size;
      const response = new Response(message.content[i], {
        headers: {
          "Content-Type": contentType || "",
          "Content-length": len.toString()
        }
      });
      totalInserts++;
      filesToUpdate.push({ request, response, pathWithVersion, onlyDelete: !content });
    }
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(filesToUpdate.map((item) => updateCache(cache, item.pathWithVersion, item.request, item.response, item.onlyDelete)));
    await cacheIndex.addPaths(message.path, message.version);
    return filesToUpdate.map((item) => item.pathWithVersion).join(",");
  };
  var clearAll = async (message) => {
    const cache = await caches.open(CACHE_NAME);
    await cache.keys().then((keys) => Promise.all(keys.map((key) => cache.delete(key))));
    cacheIndex.clear();
  };
  var clearObsolete = async () => {
    const allKeys = await cacheIndex.getAllFilesRefInCache(null);
    const urls = allKeys.map((item) => cacheIndex.getCacheUrl(item));
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    function goodToDelete(url) {
      const uri = new URL(url);
      if (urls.includes(uri.pathname + uri.search)) return false;
      if (uri.pathname.endsWith(".js")) {
        const tsName = uri.pathname.replace(".js", ".ts");
        const keyIDB = allKeys.find((item) => item.key === tsName);
        const isOriginalVersion = `?v=${keyIDB?.value}` === uri.search;
        if (keyIDB && isOriginalVersion) return false;
      }
      return true;
    }
    const keysToDelete = keys.filter((key) => goodToDelete(key.url));
    if (keysToDelete.length === 0) return;
    await Promise.all(keysToDelete.map((key) => cache.delete(key)));
    if (mls.isTrace) console.log(`[ServiceWorker] clear cache Obsolete finish, records deleted=`, keysToDelete.length);
  };
  var clearProjects = async (message) => {
    let projects = [];
    if (typeof message.path === "string") projects = [message.path];
    else if (Array.isArray(message.path)) projects = message.path;
    else throw new Error("incorrect message in clearProject, path must be string or array");
    for await (const prj of projects) {
      const projectID = Number(prj) || 0;
      await clearProject(projectID);
    }
    if (mls.isTrace) console.log(`[ServiceWorker] clearProjects finish: projects length=`, projects.length);
  };
  var clearProject = async (projectID) => {
    if (projectID < 1) throw new Error("incorrect message in clearProject, path must be a number");
    const indexedDBKeysToDelete = await cacheIndex.getAllFilesRefInCache(projectID);
    const cache = await caches.open(CACHE_NAME);
    const cacheKeysToDelete = (await cache.keys()).filter((key) => {
      const path = new URL(key.url).pathname;
      return path.startsWith(`/local/_${projectID}`);
    });
    console.log(`clearProject: project:${projectID} cache records=${cacheKeysToDelete.length}, indexedDB records=${indexedDBKeysToDelete.length}`);
    await Promise.all([
      ...cacheKeysToDelete.map((key) => cache.delete(key)),
      ...indexedDBKeysToDelete.map((item) => cacheIndex.deleteEntry(item.key))
    ]);
  };
  var findCacheJS = async (project, pathFile) => {
    const testExtension = ".test.js";
    const defsExtension = ".defs.js";
    const jsExtension = ".js";
    const tsExtension = ".ts";
    const isTestFile = pathFile.endsWith(testExtension);
    const isDefsFile = pathFile.endsWith(defsExtension);
    const isJsFile = pathFile.endsWith(jsExtension);
    const isTsFile = pathFile.endsWith(tsExtension);
    let extension = "";
    if (isTestFile) {
      extension = testExtension;
      pathFile = pathFile.slice(0, -testExtension.length);
    } else if (isDefsFile) {
      extension = defsExtension;
      pathFile = pathFile.slice(0, -defsExtension.length);
    } else if (isJsFile) {
      extension = jsExtension;
      pathFile = pathFile.slice(0, -jsExtension.length);
    } else if (isTsFile) {
      extension = tsExtension;
      pathFile = pathFile.slice(0, -tsExtension.length);
    } else {
      extension = ".js";
    }
    const url = await cacheIndex.getUrl(project, pathFile, extension);
    if (url) {
      if (mls.isTrace) console.info(`[ServiceWorker] findCacheJS rc: project=${project}, pathFile=${pathFile}, url=${url}`);
      return url;
    }
    if (mls.isTrace) console.info(`[ServiceWorker] findCacheJS 404 search=_${project}_${pathFile}${extension}`);
    return null;
  };
  var getURL = async (path, version2) => {
    if (!path || !version2) throw new Error("No content or version in getURL");
    const cache = await caches.open(CACHE_NAME);
    const pathWithVersion = getPath(path, version2);
    const matchedResponse = await cache.match(pathWithVersion);
    if (mls.isTrace) console.info(`[ServiceWorker] getURL  pathWithVersion=${pathWithVersion}, response:`, matchedResponse);
    if (!matchedResponse) return null;
    return pathWithVersion;
  };
  var getSTS = async (message) => {
    return new Promise((resolve, reject) => {
      get(tbName, MLSWORKERTRACE).then((value) => {
        mls.isTrace = value === "true";
        const result = {
          versionSW: MLSSERVICEWORKERVERSION,
          isTrace: mls.isTrace,
          totalRequests,
          totalHits,
          totalNotFound,
          totalInserts,
          baseProject
        };
        resolve(JSON.stringify(result));
      });
    });
  };
  var getPath = (path, version2) => {
    return `/local/${path}?v=${version2}`;
  };
  var cacheIndex;
  ((cacheIndex2) => {
    const getKey = (project, pathFile, extension) => {
      return `/local/_${project}_${pathFile}${extension}`;
    };
    async function addWithExtension(project, pathFile, extension, version2) {
      const key = getKey(project, pathFile, extension);
      addKey(key, version2);
    }
    cacheIndex2.addWithExtension = addWithExtension;
    async function addPath(path, version2) {
      addKey(`/local/${path}`, version2);
    }
    cacheIndex2.addPath = addPath;
    cacheIndex2.addPaths = async (paths, versions) => {
      if (paths.length !== versions.length) throw new Error("addKeys, key and version must have the same length");
      const keys = paths.map((path, i) => `/local/${path}`);
      setMultiple(tbName, keys, versions).catch((reason) => {
        if (mls.isTrace) console.error(reason);
      });
    };
    const addKey = (key, version2) => {
      set(tbName, key, version2).catch((reason) => {
        if (mls.isTrace) console.error(reason);
      });
    };
    async function deleteEntry(key) {
      return set(tbName, key, "");
    }
    cacheIndex2.deleteEntry = deleteEntry;
    async function getVersionFromPath(path) {
      return get(tbName, `/local/${path}`);
    }
    cacheIndex2.getVersionFromPath = getVersionFromPath;
    async function getAllFilesRefInCache2(project) {
      return getAllFilesRefInCache(project);
    }
    cacheIndex2.getAllFilesRefInCache = getAllFilesRefInCache2;
    async function getUrl(project, pathFile, extension) {
      const key = getKey(project, pathFile, extension);
      const version2 = await get(tbName, key);
      if (mls.isTrace && !version2) console.log(`[ServiceWorker] getUrl, project=${project}, pathFile=${pathFile}, extension=${extension}, key=${key}, version=${version2}`);
      if (!version2) return void 0;
      return `${key}?v=${version2}`;
    }
    cacheIndex2.getUrl = getUrl;
    function getCacheUrl(record) {
      return `${record.key}?v=${record.value}`;
    }
    cacheIndex2.getCacheUrl = getCacheUrl;
    function clear2() {
      clear(tbName);
    }
    cacheIndex2.clear = clear2;
  })(cacheIndex || (cacheIndex = {}));
  var MLSWORKERTRACE = "mlsServiceWorkerTrace";
  get(tbName, MLSWORKERTRACE).then((value) => {
    mls.isTrace = mls.isTrace || value === "true";
  });
})();
//# sourceMappingURL=mlsServiceWorker.js.map
