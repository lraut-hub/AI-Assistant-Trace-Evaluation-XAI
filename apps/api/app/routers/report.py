"""Report generation from reasoning graph using LLM for a full narrative analysis."""
from fastapi import APIRouter
from pydantic import BaseModel
import json
import structlog
from app.services.llm import groq_client, GROQ_MODELS

log = structlog.get_logger()
router = APIRouter()


class ReportRequest(BaseModel):
    query: str
    graph: dict


def _graph_to_context(graph: dict) -> str:
    """Serialise the reasoning graph into a compact text block for the LLM prompt."""
    sorted_nodes = sorted(
        graph.get("nodes", []),
        key=lambda n: (n.get("stage", 99), n.get("row", 0)),
    )
    lines = []
    for i, node in enumerate(sorted_nodes, 1):
        label = node.get("label", f"Node {i}")
        insight = node.get("insight", "")
        explanation = node.get("explanation", "")
        node_type = node.get("type", "analysis")
        assumptions = node.get("assumptions", []) or []
        citations = node.get("citations", []) or []
        # Safely coerce list items to strings (LLM may return dicts)
        assumptions = [a if isinstance(a, str) else json.dumps(a) for a in assumptions]
        citations = [c if isinstance(c, str) else (c.get("url") or c.get("title") or json.dumps(c)) if isinstance(c, dict) else str(c) for c in citations]

        lines.append(f"Node {i} [{node_type.upper()}]: {label}")
        if insight:
            lines.append(f"  Insight: {insight}")
        if explanation:
            # Truncate very long explanations to keep token count reasonable
            short_exp = explanation[:400] + ("..." if len(explanation) > 400 else "")
            lines.append(f"  Explanation: {short_exp}")
        if assumptions:
            lines.append(f"  Assumptions: {', '.join(assumptions[:3])}")
        if citations:
            lines.append(f"  Citations: {', '.join(citations[:3])}")
        lines.append("")

    edges = graph.get("edges", [])
    if edges:
        lines.append("Decision Paths:")
        for edge in edges:
            src = edge.get("source", "?")
            tgt = edge.get("target", "?")
            lbl = edge.get("label", "")
            lines.append(f"  {src} --[{lbl}]--> {tgt}" if lbl else f"  {src} --> {tgt}")

    return "\n".join(lines)


