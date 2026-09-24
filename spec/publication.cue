package publication

// Independent publication contract; not part of the grading IR.
#Namespace: string & =~"^[A-Za-z][A-Za-z0-9_-]*$"
#Project: {
  path: string & !=""
  format: "html" | "revealjs"
  mount?: #Namespace
}
#Import: {file: string & !="", namespace: #Namespace, "base-url": string & =~"^https?://.*/$"}
#Publication: {
  namespace: #Namespace
  home?: #Namespace
  projects: {[#Namespace]: #Project}
  imports?: {[#Namespace]: #Import}
  if home != _|_ {
    projects: (home): {format: "html", mount?: _|_}
  }
}
