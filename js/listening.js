/* =========================================================
 * listening.js —— 听力播放器与浏览器朗读
 * 播放器功能：播放/暂停、进度条、倍速 0.5–1.25、A-B 区间循环
 * 浏览器朗读：用 Web Speech API 朗读原创听力原文（无需音频文件）
 * ========================================================= */
(function () {
  "use strict";

  const esc = (s) => Cet4Utils.esc(s);

  /* ---------- 真题听力播放器 ---------- */
  function playerHTML(title, audioUrl) {
    return (
      '<div class="player" id="real-player">' +
      '<div class="player-top">' +
      '<button type="button" class="play-btn" id="p-play" aria-label="播放/暂停">▶</button>' +
      '<div class="player-meta">' +
      '<div class="name">' + esc(title) + "</div>" +
      '<div class="time"><span id="p-cur">00:00</span> / <span id="p-dur">--:--</span></div>' +
      "</div></div>" +
      '<input type="range" class="seek" id="p-seek" min="0" max="1000" value="0" aria-label="播放进度">' +
      '<div class="player-controls">' +
      [0.5, 0.75, 1, 1.25].map((sp) =>
        '<button type="button" class="speed-btn p-speed' + (sp === 1 ? " active" : "") + '" data-speed="' + sp + '">' + sp + "x</button>"
      ).join("") +
      '<button type="button" class="speed-btn loop-btn" id="p-loop">循环：关</button>' +
      "</div>" +
      '<div class="loop-hint" id="p-loop-hint">A-B 循环：播放到 A 点点“设A”，到 B 点点“设B”</div>' +
      '<div class="player-controls" style="margin-top:6px">' +
      '<button type="button" class="speed-btn" id="p-a">设 A 点</button>' +
      '<button type="button" class="speed-btn" id="p-b">设 B 点</button>' +
      '<button type="button" class="speed-btn" id="p-clear">清除</button>' +
      "</div>" +
      '<div class="loop-hint" id="p-loop-state" style="margin-top:4px"></div>' +
      '<audio id="p-audio" preload="metadata" style="display:none"></audio>' +
      "</div>"
    );
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return "--:--";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function initPlayer(rootEl, audioUrl) {
    const audio = rootEl.querySelector("#p-audio");
    const playBtn = rootEl.querySelector("#p-play");
    const seek = rootEl.querySelector("#p-seek");
    const cur = rootEl.querySelector("#p-cur");
    const dur = rootEl.querySelector("#p-dur");
    const loopBtn = rootEl.querySelector("#p-loop");
    const loopState = rootEl.querySelector("#p-loop-state");
    const loopA = rootEl.querySelector("#p-a");
    const loopB = rootEl.querySelector("#p-b");
    const loopClear = rootEl.querySelector("#p-clear");

    if (!audio) return;
    audio.src = audioUrl;
    audio.addEventListener("error", () => {
      playBtn.textContent = "!";
      loopState.textContent = "音频加载失败，请检查网络，或点击下方“打开音频源”在浏览器中播放。";
    });

    audio.addEventListener("loadedmetadata", () => {
      dur.textContent = fmtTime(audio.duration);
    });

    audio.addEventListener("timeupdate", () => {
      if (audio.duration) {
        seek.value = String((audio.currentTime / audio.duration) * 1000);
      }
      cur.textContent = fmtTime(audio.currentTime);
      // A-B 循环判断
      if (audio.dataset.loopA !== undefined && audio.dataset.loopB !== undefined) {
        const a = parseFloat(audio.dataset.loopA);
        const b = parseFloat(audio.dataset.loopB);
        if (audio.currentTime >= b) audio.currentTime = a;
      }
    });

    playBtn.addEventListener("click", async () => {
      try {
        if (audio.paused) {
          await audio.play();
          playBtn.textContent = "❚❚";
        } else {
          audio.pause();
          playBtn.textContent = "▶";
        }
      } catch (e) {
        loopState.textContent = "播放失败：" + e.message;
      }
    });

    seek.addEventListener("input", () => {
      if (audio.duration) {
        audio.currentTime = (parseFloat(seek.value) / 1000) * audio.duration;
      }
    });

    rootEl.querySelectorAll(".p-speed").forEach((btn) => {
      btn.addEventListener("click", () => {
        audio.playbackRate = parseFloat(btn.getAttribute("data-speed"));
        rootEl.querySelectorAll(".p-speed").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    const renderLoop = () => {
      const a = audio.dataset.loopA;
      const b = audio.dataset.loopB;
      if (a !== undefined && b !== undefined) {
        loopBtn.classList.add("active");
        loopBtn.textContent = "循环：开";
        loopState.textContent = "循环区间 " + fmtTime(parseFloat(a)) + " – " + fmtTime(parseFloat(b));
      } else {
        loopBtn.classList.remove("active");
        loopBtn.textContent = "循环：关";
        loopState.textContent = "";
      }
    };

    loopA.addEventListener("click", () => {
      audio.dataset.loopA = String(audio.currentTime);
      renderLoop();
    });
    loopB.addEventListener("click", () => {
      if (audio.dataset.loopA !== undefined) {
        audio.dataset.loopB = String(audio.currentTime);
      } else {
        Cet4Utils.toast("请先设置 A 点");
      }
      renderLoop();
    });
    loopClear.addEventListener("click", () => {
      delete audio.dataset.loopA;
      delete audio.dataset.loopB;
      renderLoop();
    });
    loopBtn.addEventListener("click", () => {
      delete audio.dataset.loopA;
      delete audio.dataset.loopB;
      renderLoop();
    });
  }

  /* ---------- 浏览器朗读（原创听力原文） ---------- */
  /* 挑选美式自然发音：优先 en-US 自然语音，再退回任意美式/英语语音 */
  function pickEnglishVoice(voices) {
    const list = voices || [];
    const natural = /(natural|neural|aria|jenny|guy|michelle|ana|christopher|eric|steffan|sonia|online)/i;
    const isUs = (v) => /^en[-_]US/i.test(v.lang);
    const isEn = (v) => /^en/i.test(v.lang);
    return (
      list.find((v) => isUs(v) && natural.test(v.name)) ||
      list.find((v) => isUs(v)) ||
      list.find((v) => isEn(v) && natural.test(v.name)) ||
      list.find((v) => isEn(v)) ||
      null
    );
  }

  function initTTS(rootEl) {
    if (!("speechSynthesis" in window)) {
      rootEl.querySelectorAll(".tts-play").forEach((b) => {
        b.textContent = "—";
        b.title = "当前浏览器不支持朗读";
      });
      return;
    }

    // 预加载语音列表（部分手机浏览器需要 voiceschanged 后才返回可用语音）
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    let rate = 1;
    let currentScript = "";
    let speaking = false;

    rootEl.querySelectorAll(".tts-speed").forEach((btn) => {
      btn.addEventListener("click", () => {
        rate = parseFloat(btn.getAttribute("data-speed"));
        rootEl.querySelectorAll(".tts-speed").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (speaking && window.speechSynthesis) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      });
    });

    rootEl.querySelectorAll(".tts-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const script = btn.closest(".card").querySelector(".tts-script");
        if (!script) return;
        const hidden = script.hasAttribute("hidden");
        script.toggleAttribute("hidden");
        btn.textContent = hidden ? "隐藏原文" : "显示原文";
      });
    });

    rootEl.querySelectorAll(".tts-play").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".card");
        const script = card.querySelector(".tts-script .passage");
        if (!script) return;
        const text = script.textContent;
        if (!text.trim()) return;

        if (speaking) {
          window.speechSynthesis.cancel();
          speaking = false;
          btn.textContent = "▶";
          return;
        }

        // 优先选美式自然发音
        const voices = window.speechSynthesis.getVoices();
        const enVoice = pickEnglishVoice(voices);

        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        u.rate = rate;
        if (enVoice) u.voice = enVoice;
        u.onend = () => { speaking = false; btn.textContent = "▶"; };
        u.onerror = () => { speaking = false; btn.textContent = "▶"; };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        speaking = true;
        btn.textContent = "■";
        currentScript = text;
      });
    });
  }

  window.Cet4Listening = { playerHTML, initPlayer, initTTS, pickEnglishVoice };
})();
