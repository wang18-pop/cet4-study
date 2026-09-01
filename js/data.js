/* =========================================================
 * data.js —— 静态数据加载
 * 所有题库/词表/讲义都是 data/ 目录下的 JSON 文件，
 * 通过 fetch 加载并缓存，避免重复请求。
 * ========================================================= */
(function () {
  "use strict";

  const cache = {};
  let mediaLocal = null;
  let mediaLocalLoaded = false;

  async function fetchJSON(url) {
    if (cache[url]) return cache[url];
    const resp = await fetch(url, { cache: "no-cache" });
    if (!resp.ok) throw new Error("加载失败: " + url + " (" + resp.status + ")");
    const data = await resp.json();
    cache[url] = data;
    return data;
  }

  /* 若本地存在 media-local.json（由 tools/download-media.ps1 生成），
     则真题媒体改用本地路径，实现完全离线自托管。 */
  async function getMediaLocalMap() {
    if (mediaLocalLoaded) return mediaLocal;
    mediaLocalLoaded = true;
    try {
      const resp = await fetch("data/media-local.json", { cache: "no-cache" });
      if (resp.ok) mediaLocal = await resp.json();
    } catch (e) {
      mediaLocal = null;
    }
    return mediaLocal;
  }

  function resolveMedia(cdnUrl) {
    return async (url) => {
      const local = await getMediaLocalMap();
      if (local && local.files && local.files[url]) return local.files[url];
      return url;
    };
  }

  const resolve = resolveMedia();

  const Data = {
    async papers() {
      const d = await fetchJSON("data/papers.json");
      return d.papers || [];
    },
    async paper(id) {
      const list = await this.papers();
      return list.find((p) => p.id === id) || null;
    },
    async answers(paperId) {
      try {
        return await fetchJSON("data/answers/" + paperId + ".json");
      } catch (e) {
        return null;
      }
    },
    async practice(id) {
      try {
        return await fetchJSON("data/practice/" + id + ".json");
      } catch (e) {
        return null;
      }
    },
    async vocabulary() {
      return fetchJSON("data/vocabulary.json");
    },
    async vocabTest() {
      return fetchJSON("data/vocab-test.json");
    },
    async dict() {
      return fetchJSON("data/dict.json");
    },
    async grammar() {
      return fetchJSON("data/grammar.json");
    },
    async writingTemplates() {
      return fetchJSON("data/writing-templates.json");
    },
    /* 返回解析后的媒体 URL（本地优先，否则 CDN） */
    async media(url) {
      return resolve(url);
    }
  };

  window.Cet4Data = Data;
})();
