const BACKEND_URL = "https://pharma-guard-three.vercel.app";

const DRUGS = [
  ["CODEINE", "Pain relief (opioid)"],
  ["WARFARIN", "Blood thinner"],
  ["CLOPIDOGREL", "Antiplatelet"],
  ["SIMVASTATIN", "Cholesterol lowering"],
  ["AZATHIOPRINE", "Immunosuppressant"],
  ["FLUOROURACIL", "Chemotherapy"],
];

const selectedDrugs = new Set();
const drugGrid = document.getElementById("drugGrid");

DRUGS.forEach(([name, description]) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "drug";
  button.innerHTML = `<strong>${name}</strong><small>${description}</small>`;
  button.addEventListener("click", () => {
    if (selectedDrugs.has(name)) {
      selectedDrugs.delete(name);
      button.classList.remove("selected");
    } else {
      selectedDrugs.add(name);
      button.classList.add("selected");
    }
  });
  drugGrid.appendChild(button);
});

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("vcfFile");
const fileInfo = document.getElementById("fileInfo");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (event) => event.preventDefault());
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file) setFile(file);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

function setFile(file) {
  if (!file.name.toLowerCase().endsWith(".vcf")) {
    showError("Please select a .vcf file.");
    return;
  }

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;

  fileInfo.textContent = `✓ ${file.name} • ${(file.size / 1024).toFixed(1)} KB`;
  fileInfo.classList.remove("hidden");
  dropZone.classList.add("hidden");
  clearError();
}

document.getElementById("analyzeBtn").addEventListener("click", analyze);

async function analyze() {
  clearError();

  const file = fileInput.files[0];

  if (!file) {
    showError("Please upload a VCF file first.");
    return;
  }

  if (selectedDrugs.size === 0) {
    showError("Please select at least one medication.");
    return;
  }

  const loading = document.getElementById("loading");
  const button = document.getElementById("analyzeBtn");

  loading.classList.remove("hidden");
  button.disabled = true;

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("drugs", [...selectedDrugs].join(","));

    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Server error: ${response.status}`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    if (!Array.isArray(data)) {
      throw new Error("Unexpected server response.");
    }

    renderResults(data);
  } catch (error) {
    console.error(error);
    showError(`Analysis failed: ${error.message}`);
  } finally {
    loading.classList.add("hidden");
    button.disabled = false;
  }
}

function renderResults(items) {
  document.getElementById("countLabel").textContent =
    `${items.length} drug(s) analyzed`;

  document.getElementById("results").innerHTML = items
    .map((item) => {
      const risk = item.risk_assessment;
      const profile = item.pharmacogenomic_profile;
      const variants = profile.detected_variants || [];
      const riskClass = risk.risk_label.toLowerCase().replace(" ", "-");

      return `
      <article class="result-card">
        <div class="result-top">
          <div>
            <h3>${escapeHtml(item.drug)}</h3>
            <div class="subline">
              ${escapeHtml(profile.primary_gene)} •
              ${escapeHtml(profile.diplotype)} •
              ${escapeHtml(profile.phenotype)} metabolizer
            </div>
          </div>
          <span class="risk ${riskClass}">
            ${escapeHtml(risk.risk_label)}
          </span>
        </div>

        <div class="metric">
          <div class="metric-row">
            <span>Confidence</span>
            <strong>${Math.round(risk.confidence_score * 100)}%</strong>
          </div>
          <div class="bar">
            <span style="width:${Math.min(100, Math.max(0, risk.confidence_score * 100))}%"></span>
          </div>
          <div class="severity">
            Severity: ${escapeHtml(risk.severity)}
          </div>
        </div>

        <div class="profile">
          <div class="profile-title">⌁ Genetic Profile</div>

          <div class="profile-grid">
            <div class="profile-item">
              <span>Gene</span>
              <strong>${escapeHtml(profile.primary_gene)}</strong>
            </div>
            <div class="profile-item">
              <span>Diplotype</span>
              <strong>${escapeHtml(profile.diplotype)}</strong>
            </div>
            <div class="profile-item">
              <span>Phenotype</span>
              <strong>${escapeHtml(profile.phenotype)}</strong>
            </div>
          </div>

          <div class="profile-item" style="margin-top:12px">
            <span>Variants Detected</span>
            <strong>${variants.length}</strong>
          </div>

          <div class="variants">
            ${
              variants.length
                ? variants
                    .map(
                      (v) =>
                        `<span class="variant">${escapeHtml(v.rsid)}</span>`,
                    )
                    .join("")
                : "<span class='subline'>None detected</span>"
            }
          </div>
        </div>

        <details class="accordion">
          <summary>Clinical Recommendation</summary>
          <div class="recommendation">
            ${escapeHtml(item.clinical_recommendation.recommendation)}
          </div>
        </details>

        <details class="accordion" open>
          <summary>AI Explanation</summary>
          <div class="explanation">
            ${escapeHtml(item.llm_generated_explanation.summary || "No explanation returned.")}
          </div>
        </details>
      </article>
    `;
    })
    .join("");

  document.getElementById("resultsSection").classList.remove("hidden");
  document
    .getElementById("resultsSection")
    .scrollIntoView({ behavior: "smooth" });
}

function showError(message) {
  const error = document.getElementById("error");
  error.textContent = message;
  error.classList.remove("hidden");
}

function clearError() {
  document.getElementById("error").classList.add("hidden");
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}
