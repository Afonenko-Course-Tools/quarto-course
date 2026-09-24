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
#Course: {
	schema: "1.0"
	course: {id: string & =~"^[a-z][a-z0-9-]*$"}
	registeredTargets: [...string] & list.UniqueItems
	exercises: [...#Exercise]
	assessments: [...#Assessment]
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
}
