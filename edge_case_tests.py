import asyncio
import sys
import json
from httpx import AsyncClient
import uvicorn
import threading

# Add backend app to path
import sys
import os
sys.path.append(os.path.abspath('apps/api'))

from app.main import app

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8081, log_level="warning")

async def test_edge_cases():
    print("Starting Edge Case Tests for AI Eval Canvas Backend...")
    print("="*60)
    
    async with AsyncClient(app=app, base_url="http://testserver") as client:
        
        # --- Improvement 3: Improved Full Analysis Output ---
        print("\n[Improvement 3: Full Analysis Output]")
        
        # Edge Case 3.1: Missing fields in the graph nodes
        print("  Running EC 3.1: Missing fields in graph nodes...")
        malformed_graph = {
            "nodes": [
                {"id": "1", "label": "Node without insights or assumptions"}
                # No insight, no explanation, no assumptions, no citations
            ]
        }
        res_3_1 = await client.post("/api/v1/trace/report", json={"query": "Test missing fields", "graph": malformed_graph})
        
        # Determine success
        if res_3_1.status_code == 200 and "report" in res_3_1.json():
            report_content = res_3_1.json()["report"]
            if "Node without insights" in report_content and "References" in report_content:
                print("  -> PASS: Backend gracefully handles missing fields and uses fallback or LLM correctly.")
            else:
                print("  -> FAIL: Report generated but missing expected structure.")
        else:
            print(f"  -> FAIL: Status {res_3_1.status_code}")

        # Edge Case 3.2: Extremely large graph input (simulated)
        print("  Running EC 3.2: Extremely large graph input (potential token limit)...")
        large_node_text = "A" * 15000  # ~5000 tokens
        large_graph = {
            "nodes": [
                {"id": "1", "label": "Huge Node", "explanation": large_node_text}
            ]
        }
        res_3_2 = await client.post("/api/v1/trace/report", json={"query": "Test large graph", "graph": large_graph})
        if res_3_2.status_code == 200:
            print("  -> PASS: Backend truncates or handles large inputs gracefully.")
        else:
            print(f"  -> FAIL: Status {res_3_2.status_code}")


        # --- Improvement 4: Continuous Conversational Evaluation ---
        print("\n[Improvement 4: Continuous Conversational Evaluation]")
        
        # Edge Case 4.1: Empty conversation history
        print("  Running EC 4.1: Classify with empty history...")
        res_4_1 = await client.post("/api/v1/eval/classify", json={"query": "Hello?", "conversation_history": []})
        if res_4_1.status_code == 200:
            data = res_4_1.json()
            if data["type"] == "new_topic":
                print(f"  -> PASS: Correctly classified empty history as 'new_topic'. (Confidence: {data['confidence']})")
            else:
                print(f"  -> FAIL: Incorrect classification '{data['type']}'")
        else:
            print(f"  -> FAIL: Status {res_4_1.status_code}")
            
        # Edge Case 4.2: Nonsense / Gibberish query
        print("  Running EC 4.2: Classify nonsense/gibberish query...")
        nonsense_history = [{"role": "user", "content": "Let's analyze SaaS pricing"}]
        res_4_2 = await client.post("/api/v1/eval/classify", json={"query": "!!!@#@#$^$&%$&", "conversation_history": nonsense_history})
        if res_4_2.status_code == 200:
            data = res_4_2.json()
            print(f"  -> PASS: Handled nonsense gracefully. Classified as: {data['type']} (Confidence: {data['confidence']})")
        else:
            print(f"  -> FAIL: Status {res_4_2.status_code}")

    print("\n" + "="*60)
    print("Backend tests complete.")

if __name__ == "__main__":
    asyncio.run(test_edge_cases())
