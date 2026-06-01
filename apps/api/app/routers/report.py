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
        "You are a senior strategic analyst. "
        "Given a structured reasoning graph produced by an AI evaluation assistant, "
        "write a comprehensive, well-structured analysis report in Markdown. "
        "The report must include:\n"
        "- An executive summary (2-3 sentences)\n"
        "- A section-by-section breakdown of every reasoning node, preserving their logical order\n"
        "- Key assumptions and their risk level\n"
        "- Decision path analysis (what leads to each outcome)\n"
        "- A final recommendation with supporting rationale\n"
        "Use clear headings (##, ###), bullet points, and **bold** for key terms. "
        "Be analytical, balanced, and concise."
    )

    user_prompt = (
        f"Original question: {request.query}\n\n"
        f"Reasoning graph:\n{graph_context}\n\n"
        "Write the full analysis report now."
    )

    try:
        response = await groq_client.chat.completions.create(
            model=GROQ_MODELS["standard"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=2048,
        )
        report_md = response.choices[0].message.content or ""
    except Exception as e:
        log.error("report.llm.failed", error=str(e))
        # Graceful fallback: assemble a basic structured report without LLM
        report_md = _fallback_report(request.query, request.graph)

    return {"report": report_md}


def _fallback_report(query: str, graph: dict) -> str:
    """Static markdown report used when the LLM call fails."""
    sorted_nodes = sorted(
        graph.get("nodes", []),
        key=lambda n: (n.get("stage", 99), n.get("row", 0)),
    )
    lines = [f"## Analysis Report", f"", f"**Question:** {query}", f""]
    for i, node in enumerate(sorted_nodes, 1):
        label = node.get("label", f"Step {i}")
        insight = node.get("insight", "")
        explanation = node.get("explanation", "")
        assumptions = node.get("assumptions", []) or []
        citations = node.get("citations", []) or []
        assumptions = [a if isinstance(a, str) else json.dumps(a) for a in assumptions]
        citations = [c if isinstance(c, str) else (c.get("url") or c.get("title") or json.dumps(c)) if isinstance(c, dict) else str(c) for c in citations]
        lines.append(f"### Step {i}: {label}")
        if insight:
            lines.append(f"**{insight}**")
            lines.append("")
        if explanation:
            lines.append(explanation)
            lines.append("")
        notes = []
        if assumptions:
            notes.append(f"_Assumes: {', '.join(assumptions[:3])}_")
        if citations:
            notes.append(f"_Sources: {', '.join(citations[:3])}_")
        if notes:
            lines.append(" — ".join(notes))
            lines.append("")
        lines.append("---")
        lines.append("")
    return "\n".join(lines)
