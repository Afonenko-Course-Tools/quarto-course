local visibility = require("./visibility")
local grading = require("./grading")
local exercises = require("./exercises")
local assessment = require("./assessment")
local output = require("./output")

return {{Pandoc = function(doc)
  if not doc.meta.course then return doc end
  output.invalidate()
  doc = grading.prepare(doc)
  doc = visibility.prepare(doc)
  local current = assessment.collect(doc)
  if current then doc.meta["course-assessment-id"] = pandoc.MetaString(current.id) end
  output.write({
    course = {id = pandoc.utils.stringify(doc.meta.course.id),
              schema = pandoc.utils.stringify(doc.meta.course.schema),
              view = doc.meta.course.view and pandoc.utils.stringify(doc.meta.course.view) or nil},
    exercises = exercises.collect(doc),
    assessment = current,
    downloads = pandoc.List()
  })
  return doc
end}}
