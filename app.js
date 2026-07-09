(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var form = document.getElementById("generatorForm");
  var brandInput = document.getElementById("brandName");
  var productInput = document.getElementById("productType");
  var audienceInput = document.getElementById("targetAudience");
  var languageSelect = document.getElementById("language");

  var generateBtn = document.getElementById("generateBtn");
  var resultTitle = document.getElementById("resultTitle");
  var resultDot = document.getElementById("resultDot");
  var copyBtn = document.getElementById("copyBtn");
  var copyLabel = document.getElementById("copyLabel");

  var emptyState = document.getElementById("emptyState");
  var loadingState = document.getElementById("loadingState");
  var loadingLabel = document.getElementById("loadingLabel");
  var outputState = document.getElementById("outputState");

  var fields = [
    { el: brandInput, key: "brandName" },
    { el: productInput, key: "productType" },
    { el: audienceInput, key: "targetAudience" }
  ];

  // Clear inline error as soon as the person starts fixing a field
  fields.forEach(function (f) {
    f.el.addEventListener("input", function () {
      f.el.closest(".field").classList.remove("invalid");
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (generateBtn.disabled) return;

    var valid = validateFields();
    if (!valid) return;

    var data = {
      brandName: brandInput.value.trim(),
      productType: productInput.value.trim(),
      targetAudience: audienceInput.value.trim(),
      language: languageSelect.value
    };

    runGeneration(data);
  });

  function validateFields() {
    var allValid = true;
    fields.forEach(function (f) {
      var wrap = f.el.closest(".field");
      if (f.el.value.trim().length === 0) {
        wrap.classList.add("invalid");
        allValid = false;
      } else {
        wrap.classList.remove("invalid");
      }
    });
    if (!allValid) {
      var firstInvalid = form.querySelector(".field.invalid input");
      if (firstInvalid) firstInvalid.focus();
    }
    return allValid;
  }

  var COPY = {
    en: {
      loading: "Plotting your content…",
      ready: "Content ready",
      copy: "Copy",
      copied: "Copied",
      tagline: "Tagline",
      description: "Product description",
      social: "Social media post",
      hashtags: "Suggested hashtags"
    },
    ar: {
      loading: "جارٍ صياغة المحتوى…",
      ready: "المحتوى جاهز",
      copy: "نسخ",
      copied: "تم النسخ",
      tagline: "الشعار الإعلاني",
      description: "وصف المنتج",
      social: "منشور لوسائل التواصل",
      hashtags: "وسوم مقترحة"
    },
    fr: {
      loading: "Rédaction de votre contenu…",
      ready: "Contenu prêt",
      copy: "Copier",
      copied: "Copié",
      tagline: "Slogan",
      description: "Description du produit",
      social: "Publication réseaux sociaux",
      hashtags: "Hashtags suggérés"
    }
  };

  function runGeneration(data) {
    var t = COPY[data.language] || COPY.en;

    // Loading UI
    generateBtn.disabled = true;
    generateBtn.classList.add("is-loading");
    loadingLabel.textContent = t.loading;

    emptyState.hidden = true;
    outputState.hidden = true;
    loadingState.hidden = false;
    copyBtn.hidden = true;
    resultDot.classList.remove("is-ready");
    resultTitle.textContent = t.loading;

    window.setTimeout(function () {
      var content = buildContent(data);
      renderOutput(content, t);

      generateBtn.disabled = false;
      generateBtn.classList.remove("is-loading");
      loadingState.hidden = true;
      outputState.hidden = false;
      copyBtn.hidden = false;
      resultDot.classList.add("is-ready");
      resultTitle.textContent = t.ready;
    }, 1100);
  }

  function renderOutput(content, t) {
    outputState.dir = content.dir;
    outputState.innerHTML =
      block(t.tagline, "<p class=\"output-text\">" + escapeHtml(content.tagline) + "</p>") +
      block(t.description, "<p class=\"output-text\">" + escapeHtml(content.description) + "</p>") +
      block(t.social, "<p class=\"output-text\">" + escapeHtml(content.social) + "</p>") +
      block(t.hashtags, "<div class=\"output-tags\">" + content.hashtags.map(function (h) {
        return "<span class=\"output-tag\">" + escapeHtml(h) + "</span>";
      }).join("") + "</div>");

    copyBtn.onclick = function () {
      var text = [
        t.tagline + ": " + content.tagline,
        "",
        t.description + ": " + content.description,
        "",
        t.social + ": " + content.social,
        "",
        t.hashtags + ": " + content.hashtags.join(" ")
      ].join("\n");

      copyToClipboard(text).then(function () {
        var original = t.copy;
        copyLabel.textContent = t.copied;
        window.setTimeout(function () { copyLabel.textContent = original; }, 1600);
      });
    };
    copyLabel.textContent = t.copy;
  }

  function block(label, innerHtml) {
    return "<div class=\"output-block\"><p class=\"output-label\">" + escapeHtml(label) + "</p>" + innerHtml + "</div>";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
    return Promise.resolve();
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (err) { /* no-op */ }
    document.body.removeChild(ta);
  }

  // ---- Lightweight, local "generation" so the UI works standalone. ----
  // Swap the body of this function for a real API call when a backend is connected.
  function buildContent(data) {
    var brand = data.brandName;
    var product = data.productType;
    var audience = data.targetAudience;

    var hashSeed = (brand + product).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "");

    if (data.language === "ar") {
      return {
        dir: "rtl",
        tagline: brand + " — حيث يلتقي " + product + " باحتياجات " + audience + ".",
        description: "تقدّم " + brand + " تجربة مميزة في مجال " + product + "، صُممت خصيصًا لتناسب " + audience + ". جودة تستحق الثقة، وتفاصيل تُحدث فرقًا حقيقيًا في يومك.",
        social: "✨ تعرّف على " + brand + ". " + product + " الذي طالما انتظرته، مصمم من أجلك أنت يا " + audience + ". جرّبه اليوم!",
        hashtags: ["#" + brand.replace(/\s+/g, ""), "#" + hashSeed, "#جودة_تستحق"]
      };
    }

    if (data.language === "fr") {
      return {
        dir: "ltr",
        tagline: brand + " — votre " + product + " pensé pour " + audience + ".",
        description: brand + " réinvente " + product + " avec une exigence de qualité pensée pour " + audience + ". Chaque détail est conçu pour s'intégrer naturellement à votre quotidien.",
        social: "✨ Découvrez " + brand + ". Le " + product + " que " + audience + " attendait. Essayez-le dès aujourd'hui !",
        hashtags: ["#" + brand.replace(/\s+/g, ""), "#" + hashSeed, "#QualitéAuQuotidien"]
      };
    }

    return {
      dir: "ltr",
      tagline: brand + " — " + product + ", made for " + audience + ".",
      description: brand + " brings a fresh take on " + product + ", crafted with " + audience + " in mind. Thoughtful details, dependable quality, and a look that fits right into your day.",
      social: "✨ Meet " + brand + ". The " + product + " " + audience + " have been waiting for. Try it today!",
      hashtags: ["#" + brand.replace(/\s+/g, ""), "#" + hashSeed, "#MadeForYou"]
    };
  }
})();
