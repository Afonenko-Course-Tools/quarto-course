package course

import "list"

#Head: {kind: "Header", level: int & >=1 & <=6, title: string & !=""}
#Body: {"pandoc-api-version": [...int], meta: {...}, blocks: [..._]}
#Exercise: {
	id: string & =~"^exr-[a-z0-9][a-z0-9-]*$"
	target: string & !=""
	project: string
	head: #Head
	body: #Body
	gradingNotes?: [...#Body]
	nested: 0
	unknownAttributes: []
	source: string
	extensions: {[string]: _}
}
#Assessment: {
	id: string & =~"^sec-[a-z0-9][a-z0-9-]*$"
	kind: "lab" | "test" | "exam"
	title: string & !=""
	body: #Body
	items: [...string] & list.MinItems(1) & list.UniqueItems
	memberContainers: 1
	memberKinds: [("BulletList" | "OrderedList")]
	memberSizes: [...1]
	source: string
	extensions: {[string]: _}
}
#Source: {inline: string & !=""} | {file: string & =~"^/[^.]"}
#PedagogicalMetadata: {
	difficulty?: "introductory" | "intermediate" | "advanced"
	time?: int & >0 & <=1000000
	workMode?: "individual" | "pair" | "group"
	requirement?: "required" | "recommended" | "optional"
}
#PedagogicalElement: {
	kind: "exercise" | "solution" | "hint" | "demonstration" | "prediction" |
		"discussion" | "self-check" | "objectives" | "prerequisites" | "reading" |
		"takeaway" | "limitation" | "misconception" | "criteria" | "deliverables"
	id?: string & !=""
	if kind == "exercise" {id: string & =~"^exr-[a-z0-9][a-z0-9-]*$"}
	exercise?: string & =~"^exr-[a-z0-9][a-z0-9-]*$"
	title?: string
	metadata?: #PedagogicalMetadata
	if kind != "reading" {metadata?: {requirement?: _|_}}
	if kind != "exercise" && kind != "demonstration" && kind != "prediction" && kind != "discussion" && kind != "self-check" {
		metadata?: {difficulty?: _|_, time?: _|_, workMode?: _|_}
	}
	order: int & >0
	body: #Body
	source: string
}
#Pedagogy: {
	elements: [...#PedagogicalElement]
	documents?: [...{source: string, defaults: #PedagogicalMetadata & {requirement?: _|_}}]
	CORE006_uniquePedagogicalIds: [for e in elements if e.id != _|_ {"\(e.source)#\(e.id)"}] & list.UniqueItems
	CORE007_existingPedagogicalExercise: {
		for e in elements if e.exercise != _|_ {
			"\(e.source)/\(e.order)": list.Contains([
				for target in elements
				if target.source == e.source && target.id != _|_
				if target.kind == "exercise" || target.kind == "demonstration" || target.kind == "prediction" || target.kind == "discussion" || target.kind == "self-check" {target.id}
			], e.exercise) & true
		}
	}
}
#Course: {
	course: {id: string & =~"^[a-z][a-z0-9-]*$", view?: "student" | "full"}
	registeredTargets: [...string] & list.UniqueItems
	exercises: [...#Exercise]
	assessments: [...#Assessment]
	downloads?: [...{exercise: string, source: string}]
	pedagogy?: #Pedagogy
	CORE001_uniqueExerciseIds: [for e in exercises {e.id}] & list.UniqueItems
	CORE002_uniqueAssessmentIds: [for a in assessments {a.id}] & list.UniqueItems
	CORE003_registeredTargets: {
		for e in exercises {(e.id): list.Contains(registeredTargets, e.target) & true}
	}
	CORE004_existingMembers: {
		for a in assessments {
			for id in a.items {
				"\(a.id)/\(id)": list.Contains([for e in exercises {e.id}], id) & true
			}
		}
	}
	if downloads != _|_ {
		CORE005_existingDownloads: {
			for d in downloads {
				"\(d.source)/\(d.exercise)": list.Contains([
					for e in exercises if e.source == d.source && e.project != "" {e.id}
				], d.exercise) & true
			}
		}
	}
	for e in exercises if e.gradingNotes != _|_ {course: view: "full"}
}
