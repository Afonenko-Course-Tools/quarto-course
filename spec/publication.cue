package publication

import (
  "list"
  "struct"
)

// Издательский контракт независим от модели оценивания.
#Namespace: string & =~"^[A-Za-z][A-Za-z0-9_-]*$"
#Project: {
  path: string & !=""
  format?: "html" | "revealjs"
  mount?: #Namespace
}
#Import: {
  source: string & !=""
  namespace: #Namespace
  "base-url": string & =~"^https?://.*/$"
  title?: string & !=""
  style?: "default" | "number" | "title" | "external"
}
#Publication: {
  namespace?: #Namespace
  home?: #Namespace
  projects: {[#Namespace]: #Project} & struct.MinFields(1)
  imports?: {[#Namespace]: #Import}
  exports?: {[#Namespace]: "*" | ([...string & =~"^[^\\s:#]+$"] & list.UniqueItems)}
  publication?: {title: string & !=""}
  if exports != _|_ {
    QRC002_localExports: {
      for name, _ in exports {
        "\(name)": list.Contains([for localName, _ in projects {localName}], name) & true
      }
    }
  }
  if imports != _|_ {
    QRC003_distinctImportNames: {
      for name, _ in imports {
        "\(name)": list.Contains([for localName, _ in projects {localName}], name) & false
      }
    }
  }
  if home != _|_ {
    projects: (home)!: {mount?: _|_}
    if home == "book" {projects: (home): {format: "html"}}
    // Только пространство имён book получает HTML по умолчанию.
    // Обязательное поле не позволяет CUE вывести отсутствующий format.
    if home != "book" {projects: (home): {format!: "html"}}
  }
}