@router.post("/eval/report")
@router.post("/trace/report")
async def generate_report(request: ReportRequest):
    """Generate a full narrative analysis report using an LLM from the reasoning graph."""
    graph_context = _graph_to_context(request.graph)

    system_prompt = (
        "You are a senior strategic analyst producing a Structural Thinking analysis. "
        "Given a structured reasoning graph produced by an AI evaluation assistant, "
        "write a comprehensive analysis report in Markdown following EXACTLY this 10-section structure:\n\n"
        "## 1. Problem Definition\n"
        "Clearly state the core question or decision at hand.\n\n"
        "## 2. Key Assumptions\n"
        "List assumptions in three sub-sections:\n"
        "### Explicit Assumptions\n"
        "Stated or obvious assumptions.\n"
        "### Inferred Assumptions\n"
        "Assumptions derived from context.\n"
        "### Missing Information\n"
        "Data or context that is absent but would improve the analysis.\n\n"
        "## 3. Context Mapping\n"
        "Describe the broader context — market, stakeholders, timing, constraints.\n\n"
        "## 4. Evidence & Signals\n"
        "Present supporting data, trends, signals. Attach inline citation markers like [1], [2] to every claim.\n\n"
        "## 5. Analysis Framework\n"
        "Describe the analytical framework used (SWOT, cost-benefit, first-principles, etc.).\n\n"
        "## 6. Alternative Perspectives\n"
        "Present at least 2 contrarian or alternative viewpoints.\n\n"
        "## 7. Risks & Uncertainties\n"
        "Identify key risks, probability assessments, and mitigation strategies.\n\n"
        "## 8. Decision Support\n"
        "Provide a decision matrix or structured comparison of options.\n\n"
        "## 9. Final Recommendation\n"
        "Give a clear, actionable recommendation with supporting rationale.\n\n"
        "## 10. Confidence Level\n"
        "State your confidence level (Low / Medium / High) with justification.\n\n"
        "## References\n"
        "List all citations referenced as [1], [2], etc.\n\n"
        "RULES:\n"
        "- Use inline citation markers [1], [2] etc. attached to claims, evidence, and conclusions.\n"
        "- Use clear headings (##, ###), bullet points, and **bold** for key terms.\n"
        "- Be analytical, balanced, and concise.\n"
        "- Every section must be present even if brief."
    )

    user_prompt = (
        f"Original question: {request.query}\n\n"
        f"Reasoning graph:\n{graph_context}\n\n"
        "Write the full Structural Thinking analysis report now."
    )

    try:
        response = await groq_client.chat.completions.create(
            model=GROQ_MODELS["standard"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=3000,
        )
        report_md = response.choices[0].message.content or ""
    except Exception as e:
        log.error("report.llm.failed", error=str(e))
        # Graceful fallback: assemble a basic structured report without LLM
        report_md = _fallback_report(request.query, request.graph)

    return {"report": report_md}


def _fallback_report(query: str, graph: dict) -> str:
    """Static markdown report matching the 10-section Structural Thinking format."""
    sorted_nodes = sorted(
        graph.get("nodes", []),
        key=lambda n: (n.get("stage", 99), n.get("row", 0)),
    )

    # Collect all assumptions and citations across nodes
    all_assumptions = []
    all_citations = []
    for node in sorted_nodes:
        assumptions = node.get("assumptions", []) or []
        citations = node.get("citations", []) or []
        assumptions = [a if isinstance(a, str) else json.dumps(a) for a in assumptions]
        citations = [c if isinstance(c, str) else (c.get("url") or c.get("title") or json.dumps(c)) if isinstance(c, dict) else str(c) for c in citations]
        all_assumptions.extend(assumptions)
        all_citations.extend(citations)

    # Build node summaries for Evidence section
    evidence_lines = []
    for i, node in enumerate(sorted_nodes, 1):
        label = node.get("label", f"Step {i}")
        insight = node.get("insight", "")
        explanation = node.get("explanation", "")
        short_exp = explanation[:300] + ("..." if len(explanation) > 300 else "") if explanation else ""
        evidence_lines.append(f"- **{label}**: {insight}")
        if short_exp:
            evidence_lines.append(f"  {short_exp}")

    lines = [
        f"## 1. Problem Definition", "",
        f"**Question:** {query}", "",

        f"## 2. Key Assumptions", "",
        f"### Explicit Assumptions",
        *([f"- {a}" for a in all_assumptions[:3]] if all_assumptions else ["- _No explicit assumptions identified._"]),
        "",
        f"### Inferred Assumptions",
        "- _Analysis based on available graph data._", "",
        f"### Missing Information",
        "- _Additional context may improve this analysis._", "",

        f"## 3. Context Mapping", "",
        "Context derived from the reasoning graph nodes above.", "",

        f"## 4. Evidence & Signals", "",
        *evidence_lines, "",

        f"## 5. Analysis Framework", "",
        "Structured reasoning graph with multi-node analysis.", "",

        f"## 6. Alternative Perspectives", "",
        "- _Alternative viewpoints were not generated due to LLM unavailability._", "",

        f"## 7. Risks & Uncertainties", "",
        "- _Risk assessment unavailable — LLM fallback active._", "",

        f"## 8. Decision Support", "",
        "- Review the reasoning graph canvas for decision pathways.", "",

        f"## 9. Final Recommendation", "",
        "- _Please regenerate with LLM for a detailed recommendation._", "",

        f"## 10. Confidence Level", "",
        "**Low** — This is a fallback report without LLM analysis.", "",

        f"## References", "",
        *([f"[{i+1}] {c}" for i, c in enumerate(all_citations[:5])] if all_citations else ["_No citations available._"]),
        "",
    ]
    return "\n".join(lines)
