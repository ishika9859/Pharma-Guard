import os
from groq import Groq

# Use environment variable for safety
client = Groq(api_key=os.getenv("GROQ_API_KEY"))





def generate_explanation(
    gene,
    diplotype,
    phenotype,
    drug,
    risk_label,
    severity,
    rsids
):
    rsid_text = ", ".join(rsids) if rsids else "None detected"

    prompt = f"""
You are a board-certified clinical pharmacogenomics specialist.

You must explain pharmacogenomic impact STRICTLY using the structured data provided.
Do NOT reinterpret allele function.
Do NOT assume functional impact beyond the provided phenotype.
Do NOT change the risk label.
Do NOT speculate.

Structured Data:
Gene: {gene}
Diplotype: {diplotype}
Phenotype: {phenotype}
Drug: {drug}
Risk Label: {risk_label}
Severity: {severity}
Detected rsIDs: {rsid_text}

Instructions:
- Base explanation ONLY on phenotype and risk label.
- Follow CPIC-aligned reasoning.
- Do NOT infer star allele activity beyond phenotype.
- Do NOT add speculative biology.
- Keep under 8 sentences total.
- Write in professional clinical tone.
- Do NOT use markdown or headings.
- Write as structured paragraphs in this order:
  1) Summary
  2) Biological mechanism
  3) Clinical impact
  4) Recommendation rationale
"""

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": "You are a clinical pharmacogenomics expert following CPIC guidelines strictly."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,  # lower hallucination
            max_tokens=1000
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        return f"LLM explanation unavailable due to error: {str(e)}"
