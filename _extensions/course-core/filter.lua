local visibility = require("./visibility")
local grading = require("./grading")
local exercises = require("./exercises")
local assessment = require("./assessment")
local output = require("./output")
local pedagogy = require("./pedagogy/collect")

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
    pedagogy = pedagogy.collect(doc),
    assessment = current,
    downloads = pandoc.List()
  })
  -- Presentation must not consume semantic attributes before they are saved.
  -- This document-local marker lets the optional renderer reject wrong order.
  doc.meta["course-core-processed"] = true
  return doc
end}}
