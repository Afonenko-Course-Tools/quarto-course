import { Graph, alg as bundledAlgorithms } from "./vendor/graphlib.mjs";
// Minimal public API surface: the upstream minified bundle has no TS types.
const alg = bundledAlgorithms as {
  findCycles(g: unknown): string[][];
  dijkstra(g: unknown, source: string): Record<string, {distance: number; predecessor: string}>;
  isAcyclic(g: unknown): boolean;
  tarjan(g: unknown): string[][];
};
export interface Source {rootQmd: string; owner: string}
export interface Relation {from: string; to: string; kind: string; source: Source}
export function graphFacts(nodes: string[], relations: Relation[], kinds: string[] = ["required", "recommended"]): any[] {
  return [...new Set([...kinds, ...relations.map(r => r.kind)])].map(kind => {
    const graph = new Graph({directed: true, multigraph: true});
    for (const node of nodes) graph.setNode(node);
    relations.forEach((relation, index) => {
      if (relation.kind === kind) graph.setEdge(relation.from, relation.to, relation, String(index));
    });
    const cycles = alg.findCycles(graph);
    const witness: Relation[] = [];
    if (cycles.length) {
      const component = cycles[0];
      const edge = graph.edges().find((e: any) => component.includes(e.v) && component.includes(e.w));
      witness.push(graph.edge(edge));
      if (edge.v !== edge.w) {
        // SCC output is a set, not an edge chain. A library shortest path
        // closes a real edge; this adapter only maps predecessors to facts.
        const distances = alg.dijkstra(graph, edge.w);
        const returning: Relation[] = [];
        let cursor = edge.v;
        while (cursor !== edge.w) {
          const predecessor = distances[cursor].predecessor;
          const actual = graph.outEdges(predecessor, cursor)![0];
          returning.unshift(graph.edge(actual));
          cursor = predecessor;
        }
        witness.push(...returning);
      }
    }
    return {kind, nodes: graph.nodes(), acyclic: alg.isAcyclic(graph), scc: alg.tarjan(graph), witness, occurrenceCount: graph.edgeCount()};
  });
}
