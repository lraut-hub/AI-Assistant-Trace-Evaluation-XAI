"""Trace agent using LangGraph — non-linear reasoning with gates and parallel flows."""
import json
import uuid
from datetime import datetime
from typing import TypedDict, Optional, Any
from langgraph.graph import StateGraph, END
from app.services.llm import groq_client, GROQ_MODELS
from app.services.document_service import search_documents
from app.services.web_search_service import search_web
from app.agents.trace_skeleton import build_empty_trace_graph, TRACE_SKELETON_NODES
import structlog

log = structlog.get_logger()

class EvalState(TypedDict):
    query: str
    session_id: str
    domain: Optional[str]
    graph_schema: Optional[dict[str, Any]]
    graph_full: Optional[dict[str, Any]]
    error: Optional[str]

# ── Prompts ───────────────────────────────────────────────────────────────────

DOMAIN_MAP = {
    "market_analysis":   ["enter", "market", "compete", "sector", "industry"],
    "risk_assessment":   ["risk", "threat", "vulnerability", "exposure"],
    "decision_support":  ["should we", "decide", "choose", "option", "trade-off"],
    "strategy":          ["strategy", "roadmap", "plan", "expand", "launch"],
    "research_synthesis":["research", "study", "literature", "findings"],
}

PLANNER_PROMPT = """
You are a Trace framework analyst. The user query requires structured decision tracing —
NOT a linear list of steps. You must populate a FIXED graph skeleton (do not add/remove nodes or edges).

The Trace flow has:
1. FRAME — one goal node
2. SCAN OUTSIDE — three PARALLEL external scans (market, competitors, regulation)
3. GATE 1 — diamond: "Outside favourable?" → Yes continues, No goes to STOP/EXIT
4. ANALYSE INTERNALS — Entry Strategy then Financial Viability (sequential)
5. GATE 2 — diamond: "Can we make it work?" → Yes splits to identity branches, No → STOP/PIVOT
6. MATCH IDENTITY — two PARALLEL paths (new entrant vs OEM/fleet)
7. FINAL DECISION — converged recommendation
8. REVIEW — when to re-evaluate

Query: {query}
Domain: {domain}

Skeleton node IDs (you MUST use these exact ids):
{frame_ids}

For EACH node, provide ONLY:
- "insight": one-line takeaway (max 120 chars). Use status emoji meaning in text if helpful.
- "status": one of green | amber | red | pass | pending | neutral
- For n_frame: also set "label" as "Goal: <short topic>?"
- For scan/analysis/identity/decision nodes: customize "label" sub-title after the slash pattern shown in skeleton

For gates n_gate1 and n_gate2: insight should state Pass or Fail rationale briefly; status should be "pass" if Yes path is supported.

Respond ONLY with JSON:
{{
  "node_updates": [
    {{ "id": "n_market", "label": "Market Potential", "insight": "...", "status": "green" }},
    ...
  ]
}}
"""

REASONER_PROMPT = """
You are a Trace deep-reasoning engine. Populate the complete Trace graph below.

For EVERY node add:
- explanation: 2-4 paragraphs markdown (shown in side inspector, NOT on canvas)
- assumptions: list (inspector only)

For EVERY edge add:
- explanation: why this transition matters (1-2 sentences)

Incorporate evidence into explanations and citations arrays. Gates should explain Yes/No logic.

Query: {query}

Graph JSON:
{graph_schema}

=== EVIDENCE ===
{evidence}
================

Return the COMPLETE graph JSON with all original node ids, edge ids, trace_stage, type, row, stage fields preserved.
Do not remove nodes or edges. Add populated explanation, assumptions, citations fields.
"""

REVISE_NODE_PROMPT = """
Revise a single Trace node per the directive. Preserve id, type, trace_stage, row, stage.

Query: {query}
Directive: {directive}

Target node:
{target_node}

Context nodes:
{graph_context}

Respond ONLY with the updated node JSON.
"""

# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_trace_structure(skeleton: dict, reasoner_out: dict) -> dict:
    """Merge reasoner output onto skeleton so ids/edges never drift."""
    sk_nodes = {n["id"]: n for n in skeleton.get("nodes", [])}
    out_nodes = {n["id"]: n for n in reasoner_out.get("nodes", [])}
    merged_nodes = []
    for nid, sk in sk_nodes.items():
        out = out_nodes.get(nid, {})
        merged = {**sk, **{k: out[k] for k in ("label", "insight", "status", "explanation", "assumptions", "citations") if k in out}}
        merged_nodes.append(merged)
    sk_edges = {e["id"]: e for e in skeleton.get("edges", [])}
    out_edges = {e["id"]: e for e in reasoner_out.get("edges", [])}
    merged_edges = []
    for eid, sk in sk_edges.items():
        out = out_edges.get(eid, {})
        merged_edges.append({**sk, **{k: out[k] for k in ("label", "branch", "style", "explanation") if k in out}})
    return {
        **skeleton,
        **{k: reasoner_out[k] for k in ("query", "domain") if k in reasoner_out},
        "nodes": merged_nodes,
        "edges": merged_edges,
        "metadata": {**skeleton.get("metadata", {}), **reasoner_out.get("metadata", {})},
    }


def _merge_node_updates(skeleton: dict, updates: list[dict]) -> dict:
    by_id = {u["id"]: u for u in updates if "id" in u}
    for node in skeleton["nodes"]:
        if node["id"] in by_id:
            patch = by_id[node["id"]]
            for key in ("label", "insight", "status"):
                if key in patch and patch[key]:
                    node[key] = patch[key]
    return skeleton


