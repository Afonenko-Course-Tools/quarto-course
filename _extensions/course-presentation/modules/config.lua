-- Presentation is independent of course.view: profiles decide which content exists;
-- this module only decides how visible, already projected content is presented.
local M = {}
local function string(value) return value and pandoc.utils.stringify(value) or nil end
function M.read(meta)
  local input = meta["course-presentation"]
  if input == nil then input = {} end
  if type(input) ~= "table" or input.t == "MetaList" or input.t == "MetaInlines" then
    assert(false, "course-presentation must be a mapping with mode and/or answers")
  end
  for key, _ in pairs(input) do
    if key ~= "mode" and key ~= "answers" then
      assert(false, "Unknown course-presentation option: " .. tostring(key))
    end
  end
  local reveal = quarto.doc.is_format("revealjs")
  local html = reveal or quarto.doc.is_format("html")
  local mode = string(input.mode) or (reveal and "lecture" or "study")
  local answers = string(input.answers) or "auto"
  if mode ~= "lecture" and mode ~= "study" then
    assert(false, "course-presentation.mode must be lecture or study")
  end
  if answers ~= "auto" and answers ~= "expanded" then
    assert(false, "course-presentation.answers must be auto or expanded")
  end
  local lang = string(meta.lang) or "en"
  local pedagogy = meta["course-pedagogy"] or {}
  if type(pedagogy) ~= "table" then assert(false, "course-pedagogy must be a mapping") end
  return {mode = mode, answers = answers, reveal = reveal, html = html,
    ru = lang:match("^ru") ~= nil,
    defaults = pedagogy["document-defaults"] == true and {
      difficulty = string(meta.difficulty), time = string(meta.time),
      ["work-mode"] = string(meta["work-mode"])
    } or {}}
end
return M
