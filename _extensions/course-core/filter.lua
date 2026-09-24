local exercises = require("./exercises")
local assessment = require("./assessment")
local output = require("./output")

return {{Pandoc = function(doc)
  if not doc.meta.course then return doc end
  output.write({
    course = {id = pandoc.utils.stringify(doc.meta.course.id),
              schema = pandoc.utils.stringify(doc.meta.course.schema)},
    exercises = exercises.collect(doc),
    assessment = assessment.collect(doc)
  })
  return doc
end}}
