package publication

// Independent publication contract; not part of the grading IR.
#Namespace: string & =~"^[A-Za-z][A-Za-z0-9_-]*$"
#Project: {
  path: string & !=""
  format?: "html" | "revealjs"
  mount?: #Namespace
}
#Import: {file: string & !="", namespace: #Namespace, "base-url": string & =~"^https?://.*/$"}
#Publication: {
  namespace: #Namespace
  home?: #Namespace
  projects: {[#Namespace]: #Project}
  imports?: {[#Namespace]: #Import}
  if home != _|_ {
    projects: (home): {mount?: _|_}
    if home == "book" {projects: (home): {format: "html"}}
    // Only the conventional book namespace defaults to HTML at runtime.
    // Required-field syntax prevents CUE from inventing an omitted format.
    if home != "book" {projects: (home): {format!: "html"}}
  }
}
