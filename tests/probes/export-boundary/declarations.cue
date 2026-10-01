package probe
import (
 "list"
 "strings"
)
declarations: [...{
 id: string
 let SolutionID = "sol-" + strings.TrimPrefix(id, "exr-")
 answers: [...{form: "yaml" | "choice"}] & list.MaxItems(1)
 solutions: [...{id: SolutionID}] & list.MaxItems(1)
}]