def _skeleton_node_ids_hint() -> str:
    return ", ".join(n["id"] for n in TRACE_SKELETON_NODES)


# ── Nodes ─────────────────────────────────────────────────────────────────────

async def classify_node(state: EvalState):
    query = state["query"].lower()
    domain = "decision_support"
    for d, keywords in DOMAIN_MAP.items():
        if any(kw in query for kw in keywords):
            domain = d
            break
    return {"domain": domain}


async def planner_node(state: EvalState):
    """Build fixed Trace skeleton and let LLM fill insights/labels."""
    graph_id = str(uuid.uuid4())
    skeleton = build_empty_trace_graph(state["query"], graph_id, state["domain"])

    prompt = PLANNER_PROMPT.format(
        query=state["query"],
        domain=state["domain"],
        frame_ids=_skeleton_node_ids_hint(),
    )

    response = await groq_client.chat.completions.create(
        model=GROQ_MODELS["planner"],
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    try:
        data = json.loads(content)
        updates = data.get("node_updates", data.get("nodes", []))
        if isinstance(updates, dict):
            updates = [{"id": k, **v} if isinstance(v, dict) else v for k, v in updates.items()]
        skeleton = _merge_node_updates(skeleton, updates)
        return {"graph_schema": skeleton}
    except json.JSONDecodeError as e:
        log.error("planner.json_decode_error", error=str(e), content=content)
        return {"graph_schema": skeleton}


async def reasoner_node(state: EvalState):
    if state.get("error"):
        return state

    retrieved_docs = search_documents(state["query"], n_results=3)
    evidence_lines = []

    if retrieved_docs:
        for d in retrieved_docs:
            evidence_lines.append(
                f"Doc: {d['metadata'].get('filename')} | Context: {d['content']}"
            )
        log.info("reasoner.rag_retrieved", count=len(retrieved_docs))

    web_results = await search_web(state["query"], max_results=3)
    if web_results:
        for w in web_results:
            evidence_lines.append(f"Web [{w['url']}]: {w['title']} - {w['content']}")
        log.info("reasoner.web_retrieved", count=len(web_results))

    evidence_text = (
        "\n\n".join(evidence_lines)
        if evidence_lines
        else "No additional evidence from knowledge base or web."
    )
    # Trim evidence to stay within Groq free-tier TPM (6000 tokens ≈ 4500 chars)
    if len(evidence_text) > 1500:
        evidence_text = evidence_text[:1500] + "\n...[truncated]"

    prompt = REASONER_PROMPT.format(
        query=state["query"],
        graph_schema=json.dumps(state["graph_schema"]),
        evidence=evidence_text,
    )

    response = await groq_client.chat.completions.create(
        model=GROQ_MODELS["reasoner"],
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    try:
        graph_full = json.loads(content)
        graph_full = _ensure_trace_structure(state["graph_schema"], graph_full)
        if "metadata" not in graph_full:
            graph_full["metadata"] = {}
        graph_full["metadata"]["planner_model"] = GROQ_MODELS["planner"]
        graph_full["metadata"]["reasoner_model"] = GROQ_MODELS["reasoner"]
        graph_full["metadata"]["created_at"] = datetime.utcnow().isoformat()
        graph_full["metadata"]["framework"] = "trace_v1"
        return {"graph_full": graph_full}
    except Exception as e:
        log.error("reasoner.json_decode_error", error=str(e), content=content[:500])
        # Fallback: return schema with minimal population
        schema = state["graph_schema"]
        schema["metadata"] = schema.get("metadata", {})
        schema["metadata"]["reasoner_model"] = GROQ_MODELS["reasoner"]
        schema["metadata"]["framework"] = "trace_v1"
        return {"graph_full": schema, "error": "Reasoner returned invalid JSON; partial graph returned."}


def create_eval_graph():
    graph = StateGraph(EvalState)
    graph.add_node("classify", classify_node)
    graph.add_node("planner", planner_node)
    graph.add_node("reasoner", reasoner_node)

    graph.set_entry_point("classify")
    graph.add_edge("classify", "planner")
    graph.add_edge("planner", "reasoner")
    graph.add_edge("reasoner", END)

    return graph.compile()


eval_graph = create_eval_graph()


async def revise_single_node(query: str, graph: dict, node_id: str, directive: str) -> dict:
    target_node = None
    other_nodes = []
    for n in graph.get("nodes", []):
        if n["id"] == node_id:
            target_node = n
        else:
            other_nodes.append(n)

    if not target_node:
        raise ValueError(f"Node {node_id} not found in graph.")

    prompt = REVISE_NODE_PROMPT.format(
        query=query,
        directive=directive,
        target_node=json.dumps(target_node, indent=2),
        graph_context=json.dumps(other_nodes),
    )

    response = await groq_client.chat.completions.create(
        model=GROQ_MODELS["reasoner"],
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    try:
        updated_node = json.loads(content)
        updated_node["id"] = target_node["id"]
        for key in ("type", "trace_stage", "row", "stage"):
            if key in target_node:
                updated_node[key] = target_node[key]
        return updated_node
    except json.JSONDecodeError as e:
        log.error("revise_node.json_decode_error", error=str(e), content=content)
        raise ValueError("Failed to parse revised node JSON from LLM")
