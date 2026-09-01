/* =========================================================
 * app.js —— 应用入口与哈希路由
 * 路由表：
 *   #/                       首页
 *   #/practice               刷题区（真题 + 原创题入口）
 *   #/paper/:id              真题详情（PDF + 答题卡）
 *   #/practice/original      原创题库列表
 *   #/quiz/:bankId           答题页
 *   #/listening              听力区
 *   #/listening/:paperId     真题听力播放器
 *   #/vocab                  词汇区
 *   #/writing                写作区
 *   #/translation            翻译区
 *   #/grammar                语法区（含小节）
 *   #/mistakes               错题本
 *   #/stats                  学习统计
 *   #/me                     我的
 *   #/settings               设置
 * ========================================================= */
(function () {
  "use strict";

  const Views = window.Cet4Views;

  const ROUTES = [
    { pattern: /^\/$/, render: () => Views.home() },
    { pattern: /^\/practice$/, render: () => Views.practice() },
    { pattern: /^\/paper\/([^/]+)$/, render: (m) => Views.paper(m[1]) },
    { pattern: /^\/practice\/original$/, render: () => Views.originalHub() },
    { pattern: /^\/quiz\/([^/]+)$/, render: (m) => Views.quiz(m[1]) },
    { pattern: /^\/listening$/, render: () => Views.listening() },
    { pattern: /^\/listening\/([^/]+)$/, render: (m) => Views.listeningPlayer(m[1]) },
    { pattern: /^\/vocab$/, render: () => Views.vocab() },
    { pattern: /^\/vocab-test$/, render: () => Views.vocabTest() },
    { pattern: /^\/writing$/, render: () => Views.writing() },
    { pattern: /^\/translation$/, render: () => Views.translation() },
    { pattern: /^\/grammar$/, render: () => Views.grammar() },
    { pattern: /^\/grammar\/([^/]+)$/, render: (m) => Views.grammarLesson(m[1]) },
    { pattern: /^\/mistakes$/, render: () => Views.mistakes() },
    { pattern: /^\/stats$/, render: () => Views.stats() },
    { pattern: /^\/me$/, render: () => Views.me() },
    { pattern: /^\/settings$/, render: () => Views.settings() }
  ];

  const NAV_MAP = {
    home: ["home"],
    practice: ["practice", "paper", "quiz"],
    listening: ["listening"],
    vocab: ["vocab", "vocab-test"],
    me: ["me", "mistakes", "stats", "settings", "writing", "translation", "grammar"]
  };

  async function route() {
    const hash = location.hash || "#/";
    const path = hash.replace(/^#/, "");
    const appEl = document.getElementById("app");

    let handler = null;
    let match = null;
    for (const r of ROUTES) {
      const m = path.match(r.pattern);
      if (m) { handler = r; match = m; break; }
    }

    // 应用主题
    const settings = Cet4Storage.Settings.get();
    document.body.setAttribute("data-theme", settings.theme === "dark" ? "dark" : "light");

    // 高亮底部导航
    const top = path.split("/")[1] || "home";
    document.querySelectorAll(".nav-item").forEach((el) => {
      const nav = el.getAttribute("data-nav");
      const active = NAV_MAP[nav] ? NAV_MAP[nav].includes(top) || NAV_MAP[nav].includes(path.split("/")[1]) : false;
      el.classList.toggle("active", active);
    });

    window.scrollTo(0, 0);

    if (!handler) {
      appEl.innerHTML = render404();
      return;
    }

    try {
      appEl.innerHTML = '<div class="empty">加载中…</div>';
      const result = await handler.render(match);
      renderResult(appEl, result);
    } catch (err) {
      console.error("路由渲染失败:", err);
      appEl.innerHTML = renderError(err);
    }
  }

  /* 视图可以返回字符串，也可以返回 { html, bind } 对象 */
  function renderResult(appEl, result) {
    if (result && typeof result === "object" && typeof result.html === "string") {
      appEl.innerHTML = result.html;
      if (typeof result.bind === "function") {
        try {
          result.bind(appEl);
        } catch (err) {
          console.error("视图事件绑定失败:", err);
        }
      }
      return;
    }
    if (typeof result === "string") {
      appEl.innerHTML = result;
      return;
    }
    if (result && typeof result.then === "function") {
      result
        .then((v) => renderResult(appEl, v))
        .catch((err) => {
          appEl.innerHTML = renderError(err);
        });
      return;
    }
    appEl.innerHTML = renderError(new Error("视图返回了无法识别的结果"));
  }

  function render404() {
    return '<div class="empty"><p style="font-size:40px">404</p><p>页面不存在</p>' +
      '<p style="margin-top:14px"><a class="btn" href="#/">回到首页</a></p></div>';
  }

  function renderError(err) {
    return '<div class="empty"><p style="font-size:40px">⚠️</p><p>页面加载出错</p>' +
      '<p style="font-size:13px;color:var(--muted);margin-top:6px">' + esc(String(err && err.message || err)) + "</p>" +
      '<p style="margin-top:14px"><a class="btn" href="#/">回到首页</a></p></div>';
  }

  /* 通用 HTML 转义，防止数据中的特殊字符破坏页面 */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* 轻提示 */
  function toast(msg) {
    const old = document.querySelector(".toast");
    if (old) old.remove();
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function fmtDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function daysUntil(iso) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(iso + "T00:00:00");
    return Math.round((target - now) / 86400000);
  }

  /* 全局工具挂到 window，供各视图使用 */
  window.Cet4Utils = {
    esc,
    toast,
    fmtDate,
    daysUntil,
    todayStr: Cet4Storage.todayStr
  };

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", route);
})();
