(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var form = document.getElementById("generatorForm");
  var brandInput = document.getElementById("brandName");
  var productInput = document.getElementById("productType");
  var audienceInput = document.getElementById("targetAudience");
  var descriptionInput = document.getElementById("productDescription");
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

  // Product image upload elements
  var uploadDropzone = document.getElementById("uploadDropzone");
  var productImageInput = document.getElementById("productImageInput");
  var uploadPrompt = document.getElementById("uploadPrompt");
  var uploadPreview = document.getElementById("uploadPreview");
  var uploadPreviewImg = document.getElementById("uploadPreviewImg");
  var uploadFileName = document.getElementById("uploadFileName");
  var uploadFileSize = document.getElementById("uploadFileSize");
  var uploadRemoveBtn = document.getElementById("uploadRemoveBtn");

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

  // -----------------------------------------------------------------------
  // Product image upload — drag & drop, click-to-upload, preview, validation
  // -----------------------------------------------------------------------
  var ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
  var currentImageObjectUrl = null; // tracked so we can revoke it and avoid memory leaks
  var selectedProductImage = null; // holds the currently-accepted File, if any

  if (uploadDropzone && productImageInput) {
    var uploadField = uploadDropzone.closest(".field");

    // Click anywhere on the dropzone opens the file picker, except when the
    // click originated on the Remove button (handled separately below).
    uploadDropzone.addEventListener("click", function (e) {
      if (uploadRemoveBtn && uploadRemoveBtn.contains(e.target)) return;
      productImageInput.click();
    });

    // Keyboard support: Enter / Space activates the dropzone like a button.
    uploadDropzone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        productImageInput.click();
      }
    });

    productImageInput.addEventListener("change", function () {
      var file = productImageInput.files && productImageInput.files[0];
      if (file) handleImageFile(file);
    });

    // Drag & drop
    ["dragenter", "dragover"].forEach(function (evtName) {
      uploadDropzone.addEventListener(evtName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        uploadDropzone.classList.add("is-dragover");
      });
    });
    ["dragleave", "dragend"].forEach(function (evtName) {
      uploadDropzone.addEventListener(evtName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        uploadDropzone.classList.remove("is-dragover");
      });
    });
    uploadDropzone.addEventListener("drop", function (e) {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.remove("is-dragover");
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleImageFile(file);
    });

    if (uploadRemoveBtn) {
      uploadRemoveBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        clearProductImage();
        uploadDropzone.focus();
      });
    }

    function handleImageFile(file) {
      // Validate type
      if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1) {
        showImageError();
        return;
      }
      // Validate size
      if (file.size > MAX_IMAGE_BYTES) {
        showImageError();
        return;
      }

      if (uploadField) uploadField.classList.remove("invalid");
      selectedProductImage = file;

      // Revoke any previous preview URL before creating a new one — this is
      // cheaper and faster than re-reading the file with a FileReader, and
      // keeps the preview responsive even for larger images.
      if (currentImageObjectUrl) URL.revokeObjectURL(currentImageObjectUrl);
      currentImageObjectUrl = URL.createObjectURL(file);

      uploadPreviewImg.src = currentImageObjectUrl;
      uploadPreviewImg.alt = "Preview of " + file.name;
      uploadFileName.textContent = file.name;
      uploadFileSize.textContent = formatFileSize(file.size);

      uploadPrompt.hidden = true;
      uploadPreview.hidden = false;
      uploadDropzone.classList.add("has-image");
      uploadDropzone.setAttribute("aria-label", "Product image selected: " + file.name + ". Press the Remove button to replace it.");
    }

    function clearProductImage() {
      selectedProductImage = null;
      productImageInput.value = "";
      if (currentImageObjectUrl) {
        URL.revokeObjectURL(currentImageObjectUrl);
        currentImageObjectUrl = null;
      }
      uploadPreviewImg.src = "";
      uploadPreview.hidden = true;
      uploadPrompt.hidden = false;
      uploadDropzone.classList.remove("has-image");
      uploadDropzone.setAttribute("aria-label", "Upload product image. Click, or drag and drop a JPG, PNG or WEBP file here.");
    }

    function showImageError() {
      if (uploadField) uploadField.classList.add("invalid");
      productImageInput.value = "";
    }

    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }
  }

  // Downscales/compresses the selected image on a <canvas> before it's sent
  // to the AI. This keeps the request payload small and fast to upload
  // (well under serverless body-size limits) regardless of how large the
  // original photo was, without the user ever seeing a slowdown — the
  // on-screen preview above already uses a cheap object URL, so this cost
  // is only paid once, right before submission.
  function compressImageForUpload(file) {
    var MAX_DIMENSION = 1600;
    var JPEG_QUALITY = 0.85;

    return new Promise(function (resolve, reject) {
      var objectUrl = URL.createObjectURL(file);
      var img = new Image();

      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        try {
          var scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
          var outW = Math.max(1, Math.round(img.naturalWidth * scale));
          var outH = Math.max(1, Math.round(img.naturalHeight * scale));

          var canvas = document.createElement("canvas");
          canvas.width = outW;
          canvas.height = outH;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, outW, outH);

          var dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
          var base64 = dataUrl.split(",")[1];
          if (!base64) throw new Error("Empty image data");

          resolve({ data: base64, mimeType: "image/jpeg" });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not read the selected image."));
      };
      img.src = objectUrl;
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (generateBtn.disabled) return;

    var valid = validateFields();
    if (!valid) return;

    var data = {
      brandName: brandInput.value.trim(),
      productType: productInput.value.trim(),
      targetAudience: audienceInput.value.trim(),
      productDescription: descriptionInput ? descriptionInput.value.trim() : "",
      language: languageSelect.value,
      goal: goalSelect.value,
      tone: toneSelect.value,
      contentType: contentTypeSelect.value,
      platform: platformSelect.value
    };

    var t = COPY[data.language] || COPY.en;

    if (selectedProductImage) {
      // Show immediate feedback while the image is prepared for upload —
      // this step is fast (client-side canvas resize) but still worth a
      // dedicated status message so it never looks like nothing happened.
      startLoadingUI(t.analyzing || t.loading);

      compressImageForUpload(selectedProductImage)
        .then(function (image) {
          data.productImage = image; // { data: base64 (no prefix), mimeType: "image/jpeg" }
          runGeneration(data, t);
        })
        .catch(function () {
          var uploadFieldWrap = uploadDropzone && uploadDropzone.closest(".field");
          if (uploadFieldWrap) uploadFieldWrap.classList.add("invalid");
          resetLoadingUI();
          resultTitle.textContent = "Your content will appear here";
        });
    } else {
      runGeneration(data, t);
    }
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
      analyzing: "Analyzing your product image…",
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
      analyzing: "جارٍ تحليل صورة المنتج…",
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
      analyzing: "Analyse de votre image produit…",
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

  // Shared loading-state UI, used both while the image is being prepared
  // and while the AI request is in flight.
  function startLoadingUI(label) {
    generateBtn.disabled = true;
    generateBtn.classList.add("is-loading");
    loadingLabel.textContent = label;

    emptyState.hidden = true;
    outputState.hidden = true;
    loadingState.hidden = false;
    copyBtn.hidden = true;
    resultDot.classList.remove("is-ready");
    resultTitle.textContent = label;
  }

  function resetLoadingUI() {
    generateBtn.disabled = false;
    generateBtn.classList.remove("is-loading");
    loadingState.hidden = true;
  }

  function runGeneration(data, t) {
    t = t || COPY[data.language] || COPY.en;

    startLoadingUI(t.loading);

    fetchContent(data)
      .then(function (content) {
        renderOutput(content, t);

        resetLoadingUI();
        outputState.hidden = false;
        copyBtn.hidden = false;
        resultDot.classList.add("is-ready");
        resultTitle.textContent = t.ready;
      })
      .catch(function (err) {
        resetLoadingUI();
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
