package diagnostics

import "list"

// Experimental fact envelope. Educational values remain raw; only transport
// shape is strict. No production schema is replaced by this probe.
#Source: {rootQmd: string & !="", owner: string & !=""}
#Declaration: {id: string & !="", source: #Source, fields: {[string]: _}}
#Relation: {from: string, to: string, kind: string, source: #Source}
#GraphFact: {kind: string, nodes: [...string], witness: [...#Relation]}
#Transport: {
  input: {
    declarations: [...#Declaration]
    relations: [...#Relation]
    graphFacts: [...#GraphFact]
  }
}
input: #Transport.input

_ids: [for d in input.declarations {d.id}]
_allowedFields: ["difficulty"]
#Error: {
  severity: "error"
  phase: "validation"
  component: "cue"
  code: string
  classification: string
  message: string
  source: #Source
  id: string
  field: string
  related: [...#Source]
  witness?: [...#Relation]
}
report: {
  schemaVersion: "p0-diagnostic-probe-1"
  diagnostics: [
    for d in input.declarations
    if d.fields.difficulty == _|_ {
      #Error & {code: "CORE.REQUIRED_FIELD", classification: "CORE", message: "У упражнения отсутствует сложность", source: d.source, id: d.id, field: "difficulty", related: []}
    },
    for d in input.declarations
    for key, _ in d.fields
    if !list.Contains(_allowedFields, key) {
      #Error & {code: "SOURCE.UNKNOWN_EDUCATIONAL_FIELD", classification: "SOURCE", message: "Неизвестное учебное поле", source: d.source, id: d.id, field: key, related: []}
    },
    for i, first in input.declarations
    for j, second in input.declarations
    if j > i && first.id == second.id {
      #Error & {code: "CORE.DUPLICATE_ID", classification: "CORE", message: "Повторное объявление идентификатора", source: second.source, id: second.id, field: "id", related: [first.source]}
    },
    for r in input.relations
    if !list.Contains(_ids, r.to) {
      #Error & {code: "REF.UNKNOWN_TARGET", classification: "REF", message: "Неизвестная цель отношения", source: r.source, id: r.from, field: "to", related: []}
    },
    for i, first in input.relations
    for j, second in input.relations
    if j > i && first.from == second.from && first.to == second.to && first.kind != second.kind {
      #Error & {code: "GRAPH.RELATION_CONFLICT", classification: "GRAPH", message: "Противоречащие записи отношения", source: second.source, id: second.from, field: "kind", related: [first.source]}
    },
    for f in input.graphFacts
    if f.kind == "required" && len(f.witness) > 0 {
      #Error & {code: "GRAPH.STRONG_CYCLE", classification: "GRAPH", message: "Цикл обязательных предпосылок", source: f.witness[0].source, id: f.witness[0].from, field: "relations", related: [for r in f.witness {r.source}], witness: f.witness}
    },
  ]
}
