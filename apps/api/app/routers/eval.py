from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
import json
import asyncio

from app.agents.eval_agent import eval_graph, revise_single_node
from app.db import get_db_session
from app.services.db_service import save_reasoning_graph

log = structlog.get_logger()
router = APIRouter()

class EvalGenerateRequest(BaseModel):
    query: str
    session_id: str | None = None


@router.post("/eval/generate")
@router.post("/trace/generate")
async def generate_trace(
    request: EvalGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    """Stream Trace generation progress and final graph."""
    session_id = request.session_id or "default"
    log.info("trace.generate.started", session_id=session_id)

    async def event_generator():
        try:
            initial_state = {"query": request.query, "session_id": session_id}
            final_graph = None

            yield f"data: {json.dumps({'status': 'planning', 'message': 'Building Trace structure...'})}\n\n"
            await asyncio.sleep(0.05)

            async for event in eval_graph.astream(initial_state):
                node_name = next(iter(event.keys()), "")
                node_result = event.get(node_name, {})

                if node_name == "planner" and not node_result.get("error"):
                    yield f"data: {json.dumps({'status': 'reasoning', 'message': 'Populating Trace nodes and gates...'})}\n\n"
                    await asyncio.sleep(0.05)

                if isinstance(node_result, dict):
                    if node_result.get("error"):
                        yield f"data: {json.dumps({'type': 'error', 'message': node_result['error']})}\n\n"
                    if node_result.get("graph_full"):
                        final_graph = node_result["graph_full"]

            if final_graph:
                # Send graph to client first — DB persistence must not block the canvas
                yield f"data: {json.dumps({'graph': final_graph})}\n\n"
                try:
                    await save_reasoning_graph(db, session_id, final_graph)
                except Exception as save_err:
                    log.warning(
                        "trace.save_skipped",
                        error=str(save_err),
                        hint="Postgres unavailable; graph was still returned to client",
                    )

            elif not final_graph:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Trace agents did not produce a graph. Check GROQ_API_KEY.'})}\n\n"

            yield "data: [DONE]\n\n"
            log.info("trace.generate.completed", session_id=session_id)

        except Exception as e:
            log.error("trace.generate.error", error=str(e), exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': f'Trace generation failed: {e}'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


class NodeReviseRequest(BaseModel):
    query: str
    session_id: str
    graph: dict
    node_id: str
    directive: str


@router.post("/eval/node/revise")
@router.post("/trace/node/revise")
async def api_revise_node(
    request: NodeReviseRequest,
    db: AsyncSession = Depends(get_db_session),
):
    log.info("trace.node.revise.started", node_id=request.node_id, directive=request.directive)
    try:
        updated_node = await revise_single_node(
            query=request.query,
            graph=request.graph,
            node_id=request.node_id,
            directive=request.directive,
        )
        return {"status": "success", "node": updated_node}
    except Exception as e:
        log.error("trace.node.revise.error", error=str(e), exc_info=True)
        return {"status": "error", "message": str(e)}
