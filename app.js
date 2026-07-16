(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var form = document.getElementById("generatorForm");
  var brandInput = document.getElementById("brandName");
  var productInput = document.getElementById("productType");
  var audienceInput = document.getElementById("targetAudience");
  var languageSelect = document.getElementById("language");
  var goalSelect = document.getElementById("goal");
  var toneSelect = document.getElementById("tone");
var contentTypeSelect = document.getElementById("contentType");
var platformSelect = document.getElementById("platform");

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
  language: languageSelect.value,
  goal: goalSelect.value,
  tone: toneSelect.value,
  contentType: contentTypeSelect.value,
  platform: platformSelect.value
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
      error: "Something went wrong. Please try again.",
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
      error: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
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
      error: "Une erreur est survenue. Veuillez réessayer.",
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

    fetchContent(data)
      .then(function (content) {
        renderOutput(content, t);

        generateBtn.disabled = false;
        generateBtn.classList.remove("is-loading");
        loadingState.hidden = true;
        outputState.hidden = false;
        copyBtn.hidden = false;
        resultDot.classList.add("is-ready");
        resultTitle.textContent = t.ready;
      })
      .catch(function (err) {
        generateBtn.disabled = false;
        generateBtn.classList.remove("is-loading");
        loadingState.hidden = true;
        copyBtn.hidden = true;
        resultDot.classList.remove("is-ready");
        resultTitle.textContent = t.error || "Something went wrong";

        outputState.hidden = false;
        outputState.dir = "ltr";
        outputState.innerHTML =
          "<p class=\"output-text\">" + escapeHtml(err && err.message ? err.message : String(err)) + "</p>";
      });
  }

  function fetchContent(data) {
    return fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        if (!res.ok) {
          return res
            .json()
            .catch(function () { return null; })
            .then(function (body) {
              var message =
  (body && (body.details || body.error)) ||
  ("Request failed with status " + res.status);
              throw new Error(message);
            });
        }
        return res.json();
      })
      .then(function (content) {
        if (!content || typeof content !== "object") {
          throw new Error("Unexpected response from server");
        }
        return content;
      });
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
})();
