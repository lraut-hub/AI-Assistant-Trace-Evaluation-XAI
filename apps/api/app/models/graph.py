"""Pydantic models for Trace reasoning graphs."""
from pydantic import BaseModel, Field
from typing import Literal, Optional

TraceStage = Literal[
    "frame",
    "scan_outside",
    "gate",
    "analyse_internals",
    "match_identity",
    "final_decision",
    "review",
    "stop",
]

NodeType = Literal[
    "frame",
    "scan",
    "gate",
    "analysis",
    "identity",
    "decision",
    "stop",
    "review",
]

StatusIndicator = Literal["green", "amber", "red", "pass", "pending", "neutral"]

class GraphNode(BaseModel):
    id: str = Field(description="Unique node id, e.g. 'n_frame'")
    label: str = Field(description="Short display name")
    type: NodeType = Field(description="Visual + semantic node type")
    trace_stage: TraceStage = Field(description="Trace framework stage container")
    row: int = Field(default=0, description="Vertical index within a parallel stage")
    insight: str = Field(description="One-line hover text (<= 120 chars)")
    status: StatusIndicator = Field(default="green", description="Traffic-light indicator on canvas")
    explanation: str = Field(default="", description="Full markdown for Detail Panel")
    assumptions: list[str] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    # Legacy field kept for report ordering
    stage: int = Field(default=1, description="Column order 1-8")

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str = ""
    branch: Optional[Literal["yes", "no"]] = None
    explanation: str = ""
    style: Literal["solid", "dashed"] = "solid"

class GraphMetadata(BaseModel):
    planner_model: str = ""
    reasoner_model: str = ""
    created_at: str = ""
    document_ids: list[str] = Field(default_factory=list)
    framework: str = "trace_v1"

class ReasoningGraph(BaseModel):
    graph_id: str
    query: str
    domain: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    metadata: GraphMetadata
