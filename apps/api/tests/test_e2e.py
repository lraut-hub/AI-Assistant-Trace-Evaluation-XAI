"""Comprehensive end-to-end test of all AI Eval Canvas API capabilities."""
import asyncio
import httpx
import json

BASE = "http://localhost:8000/api/v1"
RESULTS = []

def ok(name, detail=""):
    RESULTS.append(("PASS", name, detail))
    print(f"  [PASS] {name}" + (f" — {detail}" if detail else ""))

def fail(name, detail=""):
    RESULTS.append(("FAIL", name, detail))
    print(f"  [FAIL] {name}" + (f" — {detail}" if detail else ""))

async def test_health(c):
    print("\n=== 1. Health Check ===")
    try:
        r = await c.get("http://localhost:8000/health")
        if r.status_code == 200:
            ok("Health endpoint", str(r.json()))
        else:
            fail("Health endpoint", f"status={r.status_code}")
    except Exception as e:
        fail("Health endpoint", str(e))

async def test_trace_generate(c):
    print("\n=== 2. Trace Generate (SSE stream) ===")
    graph = None
    try:
        async with c.stream("POST", f"{BASE}/trace/generate",
                            json={"query": "Should we enter the EV charging market in India?", "session_id": "test-e2e"},
                            timeout=90) as r:
            if r.status_code != 200:
                fail("Trace generate HTTP", f"status={r.status_code}")
                return None
            ok("Trace generate HTTP 200")

            buf = ""
            statuses = []
            async for chunk in r.aiter_bytes():
                buf += chunk.decode("utf-8", errors="replace")

            for line in buf.split("\n"):
                line = line.strip()
                if not line.startswith("data: "):
                    continue
                payload = line[6:].strip()
                if payload == "[DONE]":
                    ok("SSE [DONE] received")
                    continue
                try:
                    d = json.loads(payload)
                    if d.get("status"):
                        statuses.append(d["status"])
                    if "graph" in d:
                        graph = d["graph"]
                    if d.get("type") == "error":
                        fail("Trace agent error", d.get("message", ""))
                except Exception as e:
                    fail("SSE JSON parse", f"{e} | payload={payload[:80]}")

        if statuses:
            ok("SSE status events received", str(statuses))
        else:
            fail("SSE status events", "none received")

        if graph:
            nodes = graph.get("nodes", [])
            edges = graph.get("edges", [])
            ok("Graph returned", f"{len(nodes)} nodes, {len(edges)} edges")
            if len(nodes) >= 10:
                ok("Node count adequate", f"{len(nodes)} >= 10")
            else:
                fail("Node count low", f"only {len(nodes)} nodes")

            # Check required fields on nodes
            required_fields = ["id", "type", "stage", "label", "insight"]
            missing_any = False
            for n in nodes:
                for f in required_fields:
                    if f not in n:
                        fail(f"Node missing field '{f}'", f"node id={n.get('id','?')}")
                        missing_any = True
                        break
            if not missing_any:
                ok("All nodes have required fields")

            # Check explanation field (needed for sidebar)
            with_explanation = [n for n in nodes if n.get("explanation")]
            ok("Nodes with explanation", f"{len(with_explanation)}/{len(nodes)}")
            if len(with_explanation) == 0:
                fail("explanation field missing on ALL nodes", "sidebar will show empty")

        else:
            fail("Graph not returned", "graphData will be null in frontend")

    except Exception as e:
        fail("Trace generate exception", str(e))

    return graph

