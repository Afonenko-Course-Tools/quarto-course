local downloads = require("./downloads")
local output = require("./output")
return {{Pandoc = function(doc)
  if not doc.meta.course then return doc end
  local root = assert(quarto.project.directory, "A Quarto project is required")
  local input = quarto.doc.input_file
  if pandoc.path.is_relative(input) then input = pandoc.path.join({root, input}) end
  local source = pandoc.path.make_relative(input, root)
  local filename = root .. "/_generated/course-spec/core/" .. pandoc.utils.sha1(source) .. ".json"
  local file = assert(io.open(filename, "r"), "Missing core fragment before download resolution")
  local fragment = pandoc.json.decode(file:read("*a")); file:close()
  doc, fragment.downloads = downloads.resolve(doc, fragment.exercises)
  output.write(fragment)
  return doc
end}}
