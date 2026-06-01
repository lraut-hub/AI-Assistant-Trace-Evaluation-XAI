"""Fixed Trace framework skeleton — non-linear, gates, parallel scans."""

TRACE_SKELETON_NODES = [
    {"id": "n_frame", "type": "frame", "trace_stage": "frame", "row": 0, "stage": 1,
     "label": "Goal: {topic}?", "insight": "Define objective, scope, and success criteria."},
    {"id": "n_market", "type": "scan", "trace_stage": "scan_outside", "row": 0, "stage": 2,
     "label": "Market Potential", "insight": ""},
    {"id": "n_competitor", "type": "scan", "trace_stage": "scan_outside", "row": 1, "stage": 2,
     "label": "Competitor Landscape", "insight": ""},
    {"id": "n_regulatory", "type": "scan", "trace_stage": "scan_outside", "row": 2, "stage": 2,
     "label": "Regulatory Environment", "insight": ""},
    {"id": "n_gate1", "type": "gate", "trace_stage": "gate", "row": 0, "stage": 3,
     "label": "Outside favourable?", "insight": "Pass if demand, competition, and policy support entry."},
    {"id": "n_stop_exit", "type": "stop", "trace_stage": "stop", "row": 0, "stage": 3,
     "label": "STOP / EXIT", "insight": "External conditions do not support entry."},
    {"id": "n_strategy", "type": "analysis", "trace_stage": "analyse_internals", "row": 0, "stage": 4,
     "label": "Entry Strategy", "insight": ""},
    {"id": "n_finance", "type": "analysis", "trace_stage": "analyse_internals", "row": 1, "stage": 4,
     "label": "Financial Viability", "insight": ""},
    {"id": "n_gate2", "type": "gate", "trace_stage": "gate", "row": 0, "stage": 5,
     "label": "Can we make it work?", "insight": "Pass if strategy and unit economics are viable."},
    {"id": "n_stop_pivot", "type": "stop", "trace_stage": "stop", "row": 0, "stage": 5,
     "label": "STOP / PIVOT", "insight": "Internal feasibility insufficient — pivot or pause."},
    {"id": "n_entrant", "type": "identity", "trace_stage": "match_identity", "row": 0, "stage": 6,
     "label": "If we are a New Entrant", "insight": ""},
    {"id": "n_oem", "type": "identity", "trace_stage": "match_identity", "row": 1, "stage": 6,
     "label": "If we are an OEM / Fleet Owner", "insight": ""},
    {"id": "n_decision", "type": "decision", "trace_stage": "final_decision", "row": 0, "stage": 7,
     "label": "Enter Market with Innovation", "insight": ""},
    {"id": "n_review", "type": "review", "trace_stage": "review", "row": 0, "stage": 8,
     "label": "Re-evaluate when policy or tech shifts", "insight": "Review cycle trigger."},
]

TRACE_SKELETON_EDGES = [
    {"id": "e1", "source": "n_frame", "target": "n_market", "label": "", "branch": None, "style": "solid"},
    {"id": "e2", "source": "n_frame", "target": "n_competitor", "label": "", "branch": None, "style": "solid"},
    {"id": "e3", "source": "n_frame", "target": "n_regulatory", "label": "", "branch": None, "style": "solid"},
    {"id": "e4", "source": "n_market", "target": "n_gate1", "label": "", "branch": None, "style": "solid"},
    {"id": "e5", "source": "n_competitor", "target": "n_gate1", "label": "", "branch": None, "style": "solid"},
    {"id": "e6", "source": "n_regulatory", "target": "n_gate1", "label": "", "branch": None, "style": "solid"},
    {"id": "e7", "source": "n_gate1", "target": "n_strategy", "label": "Yes", "branch": "yes", "style": "solid"},
    {"id": "e8", "source": "n_gate1", "target": "n_stop_exit", "label": "No", "branch": "no", "style": "solid"},
    {"id": "e9", "source": "n_strategy", "target": "n_finance", "label": "", "branch": None, "style": "solid"},
    {"id": "e10", "source": "n_finance", "target": "n_gate2", "label": "", "branch": None, "style": "solid"},
    {"id": "e11", "source": "n_gate2", "target": "n_entrant", "label": "Yes", "branch": "yes", "style": "solid"},
    {"id": "e12", "source": "n_gate2", "target": "n_oem", "label": "Yes", "branch": "yes", "style": "solid"},
    {"id": "e13", "source": "n_gate2", "target": "n_stop_pivot", "label": "No", "branch": "no", "style": "solid"},
    {"id": "e14", "source": "n_entrant", "target": "n_decision", "label": "", "branch": None, "style": "dashed"},
    {"id": "e15", "source": "n_oem", "target": "n_decision", "label": "", "branch": None, "style": "dashed"},
    {"id": "e16", "source": "n_decision", "target": "n_review", "label": "", "branch": None, "style": "solid"},
]

STAGE_LABELS = {
    "frame": "FRAME",
    "scan_outside": "SCAN OUTSIDE",
    "gate": "GATE",
    "analyse_internals": "ANALYSE INTERNALS",
    "match_identity": "MATCH IDENTITY",
    "final_decision": "FINAL DECISION",
    "review": "REVIEW",
    "stop": "STOP",
}


def build_empty_trace_graph(query: str, graph_id: str, domain: str) -> dict:
    """Return a Trace graph with skeleton structure and empty explanations."""
    topic = query.rstrip("?").strip()
    if topic.lower().startswith("should we "):
        topic = topic[10:].strip()
    nodes = []
    for sk in TRACE_SKELETON_NODES:
        node = {**sk, "label": sk["label"].format(topic=topic) if "{topic}" in sk["label"] else sk["label"],
                "explanation": "", "assumptions": [], "citations": [], "status": "green"}
        nodes.append(node)
    return {
        "graph_id": graph_id,
        "query": query,
        "domain": domain,
        "nodes": nodes,
        "edges": [{**e, "explanation": ""} for e in TRACE_SKELETON_EDGES],
        "metadata": {"framework": "trace_v1", "planner_model": "", "reasoner_model": "", "created_at": "", "document_ids": []},
    }