async def test_node_revise(c, graph):
    print("\n=== 3. Node Revise ===")
    if not graph:
        fail("Node revise skipped", "no graph from previous test")
        return

    nodes = graph.get("nodes", [])
    target = next((n for n in nodes if n.get("type") not in ("gate", "stop")), None)
    if not target:
        fail("Node revise", "no suitable node found")
        return

    try:
        r = await c.post(f"{BASE}/trace/node/revise", json={
            "query": "EV charging market India",
            "session_id": "test-e2e",
            "graph": graph,
            "node_id": target["id"],
            "directive": "Expand on this reasoning with more detail."
        }, timeout=60)
        if r.status_code != 200:
            fail("Node revise HTTP", f"status={r.status_code}")
            return
        data = r.json()
        if data.get("status") == "success" and data.get("node"):
            node = data["node"]
            ok("Node revise success", f"id={node.get('id')}")
            if node.get("explanation"):
                ok("Revised node has explanation")
            else:
                fail("Revised node missing explanation")
        else:
            fail("Node revise response", str(data)[:200])
    except Exception as e:
        fail("Node revise exception", str(e))

async def test_report(c, graph):
    print("\n=== 4. Full Analysis Report ===")
    if not graph:
        fail("Report skipped", "no graph")
        return

    try:
        r = await c.post(f"{BASE}/trace/report", json={
            "query": "Should we enter the EV charging market in India?",
            "graph": graph
        }, timeout=60)
        if r.status_code != 200:
            fail("Report HTTP", f"status={r.status_code}")
            return
        data = r.json()
        report = data.get("report", "")
        if len(report) > 200:
            ok("Report generated", f"{len(report)} chars")
            # Check for markdown structure
            if "##" in report or "**" in report:
                ok("Report has markdown formatting")
            else:
                fail("Report lacks markdown", "may be plain text only")
        else:
            fail("Report too short", f"only {len(report)} chars: {report[:100]}")
    except Exception as e:
        fail("Report exception", str(e))

async def test_chat(c):
    print("\n=== 5. Standard Chat ===")
    try:
        # Chat uses SSE stream endpoint
        async with c.stream("POST", f"{BASE}/chat/stream",
                            json={"message": "Hello, what can you help me with?", "session_id": "test-chat"},
                            timeout=30) as r:
            if r.status_code == 200:
                ok("Chat /chat/stream HTTP 200")
                buf = ""
                async for chunk in r.aiter_bytes():
                    buf += chunk.decode("utf-8", errors="replace")
                tokens = []
                for line in buf.split("\n"):
                    line = line.strip()
                    if line.startswith("data: ") and line[6:] != "[DONE]":
                        try:
                            d = json.loads(line[6:])
                            if d.get("type") == "token":
                                tokens.append(d["content"])
                        except: pass
                if tokens:
                    ok("Chat received token stream", f"{len(tokens)} tokens")
                else:
                    fail("Chat no tokens received", "empty response")
            else:
                fail("Chat HTTP", f"status={r.status_code}")
    except Exception as e:
        fail("Chat exception", str(e))

async def test_sessions(c):
    print("\n=== 6. Sessions ===")
    try:
        r = await c.get(f"{BASE}/sessions", timeout=10)
        if r.status_code in (200, 404):
            ok("Sessions endpoint reachable", f"status={r.status_code}")
        else:
            fail("Sessions endpoint", f"status={r.status_code}")
    except Exception as e:
        fail("Sessions exception", str(e))

async def main():
    print("=" * 55)
    print("  AI Eval Canvas — Full Capability Test")
    print("=" * 55)

    async with httpx.AsyncClient(timeout=90) as c:
        await test_health(c)
        graph = await test_trace_generate(c)
        await test_node_revise(c, graph)
        await test_report(c, graph)
        await test_chat(c)
        await test_sessions(c)

    print("\n" + "=" * 55)
    passed = sum(1 for r in RESULTS if r[0] == "PASS")
    failed = sum(1 for r in RESULTS if r[0] == "FAIL")
    print(f"  TOTAL: {passed} passed, {failed} failed out of {len(RESULTS)} checks")
    print("=" * 55)

    if failed:
        print("\nFailed checks:")
        for r in RESULTS:
            if r[0] == "FAIL":
                print(f"  ✗ {r[1]}: {r[2]}")

asyncio.run(main())
