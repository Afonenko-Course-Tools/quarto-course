local M = {}
local function contains(classes, name)
  for _, value in ipairs(classes) do if value == name then return true end end
  return false
end
function M.resolve(doc, extracted)
  local exercises, requests, seen = {}, pandoc.List(), {}
  for _, exercise in ipairs(extracted or {}) do exercises[exercise.id] = exercise end
  local root = assert(quarto.project.directory, "Требуется проект Quarto")
  local input = quarto.doc.input_file
  if pandoc.path.is_relative(input) then input = pandoc.path.join({root, input}) end
  local source = pandoc.path.make_relative(input, root)
  local _, depth = source:gsub("[/\\]", "")
  local prefix = string.rep("../", depth)
  doc = doc:walk({Span = function(span)
    if not contains(span.classes, "course-project-download") then return end
    local id = span.attributes.exercise
    local exercise = exercises[id]
    assert(exercise, "project-download должен ссылаться на видимое задание текущего документа: " .. id)
    assert(exercise.project and exercise.project ~= "", "Для скачивания задания требуется атрибут project: " .. id)
    assert(doc.meta.course and doc.meta.course.validate and pandoc.utils.stringify(doc.meta.course.validate) == "true",
      "Для project-download требуется course.validate: true")
    if not seen[id] then requests:insert({exercise = id}); seen[id] = true end
    local href = prefix .. "_downloads/" .. id .. ".zip"
    return pandoc.Link(span.content, href, "", pandoc.Attr("", {"project-download"}, {download = ""}))
  end})
  return doc, requests
end
return M
