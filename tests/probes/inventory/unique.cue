package probe
import "list"
#Inventory: {
  occurrences: [...{id: string, kind: string, ...}]
  _ids: [for x in occurrences if x.id != "" {x.id}]
  _unique: list.UniqueItems(_ids) & true
  ...
}
