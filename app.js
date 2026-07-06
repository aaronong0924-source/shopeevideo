const fieldIds = [
  "product",
  "industry",
  "audience",
  "language",
  "personaPreset",
  "persona",
  "characterMode",
  "voiceMode",
  "hook",
  "usp1",
  "usp2",
  "usp3",
  "offer",
  "cta"
];

const defaultLanguage = "马来西亚华语（口语化、自然、Voice-safe、不讲“令吉”，直接讲“块”）";
const storageKey = "tiktok-video-mindmap-tool-v1";

const state = {
  step: 1,
  storyboard: [],
  videoJson: null,
  clips: [],
  voiceClone: null,
  characterReference: null,
  renderObjectUrl: null
};

const stepTitles = {
  1: "脚本资料表",
  2: "图片与口播",
  3: "影片 JSON",
  4: "合成最终影片"
};

function $(id) {
  return document.getElementById(id);
}

function cleanText(value) {
  return String(value || "")
    .replace(/令吉/g, "块")
    .replace(/\bRM\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeClaim(value) {
  return cleanText(value)
    .replace(/100%/g, "稳定")
    .replace(/保证/g, "更有机会")
    .replace(/永久/g, "长期")
    .replace(/治愈/g, "改善")
    .replace(/最便宜/g, "更划算");
}

function moneySafe(value) {
  return cleanText(value).replace(/马币/g, "").replace(/ringgit/gi, "块");
}

function getBrief() {
  const brief = {};
  fieldIds.forEach((id) => {
    brief[id] = cleanText($(id).value);
  });
  brief.characterMode = brief.characterMode || "persona";
  brief.persona = cleanText(brief.persona || brief.personaPreset);
  if (brief.characterMode === "self_upload" && !brief.persona) {
    brief.persona = "上传参考图里的本人，自然亲切地介绍产品";
  }
  if (brief.characterMode === "no_person" && !brief.persona) {
    brief.persona = "自然旁白介绍";
  }
  if (!brief.voiceMode) {
    brief.voiceMode = "ai";
  }
  if (!brief.language) {
    brief.language = defaultLanguage;
  }
  return brief;
}

function setBrief(values) {
  fieldIds.forEach((id) => {
    if (id === "voiceMode") {
      $(id).value = values[id] || "ai";
    } else if (id === "characterMode") {
      $(id).value = values[id] || "persona";
    } else {
      $(id).value = values[id] || (id === "language" ? defaultLanguage : "");
    }
  });
  updateSummary();
  updateCharacterStatus();
  updateVoiceCloneStatus();
  saveDraft();
}

function saveDraft() {
  const draft = {
    brief: getBrief(),
    script: $("scriptOutput").value,
    translatedScript: $("translatedScriptOutput")?.value || "",
    translationTarget: $("translationTarget")?.value || "zh",
    storyJson: $("storyJsonOutput").value,
    videoJsonText: $("videoJsonOutput").value,
    videoSettings: {
      version: "natural-pacing-v1",
      clipCount: getSelectedVideoCount(),
      maxSeconds: $("videoMaxSeconds")?.value || "15"
    },
    characterReference: state.characterReference,
    voiceClone: state.voiceClone
  };
  localStorage.setItem(storageKey, JSON.stringify(draft));
}

function normalizeStoryboardPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.images)) return payload.images;
  if (Array.isArray(payload?.scenes)) return payload.scenes;
  return [];
}

function loadDraft() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    $("language").value = defaultLanguage;
    renderCtaPresetOptions();
    drawCanvasPlaceholder();
    updateSummary();
    updateCharacterStatus();
    return;
  }

  try {
    const draft = JSON.parse(raw);
    state.voiceClone = draft.voiceClone || null;
    state.characterReference = draft.characterReference || null;
    setBrief(draft.brief || {});
    renderCtaPresetOptions();
    $("scriptOutput").value = draft.script || "";
    $("translatedScriptOutput").value = draft.translatedScript || "";
    $("translationTarget").value = draft.translationTarget || "zh";
    $("storyJsonOutput").value = draft.storyJson || "";
    $("videoJsonOutput").value = draft.videoJsonText || "";
    if (draft.videoSettings) {
      const savedCount = draft.videoSettings.version ? (draft.videoSettings.clipCount || "4") : "4";
      $("videoClipCount").value = savedCount;
      $("storyboardVideoCount").value = savedCount;
      $("videoMaxSeconds").value = draft.videoSettings.maxSeconds || "15";
    }
    if (draft.storyJson) {
      state.storyboard = normalizeStoryboardPayload(JSON.parse(draft.storyJson));
      renderStoryboardCards(state.storyboard);
      renderSingleImageJsonCards(JSON.parse(draft.storyJson));
    }
    if (draft.videoJsonText) {
      state.videoJson = JSON.parse(draft.videoJsonText);
      renderVideoPlanPreview(state.videoJson);
    }
  } catch (error) {
    localStorage.removeItem(storageKey);
    $("language").value = defaultLanguage;
    renderCtaPresetOptions();
  }
  drawCanvasPlaceholder();
  updateSummary();
  updateCharacterStatus();
}

function updateSummary() {
  const brief = getBrief();
  $("summaryProduct").textContent = brief.product || "还没有产品名称";
  $("summaryAudience").textContent = brief.audience ? `目标客户：${brief.audience}` : "目标客户会显示在这里";
}

function updateCharacterStatus() {
  const status = $("characterStatus");
  if (!status) return;

  const mode = $("characterMode")?.value || "persona";
  const fileInput = $("characterReference");
  if (fileInput) {
    fileInput.disabled = mode !== "self_upload";
  }

  if (mode === "no_person") {
    status.textContent = "已选择无人出镜：图片和影片 prompt 会要求不要出现人物、脸和可见人手，只展示产品、场景和使用效果。";
    return;
  }

  if (mode === "self_upload") {
    if (!state.characterReference) {
      status.textContent = "请上传一张清楚的人物参考图。JSON 会写入文件名，你生成图片/影片时把同一张图上传做人物参考。";
      return;
    }
    status.textContent = `人物参考图已选择：${state.characterReference.name}。JSON 会要求所有画面保持同一个人设。`;
    return;
  }

  status.textContent = "已使用预设 / 手写人物描述。图片和影片会按这个人设出镜。";
}

function updateVoiceCloneStatus() {
  const status = $("voiceStatus");
  if (!status) return;

  const mode = $("voiceMode")?.value || "ai";
  if (mode === "none") {
    status.textContent = "已选择不要口播：JSON 会要求只生成字幕，不生成旁白声音。";
    return;
  }
  if (mode !== "clone") {
    status.textContent = `普通 AI 口播：JSON 会要求使用符合 Script Language 的自然声音。当前：${$("language")?.value || defaultLanguage}`;
    return;
  }

  if (!state.voiceClone) {
    status.textContent = "声音克隆模式：请上传约 15 秒、清楚、少背景噪音的声音样本。";
    return;
  }

  const seconds = state.voiceClone.duration ? `${state.voiceClone.duration.toFixed(1)}s` : "未知时长";
  status.textContent = state.voiceClone.isRecommendedLength
    ? `声音样本已准备：${state.voiceClone.name}（${seconds}）。每个 video_0x.json 都会引用这个文件。`
    : `声音样本已选择：${state.voiceClone.name}（${seconds}）。建议接近 15 秒，最好在 12-18 秒之间。`;
}

function readMediaDuration(file) {
  return new Promise((resolve) => {
    const media = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
    const url = URL.createObjectURL(file);
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      const duration = Number.isFinite(media.duration) ? media.duration : null;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    media.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    media.src = url;
  });
}

async function handleVoiceSampleChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    state.voiceClone = null;
    updateVoiceCloneStatus();
    saveDraft();
    return;
  }

  const duration = await readMediaDuration(file);
  state.voiceClone = {
    name: file.name,
    type: file.type || "audio",
    size_bytes: file.size,
    duration,
    isRecommendedLength: duration ? duration >= 12 && duration <= 18 : false
  };
  $("voiceMode").value = "clone";
  updateVoiceCloneStatus();
  saveDraft();
  showToast("声音样本已加入 JSON 设置");
}

function handleCharacterReferenceChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    state.characterReference = null;
    updateCharacterStatus();
    saveDraft();
    return;
  }

  state.characterReference = {
    name: file.name,
    type: file.type || "image",
    size_bytes: file.size
  };
  $("characterMode").value = "self_upload";
  updateCharacterStatus();
  saveDraft();
  showToast("人物参考图已加入 JSON 设置");
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function setStep(step) {
  state.step = Number(step);
  document.querySelectorAll(".map-node, .map-root").forEach((node) => {
    node.classList.toggle("active", Number(node.dataset.step) === state.step);
  });
  document.querySelectorAll(".step-panel").forEach((panel) => {
    panel.classList.toggle("active", Number(panel.dataset.panel) === state.step);
  });
  $("stepTitle").textContent = stepTitles[state.step];
  if (state.step === 4) {
    updateRenderSupport();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function inferPain(brief) {
  const text = `${brief.industry} ${brief.audience} ${brief.product}`.toLowerCase();
  if (/猫|宠|砂|pet|cat/.test(text)) {
    return "味道散出来、清理麻烦，家里一进门就很尴尬";
  }
  if (/鸡|农|蛋|养殖|fertilizer|肥|菜|园艺|种植/.test(text)) {
    return "明明每天照顾，效果却不稳定，花了时间又看不到变化";
  }
  if (/排水|清洁|油|厨房|厕所|家居/.test(text)) {
    return "越塞越慢、味道跑出来，还要花时间一直清";
  }
  return "问题每天都在发生，可是普通方法又慢又麻烦";
}

function inferScenePlace(brief) {
  const text = `${brief.industry} ${brief.product}`.toLowerCase();
  if (/猫|宠|砂|pet|cat/.test(text)) return "bright Malaysian apartment with a clean pet corner";
  if (/鸡|农|养殖|蛋/.test(text)) return "small Malaysian poultry farm in natural morning light";
  if (/肥|菜|园艺|种植|fertilizer/.test(text)) return "home vegetable garden in Malaysia with healthy green plants";
  if (/排水|清洁|厨房|厕所/.test(text)) return "real Malaysian home kitchen and bathroom setting";
  return "real Malaysian home and small business setting";
}

const translationProfiles = {
  zh: {
    label: "中文",
    languageInstruction: defaultLanguage,
    product: "你的产品",
    industry: "这个行业",
    audience: "正在烦这个问题的人",
    persona: "老板亲自介绍",
    usp1: "用起来简单，不需要复杂步骤",
    usp2: "日常使用更省时间，效果更稳定",
    usp3: "很多客户试过之后会继续回购",
    offer: "现在下单有特别优惠",
    cta: "点击下面黄色购物车了解更多"
  },
  en: {
    label: "English",
    languageInstruction: "English (natural Malaysian TikTok voiceover, casual, voice-safe, no exaggerated guarantee claims)",
    product: "this product",
    industry: "this category",
    audience: "people facing this problem",
    persona: "the owner",
    usp1: "it is easy to use without complicated steps",
    usp2: "it saves time for daily use and gives a more stable result",
    usp3: "many customers try it and come back again",
    offer: "there is a special offer today",
    cta: "tap the yellow cart below to learn more"
  },
  ms: {
    label: "Bahasa Melayu",
    languageInstruction: "Bahasa Melayu Malaysia (Malaysian Malay, local casual TikTok Shop voiceover, not Indonesian, not Bahasa Indonesia, voice-safe, no exaggerated guarantee claims)",
    product: "produk ini",
    industry: "kategori ini",
    audience: "orang yang sedang hadapi masalah ini",
    persona: "owner",
    usp1: "senang digunakan tanpa langkah yang rumit",
    usp2: "lebih jimat masa untuk kegunaan harian dan hasil lebih stabil",
    usp3: "ramai pelanggan cuba dan beli lagi",
    offer: "hari ini ada tawaran khas",
    cta: "tekan troli kuning di bawah untuk tengok lagi"
  }
};

const ctaPresetOptions = {
  zh: [
    "点击下面黄色购物车了解更多",
    "现在点击购物车直接下单",
    "先加入购物车，想试的时候就能下单",
    "数量有限，卖完就要等下一批",
    "现在下单，把优惠一起带回家",
    "点击购物车看看今天还有没有优惠"
  ],
  en: [
    "Tap the yellow cart below to learn more",
    "Tap the cart now and place your order",
    "Add it to cart first and try it when you are ready",
    "Limited stock available, restock may take time",
    "Order now and grab today's offer",
    "Tap the cart to check today's deal"
  ],
  ms: [
    "Tekan troli kuning di bawah untuk tengok lagi",
    "Tekan troli sekarang dan terus order",
    "Masukkan dalam troli dulu, nanti senang nak cuba",
    "Stok terhad, habis kena tunggu batch seterusnya",
    "Order sekarang dan ambil tawaran hari ini",
    "Tekan troli untuk semak promosi hari ini"
  ]
};

function renderCtaPresetOptions() {
  const select = $("ctaPreset");
  if (!select) return;
  const languageCode = getLanguageCode($("language")?.value || defaultLanguage);
  const options = ctaPresetOptions[languageCode] || ctaPresetOptions.zh;
  select.innerHTML = [
    '<option value="">选择一个 CTA，或自己手写</option>',
    ...options.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
  ].join("");
}

function inferPainForLanguage(brief, target) {
  const text = `${brief.industry} ${brief.audience} ${brief.product}`.toLowerCase();
  if (/猫|宠物|猫砂|pet|cat/.test(text)) {
    if (target === "en") return "the smell spreads around the room and cleaning becomes troublesome";
    if (target === "ms") return "bau cepat merebak satu bilik dan nak bersihkan pun leceh";
    return "味道散出来、清理麻烦，家里一进门就很尴尬";
  }
  if (/鸡|农|蛋|养殖|fertilizer|肥|菜|园艺|种植/.test(text)) {
    if (target === "en") return "you spend time taking care of it every day, but the result is still not stable";
    if (target === "ms") return "hari-hari sudah jaga, tapi hasil masih tak stabil";
    return "明明每天照顾，效果却不稳定，花了时间又看不到变化";
  }
  if (/排水|清洁|油|厨房|厕所|home|clean/.test(text)) {
    if (target === "en") return "the water drains slower, the smell comes back, and you keep cleaning again and again";
    if (target === "ms") return "air makin lambat turun, bau datang balik, lepas tu kena bersihkan berkali-kali";
    return "越塞越慢、味道跑出来，还要花时间一直清";
  }
  if (target === "en") return "the problem keeps happening, but the usual method is slow and troublesome";
  if (target === "ms") return "masalah ini selalu jadi, tapi cara biasa lambat dan leceh";
  return "问题每天都在发生，可是普通方法又慢又麻烦";
}

function valueForTranslation(brief, target, key) {
  const value = moneySafe(brief[key] || "");
  if (target !== "zh" && key !== "product" && /[\u4e00-\u9fff]/.test(value)) {
    return translationProfiles[target][key] || "";
  }
  return value || translationProfiles[target][key] || "";
}

function getLanguageCode(value) {
  const text = String(value || "").toLowerCase();
  if (/english|\ben\b/.test(text)) return "en";
  if (/bahasa|melayu|\bmalay\b|\bms\b/.test(text)) return "ms";
  return "zh";
}

function hasChineseText(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function localizedValue(brief, target, key) {
  return safeClaim(valueForTranslation(brief, target, key));
}

function getStoryboardLanguageCopy(target, values) {
  const product = values.product;
  const audience = values.audience;
  const persona = values.persona;
  const usp1 = values.usp1;
  const usp3 = values.usp3;
  const cta = values.cta;

  if (target === "en") {
    return {
      overlayLanguage: "English",
      titles: ["Pain Point Opening", "Product Reveal", "Benefit Demo", "Trust Proof", "Offer CTA"],
      usageStages: [
        "Use in video_01 opening: show the pain point / problem moment.",
        "Use in product reveal stage: introduce the product clearly.",
        "Use in benefit demo stage: show the main USP or usage process.",
        "Use in trust stage: show proof, testimonial feeling, or credibility.",
        "Use in final CTA stage: show offer/product ending frame."
      ],
      fallbacks: ["Do you have this problem?", "Product solution", "Main benefit", "People come back for it", "Tap the yellow cart"],
      directions: [
        `${persona} shows the moment ${audience} faces the problem in a realistic everyday scene.`,
        `${persona} naturally presents ${product}; the product must appear clean and clear in frame.`,
        `${persona} demonstrates ${usp1} with a before-and-after or simple use process.`,
        `${persona} shows a realistic testimonial, professional feeling, or everyday user feedback.`,
        `${persona} presents ${product}, offer, and clear shopping-cart CTA in the same frame.`
      ],
      noPersonDirections: [
        `No person on screen. Use product, environment, and problem details to show the pain point for ${audience}.`,
        `No person on screen. Show ${product} clearly in a real usage setting as the solution.`,
        `No person on screen. Show before-and-after details and practical use traces for ${product}, highlighting ${usp1}.`,
        "No person on screen. Use product arrangement, realistic setting, clean details, and feedback feeling to build trust.",
        `No person on screen. Present ${product}, offer information, and the shopping-cart CTA area in one clean final frame.`
      ],
      task: "Generate separate images based on the selected video count. Do not combine the scenes into one image.",
      outputRules: [
        "Output separate image files named image_01, image_02, and so on based on the selected count.",
        "Each image_prompt generates only one matching image.",
        "Do not create collage, grid, storyboard sheet, contact sheet, split-screen, or multi-panel output.",
        "Each image must be 9:16 for the next video step."
      ]
    };
  }

  if (target === "ms") {
    return {
      overlayLanguage: "Bahasa Melayu",
      titles: ["Buka Masalah", "Produk Muncul", "Demo Kelebihan", "Bukti Kepercayaan", "Tawaran CTA"],
      usageStages: [
        "Guna dalam video_01 pembukaan: tunjuk masalah / pain point.",
        "Guna dalam tahap produk muncul: perkenalkan produk dengan jelas.",
        "Guna dalam tahap demo kelebihan: tunjuk USP utama atau cara guna.",
        "Guna dalam tahap kepercayaan: tunjuk rasa testimoni atau kredibiliti.",
        "Guna dalam tahap CTA akhir: tunjuk offer dan ending frame produk."
      ],
      fallbacks: ["Masalah ini pernah jadi?", "Solusi produk", "Kelebihan utama", "Pelanggan beli lagi", "Tekan troli kuning"],
      directions: [
        `${persona} tunjuk situasi ${audience} sedang hadapi masalah dalam scene harian yang nampak real.`,
        `${persona} perkenalkan ${product} secara natural; produk mesti nampak jelas dan bersih dalam frame.`,
        `${persona} demo ${usp1} dengan perbandingan sebelum-selepas atau proses guna yang mudah.`,
        `${persona} tunjuk rasa testimoni, profesional, atau feedback pengguna harian yang real.`,
        `${persona} letak ${product}, tawaran, dan CTA troli beli dalam frame akhir yang jelas.`
      ],
      noPersonDirections: [
        `Tiada orang dalam frame. Guna produk, suasana, dan detail masalah untuk tunjuk pain point ${audience}.`,
        `Tiada orang dalam frame. Tunjuk ${product} dengan jelas dalam situasi penggunaan sebenar.`,
        `Tiada orang dalam frame. Tunjuk detail sebelum-selepas dan kesan penggunaan ${product}, fokus pada ${usp1}.`,
        "Tiada orang dalam frame. Guna susunan produk, suasana real, detail bersih, dan rasa feedback untuk bina kepercayaan.",
        `Tiada orang dalam frame. Susun ${product}, info tawaran, dan kawasan CTA troli beli dalam satu frame akhir.`
      ],
      task: "Jana imej berasingan ikut jumlah video yang dipilih. Jangan gabungkan scene dalam satu imej.",
      outputRules: [
        "Output fail imej berasingan bernama image_01, image_02, dan seterusnya ikut jumlah yang dipilih.",
        "Setiap image_prompt hanya jana satu imej yang sepadan.",
        "Jangan jana collage, grid, storyboard sheet, contact sheet, split-screen, atau multi-panel.",
        "Setiap imej mesti 9:16 untuk langkah video seterusnya."
      ]
    };
  }

  return {
    overlayLanguage: "Chinese",
    titles: ["痛点开场", "产品出现", "卖点示范", "信任证明", "优惠 CTA"],
    usageStages: [
      "用于 video_01 开场阶段：表现痛点 / 问题发生的一刻。",
      "用于产品出现阶段：清楚介绍产品。",
      "用于卖点示范阶段：展示主要 USP 或使用过程。",
      "用于信任证明阶段：展示见证感、专业感或可信度。",
      "用于最终 CTA 阶段：展示优惠、产品和结尾画面。"
    ],
    fallbacks: ["这个问题你也有吗？", "产品解决方案", "卖点示范", "用过的人会回购", "点击黄色购物车"],
    directions: [
      `由${persona}表现${audience}遇到问题的一刻，画面要真实、有生活感。`,
      `${persona}自然拿起或展示 ${product}，产品要干净清楚地出现在画面中。`,
      `${persona}用前后对比或操作过程表现 ${usp1}。`,
      `${persona}表现用户见证、专业感或真实使用反馈。`,
      `${persona}把产品、优惠和行动呼吁同框呈现，适合作为最后一张图。`
    ],
    noPersonDirections: [
      `无人出镜，只用产品、环境和问题细节表现${audience}遇到的痛点，画面真实、有生活感。`,
      `无人出镜，${product}在真实使用场景中清楚出现，用构图和光线带出解决方案。`,
      `无人出镜，只展示${product}的前后对比、使用过程痕迹和效果细节，突出 ${usp1}。`,
      "无人出镜，用产品陈列、真实场景、使用反馈氛围和干净细节表现信任感。",
      `无人出镜，把${product}、优惠信息和购物车指向区域同框呈现，适合作为最后一张图。`
    ],
    task: "按选择的影片数量生成独立图片，不要把多个画面集合在一张图。",
    outputRules: [
      "请按选择数量输出独立图片文件：image_01、image_02，以此类推。",
      "每个 image_prompt 只生成对应的一张图。",
      "不要生成拼贴图、九宫格、分镜表、contact sheet、split-screen 或 multi-panel。",
      "每张图都是 9:16，方便下一步各自生成一个短片。"
    ]
  };
}

function getStoryboardStage(copy, index, total) {
  const mergeMaps = {
    2: [[0, 1, 2], [3, 4]],
    3: [[0, 1], [2], [3, 4]],
    4: [[0], [1], [2], [3, 4]],
    5: [[0], [1], [2], [3], [4]]
  };
  const indexes = (mergeMaps[total] || mergeMaps[4])[index] || [Math.min(index, 4)];
  const title = indexes.map((item) => copy.titles[item]).filter(Boolean).join(" + ");
  const usageStage = indexes.map((item) => copy.usageStages[item]).filter(Boolean).join(" / ");
  const fallback = copy.fallbacks[indexes[indexes.length - 1]] || copy.fallbacks[index] || "";
  const direction = indexes.map((item) => copy.directions[item]).filter(Boolean).join(" Then ");
  const noPersonDirection = indexes.map((item) => copy.noPersonDirections[item]).filter(Boolean).join(" Then ");
  return { indexes, title, usageStage, fallback, direction, noPersonDirection };
}

function buildImageOutputRules(target, count) {
  const first = `image_01`;
  const last = `image_${String(count).padStart(2, "0")}`;
  if (target === "en") {
    return [
      `Output exactly ${count} separate image files: ${first} to ${last}.`,
      "Each image_prompt generates only one matching image.",
      "Each image must match its script_match_text.",
      "Do not create collage, grid, storyboard sheet, contact sheet, split-screen, or multi-panel output.",
      "Each image must be 9:16 for Seedance 2.0 image-to-video generation."
    ];
  }
  if (target === "ms") {
    return [
      `Output tepat ${count} fail imej berasingan: ${first} hingga ${last}.`,
      "Setiap image_prompt hanya jana satu imej yang sepadan.",
      "Setiap imej mesti ikut script_match_text masing-masing.",
      "Jangan jana collage, grid, storyboard sheet, contact sheet, split-screen, atau multi-panel.",
      "Setiap imej mesti 9:16 untuk Seedance 2.0 image-to-video."
    ];
  }
  return [
    `请输出刚好 ${count} 个独立图片文件：${first} 到 ${last}。`,
    "每个 image_prompt 只生成对应的一张图。",
    "每张图必须对应自己的 script_match_text。",
    "不要生成拼贴图、九宫格、分镜表、contact sheet、split-screen 或 multi-panel。",
    "每张图都是 9:16，方便给 Seedance 2.0 图生视频。"
  ];
}

function detectAngleCategory(brief) {
  const text = `${brief.product} ${brief.industry} ${brief.audience}`.toLowerCase();
  if (/猫|宠物|猫砂|pet|cat/.test(text)) return "pet";
  if (/鸡|农|养殖|蛋|farm|chicken|poultry/.test(text)) return "farm";
  if (/肥|菜|园艺|种植|garden|plant|fertilizer/.test(text)) return "garden";
  if (/排水|清洁|油|厨房|厕所|drain|pipe|clean|kitchen|bathroom/.test(text)) return "cleaning";
  return "general";
}

function buildAngleSuggestions(brief, target) {
  const product = valueForTranslation(brief, target, "product");
  const industry = valueForTranslation(brief, target, "industry");
  const audience = valueForTranslation(brief, target, "audience");
  const category = detectAngleCategory(brief);
  const pain = inferPainForLanguage(brief, target);

  if (target === "en") {
    const templates = {
      cleaning: {
        hook: `Is your drain getting slower and the smell keeps coming back?`,
        usp1: `${product} helps loosen daily grease, grime, and odor buildup with a simple pour-and-wait step`,
        usp2: `Suitable for kitchen, bathroom, and sink drain routines, so cleaning feels less troublesome`,
        usp3: `Made for regular home standby use, especially for ${audience}`
      },
      pet: {
        hook: `Does the smell spread before you even notice it?`,
        usp1: `${product} helps keep the pet area fresher with an easier daily routine`,
        usp2: `Simple for busy ${audience}, without making cleanup feel complicated`,
        usp3: `A practical repeat-use choice for homes that want a cleaner pet corner`
      },
      farm: {
        hook: `Why do others get a steadier result, but yours keeps going up and down?`,
        usp1: `${product} supports a more consistent daily farm routine for ${audience}`,
        usp2: `Easy to apply in normal ${industry} work, saving time during busy days`,
        usp3: `Built for practical long-term use, not one-time hype`
      },
      garden: {
        hook: `Taking care of plants every day, but the result still feels slow?`,
        usp1: `${product} helps support healthier daily plant care without complicated steps`,
        usp2: `Suitable for home gardens and regular growing routines, so it is easier to stay consistent`,
        usp3: `A practical choice for growers who want steady care over time`
      },
      general: {
        hook: `Still using the same old method, but the problem keeps coming back?`,
        usp1: `${product} is made for ${audience}, with a simple daily-use process`,
        usp2: `Fits common ${industry} situations and helps save time`,
        usp3: `A practical choice for repeat use when you want something easier to trust`
      }
    };
    return templates[category];
  }

  if (target === "ms") {
    const templates = {
      cleaning: {
        hook: `Saluran air makin lambat turun, lepas tu bau datang balik?`,
        usp1: `${product} bantu longgarkan kotoran harian, minyak, dan punca bau dengan langkah yang mudah`,
        usp2: `Sesuai untuk rutin sinki dapur, bilik air, dan saluran air, jadi kerja bersih lebih senang`,
        usp3: `Sesuai simpan di rumah untuk kegunaan berkala, terutama untuk ${audience}`
      },
      pet: {
        hook: `Bau cepat merebak sebelum sempat nak bersihkan?`,
        usp1: `${product} bantu kawasan pet rasa lebih segar dengan rutin harian yang mudah`,
        usp2: `Senang untuk ${audience} yang sibuk, tanpa proses bersih yang rumit`,
        usp3: `Pilihan praktikal untuk rumah yang nak sudut pet lebih bersih`
      },
      farm: {
        hook: `Kenapa orang lain punya hasil lebih stabil, tapi kita punya selalu turun naik?`,
        usp1: `${product} bantu rutin harian ${industry} jadi lebih konsisten untuk ${audience}`,
        usp2: `Mudah digunakan dalam kerja harian, jadi lebih jimat masa waktu sibuk`,
        usp3: `Sesuai untuk kegunaan jangka panjang yang praktikal, bukan sekadar nampak menarik sahaja`
      },
      garden: {
        hook: `Hari-hari jaga tanaman, tapi hasil masih lambat nampak?`,
        usp1: `${product} bantu sokong penjagaan tanaman harian tanpa langkah yang rumit`,
        usp2: `Sesuai untuk kebun rumah dan rutin tanaman biasa, jadi lebih senang konsisten`,
        usp3: `Pilihan praktikal untuk penanam yang nak penjagaan lebih stabil dari masa ke masa`
      },
      general: {
        hook: `Masih guna cara lama, tapi masalah yang sama datang balik?`,
        usp1: `${product} dibuat untuk ${audience}, dengan proses harian yang mudah`,
        usp2: `Sesuai untuk situasi ${industry} yang biasa dan bantu jimat masa`,
        usp3: `Pilihan praktikal untuk guna berulang bila nak sesuatu yang lebih mudah dipercayai`
      }
    };
    return templates[category];
  }

  const templates = {
    cleaning: {
      hook: `你家的排水是不是越来越慢，还一直有味道跑出来？`,
      usp1: `${product}帮助处理日常油垢、污渍和异味来源，步骤简单不复杂`,
      usp2: `厨房、厕所、洗手盆等排水位置都适合日常使用，清洁更省时间`,
      usp3: `适合${audience}长期备用，放家里需要时就能用`
    },
    pet: {
      hook: `宠物味道是不是一下子就散到整个空间？`,
      usp1: `${product}让宠物区域日常打理更轻松，味道管理更省心`,
      usp2: `适合忙碌的${audience}，清理流程不需要弄得很复杂`,
      usp3: `适合家里长期回购使用，让宠物角落维持更干净`
    },
    farm: {
      hook: `为什么别人效果比较稳定，你这里却一直忽高忽低？`,
      usp1: `${product}帮助${audience}把日常${industry}流程做得更稳定`,
      usp2: `日常使用简单，忙的时候也比较省时间、省步骤`,
      usp3: `适合长期实际使用，不是只看一次效果的短期方案`
    },
    garden: {
      hook: `每天照顾植物，可是长势还是慢慢的？`,
      usp1: `${product}帮助日常植物护理更简单，步骤不复杂`,
      usp2: `适合家庭菜园和园艺种植日常使用，更容易坚持`,
      usp3: `适合想长期稳定照顾植物的人，不用一直换方法`
    },
    general: {
      hook: `${audience}是不是也遇到这个问题：${pain}？`,
      usp1: `${product}专门给${audience}使用，日常操作简单不复杂`,
      usp2: `适合${industry}常见场景，省时间也更方便`,
      usp3: `适合长期备用和重复使用，让人更容易放心`
    }
  };
  return templates[category];
}

function generateAngles() {
  const brief = getBrief();
  const target = getLanguageCode(brief.language);
  const suggestions = buildAngleSuggestions(brief, target);
  $("hook").value = suggestions.hook;
  $("usp1").value = suggestions.usp1;
  $("usp2").value = suggestions.usp2;
  $("usp3").value = suggestions.usp3;
  $("scriptOutput").value = "";
  $("translatedScriptOutput").value = "";
  clearGeneratedOutputs();
  updateSummary();
  saveDraft();
  showToast("Hook 和 USP 已自动生成，请重新生成脚本");
}

function buildChatGptAnglePrompt() {
  const brief = getBrief();
  const target = getLanguageCode(brief.language);
  const languageRules = {
    zh: "马来西亚华语或中文，口语化、自然、适合 TikTok Shop 口播。不要讲“令吉”，价格直接讲“块”。",
    en: "English, natural Malaysian TikTok Shop voiceover style, casual, clear, and voice-safe.",
    ms: "Bahasa Melayu Malaysia, gaya TikTok Shop tempatan Malaysia. Jangan guna Bahasa Indonesia. Ayat mesti natural, santai, dan voice-safe."
  };
  const currentSuggestions = buildAngleSuggestions(brief, target);

  return [
    "你是 TikTok Shop 爆款短视频脚本策划。",
    "请根据下面产品资料，生成更有吸引力的 Hook 和 USP。",
    "",
    "要求：",
    `1. 语言：${languageRules[target] || languageRules.zh}`,
    "2. Hook 要 3 秒内能讲完，像真人开场，不要太书面。",
    "3. USP 1 是最强卖点，USP 2 是次要卖点，USP 3 是信任卖点。",
    "4. 不要夸大承诺，不要写 100%、保证、永久、治疗、最便宜等高风险词。",
    "5. 每一句要短，适合短视频口播，也方便后面生成图片和视频。",
    "6. 只输出 JSON，不要解释，不要 markdown code block。",
    "",
    "产品资料：",
    JSON.stringify(
      {
        product: brief.product || "未填写",
        industry: brief.industry || "未填写",
        target_audience: brief.audience || "未填写",
        script_language: brief.language || defaultLanguage,
        persona: brief.persona || brief.personaPreset || "未填写",
        offer: brief.offer || "无",
        cta: brief.cta || "无",
        local_template_reference: currentSuggestions
      },
      null,
      2
    ),
    "",
    "请严格按这个格式输出：",
    JSON.stringify(
      {
        hook: "一句 3 秒吸引开场",
        usp1: "最强卖点，一句话",
        usp2: "第二卖点，一句话",
        usp3: "信任卖点，一句话"
      },
      null,
      2
    )
  ].join("\n");
}

function copyChatGptAnglePrompt() {
  const prompt = buildChatGptAnglePrompt();
  const output = $("anglePromptOutput");
  if (output) {
    output.value = prompt;
  }
  copyText(prompt, "ChatGPT Prompt 已复制");
}

function parseAngleJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const withoutFence = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(withoutFence.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

function applyChatGptAngleJson() {
  const parsed = parseAngleJson($("angleJsonInput")?.value || "");
  if (!parsed) {
    showToast("找不到有效 JSON，请检查 ChatGPT 回答");
    return;
  }

  const fields = ["hook", "usp1", "usp2", "usp3"];
  let applied = 0;
  fields.forEach((id) => {
    if (parsed[id]) {
      $(id).value = safeClaim(parsed[id]);
      applied += 1;
    }
  });

  if (!applied) {
    showToast("JSON 里没有 hook / usp1 / usp2 / usp3");
    return;
  }

  $("scriptOutput").value = "";
  $("translatedScriptOutput").value = "";
  clearGeneratedOutputs();
  updateSummary();
  saveDraft();
  showToast("ChatGPT Hook / USP 已套用，请重新生成脚本");
}

function buildScriptForLanguage(target = "zh") {
  const brief = getBrief();
  const profile = translationProfiles[target] || translationProfiles.zh;
  const product = valueForTranslation(brief, target, "product");
  const industry = valueForTranslation(brief, target, "industry");
  const audience = valueForTranslation(brief, target, "audience");
  const persona = valueForTranslation(brief, target, "persona") || valueForTranslation(brief, target, "personaPreset") || profile.persona;
  const usp1 = valueForTranslation(brief, target, "usp1");
  const usp2 = valueForTranslation(brief, target, "usp2");
  const usp3 = valueForTranslation(brief, target, "usp3");
  const offer = valueForTranslation(brief, target, "offer");
  const cta = valueForTranslation(brief, target, "cta");
  const pain = inferPainForLanguage(brief, target);

  if (target === "en") {
    return [
      `0-3s - Hook: Is this happening to you too? ${pain}?`,
      "3-7s - Pain point: A lot of people think a quick fix is enough, but the same problem keeps coming back.",
      `7-14s - Product reveal: That's why ${persona} recommends ${product}, a practical ${industry} solution for ${audience}.`,
      `14-22s - Main benefit: First, ${usp1}. Second, ${usp2}.`,
      `22-29s - Trust: And ${usp3}, so it feels more reliable for daily use.`,
      `29-35s - Offer: ${offer || "If you want to try it, now is a good time."}`,
      `35-40s - CTA: ${cta || "Tap the yellow cart below to learn more."}`
    ].join("\n");
  }

  if (target === "ms") {
    return [
      `0-3s - Hook: Pernah jadi macam ni tak? ${pain}?`,
      "3-7s - Masalah: Ramai orang ingat buat cara biasa sudah cukup, tapi masalah yang sama selalu datang balik.",
      `7-14s - Produk: Sebab itu ${persona} cadangkan ${product}, solusi ${industry} yang praktikal untuk ${audience}.`,
      `14-22s - Kelebihan: Pertama, ${usp1}. Kedua, ${usp2}.`,
      `22-29s - Kepercayaan: Lagi satu, ${usp3}, jadi lebih senang untuk guna hari-hari.`,
      `29-35s - Tawaran: ${offer || "Kalau nak cuba, sekarang masa yang sesuai."}`,
      `35-40s - CTA: ${cta || "Tekan troli kuning di bawah untuk tengok lagi."}`
    ].join("\n");
  }

  const hook = safeClaim(brief.hook || `${audience}，你是不是也遇到这个问题？${pain}？`);
  return [
    `0-3s｜Hook：${hook}`,
    `3-7s｜痛点：很多人以为随便处理就好，结果${pain}。`,
    `7-14s｜产品出现：${persona}推荐你试试看 ${product}，它是专门给${audience}用的${industry}方案。`,
    `14-22s｜主要卖点：第一个重点，${usp1}；第二，${usp2}。`,
    `22-29s｜信任：而且${usp3}，所以不是讲爽而已，是很多人真的会拿来日常用。`,
    `29-35s｜优惠：${offer ? `${offer}，想试的现在比较值得。` : "想试的话，现在下单会比较值得。"}`,
    `35-40s｜CTA：${cta}，先买一份回去试试看。`
  ].join("\n");
}

function buildTranslatedScript() {
  const target = $("translationTarget")?.value || "zh";
  const script = buildScriptForLanguage(target);
  $("translatedScriptOutput").value = script;
  saveDraft();
  showToast(`${translationProfiles[target]?.label || "翻译"}版口播已生成`);
  return script;
}

function applyTranslatedScript() {
  const target = $("translationTarget")?.value || "zh";
  const script = $("translatedScriptOutput").value.trim() || buildTranslatedScript();
  $("scriptOutput").value = script;
  $("language").value = translationProfiles[target]?.languageInstruction || defaultLanguage;
  clearGeneratedOutputs();
  saveDraft();
  updateSummary();
  showToast("翻译版已套用到口播脚本");
}

function clearGeneratedOutputs() {
  state.storyboard = [];
  state.videoJson = null;
  $("storyJsonOutput").value = "";
  $("videoJsonOutput").value = "";
  renderStoryboardCards([]);
  renderSingleImageJsonCards(null);
  renderVideoPlanPreview(null);
}

function buildScript() {
  const selectedLanguage = getLanguageCode($("language")?.value || defaultLanguage);
  if (selectedLanguage !== "zh") {
    const script = buildScriptForLanguage(selectedLanguage);
    $("scriptOutput").value = script;
    $("translationTarget").value = selectedLanguage;
    $("translatedScriptOutput").value = script;
    clearGeneratedOutputs();
    saveDraft();
    updateSummary();
    showToast("脚本已按所选语言生成");
    return script;
  }

  const brief = getBrief();
  const product = safeClaim(brief.product || "你的产品");
  const industry = safeClaim(brief.industry || "这个行业");
  const audience = safeClaim(brief.audience || "正在烦这个问题的人");
  const persona = safeClaim(brief.persona || "老板亲自介绍");
  const usp1 = safeClaim(brief.usp1 || "用起来简单，不需要复杂步骤");
  const usp2 = safeClaim(brief.usp2 || "日常使用更省时间，效果更稳定");
  const usp3 = safeClaim(brief.usp3 || "很多客户试过之后会继续回购");
  const offer = moneySafe(brief.offer || "现在下单有特别优惠");
  const cta = moneySafe(brief.cta || "点击下面黄色购物车了解更多");
  const pain = inferPain(brief);
  const hook = safeClaim(brief.hook || `${audience}，你是不是也遇到这个问题：${pain}？`);

  const lines = [
    {
      time: "0-3s",
      label: "Hook",
      line: hook
    },
    {
      time: "3-7s",
      label: "痛点",
      line: `很多人以为随便处理就好，结果${pain}。`
    },
    {
      time: "7-14s",
      label: "产品出现",
      line: `${persona}推荐你试试看 ${product}，它是专门给${audience}用的${industry}方案。`
    },
    {
      time: "14-22s",
      label: "主要卖点",
      line: `第一个重点，${usp1}；第二，${usp2}。`
    },
    {
      time: "22-29s",
      label: "信任",
      line: `而且${usp3}，所以不是讲爽而已，是很多人真的会拿来日常用。`
    },
    {
      time: "29-35s",
      label: "优惠",
      line: offer ? `${offer}，想试的现在比较值得。` : "想试的话，现在下单会比较值得。"
    },
    {
      time: "35-40s",
      label: "CTA",
      line: `${cta}，先买一份回去试试看。`
    }
  ];

  const script = lines
    .map((item) => `${item.time}｜${item.label}：${moneySafe(item.line)}`)
    .join("\n");

  $("scriptOutput").value = script;
  saveDraft();
  updateSummary();
  showToast("脚本已生成");
  return script;
}

function parseScriptSegments() {
  const raw = $("scriptOutput").value.trim() || buildScript();
  return raw
    .split(/\n+/)
    .map((line, index) => {
      const original = cleanText(line);
      let text = original;
      let time = "";
      let label = "";
      const timeMatch = text.match(/^\s*(\d+\s*-\s*\d+\s*s)\s*(?:[|｜~～\-–—]|至|到)?\s*/i);
      if (timeMatch) {
        time = timeMatch[1].replace(/\s+/g, "");
        text = text.slice(timeMatch[0].length).trim();
      }
      const labelMatch = text.match(/^([A-Za-z\u4e00-\u9fff ]{1,28})\s*[:：]\s*/);
      if (labelMatch) {
        label = labelMatch[1].trim();
        text = text.slice(labelMatch[0].length).trim();
      }
      return {
        script_segment_id: index + 1,
        time,
        label,
        text: moneySafe(text),
        original_line: original
      };
    })
    .filter((segment) => segment.text);
}

function getScriptLines() {
  return parseScriptSegments().map((segment) => segment.text);
}

function buildStoryboardScriptGroups(segments, desiredCount = 4) {
  const count = clampNumber(desiredCount, 2, 5, 4);
  const used = new Set();
  const labelText = (segment) => `${segment.label} ${segment.text} ${segment.original_line}`.toLowerCase();

  const pick = (patterns) => {
    const selected = segments.filter((segment) => {
      if (used.has(segment.script_segment_id)) return false;
      return patterns.some((pattern) => pattern.test(labelText(segment)));
    });
    selected.forEach((segment) => used.add(segment.script_segment_id));
    return selected;
  };

  let semanticGroups = [
    pick([/hook/, /痛点/, /pain/, /masalah/, /buka/]),
    pick([/产品/, /product/, /produk/]),
    pick([/卖点/, /benefit/, /kelebihan/]),
    pick([/信任/, /trust/, /kepercayaan/]),
    pick([/优惠/, /offer/, /tawaran/, /cta/])
  ];

  const leftovers = segments.filter((segment) => !used.has(segment.script_segment_id));
  leftovers.forEach((segment, index) => {
    const targetIndex = semanticGroups.findIndex((group) => !group.length);
    semanticGroups[targetIndex >= 0 ? targetIndex : Math.min(4, index)].push(segment);
  });

  if (semanticGroups.every((group) => !group.length)) {
    semanticGroups = Array.from({ length: 5 }, () => []);
    segments.forEach((segment, index) => {
      semanticGroups[Math.min(4, Math.floor((index / Math.max(1, segments.length)) * 5))].push(segment);
    });
  }

  const mergeMaps = {
    2: [[0, 1, 2], [3, 4]],
    3: [[0, 1], [2], [3, 4]],
    4: [[0], [1], [2], [3, 4]],
    5: [[0], [1], [2], [3], [4]]
  };
  const groups = (mergeMaps[count] || mergeMaps[4]).map((indexes) =>
    indexes.flatMap((index) => semanticGroups[index] || [])
  );

  return groups.map((group, index) => {
    const fallbackSegment = segments[Math.min(index, Math.max(0, segments.length - 1))];
    const finalGroup = group.length ? group : (fallbackSegment ? [fallbackSegment] : []);
    const labels = finalGroup.map((segment) => segment.label).filter(Boolean);
    const times = finalGroup.map((segment) => segment.time).filter(Boolean);
    return {
      group_id: index + 1,
      segment_ids: finalGroup.map((segment) => segment.script_segment_id),
      labels,
      time_range: times.length ? `${times[0]}${times.length > 1 ? ` - ${times[times.length - 1]}` : ""}` : "",
      line: finalGroup.map((segment) => segment.text).filter(Boolean).join(" "),
      original_lines: finalGroup.map((segment) => segment.original_line)
    };
  });
}

function shortOverlay(text, fallback) {
  const cleaned = cleanText(text || fallback);
  if (cleaned.length <= 18) return cleaned;
  return `${cleaned.slice(0, 18)}...`;
}

function buildCharacterConfig(brief) {
  const mode = brief.characterMode || "persona";
  if (mode === "no_person") {
    return {
      mode,
      label: "无人出镜",
      persona: "无人出镜",
      reference: null,
      prompt_note: "Product-only scene. No human, no person, no face, no visible hands, no human body parts.",
      video_note: "Keep this clip product-only: no human, no person, no face, no visible hands."
    };
  }

  if (mode === "self_upload") {
    const reference = state.characterReference || null;
    const referenceName = reference?.name || "uploaded_character_reference_image";
    const persona = safeClaim(brief.persona || "上传参考图里的本人，自然亲切地介绍产品");
    return {
      mode,
      label: "上传自己做人设参考",
      persona,
      reference,
      prompt_note: `Use the uploaded character reference image "${referenceName}" as the same person across all images. Keep face, hairstyle, age, body shape, outfit vibe, and natural expression consistent. Do not turn the person into a different model.`,
      video_note: `Use the same uploaded character reference "${referenceName}" for this video. Keep the person consistent with the image prompt and avoid changing face or identity.`
    };
  }

  const persona = safeClaim(brief.persona || "自然口播人物");
  return {
    mode: "persona",
    label: "预设 / 手写人物",
    persona,
    reference: null,
    prompt_note: `Use this character/persona consistently: ${persona}.`,
    video_note: `Keep the on-screen character consistent with this persona: ${persona}.`
  };
}

function characterVisual(config, personText, noPersonText) {
  return config.mode === "no_person" ? noPersonText : personText;
}

function buildStoryboard() {
  const brief = getBrief();
  const scriptSegments = parseScriptSegments();
  const { requestedCount } = getVideoSettings();
  const desiredImageCount = requestedCount;
  const scriptGroups = buildStoryboardScriptGroups(scriptSegments, desiredImageCount);
  const storyboardLanguage = getLanguageCode(brief.language);
  const product = localizedValue(brief, storyboardLanguage, "product") || "产品";
  const audience = localizedValue(brief, storyboardLanguage, "audience") || "目标客户";
  const characterConfig = buildCharacterConfig(brief);
  const persona = storyboardLanguage !== "zh" && hasChineseText(characterConfig.persona)
    ? localizedValue(brief, storyboardLanguage, "persona") || translationProfiles[storyboardLanguage].persona
    : characterConfig.persona;
  const place = inferScenePlace(brief);
  const scriptLine = (index, fallback) => moneySafe(scriptGroups[index]?.line || fallback);
  const scriptGroup = (index) => scriptGroups[index] || { segment_ids: [], labels: [], time_range: "", line: "", original_lines: [] };
  const scriptMatchRule = (index) => {
    const group = scriptGroup(index);
    return `Exact script segment for this image: "${group.line}". The visual must directly match this script segment and its stage. Do not show another part of the script, do not jump to CTA early, and do not show product reveal before the script calls for it.`;
  };
  const hook = scriptLine(0, `${audience}是不是也遇到这个问题？`);
  const usp1 = localizedValue(brief, storyboardLanguage, "usp1") || "简单有效";
  const usp2 = localizedValue(brief, storyboardLanguage, "usp2") || "省时间更方便";
  const usp3 = localizedValue(brief, storyboardLanguage, "usp3") || "真实使用更安心";
  const cta = valueForTranslation(brief, storyboardLanguage, "cta") || "点击黄色购物车了解更多";
  const languageCopy = getStoryboardLanguageCopy(storyboardLanguage, { product, audience, persona, usp1, usp2, usp3, cta });

  const standaloneImageRule = "Generate ONE standalone vertical 9:16 image for this image_id only. Do not create a collage, grid, storyboard sheet, contact sheet, split-screen, or multi-panel image. Do not include any other scene in this output.";
  const baseNegative = "no fake brand logo, no tiny unreadable text, no exaggerated medical or guaranteed claims, no distorted hands, no extra fingers, no collage, no grid, no storyboard sheet, no split screen, no multi panel";
  const characterPromptNote = characterConfig.mode === "persona"
    ? `Use this character/persona consistently: ${persona}.`
    : characterConfig.prompt_note;

  const scenes = Array.from({ length: desiredImageCount }, (_, index) => {
    const sceneNumber = index + 1;
    const imageId = `image_${String(sceneNumber).padStart(2, "0")}`;
    const stage = getStoryboardStage(languageCopy, index, desiredImageCount);
    const fallbackLine = index === 0 ? hook : index === desiredImageCount - 1 ? cta : `${product} ${stage.fallback || ""}`;
    const matchedScript = scriptLine(index, fallbackLine);
    const visualDirection = characterVisual(characterConfig, stage.direction, stage.noPersonDirection);
    const stagePrompt = index === 0
      ? "opening or problem moment, no unrelated CTA yet"
      : index === desiredImageCount - 1
        ? "ending / offer / CTA moment only because this is the final script segment"
        : "middle selling beat that matches this exact script segment";

    return {
      id: sceneNumber,
      image_id: imageId,
      character: persona,
      title: stage.title || `Scene ${sceneNumber}`,
      duration_sec: Math.max(5, estimateNarrationSeconds(matchedScript, storyboardLanguage)),
      script_segments: scriptGroup(index).segment_ids,
      script_time_range: scriptGroup(index).time_range,
      script_match_text: matchedScript,
      spoken_line: matchedScript,
      text_overlay: shortOverlay(matchedScript, stage.fallback),
      visual_direction: visualDirection,
      image_prompt: `${standaloneImageRule} ${scriptMatchRule(index)} ${characterPromptNote} Vertical 9:16 Seedance 2.0 image-to-video keyframe, ${place}, ${stagePrompt}, ${visualDirection}, ${product} visible when relevant, realistic Malaysian TikTok Shop commercial style, natural light, authentic handheld framing, high detail, ${baseNegative}`
    };
  });

  scenes.forEach((scene) => {
    scene.language = brief.language || defaultLanguage;
    scene.language_code = storyboardLanguage;
    scene.usage_stage = getStoryboardStage(languageCopy, scene.id - 1, desiredImageCount).usageStage || "";
    scene.video_usage_hint = scene.usage_stage;
    scene.character_mode = characterConfig.mode;
    scene.character_config = {
      mode: characterConfig.mode,
      label: characterConfig.label,
      persona,
      reference_image: characterConfig.reference,
      prompt_note: characterConfig.prompt_note,
      video_note: characterConfig.video_note
    };
    scene.character_reference = characterConfig.reference;
    scene.character_video_rule = characterConfig.video_note;
  });

  const imageBatch = {
    language: brief.language || defaultLanguage,
    task: `Generate exactly ${desiredImageCount} separate images based on the selected video count. Do not combine images into one output.`,
    selected_video_count: desiredImageCount,
    seedance_2_0_workflow: "Generate these images first, then use each image together with its matching video_0x JSON in Seedance 2.0.",
    script_to_image_mapping: scenes.map((scene) => ({
      image_id: scene.image_id,
      title: scene.title,
      script_segments: scene.script_segments,
      script_time_range: scene.script_time_range,
      script_match_text: scene.script_match_text,
      usage_stage: scene.usage_stage
    })),
    character_config: {
      mode: characterConfig.mode,
      label: characterConfig.label,
      persona,
      reference_image: characterConfig.reference,
      prompt_note: characterConfig.prompt_note
    },
    output_rule: buildImageOutputRules(storyboardLanguage, desiredImageCount),
    image_usage_guide: Object.fromEntries([
      ...scenes.map((scene) => [scene.image_id, scene.usage_stage]),
      ["next_step_note", "Step 3 will generate the same number of video_0x JSON files. Use each video_0x JSON together with its matching image_0x in Seedance 2.0."]
    ]),
    images: scenes
  };

  state.storyboard = scenes;
  $("storyJsonOutput").value = JSON.stringify(imageBatch, null, 2);
  renderStoryboardCards(scenes);
  renderSingleImageJsonCards(imageBatch);
  saveDraft();
  showToast("图片 JSON 已生成");
  return scenes;
}

function renderStoryboardCards(scenes) {
  const container = $("storyboardCards");
  if (!scenes.length) {
    container.innerHTML = '<p class="empty-state">生成后会看到按影片数量切好的分镜图卡。</p>';
    return;
  }

  container.innerHTML = scenes
    .map(
      (scene) => `
      <article class="scene-card">
        <div class="scene-thumb">
          <span class="scene-number">${scene.id}</span>
          <strong>${scene.title}</strong>
        </div>
        <div class="scene-body">
          <p><strong>图片：</strong>${scene.image_id || `image_${String(scene.id).padStart(2, "0")}`}</p>
          <p><strong>用途：</strong>${escapeHtml(scene.usage_stage || "")}</p>
          <p><strong>对应剧本：</strong>${escapeHtml(scene.script_match_text || scene.spoken_line || "")}</p>
          <p><strong>人物：</strong>${scene.character || "自然口播人物"}</p>
          <p><strong>字幕：</strong>${scene.text_overlay}</p>
          <p><strong>口播：</strong>${scene.spoken_line}</p>
        </div>
      </article>
    `
    )
    .join("");
}

function buildSingleImageJson(project, scene) {
  return {
    filename: `${scene.image_id}.json`,
    image_id: scene.image_id,
    generator: "GPTimg / image generator",
    aspect_ratio: "9:16",
    paired_video_json: `video_${String(scene.id).padStart(2, "0")}.json`,
    seedance_2_0_pairing: `Generate ${scene.image_id} first, then use it together with video_${String(scene.id).padStart(2, "0")}.json in Seedance 2.0.`,
    usage_stage: scene.usage_stage,
    script_segments: scene.script_segments || [],
    script_time_range: scene.script_time_range || "",
    script_match_text: scene.script_match_text || scene.spoken_line || "",
    character: scene.character,
    character_mode: scene.character_mode,
    character_reference: scene.character_reference || null,
    visual_direction: scene.visual_direction,
    prompt: scene.image_prompt,
    rules: [
      "Generate only one standalone image for this JSON.",
      `This image must be saved/recognized as ${scene.image_id}.`,
      "Do not combine multiple scenes into one image.",
      "Do not create collage, grid, storyboard sheet, contact sheet, split-screen, or multi-panel output.",
      "The visual must match script_match_text exactly and must not jump to another part of the script.",
      "Use this image only with its paired Seedance 2.0 video JSON."
    ],
    project_context: {
      language: project?.language || defaultLanguage,
      selected_video_count: project?.selected_video_count || state.storyboard.length || null
    }
  };
}

function getSingleImageJsonFiles(batch = null) {
  let images = [];
  let project = batch;
  if (batch?.images?.length) {
    images = batch.images;
  } else if (state.storyboard.length) {
    images = state.storyboard;
  } else {
    const text = $("storyJsonOutput")?.value?.trim();
    if (text) {
      try {
        project = JSON.parse(text);
        images = Array.isArray(project.images) ? project.images : [];
      } catch (error) {
        images = [];
      }
    }
  }

  return images.map((scene) => ({
    filename: `${scene.image_id || `image_${String(scene.id).padStart(2, "0")}`}.json`,
    image_id: scene.image_id || `image_${String(scene.id).padStart(2, "0")}`,
    paired_video_id: `video_${String(scene.id).padStart(2, "0")}`,
    usage_stage: scene.usage_stage || "",
    script_match_text: scene.script_match_text || scene.spoken_line || "",
    json: buildSingleImageJson(project, scene)
  }));
}

function renderSingleImageJsonCards(batch) {
  const container = $("singleImageJsonList");
  if (!container) return;

  const files = getSingleImageJsonFiles(batch);
  if (!files.length) {
    container.innerHTML = '<p class="empty-state">生成后会出现每张图片的单独 JSON。</p>';
    return;
  }

  container.innerHTML = files
    .map((file) => {
      const jsonText = JSON.stringify(file.json, null, 2);
      return `
        <article class="single-json-card">
          <header>
            <div>
              <strong>${escapeHtml(file.filename)}</strong>
              <small>${escapeHtml(file.image_id)} → ${escapeHtml(file.paired_video_id)} | ${escapeHtml(file.usage_stage)}</small>
              <small>${escapeHtml(file.script_match_text)}</small>
            </div>
            <div class="button-row">
              <button class="ghost-btn" type="button" data-action="copy-single-image-json" data-image-id="${escapeHtml(file.image_id)}">复制</button>
              <button class="ghost-btn" type="button" data-action="download-single-image-json" data-image-id="${escapeHtml(file.image_id)}">下载</button>
            </div>
          </header>
          <textarea readonly>${escapeHtml(jsonText)}</textarea>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getVoiceAccentInstruction(languageCode, language = "") {
  if (languageCode === "ms") {
    return "Voice must be Bahasa Melayu Malaysia / Malaysian Malay. Use a local Malaysian Malay accent, rhythm, and casual TikTok Shop seller tone. Do not use Indonesian accent, Bahasa Indonesia wording, formal news-reader Malay, or robotic textbook pronunciation. Prefer natural Malaysian words like tak, nak, boleh, tengok, senang, leceh, sekarang, troli when they fit the script. Keep it friendly, clear, and conversational.";
  }
  if (languageCode === "en") {
    return "Voice must sound like natural Malaysian TikTok English: casual, clear, friendly, and not overly formal.";
  }
  return `Voice must match this script language naturally: ${language || defaultLanguage}. Speak casually and clearly.`;
}

function buildVoiceConfig(brief) {
  const mode = brief.voiceMode || "ai";
  const languageCode = getLanguageCode(brief.language);
  const accentInstruction = getVoiceAccentInstruction(languageCode, brief.language);
  if (mode === "none") {
    return {
      mode: "no_voiceover",
      instruction: "Do not generate spoken voice. Use caption/subtitle only."
    };
  }

  if (mode === "clone") {
    const sample = state.voiceClone;
    return {
      mode: "voice_clone",
      enabled: true,
      reference_audio_filename: sample?.name || "upload_15_second_voice_sample.wav",
      reference_duration_seconds: sample?.duration ? Number(sample.duration.toFixed(1)) : null,
      reference_status: sample ? (sample.isRecommendedLength ? "ready" : "duration_not_around_15_seconds") : "missing_upload",
      accent_instruction: accentInstruction,
      instruction: `Upload this same 15-second voice sample in Higgsfield voice clone / voice reference if available. Use the cloned voice for the narration text. ${accentInstruction}`
    };
  }

  return {
    mode: "ai_voice",
    accent_instruction: accentInstruction,
    instruction: accentInstruction
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getSelectedVideoCount() {
  return String(clampNumber($("storyboardVideoCount")?.value || $("videoClipCount")?.value, 2, 5, 4));
}

function syncVideoCount(value) {
  const count = String(clampNumber(value, 2, 5, 4));
  if ($("storyboardVideoCount")) $("storyboardVideoCount").value = count;
  if ($("videoClipCount")) $("videoClipCount").value = count;
  return count;
}

function getVideoSettings() {
  const requestedCount = Number(syncVideoCount(getSelectedVideoCount()));
  return {
    requestedCount,
    maxSeconds: clampNumber($("videoMaxSeconds")?.value, 5, 15, 15)
  };
}

function getSceneSeconds(scene) {
  return Math.max(1, Math.ceil(Number(scene.duration_sec) || 5), estimateNarrationSeconds(scene?.spoken_line || "", scene?.language_code || "zh"));
}

function estimateNarrationSeconds(text, languageCode = "zh") {
  const value = cleanText(text);
  if (!value) return 6;

  const punctuationPauses = (value.match(/[，。！？、,.!?;；:：]/g) || []).length * 0.2;
  if (languageCode === "en" || languageCode === "ms") {
    const wordCount = value.split(/\s+/).filter(Boolean).length;
    return Math.ceil(Math.max(6, wordCount / 2.1 + punctuationPauses + 1.2));
  }

  const cjkCount = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latinWords = (value.replace(/[\u3400-\u9fff]/g, " ").match(/[a-z0-9]+/gi) || []).length;
  return Math.ceil(Math.max(6, cjkCount / 3.2 + latinWords / 2.1 + punctuationPauses + 1.2));
}

function buildNoTextOverlayRule() {
  return "Do not add any visible text, subtitles, captions, scene numbers, video_01 labels, titles, top banners, bottom banners, black text bars, UI labels, watermarks, or progress bars inside the generated video. The frame must stay clean; use voiceover/audio only for spoken content.";
}

function groupScenesForVideo(scenes, requestedCount, maxSeconds) {
  const desiredCount = Math.min(scenes.length, Math.max(1, requestedCount));
  const totalSeconds = scenes.reduce((sum, scene) => sum + getSceneSeconds(scene), 0);
  const targetSeconds = Math.min(maxSeconds, Math.ceil(totalSeconds / desiredCount));
  const groups = [];
  let current = [];
  let currentSeconds = 0;

  scenes.forEach((scene, index) => {
    const seconds = getSceneSeconds(scene);
    const remainingScenes = scenes.length - index;
    const remainingSlots = desiredCount - groups.length;
    const shouldReserveSlots = current.length && groups.length < desiredCount - 1 && remainingScenes <= remainingSlots;
    const wouldExceedMax = current.length && currentSeconds + seconds > maxSeconds;
    const reachedTarget = current.length && groups.length < desiredCount - 1 && currentSeconds >= targetSeconds;

    if (wouldExceedMax || shouldReserveSlots || reachedTarget) {
      groups.push(current);
      current = [];
      currentSeconds = 0;
    }

    current.push(scene);
    currentSeconds += seconds;
  });

  if (current.length) {
    groups.push(current);
  }

  while (groups.length < desiredCount) {
    let splitIndex = -1;
    let largestSeconds = 0;
    groups.forEach((group, index) => {
      const seconds = group.reduce((sum, scene) => sum + getSceneSeconds(scene), 0);
      if (group.length > 1 && seconds > largestSeconds) {
        splitIndex = index;
        largestSeconds = seconds;
      }
    });
    if (splitIndex < 0) break;

    const group = groups[splitIndex];
    const splitAt = Math.ceil(group.length / 2);
    groups.splice(splitIndex, 1, group.slice(0, splitAt), group.slice(splitAt));
  }

  return groups.filter((group) => group.length);
}

function buildGroupedVideoClip(group, index, totalGroups, maxSeconds) {
  const clipId = `video_${String(index + 1).padStart(2, "0")}`;
  const inputImageIds = group.map((scene) => scene.image_id || `image_${String(scene.id).padStart(2, "0")}`);
  const groupSeconds = group.reduce((sum, scene) => sum + getSceneSeconds(scene), 0);
  const sceneTitles = group.map((scene) => scene.title).join(" + ");
  const narration = group.map((scene) => scene.spoken_line).filter(Boolean).join(" ");
  const clipLanguageCode = group.find((scene) => scene.language_code)?.language_code || "zh";
  const narrationSeconds = estimateNarrationSeconds(narration, clipLanguageCode);
  const durationSec = Math.min(maxSeconds, Math.max(8, groupSeconds, narrationSeconds));
  const pacingWarning = narrationSeconds > maxSeconds
    ? `Narration needs about ${narrationSeconds}s for natural pacing, but this clip is capped at ${maxSeconds}s. Shorten/summarize the voiceover or generate more video clips; do not speak faster.`
    : "Narration should fit at a natural pace. Do not speed up the voiceover.";
  const scenesIncluded = group.map((scene, sceneIndex) => ({
    scene_id: scene.id,
    image_id: inputImageIds[sceneIndex],
    title: scene.title,
    duration_sec: getSceneSeconds(scene),
    usage_stage: scene.usage_stage || scene.video_usage_hint || "",
    script_segments: scene.script_segments || [],
    script_match_text: scene.script_match_text || scene.spoken_line || ""
  }));
  const imageUsageForVideo = group.map((scene, sceneIndex) => ({
    image_id: inputImageIds[sceneIndex],
    role: sceneIndex === 0 ? "main_start_image" : "optional_reference_image",
    scene_id: scene.id,
    scene_title: scene.title,
    usage_stage: scene.usage_stage || scene.video_usage_hint || "",
    script_match_text: scene.script_match_text || scene.spoken_line || "",
    instruction: sceneIndex === 0
      ? `Upload ${inputImageIds[sceneIndex]} as the main/start image for ${clipId}.`
      : `If Higgsfield allows extra reference images, add ${inputImageIds[sceneIndex]} as a reference for this same ${clipId}.`
  }));
  const beats = group
    .map((scene, sceneIndex) => `${sceneIndex + 1}. ${inputImageIds[sceneIndex]}: ${scene.visual_direction}`)
    .join(" ");
  const timingNote = clipLanguageCode === "en"
    ? `Choose ${durationSec} seconds in Higgsfield web.`
    : clipLanguageCode === "ms"
      ? `Pilih ${durationSec} saat di laman Higgsfield.`
      : `在 Higgsfield 网页选择 ${durationSec} 秒。`;
  const characterConfig = group.find((scene) => scene.character_config)?.character_config || null;
  const characterVideoRule = group.find((scene) => scene.character_video_rule)?.character_video_rule || "";
  const noTextOverlayRule = buildNoTextOverlayRule();
  const voiceAccentInstruction = getVoiceAccentInstruction(clipLanguageCode);

  return {
    scene_ids: group.map((scene) => scene.id),
    scenes_included: scenesIncluded,
    clip_id: clipId,
    input_image_id: inputImageIds[0],
    input_image_ids: inputImageIds,
    image_usage_for_video: imageUsageForVideo,
    upload_image_instruction: `For ${clipId}: upload ${inputImageIds[0]} as the main/start image.${inputImageIds.length > 1 ? ` Add ${inputImageIds.slice(1).join(", ")} only as optional reference images if Higgsfield supports multiple references.` : ""}`,
    title: sceneTitles,
    duration_sec: durationSec,
    seedance_seconds: durationSec,
    seedance_2_0_instruction: `Use ${inputImageIds[0]} with ${clipId}.json in Seedance 2.0. Generate one standalone ${durationSec}-second vertical 9:16 video segment.`,
    higgsfield_seconds: durationSec,
    higgsfield_web_instruction: timingNote,
    character_mode: characterConfig?.mode || "persona",
    character_config: characterConfig,
    character_reference: characterConfig?.reference_image || null,
    character_video_rule: characterVideoRule,
    source_image_prompts: group.map((scene) => scene.image_prompt),
    video_prompt: `Generate ${clipId} as ONE standalone ${durationSec}-second vertical 9:16 video. ${timingNote} Use ${inputImageIds[0]} as the main/start image reference. ${characterVideoRule} This one video contains these visual beats in order: ${beats} Keep product visibility clear, motion smooth, pacing natural for Malaysian TikTok Shop, realistic lighting, no overacting. Voice instruction: ${voiceAccentInstruction} Use natural voice pacing; if the narration cannot fit naturally, shorten/summarize the voiceover instead of speaking faster. ${noTextOverlayRule} Do not include content from other video JSON files. Do not merge with other clips. Do not create split-screen, collage, grid, storyboard sheet, or multi-panel video.`,
    camera_motion: index === 0 ? "slow push-in, then natural handheld movement between beats" : index === totalGroups - 1 ? "gentle handheld movement ending on CTA area" : "small handheld movement with smooth beat-to-beat transitions",
    narration,
    voice_accent_instruction: voiceAccentInstruction,
    narration_estimated_seconds: narrationSeconds,
    pacing_note: pacingWarning,
    caption_overlay: null,
    on_screen_text: {
      enabled: false,
      instruction: noTextOverlayRule
    },
    sound_design: index === 0 ? "quick attention hit, then clean voiceover" : "light upbeat shop-video background music under voiceover",
    transition_to_next: index === totalGroups - 1 ? "export this as the final CTA clip, then merge later" : "export this clip separately, then merge later"
  };
}

function buildSingleVideoJson(projectName, language, persona, voiceConfig, clip) {
  return {
    job_name: clip.clip_id,
    generator: "Seedance 2.0 image-to-video",
    input_image: clip.input_image_id,
    input_images: clip.input_image_ids || [clip.input_image_id],
    image_usage_for_video: clip.image_usage_for_video || [],
    seedance_2_0_instruction: `Use ${clip.input_image_id} together with this JSON to generate ${clip.clip_id}. Set duration around ${clip.higgsfield_seconds || clip.duration_sec} seconds. Keep the output as one standalone vertical 9:16 video segment.`,
    upload_image_note: clip.upload_image_instruction || `Upload/use ${clip.input_image_id} as the main image for this job. If Higgsfield allows extra references, add: ${(clip.input_image_ids || [clip.input_image_id]).join(", ")}.`,
    output_filename: `${clip.clip_id}.mp4`,
    aspect_ratio: "9:16",
    duration_seconds: clip.duration_sec,
    seedance_seconds: clip.higgsfield_seconds || clip.duration_sec,
    higgsfield_seconds: clip.higgsfield_seconds || clip.duration_sec,
    higgsfield_web_instruction: clip.higgsfield_web_instruction || `Choose ${clip.duration_sec}s in Higgsfield web for this JSON.`,
    scenes_included: clip.scenes_included || [],
    character: {
      mode: clip.character_mode || "persona",
      config: clip.character_config || null,
      reference_image: clip.character_reference || null,
      instruction: clip.character_video_rule || ""
    },
    prompt: clip.video_prompt,
    voiceover: {
      mode: voiceConfig.mode,
      language,
      persona,
      text: clip.narration,
      accent_instruction: clip.voice_accent_instruction || getVoiceAccentInstruction(getLanguageCode(language), language),
      pacing: "natural, conversational, not rushed",
      pacing_note: clip.pacing_note || "Shorten/summarize the voiceover if needed; never speed-read."
    },
    voice_clone: voiceConfig.mode === "voice_clone" ? voiceConfig : { enabled: false, mode: voiceConfig.mode, instruction: voiceConfig.instruction },
    caption_overlay: null,
    on_screen_text: clip.on_screen_text || { enabled: false, instruction: buildNoTextOverlayRule() },
    camera_motion: clip.camera_motion,
    sound_design: clip.sound_design,
    rules: [
      `Generate only ${clip.clip_id}.`,
      `Set duration to ${clip.higgsfield_seconds || clip.duration_sec} seconds in Higgsfield web.`,
      `Use ${clip.input_image_id} as the main/start image.`,
      clip.voice_accent_instruction || getVoiceAccentInstruction(getLanguageCode(language), language),
      "Use natural voice pacing. Do not speed up the narration to force it into the clip.",
      "If narration feels too long, shorten/summarize it while keeping the meaning.",
      buildNoTextOverlayRule(),
      clip.character_reference ? `Upload the character reference image "${clip.character_reference.name}" if Higgsfield asks for a character/person reference.` : null,
      clip.character_mode === "no_person" ? "No human, no person, no face, no visible hands." : null,
      "Only include the scenes listed in this JSON.",
      "Do not include content from other video JSON files.",
      "Do not merge this with other clips inside Higgsfield.",
      "Do not create split-screen, collage, grid, storyboard sheet, or multi-panel video.",
      "Export this as one separate short video file."
    ].filter(Boolean),
    merge_later: {
      project_name: projectName,
      order_after_export: clip.clip_id
    }
  };
}

function buildVideoJson() {
  const brief = getBrief();
  let scenes = state.storyboard.length ? state.storyboard : buildStoryboard();
  const videoLanguageCode = getLanguageCode(brief.language);
  const { requestedCount, maxSeconds } = getVideoSettings();
  if (state.storyboard.length && (scenes.length !== requestedCount || scenes.some((scene) => scene.character_mode !== brief.characterMode || scene.language_code !== videoLanguageCode))) {
    scenes = buildStoryboard();
  }
  const product = safeClaim(brief.product || "产品");
  const persona = safeClaim(brief.persona || "自然口播人物");
  const voiceConfig = buildVoiceConfig(brief);
  const groups = groupScenesForVideo(scenes, requestedCount, maxSeconds);
  const videoClips = groups.map((group, index) => buildGroupedVideoClip(group, index, groups.length, maxSeconds));
  const totalDuration = videoClips.reduce((sum, clip) => sum + Number(clip.duration_sec || 0), 0);
  const visualCharacterConfig = scenes.find((scene) => scene.character_config)?.character_config || buildCharacterConfig(brief);
  const voiceStyle = voiceConfig.accent_instruction || brief.language || translationProfiles[videoLanguageCode]?.languageInstruction || "马来西亚华语，口语化，自然，有信任感，不念“令吉”，价格直接说“块”";

  const videoJson = {
    project_name: `${product} TikTok 短视频`,
    language: brief.language || defaultLanguage,
    aspect_ratio: "9:16",
    target_duration_sec: totalDuration,
    requested_video_count: requestedCount,
    actual_video_count: videoClips.length,
    max_seconds_per_higgsfield_video: maxSeconds,
    voice_style: voiceStyle,
    persona,
    visual_character_config: visualCharacterConfig,
    voice_config: voiceConfig,
    task: `分别生成 ${videoClips.length} 个短片，每个短片最多 ${maxSeconds} 秒。不要一次生成一条完整影片。生成 video_01 到 video_${String(videoClips.length).padStart(2, "0")} 后，再回到本工具第四步合成。`,
    seedance_2_0_usage: "不要把总览 JSON、全部图片一次丢进 Seedance。请复制 single_video_json_files 里的一个单独 JSON，并搭配对应的 image_0x，一次只生成一个 video_0x。",
    higgsfield_usage: "如果还使用 Higgsfield，也请一次只复制一个 single_video_json，并按照 higgsfield_seconds 在网页选择秒数。",
    generation_notes: [
      "Seedance 2.0 用法：每个 video_0x 只配对应的 image_0x 和该段 JSON，不要把全部图片和全部 JSON 一次丢进去。",
      ...(videoLanguageCode === "ms" ? ["如果使用 Bahasa Melayu，声音必须是 Bahasa Melayu Malaysia / Malaysian Malay，本地马来西亚口音；不要印尼腔、不要 Bahasa Indonesia、不要太正式的新闻播报腔。"] : []),
      "每个 single_video_json_files 里的 JSON 都是一个独立 Seedance 2.0 图生视频任务。",
      "每个 JSON 都有 higgsfield_seconds；在 Higgsfield 网页就选这个秒数。这个秒数已按自然口播速度估算。",
      "如果口播还是太赶，不要加速讲话；请把影片段数改成 5 段，或缩短该段 voiceover text。",
      "如果一个 video_0x 包含多个 image_id，请用第一个 image_id 做主图；网页支持参考图时再补其他图。",
      "不要把多个 video_0x 的 prompt 放在同一次影片生成里，也不要生成 split-screen 或拼贴影片。",
      "Higgsfield 生成阶段不要加任何画面文字、标题、字幕、video_01、Scene 1/5 或上下黑条。",
      "语气自然，不夸大，不使用绝对保证式表达。"
    ],
    separate_video_prompts: videoClips,
    scenes: videoClips,
    merge_order: videoClips.map((clip) => clip.clip_id),
    final_cta: moneySafe(brief.cta || "点击下面黄色购物车了解更多"),
    export_format: {
      recommended: "1080x1920, 30fps, MP4 if the video generator supports it",
      seedance_2_0: "Generate each video_0x separately from its matching image_0x, then merge the exported clips in Step 4.",
      local_browser_merge: "This tool exports WebM from uploaded clips because it uses built-in browser recording."
    }
  };

  videoJson.single_video_json_files = videoClips.map((clip) => ({
    filename: `${clip.clip_id}.json`,
    clip_id: clip.clip_id,
    input_image_id: clip.input_image_id,
    input_image_ids: clip.input_image_ids,
    image_usage_for_video: clip.image_usage_for_video,
    upload_image_instruction: clip.upload_image_instruction,
    seedance_2_0_pairing: `Use this JSON with ${clip.input_image_id}.`,
    seedance_2_0_instruction: clip.seedance_2_0_instruction,
    higgsfield_seconds: clip.higgsfield_seconds,
    seedance_seconds: clip.higgsfield_seconds,
    higgsfield_web_instruction: clip.higgsfield_web_instruction,
    voice_accent_instruction: clip.voice_accent_instruction,
    narration_estimated_seconds: clip.narration_estimated_seconds,
    pacing_note: clip.pacing_note,
    character_mode: clip.character_mode,
    character_reference: clip.character_reference,
    json: buildSingleVideoJson(videoJson.project_name, videoJson.language, videoJson.persona, videoJson.voice_config, clip)
  }));

  state.videoJson = videoJson;
  $("videoJsonOutput").value = JSON.stringify(videoJson, null, 2);
  renderVideoPlanPreview(videoJson);
  saveDraft();
  showToast("影片 JSON 已生成");
  return videoJson;
}

function renderVideoPlanPreview(plan) {
  const container = $("videoPlanPreview");
  const clips = plan?.separate_video_prompts || plan?.scenes;
  if (!plan || !clips) {
    container.innerHTML = '<p class="empty-state">生成后会看到影片分镜摘要。</p>';
    renderSingleVideoJsonCards(null);
    return;
  }

  container.innerHTML = clips
    .map(
      (scene) => `
      <div class="plan-row">
        <strong>${scene.clip_id || `${scene.duration_sec}s`} | ${scene.higgsfield_seconds || scene.duration_sec}s</strong>
        <div>
          <p><strong>用图：</strong>${formatImageUsage(scene.image_usage_for_video, scene.input_image_ids || [scene.input_image_id])}</p>
          <p>${escapeHtml(scene.higgsfield_web_instruction || "")}｜${escapeHtml(scene.narration || "")}</p>
        </div>
      </div>
    `
    )
    .join("");
  renderSingleVideoJsonCards(plan);
}

function formatImageUsage(imageUsage = [], fallbackImageIds = []) {
  const usage = Array.isArray(imageUsage) && imageUsage.length
    ? imageUsage
    : (fallbackImageIds || []).map((imageId, index) => ({
        image_id: imageId,
        role: index === 0 ? "main_start_image" : "optional_reference_image"
      }));

  return usage
    .map((item) => {
      const role = item.role === "main_start_image" ? "主图" : "参考图";
      const stage = item.usage_stage ? `（${item.usage_stage}）` : "";
      return `${role} ${item.image_id}${stage}`;
    })
    .map(escapeHtml)
    .join("；");
}

function getSingleVideoJsonFiles(plan = state.videoJson) {
  if (!plan) return [];
  if (Array.isArray(plan.single_video_json_files)) {
    return plan.single_video_json_files.map((file) => {
      const seconds = file.higgsfield_seconds || file.json?.higgsfield_seconds || file.json?.duration_seconds || file.json?.duration_sec || "";
      return {
        ...file,
        input_image_id: file.input_image_id || file.json?.input_image,
        input_image_ids: file.input_image_ids || file.json?.input_images || [file.input_image_id || file.json?.input_image].filter(Boolean),
        image_usage_for_video: file.image_usage_for_video || file.json?.image_usage_for_video || [],
        upload_image_instruction: file.upload_image_instruction || file.json?.upload_image_note || "",
        seedance_2_0_pairing: file.seedance_2_0_pairing || file.json?.seedance_2_0_instruction || "",
        higgsfield_seconds: seconds,
        higgsfield_web_instruction: file.higgsfield_web_instruction || file.json?.higgsfield_web_instruction || (seconds ? `在 Higgsfield 网页选择 ${seconds} 秒。` : "")
      };
    });
  }

  const clips = plan.separate_video_prompts || plan.scenes || [];
  return clips.map((clip) => ({
    filename: `${clip.clip_id || `video_${String(clip.scene_id || 1).padStart(2, "0")}`}.json`,
    clip_id: clip.clip_id,
    input_image_id: clip.input_image_id,
    input_image_ids: clip.input_image_ids || [clip.input_image_id],
    image_usage_for_video: clip.image_usage_for_video || [],
    upload_image_instruction: clip.upload_image_instruction || "",
    seedance_2_0_pairing: clip.seedance_2_0_instruction || "",
    higgsfield_seconds: clip.higgsfield_seconds || clip.duration_sec,
    higgsfield_web_instruction: clip.higgsfield_web_instruction || `在 Higgsfield 网页选择 ${clip.duration_sec} 秒。`,
    json: buildSingleVideoJson(
      plan.project_name || "TikTok 短视频",
      plan.language || defaultLanguage,
      plan.persona || "自然口播人物",
      plan.voice_config || buildVoiceConfig(getBrief()),
      clip
    )
  }));
}

function renderSingleVideoJsonCards(plan) {
  const container = $("singleVideoJsonList");
  if (!container) return;

  const files = getSingleVideoJsonFiles(plan);
  if (!files.length) {
    container.innerHTML = '<p class="empty-state">生成后会出现每段影片的单独 JSON。</p>';
    return;
  }

  container.innerHTML = files
    .map((file) => {
      const jsonText = JSON.stringify(file.json, null, 2);
      return `
        <article class="single-json-card">
          <header>
            <div>
              <strong>${escapeHtml(file.filename)}</strong>
              <small>${formatImageUsage(file.image_usage_for_video, file.input_image_ids || [file.input_image_id])} → ${escapeHtml(file.clip_id)} | ${escapeHtml(file.higgsfield_seconds)}s</small>
              <small>${escapeHtml(file.seedance_2_0_pairing || file.upload_image_instruction || file.higgsfield_web_instruction || "")}</small>
            </div>
            <div class="button-row">
              <button class="ghost-btn" type="button" data-action="copy-single-video-json" data-clip-id="${escapeHtml(file.clip_id)}">复制</button>
              <button class="ghost-btn" type="button" data-action="download-single-video-json" data-clip-id="${escapeHtml(file.clip_id)}">下载</button>
            </div>
          </header>
          <textarea readonly>${escapeHtml(jsonText)}</textarea>
        </article>
      `;
    })
    .join("");
}

async function copyText(text, successMessage) {
  if (!text) {
    showToast("没有内容可以复制");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      document.body.removeChild(helper);
    }
    showToast(successMessage);
  } catch (error) {
    showToast("复制失败，请手动选取复制");
  }
}

function downloadText(filename, text, type = "text/plain") {
  if (!text) {
    showToast("没有内容可以下载");
    return;
  }
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadDemo() {
  setBrief({
    product: "强力排水管清洁粉",
    industry: "家居清洁",
    audience: "经常煮饭的家庭主妇和租房族",
    language: defaultLanguage,
    personaPreset: "老板亲自介绍",
    persona: "",
    characterMode: "persona",
    voiceMode: "ai",
    hook: "你家的排水管是不是又塞了，水越流越慢，还有味道跑出来？",
    usp1: "倒进去等一下，油垢和异味更容易被冲走",
    usp2: "厨房、厕所、洗手盆都可以用，步骤很简单",
    usp3: "很多客户会一次买几包放家里备用",
    offer: "今天下单有优惠，买多更划算",
    cta: "现在点击下面黄色购物车了解更多"
  });
  buildScript();
  buildStoryboard();
  buildVideoJson();
  showToast("范例已载入");
}

function clearAll() {
  localStorage.removeItem(storageKey);
  setBrief({ language: defaultLanguage, characterMode: "persona", voiceMode: "ai" });
  $("scriptOutput").value = "";
  $("translatedScriptOutput").value = "";
  $("translationTarget").value = "zh";
  $("storyJsonOutput").value = "";
  $("videoJsonOutput").value = "";
  state.storyboard = [];
  state.videoJson = null;
  state.clips = [];
  state.voiceClone = null;
  state.characterReference = null;
  $("clipInput").value = "";
  $("characterReference").value = "";
  $("voiceSample").value = "";
  syncVideoCount("4");
  $("videoMaxSeconds").value = "15";
  renderStoryboardCards([]);
  renderVideoPlanPreview(null);
  renderClipList();
  updateCharacterStatus();
  updateVoiceCloneStatus();
  drawCanvasPlaceholder();
  saveDraft();
  showToast("已清空");
}

function renderClipList() {
  const list = $("clipList");
  if (!state.clips.length) {
    list.innerHTML = '<p class="empty-state">还没有选择短片。</p>';
    return;
  }

  list.innerHTML = state.clips
    .map((file, index) => {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      return `
        <div class="clip-item" data-clip-index="${index}">
          <span class="clip-order">${index + 1}</span>
          <div class="clip-meta">
            <strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong>
            <small>${sizeMb} MB</small>
          </div>
          <div class="clip-actions" aria-label="调整短片排序">
            <button class="icon-btn" type="button" data-action="move-clip-up" data-clip-index="${index}" ${index === 0 ? "disabled" : ""} title="上移">↑</button>
            <button class="icon-btn" type="button" data-action="move-clip-down" data-clip-index="${index}" ${index === state.clips.length - 1 ? "disabled" : ""} title="下移">↓</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function moveClip(fromIndex, direction) {
  const nextIndex = fromIndex + direction;
  if (fromIndex < 0 || nextIndex < 0 || fromIndex >= state.clips.length || nextIndex >= state.clips.length) {
    return;
  }
  const [clip] = state.clips.splice(fromIndex, 1);
  state.clips.splice(nextIndex, 0, clip);
  renderClipList();
  updateRenderSupport();
  showToast(`已调整排序：${clip.name}`);
}

function canRecordCanvas() {
  const canvas = $("renderCanvas");
  return Boolean(window.MediaRecorder && canvas && canvas.captureStream);
}

function updateRenderSupport() {
  if (!canRecordCanvas()) {
    setProgress(0, "当前浏览器不支持本地录制。请用新版 Chrome/Edge，或先导出合成清单。");
    return false;
  }
  setProgress(0, state.clips.length ? `已选择 ${state.clips.length} 段短片，将按当前排序合成。` : "准备好后点击合成。");
  return true;
}

function setProgress(value, message) {
  $("renderProgress").style.width = `${Math.max(0, Math.min(100, value))}%`;
  if (message) {
    $("renderStatus").textContent = message;
  }
}

function bestRecorderMime() {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function drawCover(ctx, source, width, height) {
  const sourceWidth = source.videoWidth || width;
  const sourceHeight = source.videoHeight || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
}

function tokenized(text) {
  const value = cleanText(text);
  if (value.includes(" ")) return value.split(/\s+/);
  return Array.from(value);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const units = tokenized(text);
  const usesSpaces = cleanText(text).includes(" ");
  let line = "";
  let lines = [];

  units.forEach((unit) => {
    const testLine = line ? `${line}${usesSpaces ? " " : ""}${unit}` : unit;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = unit;
    } else {
      line = testLine;
    }
  });
  if (line) lines.push(line);

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(1, lines[maxLines - 1].length - 2))}...`;
  }

  lines.forEach((item, index) => {
    ctx.fillText(item, x, y + index * lineHeight);
  });
  return lines.length * lineHeight;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawOverlay(ctx, scene, index, total, progress = 0) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const pad = 42;

  if (!$("captionToggle").checked) return;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
  roundedRect(ctx, pad, height - 215, width - pad * 2, 125, 8);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 34px Arial, Microsoft YaHei, sans-serif";
  wrapText(ctx, scene?.spoken_line || scene?.narration || scene?.text_overlay || "", pad + 24, height - 166, width - pad * 2 - 48, 43, 2);
  ctx.restore();
}

function drawCanvasPlaceholder() {
  const canvas = $("renderCanvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = "#101720";
  ctx.fillRect(0, 0, width, height);

  const grd = ctx.createLinearGradient(0, 0, width, height);
  grd.addColorStop(0, "rgba(20, 122, 126, 0.72)");
  grd.addColorStop(0.55, "rgba(69, 107, 217, 0.46)");
  grd.addColorStop(1, "rgba(240, 111, 79, 0.64)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let y = 0; y < height; y += 44) {
    ctx.fillRect(0, y, width, 1);
  }

  ctx.fillStyle = "rgba(0,0,0,0.36)";
  roundedRect(ctx, 66, 410, width - 132, 280, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "800 42px Arial, Microsoft YaHei, sans-serif";
  wrapText(ctx, "最终影片预览", width / 2, 500, width - 170, 50, 2);
  ctx.font = "600 26px Arial, Microsoft YaHei, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  wrapText(ctx, "上传短片后在这里合成", width / 2, 600, width - 170, 36, 2);
  ctx.textAlign = "left";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadVideoMetadata(video, url) {
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("视频无法读取"));
    video.src = url;
    video.load();
  });
}

async function renderClipToCanvas(video, file, scene, index, total, totalUnits, completedUnits) {
  const canvas = $("renderCanvas");
  const ctx = canvas.getContext("2d");
  const url = URL.createObjectURL(file);
  const maxSeconds = Math.max(2, Number($("maxClipSeconds").value) || 5);

  await loadVideoMetadata(video, url);
  video.currentTime = 0;
  const clipDuration = Math.min(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : maxSeconds, maxSeconds);
  await video.play();

  const start = performance.now();

  await new Promise((resolve) => {
    function frame(now) {
      const elapsed = (now - start) / 1000;
      const progress = Math.min(1, elapsed / clipDuration);
      ctx.fillStyle = "#0b0f15";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (video.readyState >= 2) {
        drawCover(ctx, video, canvas.width, canvas.height);
      }
      drawOverlay(ctx, scene, index, total, progress);
      setProgress(((completedUnits + progress) / totalUnits) * 100, `正在合成第 ${index + 1} 段...`);

      if (elapsed < clipDuration && !video.ended) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });

  video.pause();
  video.removeAttribute("src");
  video.load();
  URL.revokeObjectURL(url);
}

async function renderSlideToCanvas(scene, index, total, totalUnits, completedUnits) {
  const canvas = $("renderCanvas");
  const ctx = canvas.getContext("2d");
  const durationMs = Math.max(2, Number(scene.duration_sec) || 4) * 1000;
  const start = performance.now();

  await new Promise((resolve) => {
    function frame(now) {
      const progress = Math.min(1, (now - start) / durationMs);
      const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      const palettes = [
        ["#16202a", "#147a7e", "#456bd9"],
        ["#147a7e", "#456bd9", "#16202a"],
        ["#f06f4f", "#16202a", "#147a7e"],
        ["#c99621", "#16202a", "#456bd9"],
        ["#147a7e", "#f06f4f", "#16202a"]
      ];
      const colors = palettes[index % palettes.length];
      grd.addColorStop(0, colors[0]);
      grd.addColorStop(0.55, colors[1]);
      grd.addColorStop(1, colors[2]);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      for (let y = -canvas.height; y < canvas.height * 2; y += 54) {
        ctx.fillRect(0, y + progress * 54, canvas.width, 1);
      }

      ctx.fillStyle = "rgba(0,0,0,0.32)";
      roundedRect(ctx, 50, 290, canvas.width - 100, 360, 8);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 54px Arial, Microsoft YaHei, sans-serif";
      wrapText(ctx, scene.title, 82, 390, canvas.width - 164, 62, 3);
      ctx.font = "700 30px Arial, Microsoft YaHei, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.84)";
      wrapText(ctx, scene.visual_direction, 82, 560, canvas.width - 164, 39, 3);

      drawOverlay(ctx, scene, index, total, progress);
      setProgress(((completedUnits + progress) / totalUnits) * 100, `正在生成图卡样片 ${index + 1}/${total}...`);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

async function recordCanvas(renderTask, options = {}) {
  if (!canRecordCanvas()) {
    setProgress(0, "这个浏览器不支持本地合成。请换新版 Chrome/Edge，或导出合成清单。");
    showToast("当前浏览器不支持本地合成");
    return false;
  }

  if (state.renderObjectUrl) {
    URL.revokeObjectURL(state.renderObjectUrl);
    state.renderObjectUrl = null;
  }

  setProgress(1, "准备录制画面...");

  const canvas = $("renderCanvas");
  let stream = null;
  try {
    stream = canvas.captureStream(30);
  } catch (error) {
    setProgress(0, "当前浏览器禁止 canvas 录制。请用新版 Chrome/Edge，或导出合成清单。");
    showToast("浏览器禁止本地录制");
    return false;
  }

  const video = document.createElement("video");
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  let audioContext = null;
  if (options.includeAudio !== false) {
    try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await Promise.race([audioContext.resume(), wait(500)]);
    const audioSource = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    audioSource.connect(destination);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    } catch (error) {
      audioContext = null;
    }
  }

  let mimeType = "";
  let recorder = null;
  try {
    mimeType = bestRecorderMime();
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    if (audioContext) {
      try {
        await Promise.race([audioContext.close(), wait(500)]);
      } catch (error) {}
    }
    setProgress(0, "当前浏览器无法启动视频录制。请用新版 Chrome/Edge，或导出合成清单。");
    showToast("无法启动本地录制");
    return false;
  }

  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };

  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  $("finalPreview").hidden = true;
  $("renderCanvas").classList.remove("hidden");
  $("downloadVideoLink").classList.add("hidden");
  setProgress(0, "开始合成...");

  recorder.start();
  await renderTask(video);
  await wait(250);
  recorder.stop();
  await stopped;

  stream.getTracks().forEach((track) => track.stop());
  if (audioContext) {
    try {
      await Promise.race([audioContext.close(), wait(500)]);
    } catch (error) {}
  }

  const blob = new Blob(chunks, { type: mimeType || "video/webm" });
  const url = URL.createObjectURL(blob);
  state.renderObjectUrl = url;

  const preview = $("finalPreview");
  preview.src = url;
  preview.hidden = false;
  $("renderCanvas").classList.add("hidden");
  $("downloadVideoLink").href = url;
  $("downloadVideoLink").classList.remove("hidden");
  setProgress(100, "合成完成，可以预览或下载。");
  showToast("最终影片已合成");
  return true;
}

async function renderFinalVideo(useSlidesOnly = false) {
  const scenes = state.storyboard.length ? state.storyboard : buildStoryboard();
  const files = useSlidesOnly ? [] : state.clips;

  if (!useSlidesOnly && !files.length) {
    showToast("请先选择短片，或用图卡生成样片");
    return;
  }

  const units = useSlidesOnly ? scenes.length : files.length;
  try {
    await recordCanvas(async (video) => {
      for (let index = 0; index < units; index += 1) {
        const scene = scenes[index % scenes.length];
        if (useSlidesOnly) {
          await renderSlideToCanvas(scene, index, units, units, index);
        } else {
          await renderClipToCanvas(video, files[index], scene, index, units, units, index);
        }
      }
    }, { includeAudio: !useSlidesOnly });
  } catch (error) {
    setProgress(0, `合成失败：${error?.message || "请换浏览器或导出清单"}`);
    showToast("合成失败");
  }
}

function buildMergeManifest() {
  const brief = getBrief();
  const scenes = state.storyboard.length ? state.storyboard : buildStoryboard();
  const videoJson = state.videoJson || buildVideoJson();
  const maxSeconds = Math.max(2, Number($("maxClipSeconds").value) || 5);

  return {
    project_name: `${brief.product || "短视频"} 合成清单`,
    output: {
      aspect_ratio: "9:16",
      recommended_resolution: "1080x1920",
      local_browser_output: "WebM when MediaRecorder is supported",
      note: "如果当前浏览器不能本地合成，请用新版 Chrome/Edge 打开本工具，或把此清单交给剪辑软件按顺序合成。"
    },
    settings: {
      max_seconds_per_clip: maxSeconds,
      captions_enabled: $("captionToggle").checked
    },
    clips: state.clips.map((file, index) => ({
      order: index + 1,
      filename: file.name,
      size_mb: Number((file.size / 1024 / 1024).toFixed(2)),
      matched_scene_id: scenes[index % scenes.length]?.id,
      matched_scene_title: scenes[index % scenes.length]?.title,
      caption: scenes[index % scenes.length]?.text_overlay,
      narration: scenes[index % scenes.length]?.spoken_line
    })),
    scenes,
    video_json: videoJson
  };
}

function handleActionClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "render-video") {
    event.preventDefault();
    renderFinalVideo(false);
  }
  if (action === "render-slides") {
    event.preventDefault();
    renderFinalVideo(true);
  }
  if (action === "merge-manifest") {
    event.preventDefault();
    const manifest = buildMergeManifest();
    downloadText("merge-manifest.json", JSON.stringify(manifest, null, 2), "application/json");
    showToast("合成清单已导出");
  }
  if (action === "move-clip-up" || action === "move-clip-down") {
    event.preventDefault();
    const index = Number(button.dataset.clipIndex);
    moveClip(index, action === "move-clip-up" ? -1 : 1);
  }
  if (action === "copy-single-image-json") {
    event.preventDefault();
    const imageId = button.dataset.imageId;
    const file = getSingleImageJsonFiles().find((item) => item.image_id === imageId);
    if (file) {
      copyText(JSON.stringify(file.json, null, 2), `${imageId} JSON 已复制`);
    }
  }
  if (action === "download-single-image-json") {
    event.preventDefault();
    const imageId = button.dataset.imageId;
    const file = getSingleImageJsonFiles().find((item) => item.image_id === imageId);
    if (file) {
      downloadText(file.filename, JSON.stringify(file.json, null, 2), "application/json");
      showToast(`${imageId} JSON 已下载`);
    }
  }
  if (action === "copy-single-video-json") {
    event.preventDefault();
    const clipId = button.dataset.clipId;
    const file = getSingleVideoJsonFiles().find((item) => item.clip_id === clipId);
    if (file) {
      copyText(JSON.stringify(file.json, null, 2), `${clipId} JSON 已复制`);
    }
  }
  if (action === "download-single-video-json") {
    event.preventDefault();
    const clipId = button.dataset.clipId;
    const file = getSingleVideoJsonFiles().find((item) => item.clip_id === clipId);
    if (file) {
      downloadText(file.filename, JSON.stringify(file.json, null, 2), "application/json");
      showToast(`${clipId} JSON 已下载`);
    }
  }
}

function bindEvents() {
  document.addEventListener("click", handleActionClick);

  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => setStep(button.dataset.step));
  });

  document.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => setStep(button.dataset.next));
  });

  fieldIds.forEach((id) => {
    $(id).addEventListener("input", () => {
      updateSummary();
      updateCharacterStatus();
      updateVoiceCloneStatus();
      saveDraft();
    });
    $(id).addEventListener("change", () => {
      updateSummary();
      updateCharacterStatus();
      updateVoiceCloneStatus();
      saveDraft();
    });
  });

  $("characterReference").addEventListener("change", handleCharacterReferenceChange);
  $("voiceSample").addEventListener("change", handleVoiceSampleChange);

  ["scriptOutput", "translatedScriptOutput", "storyJsonOutput", "videoJsonOutput"].forEach((id) => {
    $(id).addEventListener("input", saveDraft);
  });

  $("generateScriptBtn").addEventListener("click", buildScript);
  $("generateAnglesBtn").addEventListener("click", generateAngles);
  $("copyAnglePromptBtn").addEventListener("click", copyChatGptAnglePrompt);
  $("applyAngleJsonBtn").addEventListener("click", applyChatGptAngleJson);
  $("ctaPreset").addEventListener("change", () => {
    if ($("ctaPreset").value) {
      $("cta").value = $("ctaPreset").value;
      $("scriptOutput").value = "";
      $("translatedScriptOutput").value = "";
      clearGeneratedOutputs();
      updateSummary();
      saveDraft();
      showToast("CTA 已套用，请重新生成脚本");
    }
  });
  $("translateScriptBtn").addEventListener("click", buildTranslatedScript);
  $("applyTranslatedScriptBtn").addEventListener("click", applyTranslatedScript);
  $("generateStoryBtn").addEventListener("click", buildStoryboard);
  $("generateVideoJsonBtn").addEventListener("click", buildVideoJson);
  $("generateAllBtn").addEventListener("click", () => {
    buildScript();
    buildStoryboard();
    buildVideoJson();
    setStep(1);
  });

  $("copyScriptBtn").addEventListener("click", () => copyText($("scriptOutput").value, "脚本已复制"));
  $("copyTranslatedScriptBtn").addEventListener("click", () => copyText($("translatedScriptOutput").value, "翻译版口播已复制"));
  $("copyStoryBtn").addEventListener("click", () => copyText($("storyJsonOutput").value, "图片 JSON 已复制"));
  $("copyVideoJsonBtn").addEventListener("click", () => copyText($("videoJsonOutput").value, "影片 JSON 已复制"));

  $("downloadScriptBtn").addEventListener("click", () => downloadText("tiktok-script.txt", $("scriptOutput").value));
  $("downloadTranslatedScriptBtn").addEventListener("click", () => {
    const target = $("translationTarget").value || "zh";
    downloadText(`tiktok-script-${target}.txt`, $("translatedScriptOutput").value);
  });
  $("downloadStoryBtn").addEventListener("click", () => downloadText("image-prompts.json", $("storyJsonOutput").value, "application/json"));
  $("downloadVideoJsonBtn").addEventListener("click", () => downloadText("separate-video-prompts.json", $("videoJsonOutput").value, "application/json"));

  ["storyboardVideoCount", "videoClipCount"].forEach((id) => {
    $(id).addEventListener("change", () => {
      syncVideoCount($(id).value);
      if ($("storyJsonOutput").value.trim() || $("videoJsonOutput").value.trim() || state.storyboard.length || state.videoJson) {
        clearGeneratedOutputs();
        saveDraft();
        showToast("影片数量已改变，请重新生成图片 JSON 和影片 JSON");
      } else {
        saveDraft();
      }
    });
  });

  $("videoMaxSeconds").addEventListener("change", () => {
    if ($("videoJsonOutput").value.trim() || state.videoJson) {
      buildVideoJson();
    } else {
      saveDraft();
    }
  });

  $("translationTarget").addEventListener("change", saveDraft);
  $("language").addEventListener("change", () => {
    const code = getLanguageCode($("language").value);
    $("translationTarget").value = code;
    renderCtaPresetOptions();
    if ($("storyJsonOutput").value.trim() || $("videoJsonOutput").value.trim() || state.storyboard.length || state.videoJson) {
      clearGeneratedOutputs();
      showToast("语言已切换，请重新生成图片和影片 JSON");
    }
    saveDraft();
  });

  $("loadDemoBtn").addEventListener("click", loadDemo);
  $("clearBtn").addEventListener("click", clearAll);

  $("clipInput").addEventListener("change", (event) => {
    state.clips = Array.from(event.target.files || []);
    renderClipList();
    updateRenderSupport();
  });

}

bindEvents();
loadDraft();
renderStoryboardCards(state.storyboard);
renderSingleImageJsonCards(null);
renderVideoPlanPreview(state.videoJson);
updateCharacterStatus();
updateVoiceCloneStatus();
updateRenderSupport();
