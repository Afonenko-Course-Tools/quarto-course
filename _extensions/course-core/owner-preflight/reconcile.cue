package ownerpreflight

import (
	"list"
	"strings"
)

// Private attempt transport, not the public Course/Fragment educational schema.
#Attribute: {key: string, value: string}
#Parent: {id: string, classes: [...string], attributes: [...#Attribute]}
#Occurrence: {contentJson: string, id: string, classes: [...string], attributes: [...#Attribute], kind: string, ancestors: [...#Parent], order: int & >0}
#Document: {source: string & !="", owner: string & !="", occurrences: [...#Occurrence], assessment: string, assessmentFacts: {enabled: bool, chapterId: string, title: string, headers: [...{id: string, title: string}]}}
#Transport: {input: {mode: "inventory" | "reconcile", before: [...#Document], after: [...#Document]}}
input: #Transport.input
#Select: {
	document: #Document
	facts: [for x in document.occurrences
		if x.kind == "Div"
		if strings.HasPrefix(x.id, "exr-") || strings.HasPrefix(x.id, "sol-") || list.Contains(x.classes, "solution") || list.Contains(x.classes, "assessment-items") || len([for a in x.attributes if a.key == "course-role" {a}]) > 0 {
			identity: {
				id: x.id, kind: x.kind, classes: x.classes, attributes: x.attributes, ancestors: x.ancestors
				if list.Contains(x.classes, "assessment-items") {members: x.contentJson}
			}
			source: {rootQmd: document.source, owner: document.owner}
			occurrence: x.order
		}]
}

// Existing assessment.collect identity rule, applied to raw native facts.
#AssessmentIdentity: {
	document: #Document
	let f = document.assessmentFacts
	value: {
		if !f.enabled {enabled: false, id: "", title: "", route: "disabled"}
		if f.enabled {
			enabled: true
			if f.chapterId != "" {id: f.chapterId, title: f.title, route: "chapter"}
			if f.chapterId == "" && len(f.headers) > 0 {id: f.headers[0].id, title: f.headers[0].title, route: "header"}
			if f.chapterId == "" && len(f.headers) == 0 {id: "", title: "", route: "absent"}
		}
	}
}
_beforeGroups: [for d in input.before {#Select & {document: d}}]
_afterGroups: [for d in input.after {#Select & {document: d}}]
_before: [for g in _beforeGroups for f in g.facts {f}]
_after: [for g in _afterGroups for f in g.facts {f}]
report: {
	diagnostics: [
		for i, b in _before for j, c in _before
		if j > i && b.identity.id != "" && b.identity.id == c.identity.id {
			code: "CORE.DUPLICATE_DECLARATION", severity: "error", phase: "inventory", source: c.source, id: c.identity.id, field: "id", related: [b.source]
		},
		if input.mode == "reconcile"
		for a in _after
		let matchingBefore = [for b in _before if a.source.rootQmd == b.source.rootQmd && a.source.owner == b.source.owner && list.Contains([b.identity], a.identity) {b}]
		let matchingAfter = [for b in _after if a.source.rootQmd == b.source.rootQmd && a.source.owner == b.source.owner && list.Contains([b.identity], a.identity) {b}]
		if len(matchingAfter) > len(matchingBefore) {
			code: "CORE.DECLARATION_ADDED_OR_CHANGED", severity: "error", phase: "reconciliation", source: a.source, id: a.identity.id, field: "declaration", related: [for b in _before if b.identity.id == a.identity.id {b.source}]
		},
		if input.mode == "reconcile"
		for b in _before
		let matchingBefore = [for a in _before if a.source.rootQmd == b.source.rootQmd && a.source.owner == b.source.owner && list.Contains([a.identity], b.identity) {a}]
		let matchingAfter = [for a in _after if a.source.rootQmd == b.source.rootQmd && a.source.owner == b.source.owner && list.Contains([a.identity], b.identity) {a}]
		if len(matchingBefore) > len(matchingAfter) {
			code: "CORE.DECLARATION_REMOVED_OR_CHANGED", severity: "error", phase: "reconciliation", source: b.source, id: b.identity.id, field: "declaration", related: []
		},
		if input.mode == "reconcile"
		for b in input.before for a in input.after if b.source == a.source
		let beforeIdentity = (#AssessmentIdentity & {document: b}).value
		let afterIdentity = (#AssessmentIdentity & {document: a}).value
		if beforeIdentity.enabled != afterIdentity.enabled || beforeIdentity.id != afterIdentity.id || beforeIdentity.title != afterIdentity.title || beforeIdentity.route != afterIdentity.route {
			code: "CORE.ASSESSMENT_IDENTITY_CHANGED", severity: "error", phase: "reconciliation", source: {rootQmd: a.source, owner: a.owner}, id: "", field: "assessment.identity", related: [{rootQmd: b.source, owner: b.owner}]
		},
		if input.mode == "reconcile"
		for b in input.before for a in input.after if b.source == a.source && b.assessment != a.assessment {
			code: "CORE.ASSESSMENT_METADATA_CHANGED", severity: "error", phase: "reconciliation", source: {rootQmd: a.source, owner: a.owner}, id: "", field: "assessment", related: [{rootQmd: b.source, owner: b.owner}]
		},
	]
}
