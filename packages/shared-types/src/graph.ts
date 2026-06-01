export type NodeType = 'analysis' | 'synthesis' | 'evidence' | 'recommendation';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  stage: number;
  insight: string;
  explanation: string;
  assumptions: string[];
  citations: string[]; // document IDs
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  explanation: string;
}

export interface ReasoningGraph {
  graph_id: string;
  query: string;
  domain: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    planner_model: string;
    reasoner_model: string;
    created_at: string;
    document_ids: string[];
  };
}
