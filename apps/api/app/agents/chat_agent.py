"""Single-node LangGraph agent for Standard Chat."""
from typing import TypedDict, Annotated, AsyncGenerator, Sequence, Any
import operator
import json
from langgraph.graph import StateGraph, END
from app.services.llm import groq_client, GROQ_MODELS
import structlog

log = structlog.get_logger()

# Type for messages: list of dicts {"role": "user"|"assistant", "content": "..."}
class ChatState(TypedDict):
    messages: Annotated[Sequence[dict[str, Any]], operator.add]
    session_id: str
    image_base64: str | None


async def llm_node(state: ChatState):
    """Call the LLM and stream back the response."""
    log.debug("llm.node.start", session=state.get("session_id"))
    
    # Check if there is an image in the latest turn
    has_image = bool(state.get("image_base64"))
    model = GROQ_MODELS["vision"] if has_image else GROQ_MODELS["standard"]
    
    # We must format the latest user message to handle multimodal format if an image is present
    formatted_messages = list(state["messages"])
    if has_image and formatted_messages[-1]["role"] == "user":
        text_content = formatted_messages[-1]["content"]
        formatted_messages[-1]["content"] = [
            {"type": "text", "text": text_content},
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{state['image_base64']}"}
            }
        ]
    
    response_stream = await groq_client.chat.completions.create(
        model=model,
        messages=formatted_messages,
        temperature=0.7,
        stream=True,
    )
    
    full_response = ""
    async for chunk in response_stream:
        if chunk.choices and chunk.choices[0].delta.content:
            token = chunk.choices[0].delta.content
            full_response += token
            # Yield token for SSE
            yield {"token": token}
            
    # Final state update
    yield {"messages": [{"role": "assistant", "content": full_response}]}


def create_chat_graph():
    """Build and compile the standard chat graph."""
    graph = StateGraph(ChatState)
    graph.add_node("llm", llm_node)
    graph.set_entry_point("llm")
    graph.add_edge("llm", END)
    return graph.compile()


chat_graph = create_chat_graph()
