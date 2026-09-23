from fastapi.middleware.cors import CORSMiddleware

from fastapi import FastAPI, UploadFile, File, Form
from datetime import datetime
import shutil
import os

from vcf_parser import parse_vcf
from gene_rules import construct_diplotypes, get_phenotype
from drug_rules import evaluate_drug_risk
from llm_explainer import generate_explanation
from schema import (
    PharmacogenomicResponse,
    RiskAssessment,
    PharmacogenomicProfile,
    DetectedVariant,
    ClinicalRecommendation,
    LLMGeneratedExplanation,
    QualityMetrics
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    drugs: str = Form(...)
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    variants = parse_vcf(file_path)

    if isinstance(variants, dict) and "error" in variants:
        return {"error": variants["error"]}

    diplotypes = construct_diplotypes(variants)

    phenotypes = {}
    for gene, diplotype in diplotypes.items():
        phenotypes[gene] = get_phenotype(gene, diplotype)

    drug_list = [d.strip().upper() for d in drugs.split(",")]

    responses = []

    for drug in drug_list:
        risk_label, severity, confidence, primary_gene = evaluate_drug_risk(
            drug,
            phenotypes
        )

        if not primary_gene:
            primary_gene = "Unknown"

        # Filter rsids for the primary gene only
        rsids = [
            v["rsid"]
            for v in variants
            if v.get("rsid") and v.get("gene") == primary_gene
        ]

        detected_variants = [
            DetectedVariant(rsid=rsid)
            for rsid in rsids
        ]

        # Generate LLM Explanation
        explanation_text = generate_explanation(
            gene=primary_gene,
            diplotype=diplotypes.get(primary_gene, "Unknown"),
            phenotype=phenotypes.get(primary_gene, "Unknown"),
            drug=drug,
            risk_label=risk_label,
            severity=severity,
            rsids=rsids
        )

        response = PharmacogenomicResponse(
            patient_id="PATIENT_001",
            drug=drug,
            timestamp=datetime.utcnow(),
            risk_assessment=RiskAssessment(
                risk_label=risk_label,
                confidence_score=confidence,
                severity=severity
            ),
            pharmacogenomic_profile=PharmacogenomicProfile(
                primary_gene=primary_gene,
                diplotype=diplotypes.get(primary_gene, "Unknown"),
                phenotype=phenotypes.get(primary_gene, "Unknown"),
                detected_variants=detected_variants
            ),
            clinical_recommendation=ClinicalRecommendation(
                recommendation="Refer to CPIC guidelines for dosing adjustments."
            ),
            llm_generated_explanation=LLMGeneratedExplanation(
                summary=explanation_text
            ),
            quality_metrics=QualityMetrics(
                vcf_parsing_success=True
            )
        )

        responses.append(response.model_dump())

    return responses
