package probe
import "list"
packageData: {
 experimental: "p0-native-ast-v1"
 owner: string & =~"^[a-z][a-z0-9-]*$"
 release: string & !=""
 apiVersion: [...int]
 questions: [...{
  key: "\(owner)/\(id)"
  owner: string
  id: string & =~"^exr-[a-z0-9-]+$"
  source: string
  visibility: "public" | "closed"
  condition: [..._]
  publicAnswer: [..._]
  answerType: "manual" | "single-choice" | "numeric" | "multipart" | "matching"
  closedKey: _
  solution: [..._]
  gradingNotes: [..._]
 }]
 works: [...{key: "\(owner)/\(id)", owner: string, id: string & =~"^sec-[a-z0-9-]+$", source: string, kind: "lab" | "test" | "exam", title: string & !="", items: [...string] & list.MinItems(1), _unique: true & list.UniqueItems(items)}]
 resources: [..._]
 _keys: [for q in questions {q.key}]
 _unique: true & list.UniqueItems(_keys)
 _workKeys: [for w in works {w.key}]
 _uniqueWorks: true & list.UniqueItems(_workKeys)
 for w in works {for k in w.items {_references: "\(w.key)": "\(k)": true & list.Contains(_keys,k)}}
}
