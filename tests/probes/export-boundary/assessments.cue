package probe
import "list"
assessments: [...{
 declared: true
 id: string & =~"^sec-[a-z0-9-]+$"
 kind: "lab" | "test" | "exam"
 title: string & !=""
 source: string
 containers: 1
 memberKinds: [..."BulletList" | "OrderedList"] & list.MinItems(1)
 memberSizes: [...1] & list.MinItems(1)
 items: [...string] & list.MinItems(1)
 _unique: true & list.UniqueItems(items)
}]
