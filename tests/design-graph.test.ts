import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanSchema, expectedAddition, placeNewNodes, readDesignGraph, validateEditPlan } from "../src/trigger/design-graph";

const original = {
  flow: {
    nodes: {
      primary: { id: "primary", type: "canvasNode", position: { x: 40, y: 60 }, width: 100, height: 80,
        data: { label: "Primary DB", shape: "cylinder", color: "#10233D", textColor: "#52A8FF" } },
      service: { id: "service", type: "canvasNode", position: { x: 280, y: 60 }, width: 160, height: 80,
        data: { label: "API", shape: "rectangle", color: "#1F1F1F", textColor: "#EDEDED" } },
    },
    edges: {
      link: { id: "link", type: "canvasEdge", source: "service", target: "primary", label: "writes" },
    },
  },
};

test("storage normalization preserves existing element fields and rejects corruption", () => {
  const graph = readDesignGraph(original);
  assert.deepEqual(graph.nodes[0], original.flow.nodes.primary);
  assert.deepEqual(graph.edges[0], original.flow.edges.link);
  assert.throws(() => readDesignGraph({ flow: { nodes: {}, edges: original.flow.edges } }), /missing endpoint/);
  assert.throws(() => readDesignGraph({ flow: { nodes: { wrong: original.flow.nodes.primary }, edges: {} } }), /malformed/);
});

test("one more database permits one connected node and rejects extras or unknown targets", () => {
  const graph = readDesignGraph(original);
  const plan = editPlanSchema.parse({ summary: "Add a database", addNodes: [
    { tempId: "db-2", label: "Replica", shape: "cylinder", color: "#10233D" },
  ], addEdges: [{ source: "primary", target: "db-2", label: "replication" }], updateNodes: [], updateEdges: [], clarifyingQuestion: null });
  assert.deepEqual(expectedAddition("add one more database"), { count: 1, type: "database" });
  assert.doesNotThrow(() => validateEditPlan(plan, graph, "add one more database"));
  assert.throws(() => validateEditPlan({ ...plan, addNodes: [...plan.addNodes, { ...plan.addNodes[0], tempId: "extra" }] }, graph, "add one more database"), /requested 1 database/);
  assert.throws(() => validateEditPlan({ ...plan, addEdges: [{ source: "missing", target: "db-2" }] }, graph, "add one more database"), /unknown endpoint/);
  assert.throws(() => validateEditPlan({ ...plan, updateNodes: [{ id: "service", label: "Different" }] }, graph, "add one more database"), /not identified|additive request/);
});

test("new placement avoids old bounds without changing existing nodes", () => {
  const graph = readDesignGraph(original);
  const before = JSON.stringify(graph);
  const plan = editPlanSchema.parse({ summary: "Add a database", addNodes: [
    { tempId: "db-2", label: "Replica", shape: "cylinder", color: "#10233D" },
  ], addEdges: [{ source: "primary", target: "db-2" }], updateNodes: [], updateEdges: [], clarifyingQuestion: null });
  const additions = placeNewNodes(plan, graph, "run-one");
  assert.equal(additions.length, 1);
  assert.equal(additions[0].width, 100);
  assert.ok(additions[0].position.x >= 140);
  assert.equal(JSON.stringify(graph), before);
  assert.deepEqual(placeNewNodes(plan, graph, "run-one"), additions);
});

test("a rename plan can touch only the identified node label", () => {
  const graph = readDesignGraph(original);
  const base = { summary: "Rename API", addNodes: [], addEdges: [], updateEdges: [], clarifyingQuestion: null };
  const valid = editPlanSchema.parse({ ...base, updateNodes: [{ id: "service", label: "Edge API" }] });
  assert.doesNotThrow(() => validateEditPlan(valid, graph, "Rename API to Edge API"));
  assert.throws(() => validateEditPlan({ ...valid, updateNodes: [{ id: "primary", label: "Different" }] }, graph, "Rename API to Edge API"), /not identified/);
  assert.throws(() => validateEditPlan({ ...valid, updateNodes: [{ id: "service", label: "Edge API", color: "#10233D" }] }, graph, "Rename API to Edge API"), /only change the label/);
});
